# -*- coding: utf-8 -*-
import json
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional, Tuple, Literal

from sqlalchemy import text, bindparam  # expanding bind
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")


def log_event(event: str, **payload):
    """구조화 JSON 한 줄 로그."""
    try:
        logging.info("[BEAUTYBOT] " + json.dumps({"event": event, **payload}, ensure_ascii=False))
    except Exception as e:
        logging.info(f"[BEAUTYBOT] {{\"event\":\"{event}\",\"log_error\":\"{e}\"}}")


# ✅ db_connector에서 필요한 객체 로드
from db import (
    llm,                        # ChatOpenAI (messages API 호환)
    embeddings_model,           # OpenAIEmbeddings(text-embedding-3-large)
    engine,                     # SQLAlchemy Engine
    pinecone_client,            # Pinecone(api_key=...)
    RAG_PRODUCT_INDEX_NAME,     # "rag-product"
    INGREDIENT_NAME_INDEX,      # "ingredients-name"
    BRAND_NAME_INDEX,           # "brand-name"
)

# =============================================================================
# Pinecone 인덱스
# =============================================================================
feature_index         = pinecone_client.Index(RAG_PRODUCT_INDEX_NAME)
ingredient_name_index = pinecone_client.Index(INGREDIENT_NAME_INDEX)
brand_name_index      = pinecone_client.Index(BRAND_NAME_INDEX)

# =============================================================================
# 카테고리 표준/동의어 + 엄격 탐지
# =============================================================================
CATEGORY_TERMS = {
    "파우더/팩트", "블러셔", "쉐이딩", "메이크업 픽서", "컨실러", "프라이머/베이스",
    "쿠션", "파운데이션", "BB/CC", "하이라이터", "염색/다운펌",
    "클렌징밤", "클렌징오일", "클렌징폼/젤", "클렌징워터", "클렌징밀크/크림",
    "클렌징 비누", "팩클렌저",
    "워시오프팩", "필오프팩", "슬리핑팩", "모델링팩", "시트팩",
    "크림", "아이크림", "에센스/세럼/앰플", "스킨/토너", "로션", "올인원",
    "미스트/픽서", "페이스오일", "선스틱", "선크림",
}

CATEGORY_SYNONYMS = {
    "클렌저": "클렌징폼/젤", "클렌징 폼": "클렌징폼/젤", "클렌징 젤": "클렌징폼/젤", "클렌징 폼/젤": "클렌징폼/젤",
    "클렌징 밀크": "클렌징밀크/크림", "클렌징 크림": "클렌징밀크/크림", "클렌징 워터": "클렌징워터",
    "클렌징 오일": "클렌징오일", "클렌징 밤": "클렌징밤", "클렌징 비누": "클렌징 비누", "팩 클렌저": "팩클렌저",
    "워시오프 팩": "워시오프팩", "필오프 팩": "필오프팩", "슬리핑 팩": "슬리핑팩", "모델링 팩": "모델링팩", "시트 팩": "시트팩", "팩": "시트팩",
    "파우더": "파우더/팩트", "팩트": "파우더/팩트", "프라이머": "프라이머/베이스", "베이스": "프라이머/베이스",
    "쿠션팩트": "쿠션", "쿠션 파운데이션": "쿠션", "파데": "파운데이션", "비비": "BB/CC", "씨씨": "BB/CC",
    "메이크업픽서": "메이크업 픽서", "픽서": "메이크업 픽서",
    "수분크림": "크림", "진정크림": "크림", "보습크림": "크림", "크림류": "크림", "아이 크림": "아이크림",
    "세럼": "에센스/세럼/앰플", "앰플": "에센스/세럼/앰플", "에센스": "에센스/세럼/앰플",
    "스킨": "스킨/토너", "토너": "스킨/토너", "올인원 로션": "올인원", "올인원 제품": "올인원", "미스트": "미스트/픽서", "페이스 오일": "페이스오일",
    "썬크림": "선크림", "선블록": "선크림", "썬블록": "선크림", "자외선차단제": "선크림",
    "선스프레이": "선크림", "선젤": "선크림", "선 스틱": "선스틱",
}
STRICT_CATEGORY_MODE = True


