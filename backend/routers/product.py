from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/product", tags=["product"])

@router.get("/detail/{product_pid}")
def get_product_detail(product_pid: int, db: Session = Depends(get_db)):
    """
    제품 상세조회
    - skincare_routine_product 기준 조회 (루틴 추천)
    - 없을 경우 product_data_chain 기준으로 조회 (챗봇 추천)
      + product_data 조인으로 상세정보 보강
    """

    # 1️⃣ 스킨케어 루틴 기준 우선 조회
    query_routine = text("""
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
    result = db.execute(query_routine, {"pid": product_pid}).mappings().first()

    # 2️⃣ 루틴 데이터 없으면 product_data_chain 기준 JOIN
    if not result:
        query_chat = text("""
            SELECT 
                pc.pid AS product_pid,
                pc.brand,
                pc.product_name,
                pc.category,
                pc.rag_text,
                pd.image_url,
                pd.review_count,
                pd.price_krw,
                pd.capacity,
                pd.product_url
            FROM product_data_chain pc
            LEFT JOIN product_data pd
                ON pc.pid = pd.pid
            WHERE pc.pid = :pid
            LIMIT 1
        """)
        result = db.execute(query_chat, {"pid": product_pid}).mappings().first()

        if not result:
            raise HTTPException(status_code=404, detail="해당 제품을 찾을 수 없습니다.")

    # ✅ 프론트 구조에 맞게 반환
    return {
        "product_pid": result["product_pid"],
        "display_name": f"{result['brand']} - {result['product_name']}",
        "brand": result["brand"],
        "category": result["category"],
        "skin_type": result.get("skin_type"),
        "image_url": result.get("image_url"),
        "price_krw": result.get("price_krw"),
        "capacity": result.get("capacity") or "용량 정보 없음",
        "product_url": result.get("product_url"),
        "description": result.get("rag_text") or "제품 설명이 없습니다.",
        "review_count": result.get("review_count"),
    }
