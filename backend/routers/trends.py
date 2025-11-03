# -*- coding: utf-8 -*-
from typing import List, Optional, Dict, Any, Tuple
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db  # 같은 프로젝트의 db.py

# ---------------------------------------------
# 상수
# ---------------------------------------------
ALLOWED_CATEGORIES = ["스킨/토너", "에센스/세럼/앰플", "크림", "선크림"]
TBL_PRODUCT = "product_data"                # pid, brand, product_name, review_count, category, ...
TBL_HISTORY = "product_review_history_tmp"  # product_pid, period_start(date), review_count
TBL_CHAIN   = "product_data_chain"          # pid, rag_text

router = APIRouter(prefix="/api/trends", tags=["trends"])

# ---------------------------------------------
# A/B 기준일 계산 (핵심 수정)
#  - B: 히스토리 테이블의 최신 날짜
#  - A: B 이전의 가장 최근 날짜. 없으면 A=None (→ 쿼리에서 BASE로 폴백)
# ---------------------------------------------
def _get_latest_and_prev_weeks(db: Session, b_date: Optional[str]) -> Tuple[Optional[date], date]:
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
    # 이전 스냅샷이 없으면 None을 반환한다. (!!! 중요)
    a = days[-2] if len(days) >= 2 else None
    return a, b

# ---------------------------------------------
# 0) 기간 리스트
# ---------------------------------------------
@router.get("/periods", response_model=List[str])
def get_periods(db: Session = Depends(get_db)):
    q = text(f"""
        SELECT DISTINCT DATE(period_start) AS d
        FROM {TBL_HISTORY}
        ORDER BY d
    """)
    rows = db.execute(q).fetchall()
    return [str(r[0]) for r in rows]

@router.get("/weeks", response_model=List[str])
def get_weeks(db: Session = Depends(get_db)):
    return get_periods(db)

# ---------------------------------------------
# 1) 카테고리 목록
# ---------------------------------------------
@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    return ALLOWED_CATEGORIES