def _norm_text(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = s.lower()
    s = re.sub(r"\s+", "", s)
    return s


_CATEGORY_KEYS_SORTED = sorted(
    list(CATEGORY_SYNONYMS.keys()) + list(CATEGORY_TERMS),
    key=lambda x: len(_norm_text(x)),
    reverse=True,
)


def strict_category_from_query(user_query: str) -> Optional[str]:
    qn = _norm_text(user_query)
    for raw_key in _CATEGORY_KEYS_SORTED:
        keyn = _norm_text(raw_key)
        if keyn in qn:
            if raw_key in CATEGORY_SYNONYMS:
                return CATEGORY_SYNONYMS[raw_key]
            if raw_key in CATEGORY_TERMS:
                return raw_key
    return None


def normalize_category(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    key = _norm_text(raw)
    for k, v in CATEGORY_SYNONYMS.items():
        if _norm_text(k) == key:
            return v
    for t in CATEGORY_TERMS:
        if _norm_text(t) == key:
            return t
    return None


# =============================================================================
# 0) LLM 분석기 (의도 + 파싱 통합)
# =============================================================================
Intent = Literal["PRODUCT_FIND", "GENERAL"]

_ANALYZE_SYSTEM = (
    "너는 화장품 추천 챗봇의 라우터이자 질의 파서다. "
    "사용자 한 문장을 보고 아래 JSON 스키마에 맞게 의도(intent)와 필터 정보를 한 번에 추출하라.\n\n"
    "반드시 유효한 JSON만 출력하고, 설명 문장이나 코드블록은 절대 추가하지 마라.\n\n"
    "스키마:\n"
    "{\n"
    '  "intent": "PRODUCT_FIND" | "GENERAL",\n'
    '  "brand": string | null,\n'
    '  "ingredients": string[],\n'
    '  "features": string[],\n'
    '  "price_range": [int|null, int|null]\n'
    "}\n\n"
    "- intent 규칙:\n"
    "  - PRODUCT_FIND: 제품 추천/탐색/비교/대체/찾기/구매 의도 또는 "
    "    카테고리/브랜드/가격/피처 요구가 있는 경우.\n"
    "  - GENERAL: 성분/원리/차이/부작용/루틴/상식 등 정보형 질문 또는 단순 대화.\n"
    "  - 헷갈리면 GENERAL.\n\n"
    "- brand: 브랜드명으로 보이는 경우만 채운다. 없으면 null.\n"
    "- ingredients: 성분명 리스트. 없으면 빈 배열.\n"
    "- features: 사용감·효과·특징(예: 수분감, 산뜻한, 민감피부용 등).\n"
    "- price_range 규칙:\n"
    "  - 원 단위 정수 [min, max]\n"
    '  - 예: \"3만원대\" → [30000, 39999]\n'
    '  - \"n원 이하\" → [0, n], \"n원 이상\" → [n, null]\n'
    "  - 가격 정보가 없으면 [null, null]\n"
)

_ANALYZE_TMPL = """
사용자 질의: "{q}"

위 스키마에 맞는 JSON만 출력하라.
설명, 코드블록, 추가 문장은 절대 쓰지 마라.
"""


def _safe_json_extract(text: str) -> Optional[Any]:
    if not text:
        return None

    fences = re.findall(r"```json\s*([\s\S]*?)```", text) or re.findall(
        r"```\s*([\s\S]*?)```", text
    )
    for blk in fences:
        s = blk.strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                return json.loads(s)
            except Exception:
                pass
        if s.startswith("{") and s.endswith("}"):
            try:
                return json.loads(s)
            except Exception:
                pass

    lb, rb = text.find("["), text.rfind("]")
    if 0 <= lb < rb:
        candidate = text[lb: rb + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    fb, rb = text.find("{"), text.rfind("}")
    if 0 <= fb < rb:
        candidate = text[fb: rb + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass
    return None


def analyze_with_llm(user_query: str) -> Dict[str, Any]:
    """의도 + 파싱을 한 번에 수행하는 LLM 호출."""
    prompt = _ANALYZE_TMPL.format(q=user_query)
    resp = llm.invoke(
        [
            {"role": "system", "content": _ANALYZE_SYSTEM},
            {"role": "user", "content": prompt},
        ]
    )
    raw = (getattr(resp, "content", "") or "").strip()
    data = _safe_json_extract(raw)

    if not isinstance(data, dict):
        # 한 번 더 재시도
        resp2 = llm.invoke(
            [
                {"role": "system", "content": _ANALYZE_SYSTEM},
                {
                    "role": "user",
                    "content": "직전 응답이 JSON 형식이 아닙니다. "
                               "반드시 스키마에 맞는 JSON만 출력하세요.\n\n"
                               + prompt,
                },
            ]
        )
        raw2 = (getattr(resp2, "content", "") or "").strip()
        data = _safe_json_extract(raw2)

    if not isinstance(data, dict):
        data = {}

    # intent 정규화
    intent_raw = (data.get("intent") or "GENERAL").upper()
    intent: Intent = "PRODUCT_FIND" if intent_raw == "PRODUCT_FIND" else "GENERAL"

    # 나머지 필드 정규화
    brand = data.get("brand") or None
    ingredients = [
        str(s).strip() for s in (data.get("ingredients") or []) if str(s).strip()
    ]
    features = [
        str(s).strip() for s in (data.get("features") or []) if str(s).strip()
    ]

    pr = data.get("price_range") or [None, None]

    def _i(x):
        try:
            return int(x) if x is not None else None
        except Exception:
            return None

    if isinstance(pr, (list, tuple)) and len(pr) == 2:
        price_range = (_i(pr[0]), _i(pr[1]))
    else:
        price_range = (None, None)

    # category는 여전히 질의에서 규칙 기반으로 감지
    category = strict_category_from_query(user_query) if STRICT_CATEGORY_MODE else None

    parsed = {
        "brand": brand,
        "category": category,
        "ingredients": ingredients,
        "features": features,
        "price_range": price_range,
    }

    # 코어 레벨에서는 기본적으로 로그를 찍지 않고,
    # 상위 레이어(recommender.py)에서 intent/parsed를 로깅한다.

    return {
        "intent": intent,
        "parsed": parsed,
    }


# =============================================================================
# 2) 임베딩 & 인덱스 헬퍼
# =============================================================================
def embed_query(text_: str) -> List[float]:
    return embeddings_model.embed_query(text_)


def resolve_brand_name(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    vec = embed_query(raw)
    res = brand_name_index.query(vector=vec, top_k=1, include_metadata=True)
    if not res.get("matches"):
        return None
    return (res["matches"][0].get("metadata") or {}).get("brand")


def resolve_ingredient_ids(tokens: Optional[List[str]]) -> List[int]:
    if not tokens:
        return []
    out: List[int] = []
    for t in tokens:
        vec = embed_query(t)
        res = ingredient_name_index.query(vector=vec, top_k=1, include_metadata=False)
        if res.get("matches"):
            out.append(int(res["matches"][0]["id"]))
    return list(dict.fromkeys(out))


def feature_candidates_from_text(
    text_for_search: str, top_k: int = 300
) -> Tuple[List[int], Dict[int, float]]:
    vec = embed_query(text_for_search)
    res = feature_index.query(vector=vec, top_k=top_k, include_metadata=False)
    pids, scores = [], {}
    for m in (res.get("matches") or []):
        pid = int(m["id"])
        pids.append(pid)
        scores[pid] = float(m["score"])
    return pids, scores


def dedup_keep_best(
    candidate_pids: List[int], score_map: Dict[int, float]
) -> Tuple[List[int], Dict[int, float]]:
    best: Dict[int, float] = {}
    for pid in candidate_pids:
        s = float(score_map.get(int(pid), 0.0))
        if (pid not in best) or (s > best[pid]):
            best[pid] = s
    unique_sorted_pids = sorted(best.keys(), key=lambda x: -best[x])
    return unique_sorted_pids, best


def _normalize_ingredients(val) -> List[str]:
    if val is None:
        return []
    if isinstance(val, list):
        items = [str(x).strip() for x in val if str(x).strip()]
        return list(dict.fromkeys(items))
    s = str(val).strip()
    if not s:
        return []
    if (s.startswith("[") and s.endswith("]")) or (s.startswith('"') and s.endswith('"')):
        try:
            j = json.loads(s)
            if isinstance(j, list):
                items = [str(x).strip() for x in j if str(x).strip()]
                return list(dict.fromkeys(items))
        except Exception:
            pass
    parts = re.split(r"[,\|\;\n\/·•]+", s)
    items = [p.strip() for p in parts if p and p.strip()]
    return list(dict.fromkeys(items))


def fetch_ingredient_grades(names: List[str]) -> Dict[str, Optional[str]]:
    if not names:
        return {}
    sql = text(
        """
        SELECT korean_name, caution_grade
        FROM ingredients
        WHERE korean_name IN :names
    """
    ).bindparams(bindparam("names", expanding=True))
    with engine.connect() as conn:
        rows = conn.execute(
            sql, {"names": tuple(sorted(set(names)))}
        ).mappings().all()
    return {r["korean_name"]: r["caution_grade"] for r in rows}


# =============================================================================
# 3) RDB 유틸
# =============================================================================
def rdb_filter(
    candidate_pids: Optional[List[int]],
    brand: Optional[str],
    ingredient_ids: Optional[List[int]],
    price_range: Optional[Tuple[Optional[int], Optional[int]]],
    category: Optional[str],
    limit: int = 30,
) -> List[Dict]:
    candidate_pids = candidate_pids or []
    ingredient_ids = ingredient_ids or []
    minp, maxp = price_range or (None, None)

    where_clauses = ["1=1"]
    params: Dict[str, Any] = {
        "brand": brand,
        "category": category,
        "minp": minp,
        "maxp": maxp,
        "limit": limit,
    }
    if candidate_pids:
        where_clauses.append("p.pid IN :pids")
        params["pids"] = tuple(candidate_pids)

    where_clauses.append("(:brand IS NULL OR p.brand = :brand)")
    where_clauses.append("(:category IS NULL OR p.category = :category)")
    where_clauses.append("(:minp IS NULL OR p.price_krw >= :minp)")
    where_clauses.append("(:maxp IS NULL OR p.price_krw <= :maxp)")

    having_clause = ""
    binds = []
    if ingredient_ids:
        where_clauses.append("m.ingredient_id IN :ingredient_ids")
        params["ingredient_ids"] = tuple(ingredient_ids)
        params["ing_cnt"] = len(ingredient_ids)
        having_clause = """
            HAVING COUNT(DISTINCT CASE WHEN m.ingredient_id IN :ingredient_ids THEN m.ingredient_id END) = :ing_cnt
        """
        binds.append(bindparam("ingredient_ids", expanding=True))

    where_sql = " AND ".join(where_clauses)

    if minp is None and maxp is None:
        # 가격 필터가 없으면 review_count DESC
        order_sql = "ORDER BY p.review_count DESC, p.pid ASC"
    else:
        # 기존 기본 정렬 (가격 오름차순)
        order_sql = "ORDER BY (p.price_krw IS NULL) ASC, p.price_krw ASC, p.pid"

    sql = text(
        f"""
        SELECT p.pid, p.brand, p.product_name, p.price_krw, p.category, p.rag_text,
               p.image_url, p.product_url, p.ingredients
        FROM product_data_chain AS p
        LEFT JOIN product_ingredient_map AS m ON m.product_pid = p.pid
        WHERE {where_sql}
        GROUP BY p.pid, p.brand, p.product_name, p.price_krw, p.category, p.rag_text, p.ingredients
        {having_clause}
        {order_sql}
        LIMIT :limit
    """
    )
    if "pids" in params:
        binds.append(bindparam("pids", expanding=True))
    if binds:
        sql = sql.bindparams(*binds)

    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, params).mappings().all()
            items = []
            for r in rows:
                d = dict(r)
                d["ingredients"] = _normalize_ingredients(d.pop("ingredients", None))
                items.append(d)
        return items
    except Exception as e:
        log_event("rdb_filter_error", error=str(e))
        return []


def rdb_fetch_by_pids(pids: List[int], limit: int = 30) -> List[Dict]:
    if not pids:
        return []
    sql = text(
        """
        SELECT p.pid, p.brand, p.product_name, p.price_krw, p.category,
               p.rag_text, p.image_url, p.product_url, p.ingredients
        FROM product_data_chain AS p
        WHERE p.pid IN :pids
        LIMIT :limit
    """
    ).bindparams(bindparam("pids", expanding=True))
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                sql, {"pids": tuple(pids), "limit": limit}
            ).mappings().all()
        items = []
        for r in rows:
            d = dict(r)
            d["ingredients"] = _normalize_ingredients(d.pop("ingredients", None))
            items.append(d)
        by_pid = {it["pid"]: it for it in items}
        ordered = [by_pid[pid] for pid in pids if pid in by_pid]
        return ordered[:limit]
    except Exception as e:
        log_event("rdb_fetch_by_pids_error", error=str(e))
        return []


def rdb_fetch_rag_texts(pids: List[int]) -> List[Dict]:
    if not pids:
        return []
    sql = text(
        """
        SELECT p.pid, p.rag_text
        FROM product_data_chain AS p
        WHERE p.pid IN :pids
    """
    ).bindparams(bindparam("pids", expanding=True))
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"pids": tuple(pids)}).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        log_event("rdb_fetch_rag_texts_error", error=str(e))
        return []


# =============================================================================
# 4) 검색 파이프라인 (추천 경로 내부)
# =============================================================================
def is_info_scarce(parsed: Dict) -> bool:
    """feature도 없고, 브랜드/카테고리/성분/가격 필터도 모두 비어 있으면 True."""
    feats_empty = not (parsed.get("features"))
    pr = parsed.get("price_range") or (None, None)
    has_filters = any(
        [
            parsed.get("brand"),
            parsed.get("category"),
            (parsed.get("ingredients") or []),
            any(pr),
        ]
    )
    return feats_empty and not has_filters


def _price_key(v: Optional[int]) -> int:
    return v if v is not None else 10**12


def search_pipeline_from_parsed(
    parsed: Dict[str, Any], user_query: str, use_raw_for_features: bool = True
) -> Dict[str, Any]:
    # 1) 정보가 너무 부족한 경우 → 바로 메시지 리턴
    if is_info_scarce(parsed):
        log_event(
            "info_scarce",
            brand=parsed.get("brand"),
            category=parsed.get("category"),
            has_features=bool(parsed.get("features")),
            has_ingredients=bool(parsed.get("ingredients")),
            price_range=parsed.get("price_range"),
        )
        return {
            "parsed": parsed,
            "normalized": {
                "brand": None,
                "ingredient_ids": [],
                "category": None,
            },
            "results": [],
            "message": "조금만 더 구체적으로 말씀해 주세요. 예) ‘브랜드: 라네즈, 나이아신아마이드 포함’ / ‘선크림, 2만원대, 끈적임 없음’",
        }

    brand_norm = resolve_brand_name(parsed.get("brand"))
    ingredient_ids = resolve_ingredient_ids(parsed.get("ingredients"))

    has_features = bool(parsed.get("features"))
    pr = parsed.get("price_range") or (None, None)
    has_hardfilter = any(
        [brand_norm, ingredient_ids, any(pr), parsed.get("category")]
    )

    rows: List[Dict] = []

    # 2) feature 기반 검색이 있는 경우 (vector-first + RDB 필터)
    if has_features:
        feature_text = " ".join(parsed.get("features") or []) or user_query
        candidate_pids_raw, score_map_raw = feature_candidates_from_text(
            feature_text, top_k=300
        )
        candidate_pids, score_map = dedup_keep_best(candidate_pids_raw, score_map_raw)

        if has_hardfilter:
            rows = rdb_filter(
                candidate_pids=candidate_pids,
                brand=brand_norm,
                ingredient_ids=ingredient_ids,
                price_range=parsed.get("price_range"),
                category=parsed.get("category"),
                limit=30,
            )

            if rows:
                rows.sort(
                    key=lambda r: (
                        -(score_map.get(int(r["pid"]), 0.0)),
                        _price_key(r.get("price_krw")),
                        int(r["pid"]),
                    )
                )
        else:
            if candidate_pids:
                candidate_pids = sorted(
                    candidate_pids,
                    key=lambda pid: -(score_map.get(int(pid), 0.0)),
                )
                rows = rdb_fetch_by_pids(candidate_pids[:30], limit=30)
                if rows:
                    rows.sort(
                        key=lambda r: (
                            -(score_map.get(int(r["pid"]), 0.0)),
                            _price_key(r.get("price_krw")),
                            int(r["pid"]),
                        )
                    )
            else:
                rows = []
    # 3) feature가 없는 경우 → RDB-first (필터만으로 검색)
    else:
        rows = rdb_filter(
            candidate_pids=None,
            brand=brand_norm,
            ingredient_ids=ingredient_ids,
            price_range=parsed.get("price_range"),
            category=parsed.get("category"),
            limit=30,
        )

    # 4) 가격 필터 기반 2차 정렬
    if rows:
        minp, maxp = parsed.get("price_range") or (None, None)

        # ① feature가 있는 경우 → score + 가격을 같이 반영
        if has_features:
            # score_map은 feature 경로에서만 만들어졌으므로, 없으면 그냥 0.0
            def _score(pid: int) -> float:
                return score_map.get(int(pid), 0.0)

            if maxp is not None and (minp is None or minp == 0):
                # "n원 이하" → 비싼 제품 우선 + 그 안에서 score 높은 순
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        -(r.get("price_krw") or 0),
                        -_score(r["pid"]),
                        int(r["pid"]),
                    )
                )
            elif minp is not None and (maxp is None or maxp == 0):
                # "n원 이상" → 싼 제품 우선 + 그 안에서 score 높은 순
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        (r.get("price_krw") or 0),
                        -_score(r["pid"]),
                        int(r["pid"]),
                    )
                )
            elif minp is not None and maxp is not None:
                # 구간 중앙값에 가까운 순 + 그 안에서 score 높은 순
                mid = (minp + maxp) / 2
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        abs((r.get("price_krw") or mid) - mid),
                        -_score(r["pid"]),
                        int(r["pid"]),
                    )
                )

        # ② feature가 없는 경우 → 가격 기준만 사용
        else:
            if maxp is not None and (minp is None or minp == 0):
                # "n원 이하" → 비싼 제품 우선
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        -(r.get("price_krw") or 0),
                        int(r["pid"]),
                    )
                )
            elif minp is not None and (maxp is None or maxp == 0):
                # "n원 이상" → 싼 제품 우선
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        (r.get("price_krw") or 0),
                        int(r["pid"]),
                    )
                )
            elif minp is not None and maxp is not None:
                # 구간 중앙값에 가까운 순
                mid = (minp + maxp) / 2
                rows.sort(
                    key=lambda r: (
                        r.get("price_krw") is None,
                        abs((r.get("price_krw") or mid) - mid),
                        int(r["pid"]),
                    )
                )

    return {
        "parsed": parsed,
        "normalized": {
            "brand": brand_norm,
            "ingredient_ids": ingredient_ids,
            "category": parsed.get("category"),
        },
        "results": rows,
    }


