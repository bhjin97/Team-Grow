# recommender.py
## feature_text로 변형하여 임베딩 비교한 코드(유사도반영)
# -*- coding: utf-8 -*-
import json
import re
import time
import unicodedata
from pprint import pformat
from typing import Any, Dict, List, Optional, Tuple, Literal

from sqlalchemy import text, bindparam  # expanding bind

# ✅ db_connector에서 필요한 객체 로드
from db import (
    llm,                        # ChatOpenAI (messages API 호환)
    embeddings_model,           # OpenAIEmbeddings(text-embedding-3-large)
    engine,                 # SQLAlchemy Engine
    pinecone_client,            # Pinecone(api_key=...)
    RAG_PRODUCT_INDEX_NAME,         # "rag-product"
    PRODUCT_NAME_INDEX,         # "product-name"
    INGREDIENT_NAME_INDEX,      # "ingredients-name"
    BRAND_NAME_INDEX,           # "brand-name"
)

# =============================================================================
# Logger
# =============================================================================
class Logger:
    def __init__(self):
        self.t0 = time.time()
        self.step_no = 0
    def section(self, title: str):
        self.step_no += 1
        print(f"\n{'='*80}")
        print(f"[{self.step_no:02d}] {title}")
        print(f"{'-'*80}")
    def kv(self, key: str, value):
        def _short(v):
            if isinstance(v, (list, tuple)):
                if len(v) > 10:
                    return list(v[:10]) + ["..."] + [f"(len={len(v)})"]
                return v
            return v
        print(f"  - {key}: {pformat(_short(value), width=90, compact=True)}")
    def json(self, title: str, obj: dict):
        print(f"  ▷ {title}:")
        print(pformat(obj, width=100, compact=False))
    def sql(self, where_sql: str, having_sql: Optional[str], params: Dict[str, Any]):
        print("  ▷ SQL WHERE")
        print(f"     {where_sql}")
        if having_sql and having_sql.strip():
            print("  ▷ SQL HAVING")
            print("     " + " ".join(having_sql.split()))
        shown = {}
        for k, v in params.items():
            if isinstance(v, tuple):
                vv = list(v)
                if len(vv) > 10:
                    vv = vv[:10] + ["..."] + [f"(len={len(v)})"]
                shown[k] = vv
            else:
                shown[k] = v
        print("  ▷ SQL PARAMS")
        print(pformat(shown, width=100, compact=True))
    def sample_rows(
        self,
        rows: List[Dict],
        n: int = 10,
        score_map: Optional[Dict[int, float]] = None
    ):
        print(f"  ▷ SAMPLE ROWS (showing up to {n})")
        for r in rows[:n]:
            pid = r.get("pid")
            bn = r.get("brand")
            pn = r.get("product_name")
            pr = r.get("price_krw")
            ct = r.get("category")
            if score_map is not None and pid is not None:
                sim = score_map.get(int(pid))
                if sim is not None:
                    print(f"    • [{bn}] {pn} | {pr}원 | {ct} | pid={pid} | sim={sim:.4f}")
                    continue
            print(f"    • [{bn}] {pn} | {pr}원 | {ct} | pid={pid}")
    def done(self):
        print(f"\n{'='*80}")
        print(f"[DONE] elapsed: {time.time()-self.t0:.2f}s")
        print(f"{'='*80}\n")

LOG = Logger()

# =============================================================================
# Pinecone 인덱스
# =============================================================================
feature_index         = pinecone_client.Index(RAG_PRODUCT_INDEX_NAME)
product_name_index    = pinecone_client.Index(PRODUCT_NAME_INDEX)
ingredient_name_index = pinecone_client.Index(INGREDIENT_NAME_INDEX)
brand_name_index      = pinecone_client.Index(BRAND_NAME_INDEX)

