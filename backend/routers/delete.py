# backend/routers/delete.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv
import os
import pymysql

load_dotenv()

router = APIRouter(
    prefix="/api/account",
    tags=["account"],
)

# --- DB 연결 유틸 ---
def get_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        db=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT") or 3306),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,  # 트랜잭션
    )

# --- 요청 바디 스키마 ---
class DeleteMeRequest(BaseModel):
    user_id: int = Field(..., description="현재 로그인한 사용자 id")
    confirm: str = Field(..., description='예: "DELETE 홍길동"')

@router.delete("/me", status_code=204)
def delete_me(body: DeleteMeRequest):
    """
    깃허브 스타일: 사용자가 'DELETE {사용자 이름}' 을 정확히 입력해야 삭제.
    삭제 순서: user_profiles -> users
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 사용자 이름 조회
            cur.execute("SELECT id, name FROM users WHERE id=%s", (body.user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

            expected = f"DELETE {row['name']}".strip()
            if body.confirm.strip() != expected:
                raise HTTPException(
                    status_code=400,
                    detail=f'확인 문구가 일치하지 않습니다. 정확히 "{expected}" 를 입력하세요.'
                )

            # 연관 데이터 먼저 삭제 (FK CASCADE가 없다는 가정)
            cur.execute("DELETE FROM user_profiles WHERE user_id=%s", (row["id"],))
            # 필요하면 이 아래에 다른 연관 테이블도 같이 정리
            # cur.execute("DELETE FROM favorite_product WHERE user_id=%s", (row["id"],))
            # cur.execute("DELETE FROM routine WHERE user_id=%s", (row["id"],))
            # cur.execute("DELETE FROM chat WHERE user_id=%s", (row["id"],))
            # ...

            # 마지막으로 users 삭제
            cur.execute("DELETE FROM users WHERE id=%s", (row["id"],))

        conn.commit()
        # 204 No Content
        return
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")
    finally:
        conn.close()