# =============================================================================
# 5) 출력 생성 (상위 5 → 3개, rag_text만으로 요약)
# =============================================================================
_FINALIZE_FROM_RAG_SYSTEM = (
    "너는 화장품 추천 챗봇이다. 아래 입력의 'items'는 제품별 rag_text가 포함된 JSON 배열이다.\n"
    "사용자 질의(q)를 바탕으로 제품 후보 중 가장 관련성 높은 최대 3개의 제품을 선택하고, "
    "친절하게 자연스러운 한국어로 추천 결과를 구성하라.\n\n"
    "출력 형식은 마크다운으로 다음과 같이 작성한다:\n"
    "각 제품의 rag_text를 참고해 제품명을 추정해 작성하라.\n"
    "1. 질의 요약 또는 서문 1~2줄 (자연스러운 말투)\n"
    "2. 빈 줄 1줄\n"
    "3. 최대 3개의 불릿 리스트로 각 제품 소개 (**제품명** — 설명)\n\n"
    "규칙:\n"
    "- 제품명은 **굵게(**)** 표시한다.\n"
    "- 설명은 약 150~200자 내외로, rag_text 내용을 참고해 간결하게 요약한다.\n"
    "- 제품 성분·특징·효과는 rag_text에 기반해야 한다.\n"
    "- JSON, 코드블록, 따옴표, 추가 해설 없이 마크다운 문장만 출력한다.\n"
    "- 친근하고 자연스럽지만 과장된 표현은 피한다.\n"
    "- 반드시 마지막 줄에는 아래 문장을 그대로 추가하라:\n"
    "  '※ 위 추천 내용은 사용자 리뷰 데이터를 기반으로 한 정보입니다.'"
)

