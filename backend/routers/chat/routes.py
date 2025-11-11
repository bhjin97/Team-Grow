# # backend/routers/chat/routes.py
# from fastapi import APIRouter, HTTPException, Depends
# from fastapi.responses import StreamingResponse, JSONResponse
# from pydantic import BaseModel
# from typing import Optional, Dict, Any, List
# from uuid import uuid4
# import time, asyncio
# from sqlalchemy import text
# from sqlalchemy.orm import Session
# from db import get_db  # db.py의 get_db 사용

# from .recommender import answer  # 당신의 RAG 엔진
# router = APIRouter(prefix="/chat", tags=["chat"])

# # ── 아주 간단한 in-memory 캐시 (원하면 Redis로 교체)
# _CACHE: Dict[str, Dict[str, Any]] = {}
# _TTL_SEC = 60

# def _cache_set(key: str, data: Dict[str, Any]):
#   _CACHE[key] = {"ts": time.time(), "data": data}

# def _cache_get(key: str):
#   item = _CACHE.get(key)
#   if not item: return None
#   if time.time() - item["ts"] > _TTL_SEC:
#     _CACHE.pop(key, None)
#     return None
#   return item["data"]

# # ── 요청 모델
# class ChatReq(BaseModel):
#   query: str
#   top_k: Optional[int] = 6

# class RecommendReq(BaseModel):
#   query: str
#   top_k: Optional[int] = 12
#   cache_key: Optional[str] = None   # ⬅️ 프런트가 넘겨줌

# @router.post("/")
# async def chat_stream(req: ChatReq):
#   q = (req.query or "").strip()
#   if not q:
#     raise HTTPException(status_code=400, detail="query is required")

#   # 1) 여기서 answer() 한 번만 실행
#   data = answer(q)

#   # 2) 캐시에 저장하고 키 발급
#   cache_key = uuid4().hex
#   _cache_set(cache_key, data)

#   # 3) 스트림 텍스트 구성
#     # 3) 스트림 텍스트 구성
#   if data.get("intent") == "GENERAL":
#     text = (data.get("text") or "").strip() or " "
#   else:
#     # ✅ 이제 PRODUCT_FIND에서도 data["text"]는 LLM이 생성한 '마크다운 문자열'
#     t = (data.get("text") or "").strip()
#     if t:
#       text = t
#     else:
#       msg = (data.get("message") or "").strip()
#       text = msg or "조건에 맞는 제품을 찾지 못했어요. 필터를 조금 완화해서 다시 시도해보세요."



#   async def gen():
#     # 실제 LLM 스트리밍이 있으면 그 청크를 yield 하면 됩니다.
#     for i in range(0, len(text), 200):
#       yield text[i:i+200]
#       await asyncio.sleep(0)

#   # 4) 🔑 헤더에 cache key 넣어서 내려주기
#   return StreamingResponse(
#     gen(),
#     media_type="text/plain; charset=utf-8",
#     headers={"X-Cache-Key": cache_key},
#   )

# @router.post("/recommend")
# def recommend(req: RecommendReq):
#   q = (req.query or "").strip()
#   if not q:
#     raise HTTPException(status_code=400, detail="query is required")

#   # 1) cache_key가 있으면 캐시에서 꺼내고, 없으면 새로 계산
#   data = _cache_get(req.cache_key) if req.cache_key else None
#   if data is None:
#     data = answer(q)  # fallback (캐시 미스)

#   products: List[Dict[str, Any]] = []
#   if data.get("intent") == "PRODUCT_FIND":
#     rows = (data.get("presented") or [])[: (req.top_k or 12)]
#     for r in rows:
#       item = {
#         "pid": str(r["pid"]),
#         "brand": r.get("brand"),
#         "product_name": r.get("product_name"),
#         "category": r.get("category"),
#       }
#       if r.get("price_krw") is not None: item["price_krw"] = int(r["price_krw"])
#       if r.get("rag_text"): item["rag_text"] = r["rag_text"]
#       if r.get("image_url"): item["image_url"] = r["image_url"]
#       if r.get("product_url"): item["product_url"] = r["product_url"]
#       if r.get("ingredients"): item["ingredients"] = r["ingredients"]  # ⬅️ 추가

#       products.append(item)

#   return JSONResponse({"products": products})


# ALLOWED = {"위험", "주의", "안전"}

