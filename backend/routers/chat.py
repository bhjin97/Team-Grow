from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from db import get_db, oai, CHAT_MODEL, EMBED_MODEL, pc, INDEX_PRODUCT
from .types import ChatBody

router = APIRouter(prefix="/chat", tags=["chat"])

def identify_intent(q: str) -> str:
    ql = q.lower()
    if any(k in ql for k in ["성분", "ingredient", "알레르기", "주의"]): return "ingredient"
    if any(k in ql for k in ["루틴", "순서", "아침", "저녁"]): return "routine"
    if any(k in ql for k in ["추천", "대체", "유사", "가격", "카테고리"]): return "product"
    return "general"

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

def pinecone_query_raw(query: str, top_k: int) -> Dict[str, Any]:
    emb = oai.embeddings.create(model=EMBED_MODEL, input=[query])
    qv = emb.data[0].embedding
    info = pc.describe_index(INDEX_PRODUCT)
    if len(qv) != info.dimension:
        raise RuntimeError(
            f"dim mismatch: index={info.dimension}, embed={len(qv)} (model={EMBED_MODEL}). "
            f"인덱스 차원과 임베딩 모델을 맞춰주세요."
        )
    idx = pc.Index(INDEX_PRODUCT)
    out = idx.query(vector=qv, top_k=top_k, include_metadata=True, include_values=False)
    return out.to_dict() if hasattr(out, "to_dict") else out

def pinecone_query_items(query: str, top_k: int) -> List[Dict[str, Any]]:
    out = pinecone_query_raw(query, top_k)
    matches = out.get("matches", []) if isinstance(out, dict) else (out.matches or [])
    items = []
    for m in matches:
        md = m.get("metadata", {}) if isinstance(m, dict) else (m.metadata or {})
        mid = m.get("id") if isinstance(m, dict) else m.id
        hid = md.get("hash_id") or mid
        items.append({
            "hash_id": hid,
            "category": md.get("category"),
            "rag_text_meta": md.get("rag_text"),
            "brand": md.get("brand"),
            "product_name": md.get("product_name"),
            "price_krw_meta": md.get("price_krw"),
            "image_url_meta": md.get("image_url"),
            "score": (m.get("score") if isinstance(m, dict) else m.score)
        })
    return items

def override_with_rdb(db, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    hids = [x["hash_id"] for x in items if x.get("hash_id")]
    best_map, rag_map = {}, {}
    if hids:
        rows = db.execute(text("""
            SELECT pid, hash_id, brand, product_name, category, price_krw, image_url
            FROM product_data WHERE hash_id IN :hids
        """), {"hids": tuple(hids)}).mappings().all()
        for r in rows: best_map[r["hash_id"]] = dict(r)

        rows_rag = db.execute(text("""
            SELECT rr.hash_id, rr.rag_text
            FROM review_data rr
            JOIN (
                SELECT hash_id, MIN(rid) AS rid_min
                FROM review_data WHERE hash_id IN :hids
                GROUP BY hash_id
            ) m ON rr.hash_id = m.hash_id AND rr.rid = m.rid_min
        """), {"hids": tuple(hids)}).mappings().all()
        for r in rows_rag: rag_map[r["hash_id"]] = r["rag_text"]

    out = []
    for x in items:
        hid = x.get("hash_id")
        best = best_map.get(hid, {})
        rag_text_final = x.get("rag_text_meta") or rag_map.get(hid)
        out.append({
            "hash_id": hid,
            "brand": best.get("brand") or x.get("brand"),
            "product_name": best.get("product_name") or x.get("product_name"),
            "category": best.get("category") or x.get("category"),
            "image_url": best.get("image_url") or x.get("image_url_meta"),
            "price_krw": best.get("price_krw") if best.get("price_krw") is not None else x.get("price_krw_meta"),
            "rag_text": rag_text_final,
            "score": x.get("score")
        })
    return out

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

@router.post("")
def chat(body: ChatBody, db=Depends(get_db), mode: Optional[str] = Query(default=None)):   # ✅ 따옴표 제거
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
            raw = pinecone_query_raw(q, top_k=body.top_k or 6)
            return JSONResponse(raw)
        except Exception as e:
            return PlainTextResponse(f"(pc_only error) {e}", status_code=500)

    try:
        raw_items = pinecone_query_items(q, top_k=body.top_k or 6)
    except Exception as e:
        return PlainTextResponse(f"Pinecone error: {e}", status_code=500)

    try:
        contexts = override_with_rdb(db, raw_items)
    except Exception as e:
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
