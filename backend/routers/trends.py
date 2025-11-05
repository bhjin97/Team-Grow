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
# A/B 기준일 계산
#  - B: 히스토리 테이블의 최신 날짜 (또는 <=b_date 중 최신)
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
#    - 제품 단위 outlier 필터 (감소/급증) → 카드에서 제외
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

    # outlier 필터 파라미터 (기본: 감소/급증 제외)
    filter_outliers: bool = Query(True, description="전주 대비 감소/급증 outlier 제외"),
    allow_negative: bool = Query(False, description="전주 대비 감소(Δ<0) 허용 여부"),
    max_ratio: float = Query(3.0, description="전주 대비 배율 상한(초과시 제외)"),
    max_jump: int = Query(500, description="전주 대비 절대 증가량 상한(초과시 제외)"),
    db: Session = Depends(get_db),
):
    sort_map = {
        "hot": "hot", "핫리뷰": "hot", "증가수": "hot",
        "pct": "pct", "growth": "pct", "증가율": "pct",
        "most": "most", "volume": "most", "리뷰많음": "most", "리뷰 많은 순": "most",
    }
    sort_norm = sort_map.get(sort, "hot")

    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    # A가 없을 수 있으니 COALESCE(BASE) 사용
    q = text(f"""
        SELECT
            pd.pid, pd.product_name, pd.brand,
            pd.image_url, pd.product_url, pd.price_krw,
            COALESCE(pdc.rag_text, '') AS rag_text,
            CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED) AS a_cnt,
            CAST(b.review_count AS SIGNED) AS b_cnt
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
        "a_date": a_date,
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
        ratio = (b_val / a_val) if a_val > 0 else (float('inf') if b_val > 0 else 1.0)

        # 제품 outlier 필터 → 카드에서 제외
        use = True
        if filter_outliers:
            if (not allow_negative) and (delta < 0):
                use = False
            if use and (a_val > 0) and (ratio > max_ratio):
                use = False
            if use and (abs(delta) > max_jump):
                use = False
        if not use:
            continue

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

    # 정렬
    if sort_norm == "hot":
        for it in items: it["rank_score"] = it["hot_score"]
        items.sort(key=lambda x: (x["rank_score"], x["b_count"], x["pct_score"], x["pid"]), reverse=True)
    elif sort_norm == "pct":
        for it in items: it["rank_score"] = it["pct_score"]
        items.sort(key=lambda x: (x["rank_score"], x["delta"], x["b_count"], x["pid"]), reverse=True)
    else:  # most
        for it in items: it["rank_score"] = it["most_score"]
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
    prev = None
    for d, c in rows:
        v = int(c) if c is not None else 0
        # 누적은 비감소 보정
        if prev is not None and v < prev:
            v = prev
        series.append({"date": str(d), "count": v, "index": round((v / base_val) * 100.0, 1)})
        prev = v

    if len(series) >= 2:
        a_date2, a_val = series[-2]["date"], int(series[-2]["count"])
        b_date2, b_val = series[-1]["date"], int(series[-1]["count"])
    else:
        a_date2, a_val = series[-1]["date"], int(series[-1]["count"])
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
# 4) 카테고리 요약(합계) — outlier 보정 + 비감소 보장
# ---------------------------------------------
@router.get("/category_summary")
def category_summary(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),

    filter_outliers: bool = Query(True),
    allow_negative: bool = Query(False),
    max_ratio: float = Query(3.0),
    max_jump: int = Query(5000),
):
    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    # per-product A/B를 불러와서, B값을 보정(carry-forward/clamp) 후 합산
    q = text(f"""
        SELECT
            CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED) AS a_cnt,
            CAST(b.review_count AS SIGNED) AS b_cnt
        FROM {TBL_PRODUCT} pd
        LEFT JOIN {TBL_HISTORY} a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
    """)
    rows = db.execute(q, {"a_date": a_date, "b_date": b_date, "cat": category, "min_base": min_base}).fetchall()

    a_sum = 0
    b_sum = 0
    for a_cnt, b_cnt in rows:
        a_val = int(a_cnt or 0)
        b_val = int(b_cnt or 0)
        if a_val < 0: a_val = 0
        if b_val < 0: b_val = 0

        # 보정(감소/급증 방지)
        delta = b_val - a_val
        ratio = (b_val / a_val) if a_val > 0 else (float('inf') if b_val > 0 else 1.0)

        if filter_outliers:
            if (not allow_negative) and delta < 0:
                b_eff = a_val  # carry-forward
            else:
                b_eff = b_val
                if a_val > 0 and ratio > max_ratio:
                    b_eff = int(a_val * max_ratio)
                if abs(b_eff - a_val) > max_jump:
                    # 절대 점프 상한
                    b_eff = a_val + max_jump if (b_eff >= a_val) else a_val  # 감소는 허용 안 함
        else:
            b_eff = max(b_val, a_val) if not allow_negative else b_val

        a_sum += a_val
        b_sum += b_eff

    delta = b_sum - a_sum
    pct = ((b_sum / a_sum) - 1.0) * 100.0 if a_sum > 0 else 0.0
    index = (b_sum / a_sum) * 100.0 if a_sum > 0 else 100.0

    return {
        "category": category,
        "a_date": "BASE" if a_date is None else str(a_date),
        "b_date": str(b_date),
        "a_sum": int(a_sum),
        "b_sum": int(b_sum),
        "delta": int(delta),
        "pct": round(pct, 1),
        "index": round(index, 1)
    }


# ---------------------------------------------
# 4.5) 카테고리 시계열(절대량/지수)
#     - per-product 주간 Δ 보정(감소→carry-forward, 급증→클램프)
# ---------------------------------------------
@router.get("/category_timeseries")
def category_timeseries(
    weeks: int = Query(8, ge=4, le=52),
    filter_outliers: bool = Query(True, description="전주 대비 급감/급증 보정"),
    allow_negative: bool = Query(False, description="감소 허용 여부"),
    max_ratio: float = Query(3.0, description="전주 대비 배율 상한"),
    max_jump: int = Query(5000, description="전주 대비 절대 증가량 상한"),
    db: Session = Depends(get_db),
):
    placeholders = ", ".join([f":c{i}" for i, _ in enumerate(ALLOWED_CATEGORIES)])
    q = text(f"""
        SELECT DATE(prh.period_start) AS d,
               prh.product_pid        AS pid,
               pd.category            AS cat,
               CAST(prh.review_count AS SIGNED) AS cnt
        FROM {TBL_HISTORY} prh
        JOIN {TBL_PRODUCT} pd ON pd.pid = prh.product_pid
        WHERE pd.category IN ({placeholders})
        ORDER BY pid, d
    """)
    params = {f"c{i}": cat for i, cat in enumerate(ALLOWED_CATEGORIES)}
    rows = db.execute(q, params).fetchall()
    if not rows:
        return {"series": [], "categories": ALLOWED_CATEGORIES}

    from collections import defaultdict
    per_pid = defaultdict(list)  # pid -> list[(d, cat, cnt)]
    all_days = set()
    for d, pid, cat, cnt in rows:
        all_days.add(d)
        per_pid[int(pid)].append((d, cat, int(cnt or 0)))

    for pid in per_pid:
        per_pid[pid].sort(key=lambda x: x[0])

    days_sorted = sorted(all_days)
    if len(days_sorted) > weeks:
        days_sorted = days_sorted[-weeks:]

    per_day_cat_sum = {str(d): {c: 0 for c in ALLOWED_CATEGORIES} for d in days_sorted}

    for pid, seq in per_pid.items():
        prev_cnt: Optional[int] = None
        prev_day = None
        prev_cat = None

        for (d, cat, cnt) in seq:
            if d not in days_sorted:
                prev_cnt, prev_day, prev_cat = cnt, d, cat
                continue

            a_val = prev_cnt if prev_cnt is not None else cnt
            b_val = cnt

            # 보정 로직
            if prev_cnt is None:
                eff = max(0, b_val)
            else:
                delta = b_val - a_val
                ratio = (b_val / a_val) if a_val > 0 else (float('inf') if b_val > 0 else 1.0)

                if filter_outliers:
                    if (not allow_negative) and delta < 0:
                        eff = a_val  # 감소 → carry-forward
                    else:
                        eff = b_val
                        if a_val > 0 and ratio > max_ratio:
                            eff = int(a_val * max_ratio)
                        if abs(eff - a_val) > max_jump:
                            eff = a_val + max_jump if (eff >= a_val) else a_val
                else:
                    eff = max(b_val, a_val) if not allow_negative else b_val

            per_day_cat_sum[str(d)][cat] += max(0, eff)

            prev_cnt, prev_day, prev_cat = eff, d, cat  # eff를 다음 주의 기준으로 사용

    days_final = [str(d) for d in days_sorted]
    if not days_final:
        return {"series": [], "categories": ALLOWED_CATEGORIES}

    base = per_day_cat_sum[days_final[0]]
    base_total = {c: max(1, int(base.get(c, 0))) for c in ALLOWED_CATEGORIES}

    series = []
    for ds in days_final:
        row = {"date": ds}
        for c in ALLOWED_CATEGORIES:
            v = int(per_day_cat_sum[ds].get(c, 0))
            idx = round((v / base_total[c]) * 100.0, 1) if base_total[c] > 0 else 100.0
            row[c] = {"sum": v, "index": idx}
        series.append(row)

    return {"series": series, "categories": ALLOWED_CATEGORIES}


# ---------------------------------------------
# 5) A/B 비교: 브랜드 포지셔닝 (합계)
#     - per-product 보정 후 브랜드별 합계
# ---------------------------------------------
@router.get("/brand_positioning")
def brand_positioning(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),

    filter_outliers: bool = Query(True),
    allow_negative: bool = Query(False),
    max_ratio: float = Query(3.0),
    max_jump: int = Query(5000),

    topk: int = Query(50, ge=5, le=100),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="허용되지 않은 카테고리")

    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    q = text(f"""
        SELECT
            pd.brand,
            CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED) AS a_cnt,
            CAST(b.review_count AS SIGNED) AS b_cnt
        FROM {TBL_PRODUCT} pd
        LEFT JOIN {TBL_HISTORY} a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
    """)
    rows = db.execute(q, {"a_date": a_date, "b_date": b_date, "cat": category, "min_base": min_base}).fetchall()

    from collections import defaultdict
    agg_a = defaultdict(int)
    agg_b = defaultdict(int)

    for brand, a_cnt, b_cnt in rows:
        a_val = int(a_cnt or 0);  b_val = int(b_cnt or 0)
        if a_val < 0: a_val = 0
        if b_val < 0: b_val = 0

        delta = b_val - a_val
        ratio = (b_val / a_val) if a_val > 0 else (float('inf') if b_val > 0 else 1.0)

        if filter_outliers:
            if (not allow_negative) and delta < 0:
                b_eff = a_val
            else:
                b_eff = b_val
                if a_val > 0 and ratio > max_ratio:
                    b_eff = int(a_val * max_ratio)
                if abs(b_eff - a_val) > max_jump:
                    b_eff = a_val + max_jump if (b_eff >= a_val) else a_val
        else:
            b_eff = max(b_val, a_val) if not allow_negative else b_val

        agg_a[brand] += a_val
        agg_b[brand] += b_eff

    items = []
    for brand in agg_b.keys():
        base_sum = int(agg_a[brand])
        current_sum = int(agg_b[brand])
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
#     - per-product 보정 후 브랜드 집계
# ---------------------------------------------
@router.get("/brand_contributors")
def brand_contributors(
    category: str = Query(...),
    db: Session = Depends(get_db),
    b: Optional[str] = Query(None, description="B(비교) 날짜 YYYY-MM-DD 또는 'latest'"),
    min_base: int = Query(75, ge=0),

    filter_outliers: bool = Query(True),
    allow_negative: bool = Query(False),
    max_ratio: float = Query(3.0),
    max_jump: int = Query(5000),

    topk: int = Query(5, ge=3, le=10),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="허용되지 않은 카테고리")

    a_date, b_date = _get_latest_and_prev_weeks(db, b)

    q = text(f"""
        SELECT
            pd.brand,
            pd.pid,
            pd.product_name,
            CAST(COALESCE(a.review_count, pd.review_count, 0) AS SIGNED) AS a_cnt,
            CAST(b.review_count AS SIGNED) AS b_cnt
        FROM {TBL_PRODUCT} pd
        LEFT JOIN {TBL_HISTORY} a
               ON a.product_pid = pd.pid
              AND DATE(a.period_start) = :a_date
        JOIN {TBL_HISTORY} b
               ON b.product_pid = pd.pid
              AND DATE(b.period_start) = :b_date
        WHERE pd.category = :cat
          AND COALESCE(a.review_count, pd.review_count, 0) >= :min_base
    """)
    rows = db.execute(q, {"a_date": a_date, "b_date": b_date, "cat": category, "min_base": min_base}).fetchall()

    from collections import defaultdict
    agg = defaultdict(lambda: {"a": 0, "b": 0})
    top_prod_per_brand: Dict[str, Dict[str, Any]] = {}

    for brand, pid, name, a_cnt, b_cnt in rows:
        a_val = int(a_cnt or 0);  b_val = int(b_cnt or 0)
        if a_val < 0: a_val = 0
        if b_val < 0: b_val = 0

        delta = b_val - a_val
        ratio = (b_val / a_val) if a_val > 0 else (float('inf') if b_val > 0 else 1.0)

        if filter_outliers:
            if (not allow_negative) and delta < 0:
                b_eff = a_val
            else:
                b_eff = b_val
                if a_val > 0 and ratio > max_ratio:
                    b_eff = int(a_val * max_ratio)
                if abs(b_eff - a_val) > max_jump:
                    b_eff = a_val + max_jump if (b_eff >= a_val) else a_val
        else:
            b_eff = max(b_val, a_val) if not allow_negative else b_val

        agg[brand]["a"] += a_val
        agg[brand]["b"] += b_eff

        # 대표 제품(Δ 절대값 최대, 보정 기준)
        d_eff = b_eff - a_val
        best = top_prod_per_brand.get(brand)
        if (best is None) or (abs(d_eff) > abs(best["delta"])):
            top_prod_per_brand[brand] = {"pid": int(pid), "name": name, "delta": int(d_eff)}

    items = []
    for brand, sums in agg.items():
        a_sum = int(sums["a"]); b_sum = int(sums["b"])
        delta = b_sum - a_sum
        pct = ((b_sum / a_sum) - 1.0) * 100.0 if a_sum > 0 else (100.0 if b_sum > 0 else 0.0)
        items.append({
            "brand": brand,
            "base_sum": a_sum,
            "curr_sum": b_sum,
            "delta": delta,
            "pct": round(pct, 1),
            "top_product": top_prod_per_brand.get(brand),
        })

    top = sorted(items, key=lambda x: (x["delta"], x["curr_sum"]), reverse=True)[:topk]
    bottom = sorted(items, key=lambda x: (x["delta"], -x["curr_sum"]))[:topk]

    return {
        "meta": {"category": category, "a_date": ("BASE" if a_date is None else str(a_date)),
                 "b_date": str(b_date), "min_base": min_base},
        "top": top, "bottom": bottom,
    }


# --- (추가) 카드 썸네일용 미니 시계열 (그림자 영향 無, 원본 노출)
@router.get("/product_mini_ts")
def product_mini_ts(
    pids: str = Query(..., description="쉼표로 구분된 pid 목록, 예: 1,2,3"),
    window: int = Query(8, ge=4, le=24),
    db: Session = Depends(get_db),
):
    """
    반환:
    { "items": [ {"pid": 123, "series": [10,12,13,...]}, ... ] }
    """
    try:
        pid_list = [int(x) for x in pids.split(",") if x.strip().isdigit()]
    except Exception:
        raise HTTPException(status_code=400, detail="pids 형식 오류")

    if not pid_list:
        return {"items": []}

    q_days = text(f"""
        SELECT DISTINCT DATE(period_start) AS d
        FROM {TBL_HISTORY}
        ORDER BY d DESC
        LIMIT :w
    """)
    days_rows = db.execute(q_days, {"w": window}).fetchall()
    if not days_rows:
        return {"items": []}

    days = [str(r[0]) for r in days_rows][::-1]
    placeholders_pid = ", ".join([f":p{i}" for i,_ in enumerate(pid_list)])
    placeholders_day = ", ".join([f":d{i}" for i,_ in enumerate(days)])

    q = text(f"""
        SELECT product_pid, DATE(period_start) AS d, CAST(review_count AS SIGNED) AS c
        FROM {TBL_HISTORY}
        WHERE product_pid IN ({placeholders_pid})
          AND DATE(period_start) IN ({placeholders_day})
    """)
    params = {**{f"p{i}": pid_list[i] for i in range(len(pid_list))},
              **{f"d{i}": days[i] for i in range(len(days))}}
    rows = db.execute(q, params).fetchall()

    from collections import defaultdict
    by_pid = defaultdict(dict)  # pid -> {day: count}
    for pid, d, c in rows:
        by_pid[int(pid)][str(d)] = int(c or 0)

    items = []
    for pid in pid_list:
        seq = []
        prev = None
        for day in days:
            v = int(by_pid.get(pid, {}).get(day, 0))
            if prev is not None and v < prev:
                v = prev  # 누적값 비감소 보장
            seq.append(v)
            prev = v
        items.append({"pid": pid, "series": seq})
    return {"items": items}
