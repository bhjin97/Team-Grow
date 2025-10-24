# aller/storage_sql.py
import os
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

load_dotenv()

_ENGINE: Optional[Engine] = None


def _dsn_from_parts() -> str:
    """개별 ENV(DB_*)로 DSN 구성 (기존 방식 유지)"""
    dialect = os.getenv("DB_DIALECT", "{DB_DIALECT}")  # 예: mysql+pymysql, mariadb+pymysql
    user    = os.getenv("DB_USER", "{DB_USER}")
    pw      = os.getenv("DB_PASSWORD", "{DB_PASSWORD}")
    host    = os.getenv("DB_HOST", "{DB_HOST}")
    port    = os.getenv("DB_PORT", "{DB_PORT}")
    name    = os.getenv("DB_NAME", "{DB_NAME}")

    # 반드시 URL 인코딩!
    user_q = quote_plus(user)
    pw_q   = quote_plus(pw)
    name_q = quote_plus(name)

    return f"{dialect}://{user_q}:{pw_q}@{host}:{port}/{name_q}?charset=utf8mb4"


def _dsn() -> str:
    """DB_URI가 있으면 우선 사용, 없으면 기존 방식으로 DSN 구성"""
    return os.getenv("DB_URI") or _dsn_from_parts()


def get_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = create_engine(
            _dsn(),
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            future=True,
        )
    return _ENGINE


# ---------------------------
# 공통 쿼리 유틸
# ---------------------------
def fetch_all(sql: str, params: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    with get_engine().connect() as conn:
        rs = conn.execute(text(sql), params or {})
        return [dict(r._mapping) for r in rs]


def fetch_one(sql: str, params: Dict[str, Any] | None = None) -> Dict[str, Any] | None:
    with get_engine().connect() as conn:
        r = conn.execute(text(sql), params or {}).first()
        return dict(r._mapping) if r else None


def health_check() -> bool:
    try:
        _ = fetch_one("SELECT 1 AS ok")
        return True
    except Exception:
        return False


# ---------------------------
# 비즈니스 쿼리
# ---------------------------
def fetch_products_by_ids(ids: List[str]) -> List[Dict[str, Any]]:
    """제품 기본정보 + 리뷰 RAG 텍스트/요약 일부 포함 (product_data 기준)"""
    if not ids:
        return []

    placeholders = ",".join([f":id{i}" for i in range(len(ids))])
    params = {f"id{i}": v for i, v in enumerate(ids)}
    params["rag_max"] = int(os.getenv("REVIEW_RAG_MAXLEN", "4000"))

    # (선택) GROUP_CONCAT 길이 확장 — 권한 없으면 무시
    try:
        fetch_all("SET SESSION group_concat_max_len = 1000000")
    except Exception:
        pass

    sql = f"""
        SELECT
          p.pid,
          p.brand,
          p.product_name,
          p.category,
          p.price_krw,
          p.capacity,
          p.image_url,
          p.product_url,
          p.review_count,

          -- review_data에 여러 행이 있으면 합치고 앞부분만 노출
          SUBSTRING(
            GROUP_CONCAT(DISTINCT r.rag_text SEPARATOR '\n\n—\n\n'),
            1, :rag_max
          ) AS rag_text
        FROM product_data p
        LEFT JOIN review_data r
          ON r.product_pid = p.pid
        WHERE p.pid IN ({placeholders})
        GROUP BY p.pid
    """
    return fetch_all(sql, params)


def fetch_products_with_ingredients(ids: List[str]) -> List[Dict[str, Any]]:
    """
    제품 + 성분 리스트 한 번에(카디널리티 축약)
    - 우선 'product_ingredient_view(product_pid, ingredient_name)' 뷰가 있으면 사용
    - 없으면 product_ingredient + ingredient_dim 조인으로 대체
    """
    if not ids:
        return []

    placeholders = ",".join([f":id{i}" for i in range(len(ids))])
    params = {f"id{i}": v for i, v in enumerate(ids)}

    # 1) 뷰 버전 (있으면 주석 해제하여 사용)
    # sql = f"""
    #     SELECT
    #       p.pid,
    #       p.brand,
    #       p.product_name,
    #       p.category,
    #       p.price_krw,
    #       p.capacity,
    #       p.image_url,
    #       p.product_url,
    #       p.review_count,
    #       GROUP_CONCAT(v.ingredient_name ORDER BY v.ingredient_name SEPARATOR ', ') AS ingredients
    #     FROM product_data p
    #     LEFT JOIN product_ingredient_view v ON v.product_pid = p.pid
    #     WHERE p.pid IN ({placeholders})
    #     GROUP BY p.pid
    # """

    # 2) 조인 버전 (뷰 없을 때)
    sql = f"""
        SELECT
          p.pid,
          p.brand,
          p.product_name,
          p.category,
          p.price_krw,
          p.capacity,
          p.image_url,
          p.product_url,
          p.review_count,
          GROUP_CONCAT(i.ingredient_name ORDER BY i.ingredient_name SEPARATOR ', ') AS ingredients
        FROM product_data p
        LEFT JOIN product_ingredient pi
          ON pi.product_pid = p.pid
        LEFT JOIN ingredient_dim i
          ON i.ing_id = pi.ing_id
        WHERE p.pid IN ({placeholders})
        GROUP BY p.pid
    """
    return fetch_all(sql, params)


def fetch_ingredients_by_ids(ids: List[str]) -> List[Dict[str, Any]]:
    """성분 상세 (ingredients 기준)"""
    if not ids:
        return []
    placeholders = ",".join([f":id{i}" for i in range(len(ids))])
    params = {f"id{i}": v for i, v in enumerate(ids)}
    sql = f"""
        SELECT
          i.ing_id,
          i.ingredient_name,
          i.function_summary,
          i.caution,
          i.ewg_rating,
          i.aliases
        FROM ingredient_dim i
        WHERE i.ing_id IN ({placeholders})
    """
    return fetch_all(sql, params)
