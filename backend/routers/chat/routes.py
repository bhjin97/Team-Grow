# backend/routers/chat/routes.py
# -*- coding: utf-8 -*-

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import uuid4
import time, asyncio
from sqlalchemy import text
from sqlalchemy.orm import Session

from db import get_db 
from .recommender import run_product_core, stream_finalize_from_rag_texts  # ✅ 엔진 엔트리 함수 2개

router = APIRouter(prefix="/chat", tags=["chat"])

# ──────────────────────────────────────────────────────────────────────────────
# Simple in-memory cache (향후 Redis 등으로 교체 가능)
# ──────────────────────────────────────────────────────────────────────────────
_CACHE: Dict[str, Dict[str, Any]] = {}
_TTL_SEC = 60  # 초 단위 TTL

def _cache_set(key: str, data: Dict[str, Any]):
    _CACHE[key] = {"ts": time.time(), "data": data}

def _cache_get(key: str):
    item = _CACHE.get(key)
    if not item:
        return None
    if time.time() - item["ts"] > _TTL_SEC:
        _CACHE.pop(key, None)
        return None
    return item["data"]

# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────
class RecommendReq(BaseModel):
    query: str
    top_k: Optional[int] = 12
    cache_key: Optional[str] = None  # 기존 결과 재사용 시 선택적으로 전달 가능


class RecommendRes(BaseModel):
    intent: str                      # "GENERAL" | "PRODUCT_FIND"
    message: Optional[str] = None    # 안내 문구(결과 없음/GENERAL 응답 등)
    cache_key: Optional[str] = None  # PRODUCT_FIND일 때 rows 캐시 키
    products: List[Dict[str, Any]]   # 카드용 데이터


# class FinalizeReq(BaseModel):
#     query: str
#     cache_key: str


class IngredientDetail(BaseModel):
    name: str
    description: Optional[str] = None
    caution_grade: Optional[str] = None  # "위험" | "주의" | "안전" | None


class FinalizeReq(BaseModel):
    query: str
    cache_key: Optional[str] = None
