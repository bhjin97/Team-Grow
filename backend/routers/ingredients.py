from fastapi import APIRouter, Depends, Query
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session, load_only
from sqlalchemy import or_, and_, not_

from db import get_db
from models import Ingredient

router = APIRouter(prefix="/ingredients", tags=["ingredients"])

HARD_CAP = 100
DEFAULT_LIMIT = 20

def lite(r: Ingredient) -> Dict[str, Any]:
    return {
        "id": r.id,
        "korean_name": r.korean_name,
        "english_name": r.english_name,
        "description": r.description,    
        "caution_grade": r.caution_grade,
    }

@router.get("/search")
def search_ingredients(
    q: str = Query(..., min_length=1),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=HARD_CAP),
    cursor: Optional[int] = Query(None, description="이전 페이지 마지막 id"),
    db: Session = Depends(get_db),
):
    """
    단일 검색 API
    - 검색 조건: korean_name, english_name만 사용 (description 미포함)
    - 커서 페이지네이션(id > cursor)
    - 응답: {items, next_cursor, has_more} (items에 description 포함)
    """
    key = q.strip()
    if not key:
        return {"items": [], "next_cursor": None, "has_more": False}

    prefix = f"{key}%"
    contains = f"%{key}%"
    base = True if not cursor else and_(Ingredient.id > cursor)

    # 1) prefix (인덱스 활용) — description은 검색에 사용하지 않음
    q1 = (
        db.query(Ingredient)
        .filter(and_(base, or_(Ingredient.korean_name.like(prefix),
                               Ingredient.english_name.like(prefix))))
        .options(load_only(
            Ingredient.id, Ingredient.korean_name,
            Ingredient.english_name, Ingredient.description,  # 응답에 싣기 위해 로드
            Ingredient.caution_grade
        ))
        .order_by(Ingredient.id.asc())
        .limit(limit + 1)
    )
    rows1 = q1.all()
    picked = {r.id for r in rows1[:limit]}

    if len(rows1) >= limit + 1:
        items = [lite(r) for r in rows1[:limit]]
        return {"items": items, "next_cursor": items[-1]["id"], "has_more": True}

    # 2) contains 보강 — 여기도 description은 검색 조건에서 제외
    remain = limit - len(rows1)
    if remain > 0:
        q2 = (
            db.query(Ingredient)
            .filter(and_(
                base,
                or_(Ingredient.korean_name.like(contains),
                    Ingredient.english_name.like(contains)),
                not_(Ingredient.id.in_(picked)) if picked else True,
            ))
            .options(load_only(
                Ingredient.id, Ingredient.korean_name,
                Ingredient.english_name, Ingredient.description,  # 응답용
                Ingredient.caution_grade
            ))
            .order_by(Ingredient.id.asc())
            .limit(remain + 1)
        )
        rows2 = q2.all()
    else:
        rows2 = []

    merged = rows1[:limit] + rows2[:remain]
    has_more = len(rows2) > remain

    items = [lite(r) for r in merged]
    next_cursor = items[-1]["id"] if items else cursor
    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}
