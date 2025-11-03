from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from db import get_db
from models import UserFavoriteProduct

router = APIRouter(prefix="/favorite_products", tags=["favorites"])

# ───────────────────────────────────────────────
# 즐겨찾기 추가
# ───────────────────────────────────────────────
@router.post("/")
def add_favorite(
    user_id: int = Query(...),
    product_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    즐겨찾기 추가 (중복 방지)
    """
    existing = db.query(UserFavoriteProduct).filter_by(user_id=user_id, product_id=product_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 즐겨찾기에 추가된 상품입니다.")

    favorite = UserFavoriteProduct(
        user_id=user_id,
        product_id=product_id,
        created_at=datetime.utcnow()
    )
    db.add(favorite)
    db.commit()

    return {"message": "즐겨찾기 추가 완료"}


# ───────────────────────────────────────────────
# 즐겨찾기 해제
# ───────────────────────────────────────────────
@router.delete("/")
def remove_favorite(
    user_id: int = Query(...),
    product_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    즐겨찾기 해제
    """
    favorite = db.query(UserFavoriteProduct).filter_by(user_id=user_id, product_id=product_id).first()
    if not favorite:
        raise HTTPException(status_code=404, detail="즐겨찾기에 존재하지 않습니다.")

    db.delete(favorite)
    db.commit()

    return {"message": "즐겨찾기 해제 완료"}


# ───────────────────────────────────────────────
# 사용자별 즐겨찾기 목록 조회 (제품 상세 정보 포함)
# ───────────────────────────────────────────────
@router.get("/{user_id}")
def list_favorites(user_id: int, db: Session = Depends(get_db)):
    """
    사용자의 즐겨찾기 목록을 product_data와 JOIN하여 반환
    """
    query = text("""
        SELECT 
            p.pid AS product_id,
            p.brand,
            p.product_name,
            p.image_url,
            p.category,
            p.price_krw,
            p.review_count,
            ufp.created_at
        FROM user_favorite_products ufp
        JOIN product_data p ON ufp.product_id = p.pid
        WHERE ufp.user_id = :user_id
        ORDER BY ufp.created_at DESC
    """)

    result = db.execute(query, {"user_id": user_id}).fetchall()

    if not result:
        # 즐겨찾기가 비어 있을 때는 빈 리스트 반환 (404 대신)
        return []

    favorites = [
        {
            "product_id": row.product_id,
            "brand": row.brand,
            "product_name": row.product_name,
            "image_url": row.image_url,
            "category": row.category,
            "price_krw": row.price_krw,
            "review_count": row.review_count,
            "created_at": row.created_at,
        }
        for row in result
    ]

    return favorites