_FINALIZE_FROM_RAG_TMPL = """
[사용자 질의]
{q}

[제품 목록] 
{items}
"""


def stream_finalize_from_rag_texts(user_query: str, results: List[Dict[str, Any]]):
    """
    finalize_from_rag_texts의 스트리밍 버전.
    - OpenAI(ChatOpenAI)의 .stream()을 사용해 토큰이 나오는 즉시 yield.
    - routes.py의 /finalize 스트리밍 API에서 사용.
    """
    top5 = results[:5]
    items = [
        {
            "brand": r.get("brand"),
            "price_krw": int(r["price_krw"]) if r.get("price_krw") is not None else None,
            "rag_text": (r.get("rag_text") or "")[:2000],
        }
        for r in top5
    ]

    prompt = _FINALIZE_FROM_RAG_TMPL.format(
        q=user_query,
        items=json.dumps(items, ensure_ascii=False, indent=2),
    )

    messages = [
        {"role": "system", "content": _FINALIZE_FROM_RAG_SYSTEM},
        {"role": "user", "content": prompt},
    ]

    for chunk in llm.stream(messages):
        txt = getattr(chunk, "content", "") or ""
        # 절대 strip() 하지 말 것!! 공백/개행이 여기 다 들어있음
        if not txt:
            continue
        yield txt


