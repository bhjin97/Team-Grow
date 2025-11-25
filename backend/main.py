from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------
# 라우터 임포트 (패키지 기준 우선, 로컬 실행 대비 fallback 포함)
# ---------------------------------------------------------
try:
    # ✅ 패키지(import) 기준 – Docker / gunicorn("backend.main:app") 환경
    from .routers import (
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
        user_ingredients as user_ingredients_router,
    )
except ImportError:
    # ✅ 로컬에서 backend 디렉터리 안에서 직접 실행하는 경우 대비
    from routers import (
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
        user_ingredients as user_ingredients_router,
    )

# chat 라우터 – 마찬가지로 패키지/스크립트 실행 모두 지원
try:
    from .routers.chat import router as chat_router
except ImportError:
    from routers.chat import router as chat_router


app = FastAPI()

# ---------------------------------------------------------
# CORS 설정
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요 시 ["http://localhost:5173"] 등으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 기본 라우트
# ---------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}


# ---------------------------------------------------------
# 특정 라우터 개별 prefix/alias
# ---------------------------------------------------------
# 성분/피부 관련 유저 정보
app.include_router(
    user_ingredients_router.router,
    prefix="/api/user-ingredients",
)
app.include_router(
    user_ingredients_router.router,
    prefix="/user-ingredients",
    include_in_schema=False,
)

# ---------------------------------------------------------
# 주요 도메인 라우터 (prefix 없는 기본 등록)
# ---------------------------------------------------------
app.include_router(profile.router)
app.include_router(analysis.router)
app.include_router(auth.router)
app.include_router(routine.router)
app.include_router(perfume.router)
app.include_router(user.router)
app.include_router(trends.router)
app.include_router(favorite_products.router)
app.include_router(product.router)

# ---------------------------------------------------------
# prefix가 필요한 라우터
# ---------------------------------------------------------
app.include_router(ocr.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# ---------------------------------------------------------
# 기타 라우터
# ---------------------------------------------------------
app.include_router(delete.router)
app.include_router(ingredients.router)

# ---------------------------------------------------------
# chat 라우터
# ---------------------------------------------------------
# ✅ 정식 경로: /api/chat
app.include_router(chat_router, prefix="/api")

# ✅ 호환용 별칭: /chat (문서에는 숨김)
app.include_router(chat_router, include_in_schema=False)

# ---------------------------------------------------------
# 헬스체크
# ---------------------------------------------------------
@app.get("/healthz")
def healthz():
    return {"ok": True}