# =============================================================================
# 카테고리 표준/동의어 + 엄격 탐지
# =============================================================================
CATEGORY_TERMS = {
    "파우더/팩트","블러셔","쉐이딩","메이크업 픽서","컨실러","프라이머/베이스",
    "쿠션","파운데이션","BB/CC","하이라이터","염색/다운펌",
    "클렌징밤","클렌징오일","클렌징폼/젤","클렌징워터","클렌징밀크/크림",
    "클렌징 비누","팩클렌저",
    "워시오프팩","필오프팩","슬리핑팩","모델링팩","시트팩",
    "크림","아이크림","에센스/세럼/앰플","스킨/토너","로션","올인원",
    "미스트/픽서","페이스오일","선스틱","선크림"
}
CATEGORY_SYNONYMS = {
    "클렌저":"클렌징폼/젤","클렌징 폼":"클렌징폼/젤","클렌징 젤":"클렌징폼/젤","클렌징 폼/젤":"클렌징폼/젤",
    "클렌징 밀크":"클렌징밀크/크림","클렌징 크림":"클렌징밀크/크림","클렌징 워터":"클렌징워터",
    "클렌징 오일":"클렌징오일","클렌징 밤":"클렌징밤","클렌징 비누":"클렌징 비누","팩 클렌저":"팩클렌저",
    "워시오프 팩":"워시오프팩","필오프 팩":"필오프팩","슬리핑 팩":"슬리핑팩","모델링 팩":"모델링팩","시트 팩":"시트팩","팩":"시트팩",
    "파우더":"파우더/팩트","팩트":"파우더/팩트","프라이머":"프라이머/베이스","베이스":"프라이머/베이스",
    "쿠션팩트":"쿠션","쿠션 파운데이션":"쿠션","파데":"파운데이션","비비":"BB/CC","씨씨":"BB/CC",
    "메이크업픽서":"메이크업 픽서","픽서":"메이크업 픽서",
    "수분크림":"크림","진정크림":"크림","보습크림":"크림","크림류":"크림","아이 크림":"아이크림",
    "세럼":"에센스/세럼/앰플","앰플":"에센스/세럼/앰플","에센스":"에센스/세럼/앰플",
    "스킨":"스킨/토너","토너":"스킨/토너","올인원 로션":"올인원","올인원 제품":"올인원","미스트":"미스트/픽서","페이스 오일":"페이스오일",
    "썬크림":"선크림","선블록":"선크림","썬블록":"선크림","자외선차단제":"선크림","선스프레이":"선크림","선젤":"선크림","선 스틱":"선스틱",
}
STRICT_CATEGORY_MODE = True

