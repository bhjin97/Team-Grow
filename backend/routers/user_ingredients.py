from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, AliasChoices
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError

try:
    from ..db import get_db
except ImportError:
    from db import get_db

router = APIRouter()  # prefix는 main.py에서 붙임

# ---- Schemas ----
class UserIngredientIn(BaseModel):
    userId: int = Field(validation_alias=AliasChoices("userId", "user_id", "uid"))
    koreanName: str = Field(validation_alias=AliasChoices("koreanName", "korean_name", "ingredientName"))
    # API 입력은 'preferred' | 'caution' 으로 받되, DB에는 'preference' | 'caution' 저장
    ingType: Literal["preferred", "caution"] = Field(validation_alias=AliasChoices("ingType", "ing_type", "type"))
    userName: Optional[str] = Field("", validation_alias=AliasChoices("userName", "user_name"))
    createAt: Optional[str] = Field(None, validation_alias=AliasChoices("createAt", "created_at"))
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra="ignore")

class UserIngredientOut(BaseModel):
    userId: int
    userName: str
    koreanName: str
    # API 응답은 'preferred' | 'caution' 유지
    ingType: Literal["preferred", "caution"]
    createAt: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# ---- helper exec ----
def _exec(db, sql, params=None):
    try:
        return db.execute(sql, params or {})
    except (OperationalError, ProgrammingError) as e:
        import logging
        log = logging.getLogger("sql")
        log.error("DB ERROR ORIG: %s", getattr(e, "orig", e))
        log.error("SQL: %s", sql.text if hasattr(sql, "text") else sql)
        log.error("PARAMS: %s", params)
        raise

@router.get("/__health")
def health(db: Session = Depends(get_db)):
    t = _exec(db, text("SHOW COLUMNS FROM `user_ingredients`")).mappings().all()
    return {"columns": [c["Field"] for c in t]}

# 목록
@router.get("", response_model=List[UserIngredientOut])
def list_user_ingredients(userId: int = Query(...), db: Session = Depends(get_db)):
    rows = _exec(db, text("""
        SELECT 
          `user_id`       AS userId,
          COALESCE(`user_name`, '') AS userName,
          `korean_name`   AS koreanName,
          `ing_type`      AS ingType_db,
          `created_at`    AS createAt
        FROM `user_ingredients`
        WHERE `user_id` = :uid
        ORDER BY `created_at` DESC
    """), {"uid": userId}).mappings().all()

    # DB 'preference' → API 'preferred' 로 변환
    out = []
    for r in rows:
        ing_type_api = "preferred" if r["ingType_db"] == "preference" else r["ingType_db"]
        out.append({
            "userId": r["userId"],
            "userName": r["userName"],
            "koreanName": r["koreanName"],
            "ingType": ing_type_api,
            "createAt": r["createAt"],
        })
    return out

# 1) 이미 존재 여부
@router.post("", response_model=UserIngredientOut)
def add_user_ingredient(p: UserIngredientIn, db: Session = Depends(get_db)):
    # API 값 → DB 값 매핑
    ing_type_db = "preference" if p.ingType == "preferred" else "caution"

    exists = _exec(db, text("""
        SELECT 1 FROM `user_ingredients`
        WHERE `user_id` = :u AND `korean_name` = :n AND `ing_type` = :t
        LIMIT 1
    """), {"u": p.userId, "n": p.koreanName, "t": ing_type_db}).first()
    if exists:
        raise HTTPException(409, "Already exists")
    
    # 2) user_name 자동 결정
    user_name = (p.userName or "").strip()
    if not user_name:
        # user_profiles.name 으로
        row = _exec(db, text("""
            SELECT `name` AS v FROM `user_profiles`
            WHERE `user_id` = :u LIMIT 1
        """), {"u": p.userId}).mappings().first()
        if row and row["v"]:
            user_name = row["v"]
        else:
            # users.name, 없으면 users.email
            row2 = _exec(db, text("""
                SELECT COALESCE(NULLIF(`name`,''), `email`) AS v
                FROM `users` WHERE `id` = :u LIMIT 1
            """), {"u": p.userId}).mappings().first()
            if row2 and row2["v"]:
                user_name = row2["v"]
            else:
                user_name = ""  # 최후의 보루
    
    # 3) INSERT
    _exec(db, text("""
        INSERT INTO `user_ingredients`
          (`user_id`, `user_name`, `korean_name`, `ing_type`, `created_at`)
        VALUES
          (:u, :un, :n, :t, NOW())
    """), {"u": p.userId, "un": p.userName or "", "n": p.koreanName, "t": ing_type_db})
    db.commit()

    return UserIngredientOut(
        userId=p.userId,
        userName=p.userName or "",
        koreanName=p.koreanName,
        ingType=p.ingType,        # 응답은 'preferred' 그대로
        createAt=None
    )

# 삭제 (이름 기준, 선택적으로 ingType으로 좁힘)
@router.delete("/{user_id}/{key}")
def delete_user_ingredient(
    user_id: int,
    key: str,                             # 숫자(id) 또는 한글 이름
    ingType: Optional[str] = Query(None), # 'preferred' | 'caution' (API값)
    db: Session = Depends(get_db),
):
    if ingType and ingType not in ("preferred", "caution"):
        raise HTTPException(400, "ingType must be 'preferred' or 'caution'")

    # API값 → DB값 매핑
    ing_type_clause = ""
    params = {"u": user_id}
    if ingType:
        params["t"] = "preference" if ingType == "preferred" else "caution"
        ing_type_clause = " AND `ing_type` = :t"

    # key가 숫자면 ingredients.id → korean_name 변환
    if key.isdigit():
        row = _exec(db, text("""
            SELECT `korean_name` AS n
            FROM `ingredients`
            WHERE `id` = :iid
            LIMIT 1
        """), {"iid": int(key)}).mappings().first()
        if not row or not row["n"]:
            raise HTTPException(404, "Ingredient id not found")
        korean_name = row["n"]
    else:
        korean_name = key

    res = _exec(db, text(f"""
        DELETE FROM `user_ingredients`
        WHERE `user_id` = :u AND `korean_name` = :n{ing_type_clause}
        LIMIT 1
    """), {"u": user_id, "n": korean_name, **({"t": params.get("t")} if "t" in params else {})})

    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
