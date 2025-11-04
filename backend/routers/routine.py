from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/routine", tags=["routine"])

CATEGORY_ORDER = ["스킨/토너", "에센스/세럼/앰플", "로션", "크림"]

FOCUS_RULES = {
    ("여름", "아침"): ["가벼운", "산뜻"],
    ("여름", "저녁"): ["보습", "진정"],
    ("겨울", "아침"): ["보습", "보호막"],
    ("겨울", "저녁"): ["영양", "재생"]
}


@router.get("/recommend")
def recommend_routine(
    skin_type: str = Query(..., description="사용자 피부타입 (예: DRNT)"),
    season: str = Query(..., description="계절 (여름/겨울)"),
    time: str = Query(..., description="시간대 (아침/저녁)"),
    keywords: str = Query("", description="사용자가 직접 선택한 키워드 (쉼표 구분, 최대 2개)"),
    top_n: int = 1,
    db: Session = Depends(get_db)
):
    """
    스킨케어 루틴 추천 API
    - 제품 목록은 skincare_routine_product에서 가져옴
    - 리뷰 수는 product_data.review_count 기준
    - [수정] reason에는 키워드 중심의 추천 근거만 포함
    """

    # DB에서 상세 정보 추가 조회 (price_krw, capacity, product_url, rag_text)
    # rag_text는 이미 srp에 포함되어 있습니다.
    products = db.execute(text("""
        SELECT 
            srp.product_pid, srp.hash_id, srp.brand, srp.product_name, srp.rag_text, srp.category, srp.skin_type,
            pd.image_url, pd.review_count,
            pd.price_krw,      -- 가격
            pd.capacity,       -- 용량
            pd.product_url     -- 구매 URL
        FROM skincare_routine_product srp
        LEFT JOIN product_data pd 
            ON srp.product_name = pd.product_name
        WHERE srp.skin_type = :skin_type
    """), {"skin_type": skin_type}).mappings().all()

    products = [dict(p) for p in products]

    # 키워드 결정 (기존 로직 동일)
    if keywords:
        focus = [k.strip() for k in keywords.split(",") if k.strip()][:2]
    else:
        focus = FOCUS_RULES.get((season, time), [])

    results = []

    for step in CATEGORY_ORDER:
        candidates = [p for p in products if p["category"] == step]

        for c in candidates:
            c["matched_keywords"] = [f for f in focus if f in str(c["rag_text"])]

        filtered = [c for c in candidates if len(c["matched_keywords"]) > 0]
        if not filtered:
            filtered = candidates

        top = sorted(
            filtered,
            key=lambda x: x["review_count"] if x["review_count"] is not None else 0,
            reverse=True
        )[:top_n]

        for r in top:
            # ✅ reason에는 키워드만 기록
            if r["matched_keywords"]:
                reason = ", ".join(r["matched_keywords"])
            else:
                reason = ""

            # ✅ review_count는 별도 필드로 전달
            results.append({
                "step": step,
                "product_pid": r["product_pid"],
                "display_name": f"{r['brand']} - {r['product_name']}",
                "image_url": r["image_url"],
                "reason": reason,  # 키워드 기반 근거
                "review_count": r.get("review_count", 0),  # 별도 저장
                "price_krw": r.get("price_krw"),
                "capacity": r.get("capacity"),
                "product_url": r.get("product_url"),
                "description": r.get("rag_text")
            })

    return results
