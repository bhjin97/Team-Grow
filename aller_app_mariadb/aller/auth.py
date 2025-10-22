# aller/auth.py
import re, hashlib
from datetime import datetime
from typing import Tuple
from sqlalchemy import text
from .storage_sql import get_engine

# (옵션) 비밀번호 정책이 있으면 여기에 정의
# POLICY = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$")

def _hash_pw(password: str, salt: str) -> str:
    return hashlib.sha256((salt + "|" + password).encode("utf-8")).hexdigest()

def create_user(email: str, name: str, password: str) -> Tuple[bool, str]:
    email = (email or "").strip().lower()
    name  = (name or "").strip()
    if not email or not name or not password:
        return False, "이메일/이름/비밀번호를 모두 입력하세요."
    # if not POLICY.match(password):
    #     return False, "비밀번호는 8자 이상, 영문/숫자/특수문자를 포함해야 합니다."

    salt = hashlib.sha1(email.encode("utf-8")).hexdigest()[:8]
    pw_hash = _hash_pw(password, salt)
    q = text("""
        INSERT INTO users (email, name, pw_hash, salt, created_at, updated_at)
        VALUES (:email, :name, :pw_hash, :salt, :now, :now)
    """)

    try:
        with get_engine().begin() as conn:
            conn.execute(q, {
                "email": email, "name": name, "pw_hash": pw_hash, "salt": salt,
                "now": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            })
        return True, ""
    except Exception as e:
        # MySQL/MariaDB Duplicate Key: 1062
        code = None
        if hasattr(e, "orig") and hasattr(e.orig, "args") and e.orig.args:
            code = e.orig.args[0]
        if code == 1062:
            return False, "이미 등록된 이메일입니다."
        return False, f"저장 실패: {e}"

def login(email: str, password: str):
    email = (email or "").strip().lower()
    with get_engine().connect() as conn:
        row = conn.execute(text("""
            SELECT id, email, name, pw_hash, salt, status
            FROM users WHERE email = :email LIMIT 1
        """), {"email": email}).mappings().fetchone()
    if not row:
        return None
    if row["status"] != "active":
        return None
    if _hash_pw(password, row["salt"]) != row["pw_hash"]:
        return None
    with get_engine().begin() as conn:
        conn.execute(text("UPDATE users SET last_login_at = NOW() WHERE id = :id"),
                     {"id": row["id"]})
    return {"id": row["id"], "email": row["email"], "name": row["name"]}