# ---------------------------------------------
# 2) 카테고리별 랭킹(카드/리스트)
#  - A가 없으면 a.review_count는 NULL → COALESCE로 BASE 사용
# ---------------------------------------------
@router.get("/leaderboard")
def get_leaderboard(
    category: str = Query(..., description="카테고리명"),
    sort: str = Query(
        "hot",
        description="정렬: hot(핫리뷰수) | pct(증가율) | most(리뷰많음) | growth(=pct) | volume(=most)",
    ),
    limit: int = Query(5, ge=1, le=30),
    min_base: int = Query(75, ge=0, description="A(베이스) 최소 리뷰 수 하한"),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    db: Session = Depends(get_db),
):
    # 정렬 키 정규화
    sort_map = {
        "hot": "hot", "핫리뷰": "hot", "증가수": "hot",
        "pct": "pct", "growth": "pct", "증가율": "pct",
        "most": "most", "volume": "most", "리뷰많음": "most", "리뷰 많은 순": "most",
    }
    sort_norm = sort_map.get(sort, "hot")

    # A/B 기준일
    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    # 직전 스냅샷이 없을 수 있으므로 LEFT JOIN + COALESCE(BASE)
    q = text(f"""
        SELECT
            pd.pid, pd.product_name, pd.brand,
            pd.image_url, pd.product_url, pd.price_krw,
            COALESCE(pdc.rag_text, '') AS rag_text,

            COALESCE(a.review_count, pd.review_count, 0) AS a_cnt,
            b.review_count AS b_cnt
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
        "a_date": a_date,           # None이면 A조인 미일치 → a.review_count=NULL
        "b_date": b_date,
        "cat": category,
        "min_base": min_base
    }).fetchall()

    import math
    KHOT = 300.0
    ALPHA = 0.35

    items: List[Dict[str, Any]] = []
    for (pid, name, brand, img, url, price, rag, a_cnt, b_cnt) in rows:
        a_val = int(a_cnt or 0)
        b_val = int(b_cnt or 0)
        if a_val < 0: a_val = 0
        if b_val < 0: b_val = 0

        delta = b_val - a_val
        pct_score = (math.log1p(b_val) - math.log1p(a_val)) if (a_val > 0 or b_val > 0) else 0.0
        hot_score = (delta) / ((a_val + KHOT) ** ALPHA) if (a_val + KHOT) > 0 else 0.0
        most_score = float(b_val)

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
            "hot_score": round(hot_score, 6),
            "pct_score": round(pct_score, 6),
            "most_score": round(most_score, 6),
            "pct": round(pct_percent, 1),
            "index": round(index_val, 1),
        })

    if not items:
        return {
            "meta": {
                "category": category,
                "a_date": "BASE" if a_date is None else str(a_date),
                "b_date": str(b_date),
                "sort": sort_norm,
                "min_base": min_base,
                "count": 0
            },
            "items": []
        }

    # 정렬
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
            "a_date": "BASE" if a_date is None else str(a_date),
            "b_date": str(b_date),
            "sort": sort_norm,
            "min_base": min_base,
            "count": min(len(items), limit)
        },
        "items": items[:limit]
    }

# 호환용
@router.get("/products")
def get_products_compat(
    category: str = Query(...),
    sort: str = Query("hot"),
    limit: int = Query(5, ge=1, le=30),
    min_base: int = Query(75, ge=0),
    b: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return get_leaderboard(category=category, sort=sort, limit=limit, min_base=min_base, b=b, db=db)

# ---------------------------------------------
# 3) 제품 상세 시계열
# ---------------------------------------------
@router.get("/product_timeseries")
def product_timeseries(
    pid: int = Query(..., description="product_data.pid"),
    weeks: int = Query(12, ge=4, le=52),
    db: Session = Depends(get_db),
):
    q_meta = text(f"""
        SELECT pid, product_name, brand, image_url, product_url, price_krw, category
        FROM {TBL_PRODUCT}
        WHERE pid = :pid
        LIMIT 1
    """)
    meta = db.execute(q_meta, {"pid": pid}).fetchone()
    if not meta:
        raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다.")

    q_ts = text(f"""
        SELECT DATE(period_start) AS d, CAST(review_count AS SIGNED) AS c
        FROM {TBL_HISTORY}
        WHERE product_pid = :pid
        ORDER BY d DESC
        LIMIT {int(weeks)}
    """)
    rows = db.execute(q_ts, {"pid": pid}).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="시계열 데이터가 없습니다.")

    rows = list(reversed(rows))
    base_val = max(1, int(rows[0][1]) if rows[0][1] is not None else 1)

    series = []
    for d, c in rows:
        v = int(c) if c is not None else 0
        idx = (v / base_val) * 100.0 if base_val > 0 else 100.0
        series.append({"date": str(d), "count": v, "index": round(idx, 1)})

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
        "pid": meta[0], "product_name": meta[1], "brand": meta[2],
        "image_url": meta[3], "product_url": meta[4], "price_krw": meta[5],
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

# ---------------------------------------------
# 4) 카테고리 요약(합계)
# ---------------------------------------------
@router.get("/category_summary")
def category_summary(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),
):
    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    q = text(f"""
        SELECT
            SUM(CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED)) AS a_sum,
            SUM(CAST(b.review_count AS SIGNED)) AS b_sum
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
        "a_date": a_date,
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
        "a_date": "BASE" if a_date is None else str(a_date),
        "b_date": str(b_date),
        "a_sum": a_sum,
        "b_sum": b_sum,
        "delta": delta,
        "pct": round(pct, 1),
        "index": round(index, 1)
    }

# ---------------------------------------------
# 4.5) 카테고리 시계열(절대량/지수)
# ---------------------------------------------
@router.get("/category_timeseries")
def category_timeseries(
    weeks: int = Query(8, ge=4, le=52),
    db: Session = Depends(get_db),
):
    placeholders = ", ".join([f":c{i}" for i, _ in enumerate(ALLOWED_CATEGORIES)])
    q = text(f"""
        SELECT DATE(period_start) AS d, pd.category, SUM(CAST(prh.review_count AS SIGNED)) AS s
        FROM {TBL_HISTORY} prh
        JOIN {TBL_PRODUCT} pd ON pd.pid = prh.product_pid
        WHERE pd.category IN ({placeholders})
        GROUP BY d, pd.category
        ORDER BY d DESC
        LIMIT 10000
    """)
    params = {f"c{i}": cat for i, cat in enumerate(ALLOWED_CATEGORIES)}
    rows = db.execute(q, params).fetchall()

    if not rows:
        return {"series": []}

    from collections import defaultdict
    per_day: Dict[str, Dict[str, int]] = defaultdict(lambda: {c:0 for c in ALLOWED_CATEGORIES})
    days: List[str] = []
    for d, cat, s in rows:
        ds = str(d)
        per_day[ds][cat] = int(s or 0)
        if ds not in days:
            days.append(ds)
    days.sort()
    days = days[-weeks:] if len(days) > weeks else days

    base = per_day[days[0]]
    base_total = {c: max(1, int(base.get(c,0))) for c in ALLOWED_CATEGORIES}

    series = []
    for ds in days:
        row = {"date": ds}
        for c in ALLOWED_CATEGORIES:
            v = int(per_day[ds].get(c,0))
            idx = round((v/base_total[c])*100.0, 1) if base_total[c] > 0 else 100.0
            row[c] = {"sum": v, "index": idx}
        series.append(row)

    return {"series": series, "categories": ALLOWED_CATEGORIES}

