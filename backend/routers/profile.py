# profile.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime
import os
import json
from dotenv import load_dotenv
import pymysql

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
)

# .env 로드
load_dotenv()


def get_conn():
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    database = os.getenv("DB_NAME")

    if not all([host, user, password, database]):
        raise RuntimeError("DB 환경변수가 없습니다. .env를 확인하세요.")

    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


# ---------------------------------------------------------------------
# 요청 바디
# ---------------------------------------------------------------------
class SkinDiagnosisIn(BaseModel):
    user_id: int
    skin_type_code: str
    # 프론트가 dict로 보내도, 문자열로 보내도 다 받자
    skin_axes_json: Union[str, dict]
    nickname: Optional[str] = None
    # 실제 테이블에는 birth_date가 있는데, 진단 저장할 때는 굳이 안 받기로 하자
    # 필요하면 Optional[str]로 추가해서 '2001-11-08' 형식으로 넣을 수 있음


# ---------------------------------------------------------------------
# 진단 결과 저장
# ---------------------------------------------------------------------
@router.post("/skin-diagnosis")
async def save_skin_diagnosis(payload: SkinDiagnosisIn):
    # 1) dict로 왔으면 JSON 문자열로 변환
    if isinstance(payload.skin_axes_json, dict):
        axes_str = json.dumps(payload.skin_axes_json, ensure_ascii=False)
    else:
        axes_str = payload.skin_axes_json

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 이 user_id가 이미 있는지 확인
            cur.execute(
                "SELECT user_id FROM user_profiles WHERE user_id = %s",
                (payload.user_id,),
            )
            row = cur.fetchone()
            now = datetime.now()

            if row:
                # 이미 있으면 UPDATE
                # 컬럼 이름들: skin_type_code, skin_axes_json, nickname, updated_at
                sql = """
                    UPDATE user_profiles
                       SET skin_type_code = %s,
                           skin_axes_json = %s,
                           updated_at = %s
                     WHERE user_id = %s
                """
                cur.execute(
                    sql,
                    (
                        payload.skin_type_code,
                        axes_str,
                        now,
                        payload.user_id,
                    ),
                )
                # nickname이 들어온 경우에만 별도로 업데이트
                if payload.nickname:
                    cur.execute(
                        "UPDATE user_profiles SET nickname = %s, updated_at = %s WHERE user_id = %s",
                        (payload.nickname, now, payload.user_id),
                    )
            else:
                # 없으면 INSERT
                # 실제 컬럼: (user_id, nickname, name, birth_date, gender, skin_type_code, skin_axes_json, ..., created_at, updated_at)
                # 여기서는 우리가 아는 컬럼만 넣자.
                sql = """
                    INSERT INTO user_profiles
                        (user_id, nickname, skin_type_code, skin_axes_json, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """
                cur.execute(
                    sql,
                    (
                        payload.user_id,
                        payload.nickname or f"user{payload.user_id}",
                        payload.skin_type_code,
                        axes_str,
                        now,
                        now,
                    ),
                )
        conn.commit()
    except Exception as e:
        print("❌ save_skin_diagnosis error:", repr(e))
        raise HTTPException(status_code=500, detail="DB 저장 중 오류가 발생했습니다.")
    finally:
        conn.close()

    return {"ok": True, "message": "saved", "user_id": payload.user_id}


# ---------------------------------------------------------------------
# 프로필 조회
# ---------------------------------------------------------------------
@router.get("/{user_id}")
async def get_profile(user_id: int):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 실제 있는 컬럼만 SELECT
            cur.execute(
                """
                SELECT
                    user_id,
                    nickname,
                    name,
                    birth_date,
                    gender,
                    skin_type_code,
                    skin_axes_json,
                    preferences_json,
                    allergies_json,
                    last_quiz_at,
                    created_at,
                    updated_at
                FROM user_profiles
                WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
    except Exception as e:
        print("❌ get_profile error:", repr(e))
        raise HTTPException(status_code=500, detail="DB 조회 중 오류가 발생했습니다.")
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return row
