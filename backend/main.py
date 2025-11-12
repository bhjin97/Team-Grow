from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 주의: 프로젝트 구조에 맞춰 필요한 라우터만 임포트
from routers import (
    profile, analysis, auth, routine, perfume, user, trends,
    favorite_products, product, ocr, stats, delete, ingredients
)

try:
    from .routers import user_ingredients as user_ingredients_router
except ImportError:
    from routers import user_ingredients as user_ingredients_router

# chat 라우터는 프로젝트에 따라 경로가 다를 수 있음
# 기본 시도:
from routers.chat import router as chat_router
# 만약 위 임포트에서 ModuleNotFoundError가 나면 ↓로 교체
# from routers.chat.routes import router as chat_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요 시 ["http://localhost:5173"] 등으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_ingredients_router.router, prefix="/api/user-ingredients")
app.include_router(user_ingredients_router.router, prefix="/user-ingredients", include_in_schema=False)

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
app.include_router(trends.router)
app.include_router(favorite_products.router)
app.include_router(product.router)

# prefix가 필요한 라우터
app.include_router(ocr.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# 기타
app.include_router(delete.router)
app.include_router(ingredients.router)
app.include_router(chat_router)

@app.get("/healthz")
def healthz():
    return {"ok": True}