# ---------------------------------------------
# 5) A/B 비교: 브랜드 포지셔닝 (합계)
#  - A 없으면 BASE 사용
# ---------------------------------------------
@router.get("/brand_positioning")
def brand_positioning(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),
    topk: int = Query(50, ge=5, le=100),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="허용되지 않은 카테고리")

    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    q = text(f"""
        SELECT
            pd.brand,
            SUM(CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED)) AS base_sum,
            SUM(CAST(b.review_count AS SIGNED)) AS current_sum
        FROM {TBL_PRODUCT} pd
        LEFT JOIN {TBL_HISTORY} a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
        GROUP BY pd.brand
    """)
    rows = db.execute(q, {
        "a_date": a_date, "b_date": b_date, "cat": category, "min_base": min_base
    }).fetchall()

    items = []
    for brand, base_sum, current_sum in rows:
        base_sum = int(base_sum or 0)
        current_sum = int(current_sum or 0)
        delta_sum = current_sum - base_sum
        if base_sum <= 0 and current_sum <= 0:
            continue
        items.append({
            "brand": brand,
            "base_sum": base_sum,
            "current_sum": current_sum,
            "delta_sum": delta_sum,
        })

    items.sort(key=lambda x: (x["delta_sum"], x["current_sum"]), reverse=True)
    items = items[:topk]

    return {
        "meta": {"category": category, "a_date": ("BASE" if a_date is None else str(a_date)),
                 "b_date": str(b_date), "min_base": min_base},
        "items": items
    }

# ---------------------------------------------
# 6) A/B 비교: 브랜드 기여도 Top/Bottom + 대표 제품
#  - A 없으면 BASE 사용
# ---------------------------------------------
@router.get("/brand_contributors")
def brand_contributors(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),
    topk: int = Query(5, ge=3, le=10),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="허용되지 않은 카테고리")

    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    # 1) 브랜드별 A/B 합계
    q_brand = text(f"""
        SELECT
            pd.brand AS brand,
            SUM(CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED)) AS a_sum,
            SUM(CAST(b.review_count AS SIGNED)) AS b_sum
        FROM {TBL_PRODUCT} pd
        LEFT JOIN {TBL_HISTORY} a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
        GROUP BY pd.brand
    """)
    rows = db.execute(q_brand, {
        "a_date": a_date, "b_date": b_date, "cat": category, "min_base": min_base
    }).fetchall()

    if not rows:
        return {
            "meta": {"category": category, "a_date": ("BASE" if a_date is None else str(a_date)),
                     "b_date": str(b_date), "min_base": min_base},
            "top": [], "bottom": []
        }

    items = []
    for brand, a_sum, b_sum in rows:
        a_sum = int(a_sum or 0)
        b_sum = int(b_sum or 0)
        delta = b_sum - a_sum
        pct = ((b_sum / a_sum) - 1.0) * 100.0 if a_sum > 0 else (100.0 if b_sum > 0 else 0.0)
        items.append({
            "brand": brand,
            "base_sum": a_sum,
            "curr_sum": b_sum,
            "delta": delta,
            "pct": round(pct, 1),
        })

    # 2) 브랜드별 대표 제품(Δ 절대값 최대) — A는 BASE fallback
    def fetch_top_product_for_brand(brand_name: str) -> Optional[Dict[str, Any]]:
        q_prod = text(f"""
            SELECT
                pd.pid, pd.product_name,
                CAST(b.review_count AS SIGNED) - CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED) AS d
            FROM {TBL_PRODUCT} pd
            LEFT JOIN {TBL_HISTORY} a
                   ON a.product_pid = pd.pid
                  AND DATE(a.period_start) = :a_date
            JOIN {TBL_HISTORY} b
                   ON b.product_pid = pd.pid
                  AND DATE(b.period_start) = :b_date
            WHERE pd.category = :cat
              AND pd.brand = :brand
            ORDER BY ABS(d) DESC
            LIMIT 1
        """)
        r = db.execute(q_prod, {
            "a_date": a_date, "b_date": b_date, "cat": category, "brand": brand_name
        }).fetchone()
        if not r:
            return None
        return {"pid": int(r[0]), "name": r[1], "delta": int(r[2] or 0)}

    for it in items:
        it["top_product"] = fetch_top_product_for_brand(it["brand"])

    top = sorted(items, key=lambda x: (x["delta"], x["curr_sum"]), reverse=True)[:topk]
    bottom = sorted(items, key=lambda x: (x["delta"], -x["curr_sum"]))[:topk]

    return {
        "meta": {"category": category, "a_date": ("BASE" if a_date is None else str(a_date)),
                 "b_date": str(b_date), "min_base": min_base},
        "top": top, "bottom": bottom,
    }
