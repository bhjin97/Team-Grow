# backend/routers/types.py
from pydantic import BaseModel

class ChatBody(BaseModel):
    query: str
    top_k: int | None = 6
    fusion: str | None = "union"  # 추후 다중 인덱스/교집합 확장용 (지금은 단일 인덱스)