def _norm_text(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = s.lower()
    s = re.sub(r"\s+", "", s)
    return s

_CATEGORY_KEYS_SORTED = sorted(
    list(CATEGORY_SYNONYMS.keys()) + list(CATEGORY_TERMS),
    key=lambda x: len(_norm_text(x)), reverse=True
)

def strict_category_from_query(user_query: str) -> Optional[str]:
    qn = _norm_text(user_query)
    for raw_key in _CATEGORY_KEYS_SORTED:
        keyn = _norm_text(raw_key)
        if keyn in qn:
            if raw_key in CATEGORY_SYNONYMS: return CATEGORY_SYNONYMS[raw_key]
            if raw_key in CATEGORY_TERMS:    return raw_key
    return None

def normalize_category(raw: Optional[str]) -> Optional[str]:
    if not raw: return None
    key = _norm_text(raw)
    for k, v in CATEGORY_SYNONYMS.items():
        if _norm_text(k) == key: return v
    for t in CATEGORY_TERMS:
        if _norm_text(t) == key: return t
    return None

# =============================================================================
# 0) LLM 의도 분류기 (최초 라우팅 전용)
# =============================================================================
Intent = Literal["PRODUCT_FIND", "GENERAL"]

_INTENT_SYSTEM = (
    "너는 화장품 챗봇의 라우터다. 사용자 한 문장을 보고 의도를 분류하라.\n"
    "반드시 아래 둘 중 하나의 JSON만 출력한다.\n"
    '{"intent":"PRODUCT_FIND"}  또는  {"intent":"GENERAL"}\n\n'
    "- PRODUCT_FIND: 제품 추천/탐색/비교/대체/찾기/구매 의도 또는 카테고리/브랜드/가격/피처 요구가 있는 경우.\n"
    "- GENERAL: 성분/원리/차이/부작용/루틴/상식 등 정보형 질문 또는 단순 대화.\n"
    "- 헷갈리면 GENERAL."
)

def _safe_json_extract(text: str) -> Optional[Any]:
    """최상위가 객체({})든 배열([])이든 안전하게 추출."""
    if not text:
        return None

    # 1) ```json ... ``` 또는 ``` ... ``` 블록 먼저
    fences = re.findall(r"```json\s*([\s\S]*?)```", text) or re.findall(r"```\s*([\s\S]*?)```", text)
    for blk in fences:
        s = blk.strip()
        # 배열 시도
        if s.startswith("[") and s.endswith("]"):
            try:
                return json.loads(s)
            except Exception:
                pass
        # 객체 시도
        if s.startswith("{") and s.endswith("}"):
            try:
                return json.loads(s)
            except Exception:
                pass

    # 2) 본문에서 배열 우선 탐지
    lb, rb = text.find("["), text.rfind("]")
    if 0 <= lb < rb:
        candidate = text[lb:rb+1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # 3) 본문에서 객체 탐지(후순위)
    fb, rb = text.find("{"), text.rfind("}")
    if 0 <= fb < rb:
        candidate = text[fb:rb+1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    return None


def decide_intent_with_llm(user_query: str) -> Intent:
    resp = llm.invoke([
        {"role":"system","content":_INTENT_SYSTEM},
        {"role":"user","content": f"문장: {user_query}\n위 지침에 따라 의도만 JSON으로 답하라."}
    ])
    raw = (getattr(resp,"content","") or "").strip()
    data = _safe_json_extract(raw)

    # ✅ 의도 파싱 안정화: dict가 아니면 버리고 기본값 사용
    if not isinstance(data, dict):
        data = {}
    intent = (data.get("intent") or "GENERAL").upper()
    return "PRODUCT_FIND" if intent == "PRODUCT_FIND" else "GENERAL"

# =============================================================================
# 1) LLM 파서 (추천 경로에서만 호출)
# =============================================================================
_EXTRACT_SYSTEM = (
    "너는 화장품 추천 챗봇의 질의 파서다. "
    "사용자 문장에서 아래 항목들을 JSON으로 정확히 추출한다. "
    "모르면 null 또는 빈 배열을 사용하고, 숫자는 정수로만 반환한다. "
    "brand는 브랜드명, product는 '정식 제품명(모델명)'일 때만 추출하며, "
    "category는 별도의 규칙으로 감지된다(너는 추출하지 말 것)."
)
_EXTRACT_TMPL = """
사용자 질의: "{q}"

아래 스키마로만 JSON 출력:
{
  "brand": string|null,
  "product": string|null,
  "ingredients": string[],
  "features": string[],
  "price_range": [int|null, int|null]
}
규칙:
- product는 실제 제품명(모델명)만 넣어.
- "만원대" 등은 원 단위로 변환(예: 3만원대 → [30000, 39999]).
- "이하/이상"은 [0, n] 또는 [n, null].
- 가격 모르면 [null, null].
- 꼭 유효한 JSON만 출력(설명/텍스트 금지).
"""

def _default_parsed() -> Dict[str, Any]:
    return {"brand": None, "product": None, "category": None,
            "ingredients": [], "features": [], "price_range": (None, None)}

def extract_with_llm(user_query: str) -> Dict[str, Any]:
    prompt = _EXTRACT_TMPL.replace("{q}", user_query)
    resp = llm.invoke([
        {"role":"system","content":_EXTRACT_SYSTEM},
        {"role":"user","content": prompt}
    ])
    data = _safe_json_extract((getattr(resp,"content","") or "").strip())
    if data is None:
        resp2 = llm.invoke([
            {"role":"system","content":_EXTRACT_SYSTEM},
            {"role":"user","content":"직전 응답이 JSON이 아닙니다. 위 스키마로 JSON만 출력하세요."}
        ])
        data = _safe_json_extract((getattr(resp2,"content","") or "").strip())
    if data is None: data = _default_parsed()

    brand       = data.get("brand") or None
    product     = data.get("product") or None
    ingredients = [str(s).strip() for s in (data.get("ingredients") or []) if str(s).strip()]
    features    = [str(s).strip() for s in (data.get("features") or []) if str(s).strip()]
    pr          = data.get("price_range") or [None, None]
    def _i(x): return int(x) if (x is not None) else None
    price_range = (_i(pr[0]), _i(pr[1])) if isinstance(pr,(list,tuple)) and len(pr)==2 else (None,None)
    category = strict_category_from_query(user_query) if STRICT_CATEGORY_MODE else None

    return {"brand": brand, "product": product, "category": category,
            "ingredients": ingredients, "features": features, "price_range": price_range}

# =============================================================================
# 2) 임베딩 & 인덱스 헬퍼
# =============================================================================
def embed_query(text_: str) -> List[float]:
    return embeddings_model.embed_query(text_)

def resolve_brand_name(raw: Optional[str]) -> Optional[str]:
    if not raw: return None
    vec = embed_query(raw)
    res = brand_name_index.query(vector=vec, top_k=1, include_metadata=True)
    if not res.get("matches"): return None
    return (res["matches"][0].get("metadata") or {}).get("brand")

def resolve_product_pid_candidates(raw: Optional[str], top_k: int = 5) -> List[int]:
    if not raw: return []
    vec = embed_query(raw)
    res = product_name_index.query(vector=vec, top_k=top_k, include_metadata=False)
    return [int(m["id"]) for m in (res.get("matches") or [])]

def resolve_ingredient_ids(tokens: Optional[List[str]]) -> List[int]:
    if not tokens: return []
    out: List[int] = []
    for t in tokens:
        vec = embed_query(t)
        res = ingredient_name_index.query(vector=vec, top_k=1, include_metadata=False)
        if res.get("matches"): out.append(int(res["matches"][0]["id"]))
    return list(dict.fromkeys(out))

def feature_candidates_from_text(text_for_search: str, top_k: int = 300) -> Tuple[List[int], Dict[int, float]]:
    vec = embed_query(text_for_search)
    res = feature_index.query(vector=vec, top_k=top_k, include_metadata=False)
    pids, scores = [], {}
    for m in (res.get("matches") or []):
        pid = int(m["id"])
        pids.append(pid); scores[pid] = float(m["score"])
    return pids, scores

def dedup_keep_best(candidate_pids: List[int], score_map: Dict[int, float]) -> Tuple[List[int], Dict[int, float]]:
    best: Dict[int, float] = {}
    for pid in candidate_pids:
        s = float(score_map.get(int(pid), 0.0))
        if (pid not in best) or (s > best[pid]): best[pid] = s
    unique_sorted_pids = sorted(best.keys(), key=lambda x: -best[x])
    return unique_sorted_pids, best

def _normalize_ingredients(val) -> List[str]:
    """
    product_data_chain.ingredients 컬럼을 배열[str]로 정규화.
    - JSON 배열이면 그대로 사용
    - 문자열이면 구분자(, | ; \n / · •)로 스플릿
    - 공백/중복 제거
    """
    if val is None:
        return []
    if isinstance(val, list):
        items = [str(x).strip() for x in val if str(x).strip()]
        return list(dict.fromkeys(items))

    s = str(val).strip()
    if not s:
        return []
    # JSON 배열일 가능성 먼저
    if (s.startswith("[") and s.endswith("]")) or (s.startswith('"') and s.endswith('"')):
        try:
            j = json.loads(s)
            if isinstance(j, list):
                items = [str(x).strip() for x in j if str(x).strip()]
                return list(dict.fromkeys(items))
        except Exception:
            pass

    # 구분자로 분리
    parts = re.split(r"[,\|\;\n\/·•]+", s)
    items = [p.strip() for p in parts if p and p.strip()]
    return list(dict.fromkeys(items))


# =============================================================================
# 3) RDB 유틸
# =============================================================================
def rdb_filter(
    candidate_pids: Optional[List[int]],
    brand: Optional[str],
    product_pid: Optional[int],
    ingredient_ids: Optional[List[int]],
    price_range: Optional[Tuple[Optional[int], Optional[int]]],
    category: Optional[str],
    limit: int = 30
) -> List[Dict]:
    candidate_pids = candidate_pids or []
    ingredient_ids = ingredient_ids or []
    minp, maxp = price_range or (None, None)

    where_clauses = ["1=1"]
    params: Dict[str, Any] = {
        "brand": brand, "product_pid": product_pid, "category": category,
        "minp": minp, "maxp": maxp, "limit": limit,
    }
    if candidate_pids:
        where_clauses.append("p.pid IN :pids"); params["pids"] = tuple(candidate_pids)

    where_clauses.append("(:brand IS NULL OR p.brand = :brand)")
    where_clauses.append("(:product_pid IS NULL OR p.pid = :product_pid)")
    where_clauses.append("(:category IS NULL OR p.category = :category)")
    where_clauses.append("(:minp IS NULL OR p.price_krw >= :minp)")
    where_clauses.append("(:maxp IS NULL OR p.price_krw <= :maxp)")

    having_clause = ""
    binds = []
    if ingredient_ids:
        where_clauses.append("m.ingredient_id IN :ingredient_ids")
        params["ingredient_ids"] = tuple(ingredient_ids); params["ing_cnt"] = len(ingredient_ids)
        having_clause = """
            HAVING COUNT(DISTINCT CASE WHEN m.ingredient_id IN :ingredient_ids THEN m.ingredient_id END) = :ing_cnt
        """
        binds.append(bindparam("ingredient_ids", expanding=True))

    where_sql = " AND ".join(where_clauses)
    LOG.section("RDB FILTER"); LOG.sql(where_sql, having_clause, params)

    sql = text(f"""
        SELECT p.pid, p.brand, p.product_name, p.price_krw, p.category, p.rag_text, p.image_url, p.product_url,  p.ingredients

        FROM product_data_chain AS p
        LEFT JOIN product_ingredient_map AS m ON m.product_pid = p.pid
        WHERE {where_sql}
        GROUP BY p.pid, p.brand, p.product_name, p.price_krw, p.category, p.rag_text, p.ingredients
        {having_clause}
        ORDER BY (p.price_krw IS NULL) ASC, p.price_krw ASC, p.pid
        LIMIT :limit
    """)
    if "pids" in params: binds.append(bindparam("pids", expanding=True))
    if binds: sql = sql.bindparams(*binds)

    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, params).mappings().all()
            items = []
            for r in rows:
                d = dict(r)
                d["ingredients"] = _normalize_ingredients(d.pop("ingredients", None))
                items.append(d)
        LOG.kv("rows_count", len(items)); LOG.sample_rows(items, n=10)
        return items
    except Exception as e:
        LOG.kv("ERROR", repr(e)); LOG.kv("PARAMS_AGAIN", params); return []

def rdb_fetch_by_pids(pids: List[int], limit: int = 30) -> List[Dict]:
    if not pids: return []
    LOG.section("RDB FETCH BY PIDS"); LOG.kv("request_count", len(pids)); LOG.kv("sample_pids", pids[:10])
    sql = text("""
        SELECT p.pid, p.brand, p.product_name, p.price_krw, p.category, p.rag_text, p.image_url, p.product_url, p.ingredients
        FROM product_data_chain AS p
        WHERE p.pid IN :pids
        LIMIT :limit
    """).bindparams(bindparam("pids", expanding=True))
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"pids": tuple(pids), "limit": limit}).mappings().all()
        items = []
        for r in rows:
            d = dict(r)
            d["ingredients"] = _normalize_ingredients(d.pop("ingredients", None))
            items.append(d)
        by_pid = {it["pid"]: it for it in items}
        ordered = [by_pid[pid] for pid in pids if pid in by_pid]
        LOG.kv("rows_count", len(ordered))
        return ordered[:limit]
    except Exception as e:
        LOG.kv("ERROR", repr(e)); return []

