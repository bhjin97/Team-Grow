# backend/routers/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy import text
from db import get_engine
import hashlib

router = APIRouter()

# -------------------------------
# 공통 함수
# -------------------------------
def _hash_pw(password: str, salt: str) -> str:
    """비밀번호 해시"""
    return hashlib.sha256((salt + "|" + password).encode("utf-8")).hexdigest()

# -------------------------------
# 요청 모델
# -------------------------------
class SignupRequest(BaseModel):
    email: str
    fullName: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class FindPasswordRequest(BaseModel):
    name: str
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    newPassword: str

# -------------------------------
# ✅ 회원가입
# -------------------------------
@router.post("/signup")
def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자리 이상이어야 합니다.")

    salt = hashlib.sha1(req.email.encode("utf-8")).hexdigest()[:8]
    pw_hash = _hash_pw(req.password, salt)

    q = text("""
        INSERT INTO users (email, name, pw_hash, pw_plain, salt, status, last_login_at, created_at, updated_at)
        VALUES (:email, :name, :pw_hash, :pw_plain, :salt, :status, :last_login_at, :created_at, :updated_at)
    """)

    try:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        with get_engine().begin() as conn:
            conn.execute(q, {
                "email": req.email.strip().lower(),
                "name": req.fullName.strip(),
                "pw_hash": pw_hash,
                "pw_plain": req.password,   # ⚠️ 원본 비밀번호 저장
                "salt": salt,
                "status": "active",
                "last_login_at": None,
                "created_at": now,
                "updated_at": now,
            })
        return {"success": True, "message": "회원가입 성공"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"회원가입 실패: {str(e)}")

# -------------------------------
# ✅ 로그인
# -------------------------------
@router.post("/login")
def login(req: LoginRequest):
    with get_engine().connect() as conn:
        row = conn.execute(text("""
            SELECT id, email, name, pw_hash, salt
            FROM users WHERE email = :email LIMIT 1
        """), {"email": req.email}).mappings().fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="이메일 없음")

    if _hash_pw(req.password, row["salt"]) != row["pw_hash"]:
        raise HTTPException(status_code=401, detail="비밀번호 불일치")

    with get_engine().begin() as conn:
        conn.execute(
            text("UPDATE users SET last_login_at = NOW() WHERE id = :id"),
            {"id": row["id"]}
        )

    return {"success": True, "user": {"id": row["id"], "email": row["email"], "name": row["name"]}}

# -------------------------------
# ✅ 비밀번호 일부 표시
# -------------------------------
@router.post("/find_password")
def find_password(req: FindPasswordRequest):
    """이름 + 이메일로 검색 후 원래 비밀번호 일부 보여주기"""
    with get_engine().connect() as conn:
        user = conn.execute(text("""
            SELECT pw_plain FROM users WHERE email = :email AND name = :name
        """), {"email": req.email, "name": req.name}).mappings().fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="입력하신 정보와 일치하는 계정이 없습니다.")

    pw = user["pw_plain"]
    if len(pw) <= 3:
        masked = pw[0] + "*" * (len(pw) - 1)
    else:
        masked = pw[:2] + "*" * (len(pw) - 3) + pw[-1]

    return {"maskedPassword": masked}

# -------------------------------
# ✅ 비밀번호 재설정
# -------------------------------
@router.post("/reset_password")
def reset_password(req: ResetPasswordRequest):
    if len(req.newPassword) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자리 이상이어야 합니다.")

    with get_engine().connect() as conn:
        user = conn.execute(
            text("SELECT salt FROM users WHERE email = :email"),
            {"email": req.email}
        ).mappings().fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="이메일을 찾을 수 없습니다.")

    new_hash = _hash_pw(req.newPassword, user["salt"])

    with get_engine().begin() as conn:
        conn.execute(
            text("""
                UPDATE users
                SET pw_hash = :pw_hash,
                    pw_plain = :pw_plain,   -- ⚠️ 원본 비밀번호도 갱신
                    updated_at = NOW()
                WHERE email = :email
            """),
            {"pw_hash": new_hash, "pw_plain": req.newPassword, "email": req.email}
        )

    return {"success": True, "message": "비밀번호가 성공적으로 변경되었습니다."}
