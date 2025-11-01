# -*- coding: utf-8 -*-
from typing import List, Optional, Dict, Any, Tuple
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db  # 같은 프로젝트의 db.py

TBL_PRODUCT = "product_data"               # pid, hash_id, brand, product_name, review_count, category...
TBL_HISTORY = "product_review_history_tmp" # product_pid, period_start(date), review_count
TBL_CHAIN   = "product_data_chain"         # pid, rag_text

router = APIRouter(prefix="/api/trends", tags=["trends"])

# ------------------------------------------------------------
# 유틸: 최신 주차와 직전 주차(=A/B) 결정
# ------------------------------------------------------------
def _get_latest_and_prev_weeks(db: Session, b_date: Optional[str]) -> Tuple[date, date]:
    """
    product_review_history_tmp.period_start 에서
    - B(비교 기준): 요청값 없으면 최신 날짜. b_date == 'latest' 도 최신 처리
    - A(베이스): B 이전의 가장 최근 날짜
    """
    if b_date and b_date != "latest":
        q = text(f"""
            SELECT DISTINCT DATE(period_start) AS d
            FROM {TBL_HISTORY}
            WHERE DATE(period_start) <= :b
            ORDER BY d
        """)
        rows = db.execute(q, {"b": b_date}).fetchall()
    else:
        q = text(f"""
            SELECT DISTINCT DATE(period_start) AS d
            FROM {TBL_HISTORY}
            ORDER BY d
        """)
        rows = db.execute(q).fetchall()

    days = [r[0] for r in rows]
    if not days:
        raise HTTPException(status_code=404, detail="리뷰 이력(period_start)이 없습니다.")

    b = days[-1]
    # 직전 날짜 선택(동일 주차 스냅샷 구조라면 직전 행으로 충분)
    if len(days) < 2:
        # 직전이 없으면 B만 존재 → A=B 로 맞추되, 후속 계산에서 delta=0
        a = b
    else:
        a = days[-2]
    return a, b


# ------------------------------------------------------------
# 0) 기간 리스트 (필요 시)
# ------------------------------------------------------------
@router.get("/periods", response_model=List[str])
def get_periods(db: Session = Depends(get_db)):
    q = text(f"""
        SELECT DISTINCT DATE(period_start) AS d
        FROM {TBL_HISTORY}
        ORDER BY d
    """)
    rows = db.execute(q).fetchall()
    return [str(r[0]) for r in rows]


# (호환용) 프론트가 /weeks 를 기대하는 경우 지원
@router.get("/weeks", response_model=List[str])
def get_weeks(db: Session = Depends(get_db)):
    return get_periods(db)  # 동일 응답


# ------------------------------------------------------------
# 1) 카테고리 목록 (product_data 기준)
# ------------------------------------------------------------
@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    q = text(f"""
        SELECT DISTINCT category
        FROM {TBL_PRODUCT}
        WHERE category IS NOT NULL AND category <> ''
        ORDER BY category
    """)
    rows = db.execute(q).fetchall()
    cats = [r[0] for r in rows if r[0]]
    if not cats:
        raise HTTPException(status_code=404, detail="카테고리가 없습니다.")
    return cats


# ------------------------------------------------------------
# 정렬 문자열 호환 (hot | pct | most | growth | volume)
# ------------------------------------------------------------
def _normalize_sort(sort: str) -> str:
    if sort in ("hot", "pct", "most"):
        return sort
    if sort == "growth":
        return "pct"
    if sort == "volume":
        return "most"
    return "hot"