def rdb_fetch_rag_texts(pids: List[int]) -> List[Dict]:
    if not pids: return []
    sql = text("""
        SELECT p.pid, p.rag_text
        FROM product_data_chain AS p
        WHERE p.pid IN :pids
    """).bindparams(bindparam("pids", expanding=True))
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"pids": tuple(pids)}).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []
    


# =============================================================================
# 4) 검색 파이프라인 (추천 경로 내부)
# =============================================================================
def is_info_scarce(parsed: Dict) -> bool:
    feats_empty = not (parsed.get("features"))
    pr = parsed.get("price_range") or (None, None)
    has_filters = any([
        parsed.get("brand"), parsed.get("product"), parsed.get("category"),
        (parsed.get("ingredients") or []), any(pr)
    ])
    return feats_empty and not has_filters

def _price_key(v: Optional[int]) -> int:
    return v if v is not None else 10**12

def search_pipeline_from_parsed(parsed: Dict[str, Any], user_query: str, use_raw_for_features: bool = True) -> Dict[str, Any]:
    if is_info_scarce(parsed):
        return {
            "parsed": parsed,
            "normalized": {"brand": None, "product_pid": None, "ingredient_ids": [], "category": None},
            "results": [],
            "message": "조금만 더 구체적으로 말씀해 주세요. 예) ‘브랜드: 라네즈, 나이아신아마이드 포함’ / ‘선크림, 2만원대, 끈적임 없음’"
        }

    # 1) 정규화
    brand_norm  = resolve_brand_name(parsed.get("brand"))
    pid_cands   = resolve_product_pid_candidates(parsed.get("product"), top_k=5)
    product_pid = None
    if pid_cands and brand_norm:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT pid FROM product_data_chain WHERE brand = :b AND pid IN :p LIMIT 1")
                .bindparams(bindparam("p", expanding=True)),
                {"b": brand_norm, "p": tuple(pid_cands)}
            ).first()
            if row: product_pid = int(row[0])
    elif pid_cands:
        product_pid = int(pid_cands[0])

    ingredient_ids = resolve_ingredient_ids(parsed.get("ingredients"))

    # 2) 분기
    has_features = bool(parsed.get("features"))
    pr = parsed.get("price_range") or (None, None)
    has_hardfilter = any([brand_norm, product_pid, ingredient_ids, any(pr), parsed.get("category")])

    # 후보 생성
    rows: List[Dict] = []
    sim_map_for_log: Optional[Dict[int, float]] = None  # ← 유사도 로그용 추가

    if has_features:
        feature_text = " ".join(parsed.get("features") or []) or user_query  # features 없으면 원문으로 폴백
        candidate_pids_raw, score_map_raw = feature_candidates_from_text(feature_text, top_k=300)
        candidate_pids, score_map = dedup_keep_best(candidate_pids_raw, score_map_raw)
        sim_map_for_log = score_map  # ← 유사도 맵 저장

        if has_hardfilter:
            rows = rdb_filter(candidate_pids=candidate_pids, brand=brand_norm, product_pid=product_pid,
                              ingredient_ids=ingredient_ids, price_range=parsed.get("price_range"),
                              category=parsed.get("category"), limit=30)
            if rows:
                rows.sort(key=lambda r: (-(score_map.get(int(r["pid"]), 0.0)),
                                         _price_key(r.get("price_krw")), int(r["pid"])))
        else:
            if candidate_pids:
                candidate_pids = sorted(candidate_pids, key=lambda pid: -(score_map.get(int(pid), 0.0)))
                rows = rdb_fetch_by_pids(candidate_pids[:30], limit=30)
                if rows:
                    rows.sort(key=lambda r: (-(score_map.get(int(r["pid"]), 0.0)),
                                             _price_key(r.get("price_krw")), int(r["pid"])))
            else:
                rows = []
    else:
        rows = rdb_filter(candidate_pids=None, brand=brand_norm, product_pid=product_pid,
                          ingredient_ids=ingredient_ids, price_range=parsed.get("price_range"),
                          category=parsed.get("category"), limit=30)
        
        
        # ✅ 가격 필터 방향 제어
    if rows:
        minp, maxp = parsed.get("price_range") or (None, None)

        if maxp is not None and (minp is None or minp == 0):
            # 예: 3만원 이하 → 상한 가까운 순 (내림차순)
            rows.sort(key=lambda r: (
                r.get("price_krw") is None,
                -(r.get("price_krw") or 0),
                int(r["pid"])
            ))

        elif minp is not None and (maxp is None or maxp == 0):
            # 예: 3만원 이상 → 하한 가까운 순 (오름차순)
            rows.sort(key=lambda r: (
                r.get("price_krw") is None,
                (r.get("price_krw") or 0),
                int(r["pid"])
            ))

        elif minp is not None and maxp is not None:
            # ✅ 범위 내에서는 '중간값'에 가까운 제품을 우선 정렬
            mid = (minp + maxp) / 2
            rows.sort(key=lambda r: (
                r.get("price_krw") is None,
                abs((r.get("price_krw") or mid) - mid),  # 중간가와의 차이 절댓값
                int(r["pid"])
            ))

        
    # ✅ rows 계산이 끝난 뒤 공통 지점: 최종 정렬 결과 샘플 로그
    if rows:
        LOG.section("FINAL ORDER (TOP 10)")
        LOG.sample_rows(rows, n=10, score_map=sim_map_for_log)  # ← 유사도 점수 동시 표기

    return {
        "parsed": parsed,
        "normalized": {"brand": brand_norm, "product_pid": product_pid,
                       "ingredient_ids": ingredient_ids, "category": parsed.get("category")},
        "results": rows
    }

