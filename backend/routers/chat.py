from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from db import get_db, oai, CHAT_MODEL, EMBED_MODEL, pc, INDEX_PRODUCT
from .types import ChatBody

router = APIRouter(prefix="/chat", tags=["chat"])

# ─────────────────────────────────────────────────────────
# 카테고리 매핑 (메타데이터와 동일 표기)
# ─────────────────────────────────────────────────────────
CATEGORY_MAP: dict[str, list[str]] = {
    # 스킨/토너
    "스킨": ["스킨/토너"],
    "토너": ["스킨/토너"],
    "toner": ["스킨/토너"],
    "skin": ["스킨/토너"],

    # 에센스/세럼/앰플
    "에센스": ["에센스/세럼/앰플"],
    "세럼": ["에센스/세럼/앰플"],
    "앰플": ["에센스/세럼/앰플"],
    "essence": ["에센스/세럼/앰플"],
    "serum": ["에센스/세럼/앰플"],
    "ampoule": ["에센스/세럼/앰플"],

    # 크림
    "크림": ["크림"],
    "cream": ["크림"],
    "수분크림": ["크림"],
    "영양크림": ["크림"],

    # 선크림
    "선크림": ["선크림"],
    "자차": ["선크림"],
    "sunscreen": ["선크림"],
    "spf": ["선크림"],
}

def detect_categories(user_text: str) -> list[str] | None:
    """사용자 질의에서 우리가 쓰는 표준 카테고리 리스트를 추출."""
    t = (user_text or "").lower()
    hits = set()
    for key, cats in CATEGORY_MAP.items():
        if key in t:
            hits.update(cats)
    # 복합 표기 보완(스킨/토너 키워드 군집)
    if any(k in t for k in ["스킨", "토너", "skin", "toner"]):
        hits.add("스킨/토너")
    return list(hits) if hits else None


# ─────────────────────────────────────────────────────────
# Intent (현재는 사용만 안 하지만 유지)
# ─────────────────────────────────────────────────────────
def identify_intent(q: str) -> str:
    ql = q.lower()
    if any(k in ql for k in ["성분", "ingredient", "알레르기", "주의"]): return "ingredient"
    if any(k in ql for k in ["루틴", "순서", "아침", "저녁"]): return "routine"
    if any(k in ql for k in ["추천", "대체", "유사", "가격", "카테고리"]): return "product"
    return "general"


