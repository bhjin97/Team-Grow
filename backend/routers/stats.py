from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/stats", tags=["stats"])

# 쿼리 파라미터 타입 (MySQL 기준)
Interval = ["30d", "90d", "180d", "all"]
Gender = ["all", "female", "male", "other", "na"]
AgeBand = ["all", "10s", "20s", "30s", "40s", "50s", "60s_plus"]

BAUMANN_16 = [
    "OSNT","OSNW","OSPT","OSPW",
    "ORNT","ORNW","ORPT","ORPW",
    "DSNT","DSNW","DSPT","DSPW",
    "DRNT","DRNW","DRPT","DRPW",
]

def _interval_sql(interval: str) -> str:
    if interval == "30d": return "AND updated_at >= NOW() - INTERVAL 30 DAY"
    if interval == "90d": return "AND updated_at >= NOW() - INTERVAL 90 DAY"
    if interval == "180d": return "AND updated_at >= NOW() - INTERVAL 180 DAY"
    return ""  # all

def _gender_sql(gender: str) -> str:
    return "" if gender == "all" else "AND gender = :gender"

def _age_sql(age_band: str) -> str:
    if age_band == "10s": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 10 AND 19"
    if age_band == "20s": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 20 AND 29"
    if age_band == "30s": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 30 AND 39"
    if age_band == "40s": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 40 AND 49"
    if age_band == "50s": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 50 AND 59"
    if age_band == "60s_plus": return "AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) >= 60"
    return ""  # all

@router.get("/baumann-distribution")
def baumann_distribution(
    interval: str = Query("90d"),
    gender: str = Query("all"),
    age_band: str = Query("all"),
    db: Session = Depends(get_db)
):
    """
    user_profiles.skin_type_code 분포
    - 기준시각: updated_at (최신 프로필 상태 반영)
    - NULL/빈값은 분모에서 제외, unassigned로 별도 카운트
    """
    where = "WHERE 1=1 " + " ".join([
        _interval_sql(interval),
        _gender_sql(gender),
        _age_sql(age_band),
    ])

    params = {}
    if gender != "all":
        params["gender"] = gender

    # 전체/미설정
    total_sql = text(f"""
        SELECT
          SUM(CASE WHEN skin_type_code IS NOT NULL AND skin_type_code <> '' THEN 1 ELSE 0 END) AS total_set,
          SUM(CASE WHEN skin_type_code IS NULL OR skin_type_code = '' THEN 1 ELSE 0 END) AS unassigned
        FROM user_profiles
        {where}
    """)
    totals = db.execute(total_sql, params).mappings().first() or {"total_set": 0, "unassigned": 0}
    total_set = int(totals["total_set"] or 0)
    unassigned = int(totals["unassigned"] or 0)

    # 타입별
    dist_sql = text(f"""
        SELECT skin_type_code AS type, COUNT(*) AS cnt
        FROM user_profiles
        {where}
          AND skin_type_code IS NOT NULL AND skin_type_code <> ''
        GROUP BY skin_type_code
    """)
    rows = db.execute(dist_sql, params).mappings().all()
    counts = {r["type"]: int(r["cnt"]) for r in rows}
    # 👇 추가: 리스트에 없는 타입 감지 로그
    unknown = [t for t in counts.keys() if t not in BAUMANN_16]
    if unknown:
        print("[stats] Unknown skin types in DB:", unknown)
    distribution = [{"type": t, "count": counts.get(t, 0)} for t in BAUMANN_16]

    return {
        "interval": interval,
        "gender": gender,
        "age_band": age_band,
        "total": total_set,
        "unassigned": unassigned,
        "distribution": distribution
    }

@router.get("/axis-summary")
def axis_summary(
    interval: str = Query("90d"),
    gender: str = Query("all"),
    age_band: str = Query("all"),
    db: Session = Depends(get_db)
):
    """
    4축 요약(OD/SR/PN/WT) — skin_type_code 각 글자 분해하여 비율 계산
    분모: 설정된 타입 레코드 수(total)
    """
    where = "WHERE 1=1 " + " ".join([
        _interval_sql(interval),
        _gender_sql(gender),
        _age_sql(age_band),
    ])

    params = {}
    if gender != "all":
        params["gender"] = gender

    sql = text(f"""
      SELECT
        SUBSTRING(skin_type_code, 1, 1) AS od,
        SUBSTRING(skin_type_code, 2, 1) AS sr,
        SUBSTRING(skin_type_code, 3, 1) AS pn,
        SUBSTRING(skin_type_code, 4, 1) AS wt
      FROM user_profiles
      {where}
        AND skin_type_code IS NOT NULL AND skin_type_code <> ''
    """)
    rows = db.execute(sql, params).mappings().all()
    total = len(rows)

    def pct(n: int) -> float:
        return round((n / total * 100), 2) if total else 0.0

    O = sum(1 for r in rows if r["od"] == "O"); D = total - O
    S = sum(1 for r in rows if r["sr"] == "S"); R = total - S
    N = sum(1 for r in rows if r["pn"] == "N"); P = total - N
    T = sum(1 for r in rows if r["wt"] == "T"); W = total - T

    return {
        "interval": interval,
        "gender": gender,
        "age_band": age_band,
        "total": total,
        "axes": {
            "OD": {"O": pct(O), "D": pct(D)},
            "SR": {"S": pct(S), "R": pct(R)},
            "PN": {"N": pct(N), "P": pct(P)},
            "WT": {"T": pct(T), "W": pct(W)}
        }
    }