# =============================================================================
# 5) 출력 생성 (상위 5 → 3개, rag_text만으로 요약)
# =============================================================================
# _FINALIZE_FROM_RAG_SYSTEM = (
#     "너는 화장품 추천 챗봇이다. 아래 입력의 'items'는 제품별 rag_text가 포함된 JSON 배열이다.\n"
#     "너의 임무는 이 중에서 사용자 질의에 가장 잘 맞는 가능한 최대 3개의 제품을 고르고,"
#     "3개 미만이면 가능한 최대 개수까지만 출력하라"
#     "각 제품명(name)과 설명(desc)을 아래 형식의 JSON 배열로만 반환하는 것이다.\n\n"
#     "[출력 예시]\n"
#     "[\n"
#     "  {\"name\": \"제품명1\", \"desc\": \"설명1\"},\n"
#     "  {\"name\": \"제품명2\", \"desc\": \"설명2\"},\n"
#     "  {\"name\": \"제품명3\", \"desc\": \"설명3\"}\n"
#     "]\n\n"
#     "설명은 사용자 질의 q와 rag_text 내용을 확인하여, 약90자 내외로 작성한다.\n"
#     "주어진 자료 이외의 "
#     "JSON 외의 다른 텍스트는 절대 출력하지 마라.\n"
#     "가격 언급이 필요하면 price_krw만 사용하고, rag_text에 없는 기능/수치/효과는 쓰지 말 것.\n"
#     "브랜드 언급이 필요하면 brand를 사용하라"
# )
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
    "- 친근하고 자연스럽지만 과장된 표현은 피한다."
    "- 반드시 마지막 줄에는 아래 문장을 그대로 추가하라:\n"
    "  '※ 위 추천 내용은 사용자 리뷰 데이터를 기반으로 한 정보입니다.'"
)


