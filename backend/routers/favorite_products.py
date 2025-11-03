from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db import get_db
from models import UserFavoriteProduct
from datetime import datetime

router = APIRouter(prefix="/favorite_products", tags=["favorites"])

# 즐겨찾기 추가
@router.post("/")
def add_favorite(
    user_id: int = Query(...),
    product_id: int = Query(...),
    db: Session = Depends(get_db)
):
    existing = db.query(UserFavoriteProduct).filter_by(user_id=user_id, product_id=product_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 즐겨찾기에 추가된 상품입니다.")
    favorite = UserFavoriteProduct(user_id=user_id, product_id=product_id, created_at=datetime.utcnow())
    db.add(favorite)
    db.commit()
    return {"message": "즐겨찾기 추가 완료"}

# 즐겨찾기 해제
@router.delete("/")
def remove_favorite(
    user_id: int = Query(...),
    product_id: int = Query(...),
    db: Session = Depends(get_db)
):
    favorite = db.query(UserFavoriteProduct).filter_by(user_id=user_id, product_id=product_id).first()
    if not favorite:
        raise HTTPException(status_code=404, detail="즐겨찾기에 존재하지 않습니다.")
    db.delete(favorite)
    db.commit()
    return {"message": "즐겨찾기 해제 완료"}

# 사용자별 즐겨찾기 목록 조회
@router.get("/{user_id}")
def list_favorites(user_id: int, db: Session = Depends(get_db)):
    favorites = db.query(UserFavoriteProduct).filter_by(user_id=user_id).all()
    if not favorites:
        raise HTTPException(status_code=404, detail="즐겨찾기한 상품이 없습니다.")
    return [{"product_id": f.product_id, "created_at": f.created_at} for f in favorites]
