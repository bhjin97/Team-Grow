from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/product", tags=["product"])


@router.get("/detail/{product_pid}")
def get_product_detail(product_pid: int, db: Session = Depends(get_db)):
    """
    단일 제품 상세정보 조회 API
    - skincare_routine_product(srp) 기준으로 조회
    - product_data(pd)와 LEFT JOIN하여 상세정보 가져오기
    """

    query = text("""
        SELECT 
            srp.product_pid,
            srp.hash_id,
            srp.brand,
            srp.product_name,
            srp.category,
            srp.skin_type,
            srp.rag_text,
            pd.image_url,
            pd.review_count,
            pd.price_krw,
            pd.capacity,
            pd.product_url
        FROM skincare_routine_product srp
        LEFT JOIN product_data pd 
            ON srp.product_name = pd.product_name
        WHERE srp.product_pid = :pid
        LIMIT 1
    """)

    result = db.execute(query, {"pid": product_pid}).mappings().first()

    if not result:
        raise HTTPException(status_code=404, detail="해당 제품을 찾을 수 없습니다.")

    # ✅ 프론트 구조에 맞게 반환 정리
    return {
        "product_pid": result["product_pid"],
        "display_name": f"{result['brand']} - {result['product_name']}",
        "brand": result["brand"],
        "category": result["category"],
        "skin_type": result.get("skin_type"),
        "image_url": result.get("image_url"),
        "price_krw": result.get("price_krw"),
        "capacity": result.get("capacity"),
        "product_url": result.get("product_url"),
        "description": result.get("rag_text") or "제품 설명이 없습니다.",
        "review_count": result.get("review_count"),
    }
