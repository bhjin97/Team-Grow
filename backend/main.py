from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ✅ 패키지 기준(절대 경로) 임포트로 통일
from backend.routers import (
    profile,
    analysis,
    auth,
    routine,
    perfume,
    user,
    trends,
    favorite_products,
    product,
    ocr,
    stats,
    delete,
    ingredients,
    chat,
    user_ingredients,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 필요하면 프론트 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기본 라우트
@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

# 헬스체크 라우트
@app.get("/healthz")
def healthz():
    return {"ok": True}

# ===== 라우터 등록 =====
# user_ingredients: API/비노출 두 경로 유지
app.include_router(user_ingredients.router, prefix="/api/user-ingredients")
app.include_router(user_ingredients.router, prefix="/user-ingredients", include_in_schema=False)

# 일반 라우터
app.include_router(profile.router)
app.include_router(analysis.router)
app.include_router(auth.router)
app.include_router(routine.router)
app.include_router(perfume.router)
app.include_router(user.router)
app.include_router(trends.router)
app.include_router(favorite_products.router)
app.include_router(product.router)

# prefix 필요한 것들
app.include_router(ocr.router,   prefix="/api")
app.include_router(stats.router, prefix="/api")

# 기타
app.include_router(delete.router)
app.include_router(ingredients.router)
app.include_router(chat.router)
