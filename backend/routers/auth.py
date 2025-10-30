# backend/routers/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy import text
from db import get_engine
import hashlib

router = APIRouter()

# 비밀번호 해시 함수
def _hash_pw(password: str, salt: str) -> str:
    return hashlib.sha256((salt + "|" + password).encode("utf-8")).hexdigest()

class SignupRequest(BaseModel):
    email: str
    fullName: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# ✅ 회원가입 API
@router.post("/signup")
def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자리 이상이어야 합니다.")

    salt = hashlib.sha1(req.email.encode("utf-8")).hexdigest()[:8]
    pw_hash = _hash_pw(req.password, salt)

    q = text("""
        INSERT INTO users (email, name, pw_hash, salt, status, last_login_at, created_at, updated_at)
        VALUES (:email, :name, :pw_hash, :salt, :status, :last_login_at, :created_at, :updated_at)
    """)

    try:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        with get_engine().begin() as conn:
            conn.execute(q, {
                "email": req.email.strip().lower(),
                "name": req.fullName.strip(),
                "pw_hash": pw_hash,
                "salt": salt,
                "status": "active",
                "last_login_at": None,
                "created_at": now,
                "updated_at": now,
            })
        return {"success": True, "message": "회원가입 성공"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"회원가입 실패: {str(e)}")

# ✅ 로그인 API
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

    # ✅ 로그인 성공 → last_login_at 갱신
    with get_engine().begin() as conn:
        conn.execute(
            text("UPDATE users SET last_login_at = NOW() WHERE id = :id"),
            {"id": row["id"]}
        )

    return {"success": True, "user": {"id": row["id"], "email": row["email"], "name": row["name"]}}