from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db
from routers import profile, analysis, auth, routine, perfume, user

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요하면 ["http://localhost:3000"] 이런 식으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

# ✅ 라우터 등록
app.include_router(profile.router)
app.include_router(analysis.router)
app.include_router(auth.router)
app.include_router(routine.router)
app.include_router(perfume.router)
app.include_router(user.router)