_FINALIZE_FROM_RAG_TMPL = """
[사용자 질의]
{q}

[제품 목록] 
{items}
"""

def finalize_from_rag_texts(user_query: str, results: List[Dict[str, Any]]) -> str:
    top5 = results[:5]
    items = [{
              "brand": r.get("brand"),
              "price_krw": int(r["price_krw"]) if r.get("price_krw") is not None else None,
              "rag_text": (r.get("rag_text") or "")[:2000]
              } for r in top5]

    prompt = _FINALIZE_FROM_RAG_TMPL.format(
        q=user_query,
        items=json.dumps(items, ensure_ascii=False, indent=2)
    )

    resp = llm.invoke([
        {"role": "system", "content": _FINALIZE_FROM_RAG_SYSTEM},
        {"role": "user", "content": prompt}
    ])

    txt = (getattr(resp, "content", "") or "").strip()
    if not txt:
        lines = [
            "요청하신 조건에 맞는 제품을 정리했어요.",
            "",
            "추천 제품:",
        ]
        for r in top5[:3]:
            nm = (r.get("brand") or "알 수 없는 브랜드")
            desc = (r.get("rag_text") or "")[:90].replace("\n", " ")
            lines.append(f"- **{nm} 제품** — {desc}")
        return "\n".join(lines)

    return txt

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
    resp = llm.invoke([
        {"role":"system","content":_GENERAL_SYSTEM},
        {"role":"user","content":_GENERAL_TMPL.format(q=user_query)}
    ])
    return (getattr(resp,"content","") or "").strip()

