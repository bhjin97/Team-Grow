from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
)

class SkinDiagnosisIn(BaseModel):
    user_id: int
    skin_type_code: str
    skin_axes_json: str
    nickname: Optional[str] = None
    birth_year: Optional[int] = None
    gender: Optional[str] = None


FAKE_DB: dict[int, dict] = {}


@router.post("/skin-diagnosis")
async def save_skin_diagnosis(payload: SkinDiagnosisIn):
    FAKE_DB[payload.user_id] = {
        "skin_type_code": payload.skin_type_code,
        "skin_axes_json": payload.skin_axes_json,
        "nickname": payload.nickname,
        "birth_year": payload.birth_year,
        "gender": payload.gender,
    }
    return {"ok": True, "message": "saved", "user_id": payload.user_id}


@router.get("/{user_id}")
async def get_profile(user_id: int):
    if user_id not in FAKE_DB:
        raise HTTPException(status_code=404, detail="User not found")
    return FAKE_DB[user_id]