# ------------------------------------------------------------
# 2) 카테고리별 랭킹(카드 7개)
#    * A 스냅샷이 없으면 product_data.review_count(BASE) 사용
# ------------------------------------------------------------
@router.get("/leaderboard")
def get_leaderboard(
    category: str = Query(..., description="카테고리명 (product_data.category)"),
    sort: str = Query(
        "hot",
        description="정렬: hot(핫리뷰수) | pct(증가율) | most(리뷰많음) "
                    "| growth(=pct) | volume(=most) | 핫리뷰 | 증가율 | 리뷰많음",
    ),
    limit: int = Query(7, ge=1, le=30),
    min_base: int = Query(75, ge=0, description="A(베이스) 최소 리뷰 수 하한(노이즈 컷)"),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'. 없으면 최신"),
    db: Session = Depends(get_db),
):
    """
    반환 필드:
    - a_count, b_count
    - delta
    - pct_score(로그/스무딩 증가율), hot_score(규모보정 증가수), most_score(리뷰수B)
    - rank_score(현재 정렬에 사용된 최종 점수)
    """

    # 0) 정렬 키 표준화(영/한/별칭 모두 허용)
    sort_map = {
        "hot": "hot", "핫리뷰": "hot", "증가수": "hot",
        "pct": "pct", "growth": "pct", "증가율": "pct",
        "most": "most", "volume": "most", "리뷰많음": "most", "리뷰 많은 순": "most",
    }
    sort_norm = sort_map.get(sort, "hot")

    # 1) A/B 날짜 산출
    a_date, b_date = _get_latest_and_prev_weeks(db, b)
    # A 스냅샷이 없으면 BASE로 대체
    prev = db.execute(
        text(f"""
            SELECT MAX(DATE(period_start)) AS d
            FROM {TBL_HISTORY}
            WHERE DATE(period_start) < :b_date
        """),
        {"b_date": b_date}
    ).fetchone()
    a_date_real = prev[0]

    # 2) 데이터 로드 (A 없으면 BASE 사용)
    q = text(f"""
        SELECT
            pd.pid, pd.product_name, pd.brand,
            pd.image_url, pd.product_url, pd.price_krw,
            COALESCE(pdc.rag_text, '') AS rag_text,
            pd.review_count AS base_cnt,           -- BASE
            a.review_count  AS a_cnt,              -- A(스냅샷)
            b.review_count  AS b_cnt               -- B(스냅샷)
        FROM {TBL_PRODUCT} AS pd
        LEFT JOIN {TBL_HISTORY} AS a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} AS b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        LEFT JOIN {TBL_CHAIN} AS pdc
               ON pdc.pid = pd.pid
        WHERE pd.category = :cat
          AND b.review_count IS NOT NULL
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
    """)
    rows = db.execute(q, {
        "a_date": a_date_real,
        "b_date": b_date,
        "cat": category,
        "min_base": min_base
    }).fetchall()

    # 3) 점수 공식을 “확 바꾼” 버전
    #    - hot_score: 규모 보정 증가수  = (B - A) / (A + KHOT)^ALPHA
    #    - pct_score: 로그 차이 증가율  = log1p(B) - log1p(A)
    #    - most_score: 리뷰수 B 그 자체
    #    ※ 이렇게 하면 세 탭이 절대 같은 순서가 나오지 않음.
    import math
    KHOT = 300.0   # 분모 스무딩(너무 크게 튀는 소형 베이스 억제)
    ALPHA = 0.35   # 규모 보정의 강도(0.3~0.5 권장)

    items: List[Dict[str, Any]] = []
    for (pid, name, brand, img, url, price, rag, base_cnt, a_cnt, b_cnt) in rows:
        a_val = int(a_cnt) if a_cnt is not None else int(base_cnt or 0)
        b_val = int(b_cnt or 0)
        if a_val < 0: a_val = 0
        if b_val < 0: b_val = 0

        delta = b_val - a_val

        # 증가율(로그 차) — 규모 무관하게 상승폭 비교 가능
        pct_score = (math.log1p(b_val) - math.log1p(a_val)) if a_val > 0 or b_val > 0 else 0.0
        # 규모 보정 증가수 — BASE가 큰 브랜드의 ‘원래 크기’ 이점 줄임
        hot_score = (delta) / ((a_val + KHOT) ** ALPHA) if (a_val + KHOT) > 0 else 0.0
        # 리뷰 많은 순 — 그 자체
        most_score = float(b_val)

        # UI 보조용: 기존 퍼센트도 제공(표시 원하면 사용)
        pct_percent = (((b_val / a_val) - 1.0) * 100.0) if a_val > 0 else (100.0 if b_val > 0 else 0.0)
        index_val = ((b_val / a_val) * 100.0) if a_val > 0 else (100.0 if b_val > 0 else 100.0)

        items.append({
            "pid": pid,
            "product_name": name,
            "brand": brand,
            "image_url": img,
            "product_url": url,
            "price_krw": price,
            "rag_text": rag or "요즘 후기에서 자주 보이는 제품이에요.",
            "a_count": a_val,
            "b_count": b_val,
            "delta": delta,

            # 새 점수들
            "hot_score": round(hot_score, 6),
            "pct_score": round(pct_score, 6),
            "most_score": round(most_score, 6),

            # 참고용(표시 선택)
            "pct": round(pct_percent, 1),
            "index": round(index_val, 1),
        })

    if not items:
        return {
            "meta": {
                "category": category,
                "a_date": "BASE" if a_date_real is None else str(a_date_real),
                "b_date": str(b_date),
                "sort": sort_norm,
                "min_base": min_base,
                "count": 0
            },
            "items": []
        }

    # 4) 정렬 — 각 탭별로 아예 다른 점수 사용 + 강한 타이브레이커
    if sort_norm == "hot":
        for it in items:
            it["rank_score"] = it["hot_score"]
        items.sort(key=lambda x: (x["rank_score"], x["b_count"], x["pct_score"], x["pid"]), reverse=True)
    elif sort_norm == "pct":
        for it in items:
            it["rank_score"] = it["pct_score"]
        items.sort(key=lambda x: (x["rank_score"], x["delta"], x["b_count"], x["pid"]), reverse=True)
    else:  # most
        for it in items:
            it["rank_score"] = it["most_score"]
        items.sort(key=lambda x: (x["rank_score"], x["delta"], x["pct_score"], x["pid"]), reverse=True)

    return {
        "meta": {
            "category": category,
            "a_date": "BASE" if a_date_real is None else str(a_date_real),
            "b_date": str(b_date),
            "sort": sort_norm,
            "min_base": min_base,
            "count": min(len(items), limit)
        },
        "items": items[:limit]
    }

