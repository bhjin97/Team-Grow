# api.py
import os
from typing import Dict, Any, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()  # .env 로드

# ─────────────────────────────────────────────────────────
# DB 연결 문자열: DB_URI 우선, 없으면 개별 환경변수로 조합
# ─────────────────────────────────────────────────────────
DB_URI = os.getenv("DB_URI")
if not DB_URI:
    DIALECT = os.getenv("DB_DIALECT", "mysql+pymysql")
    HOST = os.getenv("DB_HOST", "127.0.0.1")
    PORT = int(os.getenv("DB_PORT", "3306"))
    USER = os.getenv("DB_USER", "")
    PASSWORD = os.getenv("DB_PASSWORD", "")
    NAME = os.getenv("DB_NAME", "")
    DB_URI = f"{DIALECT}://{USER}:{PASSWORD}@{HOST}:{PORT}/{NAME}?charset=utf8mb4"

engine = create_engine(DB_URI, pool_pre_ping=True, pool_recycle=3600)

try:
    with engine.connect() as conn:
        print("✅ DB 연결 성공:", conn.engine.url)
except Exception as e:
    print("❌ DB 연결 실패:", e)

# ─────────────────────────────────────────────────────────
# FastAPI 앱
# ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Aller Skin Diagnosis API",
    description="피부타입 진단 결과를 MariaDB에 저장하는 FastAPI 서비스",
    version="1.0.0",
)

# ─────────────────────────────────────────────────────────
# CORS (개발 환경)
# ─────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# 모델 (프런트/스트림릿 공통 포맷)
#   - user_id: 문자열/숫자 모두 허용 (프론트에서 email/uuid/숫자 등 유연)
#   - skin_axes_json: 프런트에서 JSON.stringify(...)로 보낸 문자열
# ─────────────────────────────────────────────────────────
class SkinDiagIn(BaseModel):
    user_id: Union[str, int]
    skin_type_code: str                 # 예: "ORNT"
    skin_axes_json: str                 # JSON 문자열 {"OD":{...}, "SR":{...}, ...}
    nickname: str | None = None
    birth_date: int | None = None
    gender: str | None = "na"

# ─────────────────────────────────────────────────────────
# 테이블 보장 (user_id를 VARCHAR로 통일)
#  - MariaDB JSON 타입 환경마다 제약이 있어 LONGTEXT로 저장(문자열 JSON)
# ─────────────────────────────────────────────────────────
@app.on_event("startup")
def ensure_profile_table():
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS profile (
          user_id VARCHAR(64) PRIMARY KEY,
          nickname VARCHAR(100),
          birth_date DATE,
          gender VARCHAR(10),
          skin_type_code CHAR(4),
          skin_axes_json LONGTEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))
    print("✅ profile 테이블 확인 또는 생성 완료.")

# ─────────────────────────────────────────────────────────
# 헬스체크
# ─────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True}

# ─────────────────────────────────────────────────────────
# 저장(업서트)
# ─────────────────────────────────────────────────────────
@app.post("/api/profile/skin-diagnosis")
def save_skin_diag(data: SkinDiagIn):
    try:
        # user_id를 항상 문자열로 저장 (VARCHAR(64)와 일치)
        uid = str(data.user_id)

        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO profile (user_id, nickname, birth_date, gender, skin_type_code, skin_axes_json, updated_at)
                VALUES (:uid, :nick, :by, :gender, :type_code, :axes, NOW())
                ON DUPLICATE KEY UPDATE
                  nickname = VALUES(nickname),
                  birth_date = VALUES(birth_date),
                  gender = VALUES(gender),
                  skin_type_code = VALUES(skin_type_code),
                  skin_axes_json = VALUES(skin_axes_json),
                  updated_at = NOW()
                """),
                dict(
                    uid=uid,
                    nick=data.nickname,
                    by=data.birth_date,
                    gender=(data.gender or "na"),
                    type_code=data.skin_type_code,
                    axes=data.skin_axes_json,  # 문자열(JSON) 그대로 저장
                )
            )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────
# 조회
# ─────────────────────────────────────────────────────────
@app.get("/api/profile/{user_id}")
def get_profile(user_id: str) -> Dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                SELECT user_id, nickname, birth_date, gender,
                       skin_type_code, skin_axes_json, updated_at
                FROM profile
                WHERE user_id = :uid
                LIMIT 1
            """),
            {"uid": str(user_id)}
        ).mappings().first()

    if not row:
        # 없으면 기본 응답
        return {"user_id": user_id, "skin_type_code": None, "skin_axes_json": None}
    return dict(row)
