# pages/3_Profile.py

import os
import json
import streamlit as st
from urllib.parse import quote_plus
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from datetime import datetime
from aller.ui import render_app_sidebar, require_login_redirect

def get_engine() -> Engine:
    dialect = os.getenv("DB_DIALECT", "mysql+pymysql")
    host    = os.getenv("DB_HOST", "211.51.163.232")
    port    = os.getenv("DB_PORT", "19306")
    user    = os.getenv("DB_USER", "lgup1")
    pw      = os.getenv("DB_PASSWORD", "lgup1P@ssw0rd")
    name    = os.getenv("DB_NAME", "lgup1")
    dsn = f"{dialect}://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{quote_plus(name)}?charset=utf8mb4"
    return create_engine(dsn, pool_pre_ping=True, future=True)

# 로그인 체크
require_login_redirect()
render_app_sidebar()

st.set_page_config(page_title="사용자 정보", layout="wide")

# ============================================
# 로그인 세션 확인
# ============================================
auth_user = st.session_state.get("auth_user")
if not auth_user:
    st.error("로그인이 필요합니다.")
    st.stop()

# ============================================
# DB 연결
# ============================================

ENGINE = get_engine()

# ============================================
# 사용자 프로필 조회
# ============================================
def fetch_user_profile(user_id: int):
    """사용자 정보 조회 (allergies_json 포함)"""
    sql = """
      SELECT u.id, u.email, u.name, u.last_login_at,
             p.nickname, p.birth_year, p.gender,
             p.skin_type_code, p.skin_axes_json,
             p.preferences_json,
             p.allergies_json,
             p.last_quiz_at, p.created_at
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = :uid
      LIMIT 1
    """
    with ENGINE.connect() as conn:
        return conn.execute(text(sql), {"uid": user_id}).mappings().fetchone()

# ============================================
# 프로필 업데이트 함수
# ============================================
def update_user_profile(user_id: int, nickname: str, birth_year: int, gender: str):
    """user_profiles 테이블 업데이트 (INSERT ... ON DUPLICATE KEY UPDATE)"""
    sql = text("""
    INSERT INTO user_profiles
      (user_id, nickname, birth_year, gender, updated_at)
    VALUES
      (:uid, :nickname, :byear, :gender, NOW())
    ON DUPLICATE KEY UPDATE
      nickname = VALUES(nickname),
      birth_year = VALUES(birth_year),
      gender = VALUES(gender),
      updated_at = NOW()
    """)
    
    try:
        with ENGINE.begin() as conn:
            conn.execute(sql, {
                "uid": user_id,
                "nickname": nickname,
                "byear": birth_year,
                "gender": gender
            })
        return True
    except Exception as e:
        st.error(f"프로필 저장 실패: {e}")
        return False

# ============================================
# 프로필 편집 모달 (Streamlit 1.31+)
# ============================================
@st.dialog("⚙️ 개인 프로필 설정")
def profile_edit_modal(current_nickname, current_birth_year, current_gender):
    """프로필 편집 모달 창"""
    st.write("기본 정보를 입력해주세요.")
    
    with st.form("profile_form"):
        # 닉네임
        nickname = st.text_input(
            "닉네임", 
            value=current_nickname or "",
            placeholder="사용할 닉네임을 입력하세요",
            max_chars=50
        )
        
        # 생년월일
        current_time = datetime.now()
        min_date = datetime(current_time.year - 100, 1, 1).date()
        max_date = current_time.date()
        
        if current_birth_year:
            try:
                default_date = datetime(current_birth_year, 1, 1).date()
            except ValueError:
                default_date = datetime(2000,1,1).date()
        else:
            # 기본값(2000년1월1일)
            default_date = datetime(2000,1,1).date()
        
        # 날짜가 범위를 벗어나지 않도록 보정
        if default_date < min_date : default_date = min_date
        if default_date > max_date : default_date = max_date
        
        birth_date = st.date_input(
            "생년월일",
            value=default_date,
            min_value=min_date,
            max_value=max_date,
            format='YYYY-MM-DD'
        )
        
        # 성별
        gender_options = {"남성": "male", "여성": "female", "미설정": "na"}
        gender_display = {v: k for k, v in gender_options.items()}
        
        current_gender_display = gender_display.get(current_gender, "미설정")
        gender = st.selectbox(
            "성별",
            options=list(gender_options.keys()),
            index=list(gender_options.keys()).index(current_gender_display)
        )
        
        # 저장 버튼
        col1, col2 = st.columns([1, 1])
        with col1:
            submitted = st.form_submit_button("💾 저장", use_container_width=True)
        with col2:
            cancelled = st.form_submit_button("❌ 취소", use_container_width=True)
        
        if submitted:
            if not nickname or len(nickname.strip()) == 0:
                st.error("닉네임을 입력해주세요.")
            else:
                # DB 저장
                gender_code = gender_options[gender]
                selected_year=birth_date.year
                
                success = update_user_profile(
                    auth_user["id"],
                    nickname.strip(),
                    selected_year,
                    gender_code
                )
                
                if success:
                    st.success("✅ 프로필이 저장되었습니다!")
                    st.balloons()
                    # 2초 후 새로고침
                    import time
                    time.sleep(2)
                    st.rerun()
        
        if cancelled:
            st.rerun()