# ──────────────────────────────────────────────────────────────────────────────
# ✅ Recommend cards API
#    역할: 검색 + intent 판별 + presented 카드 + cache_key 발급 (JSON 응답)
#    경로: POST /api/chat/recommend
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/recommend", response_model=RecommendRes)
def recommend(req: RecommendReq):
    q = (req.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")

    data: Optional[Dict[str, Any]] = None
    used_key: Optional[str] = None

    # 1) 전달된 cache_key가 있으면 우선 재사용 시도
    if req.cache_key:
        cached = _cache_get(req.cache_key)
        if cached is not None:
            data = cached
            used_key = req.cache_key

    # 2) 캐시가 없으면 새로 검색 실행
    if data is None:
        data = run_product_core(q)
        used_key = None  # intent 보고 아래에서 결정

    intent = data.get("intent", "GENERAL")

    # GENERAL 질의인 경우: 카드 대신 텍스트만 반환, cache_key 없음
    if intent == "GENERAL":
        text_out = (data.get("text") or "").strip() or None
        return RecommendRes(
            intent="GENERAL",
            message=text_out,
            cache_key=None,
            products=[],
        )

    # PRODUCT_FIND인 경우: rows/presented를 캐시에 저장하고 카드 빌드
    if used_key is None:
        used_key = uuid4().hex
        _cache_set(used_key, data)

    products: List[Dict[str, Any]] = []
    top_k = req.top_k or 12
    rows = (data.get("presented") or [])[:top_k]

    for r in rows:
        item: Dict[str, Any] = {
            "pid": int(r["pid"]) if r.get("pid") is not None else None,
            "brand": r.get("brand"),
            "product_name": r.get("product_name"),
            "category": r.get("category"),
        }
        if r.get("price_krw") is not None:
            item["price_krw"] = int(r["price_krw"])
        if r.get("rag_text"):
            item["rag_text"] = r["rag_text"]
        if r.get("image_url"):
            item["image_url"] = r["image_url"]
        if r.get("product_url"):
            item["product_url"] = r["product_url"]
        if r.get("ingredients"):
            item["ingredients"] = r["ingredients"]
        if r.get("ingredients_detail"):
            item["ingredients_detail"] = r["ingredients_detail"]
        products.append(item)

    msg = (data.get("message") or "").strip() or None

    return RecommendRes(
        intent="PRODUCT_FIND",
        message=msg,
        cache_key=used_key,
        products=products,
    )

# ──────────────────────────────────────────────────────────────────────────────
# ✅ 요약 전용 API (스트리밍)
#    역할: cache_key 기반 rows → run_product_finalize → 텍스트 스트리밍
#    경로: POST /api/chat/finalize
# ──────────────────────────────────────────────────────────────────────────────
# @router.post("/finalize")
# async def finalize_stream(req: FinalizeReq):
#     data = _cache_get(req.cache_key)
#     if not data:
#         raise HTTPException(status_code=404, detail="cache_key expired or not found")

#     rows = data.get("rows") or []  # run_product_core에서 넣어준 rows
#     out = run_product_finalize(req.query, rows)
#     full_text = (out.get("text") or "").strip() or " "

#     async def gen():
#         # 200자 단위로 잘라서 스트리밍
#         for i in range(0, len(full_text), 200):
#             yield full_text[i:i + 200]
#             await asyncio.sleep(0)

#     return StreamingResponse(
#         gen(),
#         media_type="text/plain; charset=utf-8",
#         headers={
#             "X-Intent": out.get("intent", "PRODUCT_FIND"),
#         }, 
#     )

@router.post("/finalize")
async def chat_finalize(req: FinalizeReq):
    """
    토큰 스트림으로 요약만 생성하는 API.

    - 먼저 cache_key 에서 rows를 찾고,
      없으면 run_product_core(query)를 다시 돌려서 rows 확보 (fallback).
    - rows가 없으면 간단한 안내 문구만 스트리밍.
    - rows가 있으면 stream_finalize_from_rag_texts()를 사용해
      OpenAI 토큰이 나오는 즉시 클라이언트로 흘려보낸다.
    """
    q = (req.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")

    # 1) 캐시에서 rows 복구 시도
    rows: List[Dict[str, Any]] = []
    if req.cache_key:
        data = _cache_get(req.cache_key)
        if data and isinstance(data.get("rows"), list):
            rows = data["rows"]

    # 2) 캐시에 rows가 없으면 검색부터 다시 수행 (fallback)
    if not rows:
        core = run_product_core(q)
        rows = core.get("rows") or []

    # 3) 그래도 rows가 없으면 요약할 게 없음 → 한 줄 안내만 스트리밍
    if not rows:
        async def empty_gen():
            yield "조건에 맞는 제품을 찾을 수 없습니다."
            await asyncio.sleep(0)

        return StreamingResponse(
            empty_gen(),
            media_type="text/plain; charset=utf-8",
        )

    # 4) 정상 케이스: 스트리밍 요약
    async def gen():
        # stream_finalize_from_rag_texts는 sync generator이므로
        # async 함수 안에서 그냥 for로 돌리면 된다.
        for chunk in stream_finalize_from_rag_texts(q, rows):
            # chunk는 문자열 일부 (토큰/델타 누적)라고 가정
            yield chunk
            # 이벤트 루프에 제어 넘겨서 UI가 반응성 있게 느끼도록
            await asyncio.sleep(0)

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
    )

# ──────────────────────────────────────────────────────────────────────────────
# Ingredient detail API (기존 유지)
#    경로: GET /api/chat/ingredient/{name}
# ──────────────────────────────────────────────────────────────────────────────
ALLOWED = {"위험", "주의", "안전"}

def _normalize_grade(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    v = str(val).strip()
    return v if v in ALLOWED else None

@router.get("/ingredient/{name}", response_model=IngredientDetail)
def get_ingredient_detail(name: str, db: Session = Depends(get_db)):
    sql = text("""
        SELECT korean_name, description, caution_grade
        FROM ingredients
        WHERE korean_name = :name
        LIMIT 1
    """)
    row = db.execute(sql, {"name": name.strip()}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    return IngredientDetail(
        name=row.korean_name,
        description=row.description,
        caution_grade=_normalize_grade(row.caution_grade),
    )
