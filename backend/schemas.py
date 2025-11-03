# backend/schemas.py
from pydantic import BaseModel
from datetime import datetime

class FavoriteBase(BaseModel):
    user_id: int
    product_id: int

class FavoriteCreate(FavoriteBase):
    pass

class FavoriteResponse(FavoriteBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