# @router.get("/ingredient/{name}")
# def get_ingredient_detail(name: str, db: Session = Depends(get_db)):
#     """
#     성분 이름(korean_name)으로 ingredients 테이블 조회.
#     반환: korean_name, description, caution_grade
#     """
#     sql = text("""
#         SELECT korean_name, description, caution_grade
#         FROM ingredients
#         WHERE korean_name = :name
#         LIMIT 1
#     """)
#     row = db.execute(sql, {"name": name}).fetchone()

#     if not row:
#         raise HTTPException(status_code=404, detail="Ingredient not found")

#     return {
#         "name": row.korean_name,
#         "description": row.description,
#         "caution_grade": row.caution_grade
#     }



from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import uuid4
import time, asyncio
from sqlalchemy import text
from sqlalchemy.orm import Session
from db import get_db

from .recommender import answer

router = APIRouter(prefix="/chat", tags=["chat"])

# ── 아주 간단한 in-memory 캐시 (원하면 Redis로 교체)
_CACHE: Dict[str, Dict[str, Any]] = {}
_TTL_SEC = 60

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

# ── 요청/응답 모델
class ChatReq(BaseModel):
    query: str
    top_k: Optional[int] = 6

class RecommendReq(BaseModel):
    query: str
    top_k: Optional[int] = 12
    cache_key: Optional[str] = None

class RecommendRes(BaseModel):
    products: List[Dict[str, Any]]

class IngredientDetail(BaseModel):
    name: str
    description: Optional[str] = None
    caution_grade: Optional[str] = None  # "위험" | "주의" | "안전" | None

# ── 채팅 스트림
@router.post("/")
async def chat_stream(req: ChatReq):
    q = (req.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")

    # 1) 여기서 answer() 한 번만 실행
    data = answer(q)

    # 2) 캐시에 저장하고 키 발급
    cache_key = uuid4().hex
    _cache_set(cache_key, data)

    # 3) 스트림 텍스트 구성
    if data.get("intent") == "GENERAL":
        text_out = (data.get("text") or "").strip() or " "
    else:
        # PRODUCT_FIND에서도 data["text"]는 LLM의 마크다운 문자열
        t = (data.get("text") or "").strip()
        if t:
            text_out = t
        else:
            msg = (data.get("message") or "").strip()
            text_out = msg or "조건에 맞는 제품을 찾지 못했어요. 필터를 조금 완화해서 다시 시도해보세요."

    async def gen():
        # 실제 LLM 스트리밍이 있으면 그 청크를 yield
        for i in range(0, len(text_out), 200):
            yield text_out[i:i+200]
            await asyncio.sleep(0)

    # 4) 🔑 헤더에 cache key 넣어서 내려주기
    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Cache-Key": cache_key},
    )

# ── 추천 카드
@router.post("/recommend", response_model=RecommendRes)
def recommend(req: RecommendReq):
    q = (req.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")

    # 1) cache_key가 있으면 캐시에서 꺼내고, 없으면 새로 계산
    data = _cache_get(req.cache_key) if req.cache_key else None
    if data is None:
        data = answer(q)  # fallback (캐시 미스)

    products: List[Dict[str, Any]] = []
    if data.get("intent") == "PRODUCT_FIND":
        rows = (data.get("presented") or [])[: (req.top_k or 12)]
        for r in rows:
            item: Dict[str, Any] = {
                "pid": int(r["pid"]) if r.get("pid") is not None else None,  # 🔧 숫자 유지
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
                item["ingredients_detail"] = r["ingredients_detail"]  # ← 추가
            products.append(item)

    return {"products": products}

# ── 성분 상세
ALLOWED = {"위험", "주의", "안전"}

def _normalize_grade(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    v = str(val).strip()
    return v if v in ALLOWED else None

@router.get("/ingredient/{name}", response_model=IngredientDetail)
def get_ingredient_detail(name: str, db: Session = Depends(get_db)):
    """
    성분 이름(korean_name)으로 ingredients 테이블 조회.
    반환: name(=korean_name), description, caution_grade(위험|주의|안전|None)
    """
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    sql = text("""
        SELECT korean_name, description, caution_grade
        FROM ingredients
        WHERE korean_name = :name
        LIMIT 1
    """)
    row = db.execute(sql, {"name": name}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    return IngredientDetail(
        name=row.korean_name,
        description=row.description,
        caution_grade=_normalize_grade(row.caution_grade)
    )