# =============================================================================
# 7) 엔트리포인트: LLM 라우팅 → (추천) 파싱 → 검색 → rag_text만으로 최종 3줄
# =============================================================================
def answer(user_query: str) -> Dict[str, Any]:
    LOG.section("LLM ROUTER"); LOG.kv("query", user_query)
    intent = decide_intent_with_llm(user_query)     # LLM 호출 1
    LOG.kv("intent", intent)

    if intent == "GENERAL":
        txt = generate_general_answer(user_query)   # LLM 호출 2 (최종)
        return {
        "intent": "GENERAL",
        "text": txt  # ✅ 문자열로 반환 (스키마 일치)
    }

    # intent == PRODUCT_FIND
    parsed = extract_with_llm(user_query)           # LLM 호출 2 (파싱)
    LOG.json("parsed", parsed)

    out = search_pipeline_from_parsed(parsed, user_query)
    rows = out.get("results") or []
    
    if not rows:
        return {
            "intent": "PRODUCT_FIND",
            "text": "",                
            "presented": [],           # ✅ 리스트 유지
            "message": (
                "죄송합니다. 조건에 맞는 제품을 찾을 수 없습니다.\n"
                "입력하신 조건이 너무 구체적이거나, "
                "해당 제품이 현재 데이터베이스에 없을 수도 있습니다.\n"
                "필터(브랜드, 성분, 가격 등)를 조금 완화해서 다시 시도해 보세요."
            )
        }
        
    final_markdown  = finalize_from_rag_texts(user_query, rows)  # 최대 3개
    # 상세 모달용: 상위 5개
    presented = []
    for r in rows[:5]:
        full_rag = r.get("rag_text") or ""   # ✅ 여기서 정의
        presented.append({
            "pid": r["pid"],
            "brand": r["brand"],
            "product_name": r["product_name"],
            # "price_krw": r.get("price_krw"),
            "price_krw": int(r["price_krw"]) if r.get("price_krw") is not None else None,
            "category": r.get("category"),
            # "rag_text_snippet": (r.get("rag_text") or "")[:220],
            "rag_text": full_rag,  
            "image_url": r.get("image_url") or None,
            "product_url": r.get("product_url") or None,
            "ingredients": r.get("ingredients", []),
        })
    return {
        "intent": "PRODUCT_FIND",
        "text": final_markdown ,       # [{pid, name, desc}] x up to 3
        "presented": presented     # [{pid, brand, product_name, ...}] x up to 5
    }