# ============================================
# 사용자 정보 로드
# ============================================
user_row = fetch_user_profile(auth_user["id"])
if not user_row:
    st.error("사용자 정보를 불러올 수 없습니다.")
    st.stop()

# ============================================
# 데이터 파싱
# ============================================
name = user_row["name"] or "사용자"
email = user_row["email"] or "example@abcd.com"
nickname = user_row["nickname"] or name
birth_year = user_row["birth_year"]
gender_map = {"male": "남성", "female": "여성", "na": "미설정", "other": "기타"}
gender = gender_map.get(user_row["gender"], "미설정")
skin_type_code = user_row["skin_type_code"] or "미설정"

# 나이 계산
age = datetime.now().year - birth_year if birth_year else None
if age:
    if age < 20:
        age_group = "10대"
    elif age < 25:
        age_group = "20대 초반"
    elif age < 30:
        age_group = "20대 후반"
    elif age < 40:
        age_group = "30대"
    else:
        age_group = "40대 이상"
else:
    age_group = "미설정"

# 피부 축 정보
skin_axes = {}
if user_row["skin_axes_json"]:
    try:
        skin_axes = json.loads(user_row["skin_axes_json"])
    except:
        pass

# 선호 성분 (JSON 파싱)
preferences = []
if user_row["preferences_json"]:
    try:
        pref_data = json.loads(user_row["preferences_json"])
        if isinstance(pref_data, list):
            preferences = pref_data
        elif isinstance(pref_data, dict):
            preferences = pref_data.get("ingredients", [])
    except:
        pass

# ✅ 알레르기 성분 (JSON 파싱) - allergies_json
allergies = []
if user_row["allergies_json"]:
    try:
        allergy_data = json.loads(user_row["allergies_json"])
        if isinstance(allergy_data, list):
            allergies = allergy_data
        elif isinstance(allergy_data, dict):
            allergies = allergy_data.get("ingredients", [])
    except:
        pass

# 피부타입 디코딩
skin_type_full = "미설정"
if skin_type_code and skin_type_code != "미설정":
    o_type = "지성" if skin_type_code[0] == "O" else "건성"
    s_type = "민감성" if skin_type_code[1] == "S" else "저항성"
    n_type = "비색소침착" if skin_type_code[2] == "N" else "색소침착"
    t_type = "탄력" if skin_type_code[3] == "T" else "주름"
    skin_type_full = f"{o_type}·{s_type}·{n_type}·{t_type}"

# 활동 통계 (TODO: 실제 집계)
review_count = 7
searched_count = 13
favorite_count = 5

# ============================================
# UI 렌더링
# ============================================
st.title("👤 사용자 정보")

# ============================================
# 상단: 프로필 헤더
# ============================================
col1, col2, col3 = st.columns([1, 3, 1])