# ─────────────────────────────────────────────────────────
# 메시지 빌더 (LLM 컨텍스트)
# ─────────────────────────────────────────────────────────
def build_messages(query: str, contexts: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    system = (
        "너는 화장품 도메인 어시스턴트다. 제공된 컨텍스트에 근거해서만 답한다. "
        "과장된 의학적 주장을 피하고, 안전/주의 성분을 명확히 표시한다. "
        "불확실하면 모른다고 말한다. 답변 끝에 [근거] 섹션을 1~3줄로 덧붙인다."
    )
    lines = []
    for i, c in enumerate(contexts, 1):
        head = f"[{i}] {c.get('brand','')}/{c.get('product_name','')}/{c.get('category','')}"
        price = f"(₩{c.get('price_krw','-')})"
        body = (c.get("rag_text") or "")[:800]
        lines.append(f"{head} {price}\n{body}")
    user = f"사용자 질문: {query}\n\n컨텍스트:\n" + ("\n\n".join(lines) if lines else "(없음)")
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


# ─────────────────────────────────────────────────────────
# Pinecone 검색 (메타 필터 추가)
# ─────────────────────────────────────────────────────────
def pinecone_query_raw(query: str, top_k: int, meta_filter: Optional[dict] = None) -> Dict[str, Any]:
    emb = oai.embeddings.create(model=EMBED_MODEL, input=[query])
    qv = emb.data[0].embedding
    info = pc.describe_index(INDEX_PRODUCT)
    if len(qv) != info.dimension:
        raise RuntimeError(
            f"dim mismatch: index={info.dimension}, embed={len(qv)} (model={EMBED_MODEL}). "
            f"인덱스 차원과 임베딩 모델을 맞춰주세요."
        )
    idx = pc.Index(INDEX_PRODUCT)
    out = idx.query(
        vector=qv,
        top_k=top_k,
        include_metadata=True,
        include_values=False,
        filter=meta_filter  # ← 메타 필터 적용
    )
    return out.to_dict() if hasattr(out, "to_dict") else out

def pinecone_query_items(query: str, top_k: int, meta_filter: Optional[dict] = None) -> list[dict]:
    out = pinecone_query_raw(query, top_k, meta_filter=meta_filter)
    matches = out.get("matches", []) if isinstance(out, dict) else (out.matches or [])
    items = []
    for m in matches:
        md  = m.get("metadata", {}) if isinstance(m, dict) else (m.metadata or {})
        mid = m.get("id") if isinstance(m, dict) else m.id
        # 🔑 pid 우선: 메타에 pid가 있으면 그걸 쓰고, 없으면 match.id를 pid로 간주
        pid = str(md.get("pid") or mid)

        items.append({
            "pid": pid,
            "brand": md.get("brand"),
            "product_name": md.get("product_name"),
            "category": md.get("category"),
            "image_url_meta": md.get("image_url"),
            "price_krw_meta": md.get("price_krw"),
            "rag_text_meta": md.get("rag_text"),
            "score": (m.get("score") if isinstance(m, dict) else m.score),
        })
    return items


# ─────────────────────────────────────────────────────────
# RDB override (최신 가격/이미지/URL + 리뷰요약 조인)
# ─────────────────────────────────────────────────────────
def override_with_rdb(db, items: list[dict]) -> list[dict]:
    # 1) pid 수집
    pids = [x["pid"] for x in items if x.get("pid")]
    pids_tuple = tuple(set(pids)) if pids else None

    best_map, rag_map = {}, {}

    if pids_tuple:
        # 2) 제품 최신값(pid 조인)
        rows = db.execute(text("""
            SELECT pid, hash_id, brand, product_name, category, price_krw, image_url, product_url
            FROM product_data
            WHERE pid IN :pids
        """), {"pids": pids_tuple}).mappings().all()
        for r in rows:
            best_map[str(r["pid"])] = dict(r)

        # 3) 리뷰 요약(pid → product_data.hash_id → review_data)
        rows_rag = db.execute(text("""
            SELECT pd.pid, rr.rag_text
            FROM product_data pd
            JOIN (
                SELECT x.hash_id, rr.rag_text
                FROM review_data rr
                JOIN (
                    SELECT hash_id, MIN(rid) AS rid_min
                    FROM review_data
                    GROUP BY hash_id
                ) x ON rr.hash_id = x.hash_id AND rr.rid = x.rid_min
            ) rr ON rr.hash_id = pd.hash_id
            WHERE pd.pid IN :pids
        """), {"pids": pids_tuple}).mappings().all()
        for r in rows_rag:
            rag_map[str(r["pid"])] = r["rag_text"]

    # 4) 머지(DB 우선, 없으면 메타 fallback)
    out = []
    for x in items:
        pid = x.get("pid")
        best = best_map.get(pid, {})
        rag_text_final = rag_map.get(pid) or x.get("rag_text_meta")

        out.append({
            "pid": pid,
            "brand": best.get("brand") or x.get("brand"),
            "product_name": best.get("product_name") or x.get("product_name"),
            "category": best.get("category") or x.get("category"),
            "image_url": best.get("image_url") or x.get("image_url_meta"),
            "price_krw": best.get("price_krw") if best.get("price_krw") is not None else x.get("price_krw_meta"),
            "rag_text": rag_text_final,
            "score": x.get("score"),
            "product_url": best.get("product_url"),  # 없으면 None
        })
    return out


# ─────────────────────────────────────────────────────────
# Health/Diag
# ─────────────────────────────────────────────────────────
@router.get("/health")
def health():
    return {"ok": True}

@router.get("/diag")
def diag(db=Depends(get_db)):
    ret = {"openai": None, "pinecone": None, "db": None, "pc_info": None, "pc_indexes": None}
    try:
        e = oai.embeddings.create(model=EMBED_MODEL, input=["ping"])
        ret["openai"] = f"ok(dim={len(e.data[0].embedding)})"
    except Exception as e:
        ret["openai"] = f"err:{e!r}"

    try:
        info = pc.describe_index(INDEX_PRODUCT)
        ret["pc_info"] = {"name": info.name, "dimension": info.dimension, "metric": getattr(info, "metric", None)}
        ret["pc_indexes"] = [i.name for i in pc.list_indexes()]
        z = [0.0] * info.dimension
        idx = pc.Index(INDEX_PRODUCT)
        _ = idx.query(vector=z, top_k=1, include_metadata=False, include_values=False)
        ret["pinecone"] = f"ok(query-{info.dimension})"
    except Exception as e:
        msg = getattr(e, "body", None) or repr(e)
        ret["pinecone"] = f"err:{msg}"

    try:
        _ = db.execute(text("SELECT 1")).scalar()
        ret["db"] = "ok"
    except Exception as e:
        ret["db"] = f"err:{e!r}"
    return ret


# ─────────────────────────────────────────────────────────
# 채팅(텍스트 스트리밍) - 메타 필터 적용
# ─────────────────────────────────────────────────────────
@router.post("")
def chat(body: ChatBody, db=Depends(get_db), mode: Optional[str] = Query(default=None)):
    q = (body.query or "").strip()
    if not q:
        raise HTTPException(400, "query is required")

    if mode == "llm_only":
        msgs = [{"role": "system", "content": "친절한 화장품 도메인 어시스턴트다."},
                {"role":"user","content": q}]
        def stream_llm():
            try:
                chunks = oai.chat.completions.create(model=CHAT_MODEL, messages=msgs, temperature=0.2, stream=True)
                for ch in chunks:
                    delta = ch.choices[0].delta.content or ""
                    if delta: yield delta
            except Exception as e:
                yield f"(llm_only error) {e}"
        return StreamingResponse(stream_llm(), media_type="text/plain; charset=utf-8")

    if mode == "pc_only":
        try:
            cats = detect_categories(q)
            meta_filter = {"category": {"$in": cats}} if cats else None
            raw = pinecone_query_raw(q, top_k=body.top_k or 6, meta_filter=meta_filter)
            return JSONResponse(raw)
        except Exception as e:
            return PlainTextResponse(f"(pc_only error) {e}", status_code=500)

    # 기본 경로: 컨텍스트 구성 → LLM 스트리밍
    try:
        cats = detect_categories(q)
        meta_filter = {"category": {"$in": cats}} if cats else None
        raw_items = pinecone_query_items(q, top_k=body.top_k or 6, meta_filter=meta_filter)
    except Exception as e:
        return PlainTextResponse(f"Pinecone error: {e}", status_code=500)

    try:
        contexts = override_with_rdb(db, raw_items)
    except Exception:
        contexts = []

    messages = build_messages(q, contexts)

    def stream():
        try:
            chunks = oai.chat.completions.create(model=CHAT_MODEL, messages=messages, temperature=0.2, stream=True)
            for ch in chunks:
                delta = ch.choices[0].delta.content or ""
                if delta: yield delta
        except Exception as e:
            yield f"(stream error) {e}"

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")


# ─────────────────────────────────────────────────────────
# 🔥 추천 JSON (프런트 카드용) - 메타 필터 적용
# ─────────────────────────────────────────────────────────
@router.post("/recommend")
def recommend(body: ChatBody, db=Depends(get_db)):
    q = (body.query or "").strip()
    if not q:
        raise HTTPException(400, "query is required")
    try:
        cats = detect_categories(q)
        meta_filter = {"category": {"$in": cats}} if cats else None
        raw_items = pinecone_query_items(q, top_k=body.top_k or 12, meta_filter=meta_filter)
        contexts = override_with_rdb(db, raw_items)
        products = [{
            "pid": c.get("pid"),
            "brand": c.get("brand"),
            "product_name": c.get("product_name"),
            "category": c.get("category"),
            "price_krw": c.get("price_krw"),
            "image_url": c.get("image_url"),
            "rag_text": c.get("rag_text"),
            "score": c.get("score"),
            "product_url": c.get("product_url"),
        } for c in contexts]
        return JSONResponse({"products": products})
    except Exception as e:
        raise HTTPException(500, f"recommend error: {e}")