# =============================================================================
# 8) 간단 테스트
# =============================================================================
if __name__ == "__main__":
    tests = [
        ("RAG-ONLY-1", "가벼운 제형에 잘 흡수되고 끈적임 없는 제품 추천"),
        ("RAG+CAT-3", "끈적임 적은 썬크림 추천"),
        ("RAG+PRICE-2", "흡수 빠르고 산뜻한데 2만~3만5천원 추천"),
        # ("RAG+ING-1", "자극 적고 촉촉한데 히알루론산 들어간 제품 추천"),
        # ("RAG+BRAND-1", "산뜻하고 가벼운 사용감의 라네즈 제품 추천 "),
        # ("RAG+PROD-2", "‘닥터지 그린 마일드 업 선’ 제품 알려줘"),
        # ("RAG+CAT+ING+PRICE-1", "토너, 히알루론산 포함, 3만원대, 가벼운 사용감 추천"),
        # ("MAX-1", "라네즈, 크림, 히알루론산 포함, 3만~4만, 가벼운 제형 알려줘"),
        # ("RDB-ONLY-3", "히알루론산 포함 선크림 추천"),
        # ("CAT-SYN-1", "끈적임 적은 파데 추천"),
        # ("PRICE-3", "5만원 이하 추천"),
        # ("NORM-1", "   가   벼 운   제 형 ,  흡 수 빠 름  추천"),
    ]
    for tag, q in tests:
        print("\n" + "="*100)
        print(f"[RUN] {tag} → {q}")
        print("="*100)
        out = answer(q)
        print("\n=== Intent ===", out["intent"])
        
        if out["intent"] == "PRODUCT_FIND":
            print("\n=== Text (LLM Markdown) ===")
            print(out["text"])  # ← 문자열 그대로 출력

            print("\n=== Presented (up to 5) ===")
            for r in out["presented"]:
                print(f"[{r['brand']}] {r['product_name']} | {r.get('price_krw')}원 | {r.get('category')} (pid={r['pid']})")
        else:
            print("\n=== Text ===")
            print(out["text"])
