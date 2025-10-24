# aller/utils/vector_pinecone.py
from functools import lru_cache
from typing import Dict, List
from openai import OpenAI
from pinecone import Pinecone
from aller.components.config import (
    OPENAI_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIM,
    PINECONE_API_KEY, PINECONE_INDEX_PRODUCTS, PINECONE_HOST, NAMESPACE,
    validate_config
)

validate_config()

@lru_cache
def _oai() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)

@lru_cache
def _pc() -> Pinecone:
    return Pinecone(api_key=PINECONE_API_KEY)

def embed_text(text: str) -> List[float]:
    emb = _oai().embeddings.create(model=EMBEDDING_MODEL, input=text)
    vec = emb.data[0].embedding
    if len(vec) != EMBEDDING_DIM:
        raise ValueError(f"임베딩 차원 {len(vec)} != 기대치 {EMBEDDING_DIM}")
    return vec

def pinecone_query_products(query: str, top_k: int = 8, meta_filter: dict | None = None) -> Dict:
    vec = embed_text(query)
    pc = _pc()
    idx = pc.Index(PINECONE_HOST) if PINECONE_HOST else pc.Index(PINECONE_INDEX_PRODUCTS)
    return idx.query(
        vector=vec,
        top_k=top_k,
        include_metadata=True,
        namespace=NAMESPACE,
        filter=meta_filter or {}  # ← 필터 적용
    )
