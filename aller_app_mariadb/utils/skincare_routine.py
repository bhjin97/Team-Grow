import os
import pandas as pd
from dotenv import load_dotenv
import streamlit as st
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus

# .env 로드
load_dotenv()

# =========================
# DB 연결 (SQLAlchemy)
# =========================
def get_engine():
    load_dotenv()
    
    dialect = os.getenv("DB_DIALECT", "{DB_DIALECT}")
    host    = os.getenv("DB_HOST", "{DB_HOST}")
    port    = os.getenv("DB_PORT", "{DB_PORT}")
    user    = os.getenv("DB_USER", "{DB_USER}")
    pw      = os.getenv("DB_PASSWORD", "{DB_PASSWORD}")
    name    = os.getenv("DB_NAME", "{DB_NAME}")

    dsn = f"{dialect}://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{quote_plus(name)}?charset=utf8mb4"
    return create_engine(dsn, pool_pre_ping=True, future=True)

ENGINE = get_engine()

def run_query(query, params=None):
    with ENGINE.connect() as conn:
        return pd.read_sql(text(query), conn, params=params)

# =========================
# 카테고리 순서와 focus 규칙
# =========================
CATEGORY_ORDER = ["스킨/토너", "에센스/세럼/앰플", "로션", "크림"]

FOCUS_RULES = {
    ("여름", "아침"): ["가벼운", "산뜻"],
    ("여름", "저녁"): ["보습", "진정"],
    ("겨울", "아침"): ["보습", "보호막"],
    ("겨울", "저녁"): ["영양", "재생"]
}

# =========================
# DB에서 상품 불러오기
# =========================
def load_products(skin_type):
    query = """
    SELECT product_pid, hash_id, brand, product_name, n_reviews, rag_text, category, skin_type
    FROM skincare_routine_product
    WHERE skin_type = :skin_type
    """
    return run_query(query, params={"skin_type": skin_type})

# =========================
# 이미지 URL 불러오기
# =========================
def get_image_url(product_name):
    query = """
    SELECT image_url 
    FROM product_data
    WHERE product_name = :product_name
    LIMIT 1
    """
    df = run_query(query, params={"product_name": product_name})
    if not df.empty:
        return df["image_url"].iloc[0]
    return None

# =========================
# 추천 상품 뽑기
# =========================
def recommend_products(skin_type, season, time, top_n=1):
    products = load_products(skin_type)
    focus = FOCUS_RULES.get((season, time), [])
    results = []

    for step in CATEGORY_ORDER:
        # ⚠️ SettingWithCopyWarning 방지 위해 .copy() 추가
        candidates = products[products["category"] == step].copy()

        candidates["matched_keywords"] = candidates["rag_text"].apply(
            lambda x: [f for f in focus if f in str(x)]
        )
        filtered = candidates[candidates["matched_keywords"].map(len) > 0]

        if filtered.empty:
            filtered = candidates.copy()

        top = filtered.sort_values("n_reviews", ascending=False).head(top_n)

        for _, r in top.iterrows():
            image_url = get_image_url(r["product_name"])
            results.append({
                "step": step,
                "display_name": f"{r['brand']} - {r['product_name']}",
                "image_url": image_url
            })
    return pd.DataFrame(results)

# =========================
# Streamlit 카드 렌더링
# =========================
def render_routine(df):
    if df.empty:
        st.warning("추천할 제품이 없습니다.")
        return

    cards_html = '<div style="overflow-x:auto; white-space:nowrap; padding:10px;">'

    for _, row in df.iterrows():
        cards_html += f'''
<div style="width:220px; display:inline-block; margin-right:25px; vertical-align:top; text-align:center;">
  <div style="font-weight:800; margin-bottom:8px;">{row['step']}</div>
  <div style="width:200px; height:200px; display:flex; align-items:center; justify-content:center;
              background:#f9f9f9; border-radius:10px; overflow:hidden; margin:0 auto;">
    <img src="{row['image_url']}" style="width:200px; height:200px; object-fit:contain;" />
  </div>
  <div style="margin-top:8px; font-weight:600; white-space:normal; word-wrap:break-word; font-size:14px;">
    {row['display_name']}
  </div>
</div>
'''
    cards_html += "</div>"

    # ✅ unsafe_allow_html=True 로 HTML 그대로 렌더링
    st.markdown(cards_html, unsafe_allow_html=True)