# (호환용) /products : 프론트가 이 경로를 기대하는 경우를 위해 /leaderboard 위임
@router.get("/products")
def get_products_compat(
    category: str = Query(...),
    sort: str = Query("hot", description="hot | growth | volume 도 허용"),
    limit: int = Query(7, ge=1, le=30),
    min_base: int = Query(75, ge=0),
    b: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return get_leaderboard(category=category, sort=sort, limit=limit, min_base=min_base, b=b, db=db)


# ------------------------------------------------------------
# 3) 제품 상세 시계열(모달 차트 용) — 최근 N주
# ------------------------------------------------------------
@router.get("/product_timeseries")
def product_timeseries(
    pid: int = Query(..., description="product_data.pid"),
    weeks: int = Query(12, ge=4, le=52),
    db: Session = Depends(get_db),
):
    """
    반환:
    - product { pid, name, brand, image_url, product_url, price_krw, category }
    - series: [{date, count, index}], index는 첫 값=100 기준
    - latest: {a_date, b_date, a_count, b_count, delta, pct, index}
    """
    # 제품 메타
    q_meta = text(f"""
        SELECT pid, product_name, brand, image_url, product_url, price_krw, category
        FROM {TBL_PRODUCT}
        WHERE pid = :pid
        LIMIT 1
    """)
    meta = db.execute(q_meta, {"pid": pid}).fetchone()
    if not meta:
        raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다.")

    # 최근 N주 시계열
    q_ts = text(f"""
        SELECT DATE(period_start) AS d, CAST(review_count AS SIGNED) AS c
        FROM {TBL_HISTORY}
        WHERE product_pid = :pid
        ORDER BY d DESC
        LIMIT :n
    """)
    rows = db.execute(q_ts, {"pid": pid, "n": weeks}).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="시계열 데이터가 없습니다.")

    # 오래된→최신 순으로 정렬
    rows = list(reversed(rows))
    base_val = max(1, int(rows[0][1]) if rows[0][1] is not None else 1)

    series = []
    for d, c in rows:
        v = int(c) if c is not None else 0
        idx = (v / base_val) * 100.0 if base_val > 0 else 100.0
        series.append({
            "date": str(d),
            "count": v,
            "index": round(idx, 1)
        })

    # 최신 2주 A/B 요약
    if len(rows) >= 2:
        a_date2, a_val = rows[-2][0], int(rows[-2][1] or 0)
        b_date2, b_val = rows[-1][0], int(rows[-1][1] or 0)
    else:
        a_date2, a_val = rows[-1][0], int(rows[-1][1] or 0)
        b_date2, b_val = a_date2, a_val

    delta = b_val - a_val
    pct = ((b_val / a_val) - 1.0) * 100.0 if a_val > 0 else 0.0
    index = (b_val / a_val) * 100.0 if a_val > 0 else 100.0

    product = {
        "pid": meta[0],
        "product_name": meta[1],
        "brand": meta[2],
        "image_url": meta[3],
        "product_url": meta[4],
        "price_krw": meta[5],
        "category": meta[6],
    }

    return {
        "product": product,
        "series": series,
        "latest": {
            "a_date": str(a_date2),
            "b_date": str(b_date2),
            "a_count": a_val,
            "b_count": b_val,
            "delta": delta,
            "pct": round(pct, 1),
            "index": round(index, 1)
        }
    }


# ------------------------------------------------------------
# 4) 카테고리 요약(선택): 합계 기준 델타/증가율
#    * A 스냅샷이 없으면 product_data.review_count(BASE) 사용
# ------------------------------------------------------------
@router.get("/category_summary")
def category_summary(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'. 없으면 최신"),
    min_base: int = Query(75, ge=0),
):
    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    prev = db.execute(
        text(f"""
            SELECT MAX(DATE(period_start)) AS d
            FROM {TBL_HISTORY}
            WHERE DATE(period_start) < :b_date
        """),
        {"b_date": b_date}
    ).fetchone()
    a_date_real = prev[0]

    q = text(f"""
        SELECT
            SUM(COALESCE(a.review_count, pd.review_count)) AS a_sum,   -- A=스냅샷 없으면 BASE
            SUM(b.review_count) AS b_sum
        FROM {TBL_PRODUCT} AS pd
        LEFT JOIN {TBL_HISTORY} AS a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} AS b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
    """)
    row = db.execute(q, {
        "a_date": a_date_real,
        "b_date": b_date,
        "cat": category,
        "min_base": min_base
    }).fetchone()

    a_sum = int(row[0] or 0)
    b_sum = int(row[1] or 0)
    delta = b_sum - a_sum
    pct = ((b_sum / a_sum) - 1.0) * 100.0 if a_sum > 0 else 0.0
    index = (b_sum / a_sum) * 100.0 if a_sum > 0 else 100.0

    return {
        "category": category,
        "a_date": "BASE" if a_date_real is None else str(a_date_real),
        "b_date": str(b_date),
        "a_sum": a_sum,
        "b_sum": b_sum,
        "delta": delta,
        "pct": round(pct, 1),
        "index": round(index, 1)
    }