# =============================================================================
# 6) 일반 질의용
# =============================================================================
_GENERAL_SYSTEM = (
    "너는 화장품 성분/제품/화장품성분 정보에 특화된 한국어 어시스턴트다. "
    "과장 없이 사실 위주로 간결하게 설명하고, 필요하면 간단한 팁을 덧붙인다."
    "질문이 화장품, 스킨케어, 뷰티, 성분, 피부 관련이 아니면 "
    "응답은 간략하게 한 후에 다음과 같이 응답하라: "
    "'죄송하지만 저는 화장품 관련 질문에만 답변드릴 수 있어요. '"
)
_GENERAL_TMPL = """
아래 질문에 대해 화장품/피부관리 관점에서 핵심만 간결하게 4~6문장으로 설명해줘.
- 성분, 원리, 제품, 사용 순서, 루틴, 주의점 중 해당되는 내용을 중심으로
- 너무 단정적인 표현(보장, 치료, 의학적 효과)은 피하라
질문: {q}
"""


def generate_general_answer(user_query: str) -> str:
    resp = llm.invoke(
        [
            {"role": "system", "content": _GENERAL_SYSTEM},
            {"role": "user", "content": _GENERAL_TMPL.format(q=user_query)},
        ]
    )
    return (getattr(resp, "content", "") or "").strip()