with col1:
    st.markdown("""
        <div style="text-align: center;">
            <div style="
                width: 120px; 
                height: 120px; 
                border-radius: 50%; 
                background-color: #E8EAF6; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                font-size: 60px;
                margin: 0 auto;
            ">
                👤
            </div>
        </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"## {nickname}")
    st.caption(f"{age_group} · {gender}")
    st.caption(f"📧 {email}")
    
    if skin_type_code != "미설정":
        tags_html = f"""
            <div style="margin-top: 10px;">
                <span style="
                    background-color: #6C7FED; 
                    color: white; 
                    padding: 5px 15px; 
                    border-radius: 20px; 
                    margin-right: 8px;
                    font-size: 14px;
                ">{skin_type_code}</span>
                <span style="
                    background-color: #9C27B0; 
                    color: white; 
                    padding: 5px 15px; 
                    border-radius: 20px;
                    font-size: 14px;
                ">{skin_type_full}</span>
            </div>
        """
        st.markdown(tags_html, unsafe_allow_html=True)

with col3:
    # ✅ 프로필 편집 버튼
    if st.button("⚙️ 개인 프로필 설정 및 입력", use_container_width=True):
        profile_edit_modal(nickname, birth_year, user_row["gender"])

st.markdown("---")

# ============================================
# 중단: 3개 카드
# ============================================
st.markdown("### 나의 활동")

card1, card2, card3 = st.columns(3)

with card1:
    st.markdown(f"""
        <div style="
            border: 2px solid #E0E0E0; 
            border-radius: 15px; 
            padding: 30px; 
            text-align: center;
            min-height: 150px;
        ">
            <div style="font-size: 40px; margin-bottom: 10px;">📝</div>
            <div style="font-weight: bold; font-size: 16px;">내가 사용해 본 제품 리뷰 쓰기</div>
            <div style="color: #FF69B4; font-size: 32px; font-weight: bold; margin-top: 10px;">{review_count}</div>
        </div>
    """, unsafe_allow_html=True)
    
    if st.button("리뷰 작성하기", key="review_btn", use_container_width=True):
        st.info("리뷰 작성 페이지로 이동 (개발 예정)")

with card2:
    st.markdown(f"""
        <div style="
            border: 2px solid #E0E0E0; 
            border-radius: 15px; 
            padding: 30px; 
            text-align: center;
            min-height: 150px;
        ">
            <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
            <div style="font-weight: bold; font-size: 16px;">찾아 본 성분</div>
            <div style="color: #6C7FED; font-size: 32px; font-weight: bold; margin-top: 10px;">{searched_count}</div>
        </div>
    """, unsafe_allow_html=True)
    
    if st.button("성분 기록 보기", key="ingredient_btn", use_container_width=True):
        st.info("성분 검색 기록 페이지로 이동 (개발 예정)")

with card3:
    st.markdown(f"""
        <div style="
            border: 2px solid #E0E0E0; 
            border-radius: 15px; 
            padding: 30px; 
            text-align: center;
            min-height: 150px;
        ">
            <div style="font-size: 40px; margin-bottom: 10px;">💗</div>
            <div style="font-weight: bold; font-size: 16px;">즐겨찾기 제품</div>
            <div style="color: #FF69B4; font-size: 32px; font-weight: bold; margin-top: 10px;">{favorite_count}</div>
        </div>
    """, unsafe_allow_html=True)
    
    if st.button("즐겨찾기 보기", key="favorite_btn", use_container_width=True):
        st.info("즐겨찾기 목록 페이지로 이동 (개발 예정)")

st.markdown("---")

# ============================================
# 하단: 주의 성분
# ============================================
st.markdown("### 주의 성분")

col_left, col_right = st.columns(2)

with col_left:
    with st.expander("📋 선호 성분", expanded=True):
        st.markdown("""
        피부에 좋은 성분, 선호하는 향, 질감 등을 등록하여  
        맞춤형 제품 추천을 받을 수 있습니다.
        """)
        
        if st.button("편집하기", key="pref_edit"):
            st.info("선호 성분 편집 페이지로 이동")
        
        if preferences:
            st.markdown("**등록된 선호 성분:**")
            for pref in preferences[:10]:
                st.markdown(f"- {pref}")
        else:
            st.info("등록된 선호 성분이 없습니다.")

with col_right:
    with st.expander("⚠️ 알레르기/회피 성분", expanded=False):
        st.markdown("""
        알레르기 반응을 일으키거나 피부에 자극을 주는 성분을 등록하여  
        해당 성분이 포함된 제품을 필터링할 수 있습니다.
        """)
        
        if st.button("편집하기", key="allergy_edit"):
            st.info("알레르기 성분 편집 페이지로 이동")
        
        if allergies:
            st.markdown("**등록된 주의 성분:**")
            for allergy in allergies[:10]:
                st.markdown(f"- {allergy}")
        else:
            st.info("등록된 주의 성분이 없습니다.")

st.markdown("---")

# ============================================
# 디버그 정보
# ============================================
with st.expander("🔧 개발자 정보 (디버그용)"):
    st.json({
        "user_id": user_row["id"],
        "name": name,
        "nickname": nickname,
        "email": email,
        "birth_year": birth_year,
        "age_group": age_group,
        "gender": gender,
        "skin_type_code": skin_type_code,
        "skin_type_full": skin_type_full,
        "skin_axes": skin_axes,
        "preferences": preferences,
        "allergies": allergies,
        "last_quiz_at": str(user_row["last_quiz_at"]) if user_row["last_quiz_at"] else None
    })