# =============================================================================
# 7) 카드(presented) 변환 헬퍼
# =============================================================================
def build_presented(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    검색된 rows 리스트를 받아서,
    - 상위 5개에서 성분 등급을 조회하고
    - 프론트에서 쓰는 presented 카드 구조로 변환
    """
    top_rows = rows[:5]

    # 1) 성분 이름 수집
    all_ings: List[str] = []
    for r in top_rows:
        for n in (r.get("ingredients") or []):
            if isinstance(n, str) and n.strip():
                all_ings.append(n.strip())

    # 2) caution_grade 매핑 조회
    grade_map = fetch_ingredient_grades(all_ings)

    # 3) 카드 구조로 변환
    presented: List[Dict[str, Any]] = []
    for r in top_rows:
        full_rag = r.get("rag_text") or ""
        presented.append(
            {
                "pid": r["pid"],
                "brand": r["brand"],
                "product_name": r["product_name"],
                "price_krw": int(r["price_krw"])
                if r.get("price_krw") is not None
                else None,
                "category": r.get("category"),
                "rag_text": full_rag,
                "image_url": r.get("image_url") or None,
                "product_url": r.get("product_url") or None,
                "ingredients": r.get("ingredients", []),
                "ingredients_detail": [
                    {"name": n, "caution_grade": grade_map.get(n)}
                    for n in (r.get("ingredients", []) or [])
                ],
            }
        )

    return presented
