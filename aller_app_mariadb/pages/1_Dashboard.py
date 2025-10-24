# streamlit run aller_user_dashboard.py
import os, json
import streamlit as st
import pandas as pd
import requests
from dotenv import load_dotenv
from datetime import datetime
from dataclasses import dataclass
from statistics import pstdev
from typing import Dict, List, Optional
from urllib.parse import quote_plus
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from utils.perfume import (
    initialize,  # ✅ 초기화 함수 추가
    load_all_data,
    recommend_perfume_hybrid,
    CITY_MAPPING,
    LOCATION_NOTES_MAP,
    AGE_NOTES_MAP,
    MOOD_NOTES_MAP
)
from aller.ui import require_login_redirect, render_app_sidebar
require_login_redirect()   # 비로그인 접근 차단 + 기본 네비 숨김
render_app_sidebar()       # 로그인 후 커스텀 사이드바 표시 (로그인은 없음)


st.set_page_config(page_title="Aller 사용자 대시보드", layout="wide")

# ─────────────────────────────────────────
# 로그인 세션 필수
# ─────────────────────────────────────────
auth_user = st.session_state.get("auth_user")
if not auth_user:
    st.error("로그인이 필요합니다. 로그인 페이지에서 먼저 로그인해주세요.")
    st.stop()

# ─────────────────────────────────────────
# DB 연결
# ─────────────────────────────────────────
def get_engine() -> Engine:
    dialect = os.getenv("DB_DIALECT", "mysql+pymysql")
    host    = os.getenv("DB_HOST", "211.51.163.232")
    port    = os.getenv("DB_PORT", "19306")
    user    = os.getenv("DB_USER", "lgup1")
    pw      = os.getenv("DB_PASSWORD", "lgup1P@ssw0rd")
    name    = os.getenv("DB_NAME", "lgup1")
    dsn = f"{dialect}://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{quote_plus(name)}?charset=utf8mb4"
    return create_engine(dsn, pool_pre_ping=True, future=True)

ENGINE = get_engine()

def fetch_user_by_id(user_id: int):
    sql = """
      SELECT u.id, u.email, u.name, u.last_login_at,
             p.nickname, p.birth_year, p.gender,
             p.skin_type_code, p.skin_axes_json, p.last_quiz_at
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = :uid
      LIMIT 1
    """
    with ENGINE.connect() as conn:
        return conn.execute(text(sql), {"uid": user_id}).mappings().fetchone()

def upsert_profile(user_id: int, nickname=None, birth_year=None, gender="na",
                   skin_type_code=None, skin_axes_json=None):
    sql = text("""
    INSERT INTO user_profiles
      (user_id, nickname, birth_year, gender, skin_type_code, skin_axes_json, last_quiz_at)
    VALUES
      (:uid, :nickname, :byear, :gender, :code, :axes, NOW())
    ON DUPLICATE KEY UPDATE
      nickname=VALUES(nickname),
      birth_year=VALUES(birth_year),
      gender=VALUES(gender),
      skin_type_code=VALUES(skin_type_code),
      skin_axes_json=VALUES(skin_axes_json),
      last_quiz_at=VALUES(last_quiz_at),
      updated_at=CURRENT_TIMESTAMP
    """)
    with ENGINE.begin() as conn:
        conn.execute(sql, {
            "uid": user_id,
            "nickname": nickname or None,
            "byear": int(birth_year) if birth_year else None,
            "gender": gender or "na",
            "code": skin_type_code or None,
            "axes": skin_axes_json
        })

# 세션 사용자 로드
user_row = fetch_user_by_id(auth_user["id"])
if not user_row:
    st.error("세션 사용자 정보를 불러올 수 없습니다. (DB에 사용자 레코드가 없음)")
    st.stop()

# ─────────────────────────────────────────
# 0) 상단 헤더 & 사용자 요약
# ─────────────────────────────────────────
st.title("🧴 Aller 사용자 대시보드 (User)")
st.caption("개인 데이터 기반 맞춤 분석/추천 · 바우만 피부타입 진단 포함")

# (가상) 사용자 고민/상태 점수 — 차후 DB 집계로 교체
user_ctx = {
    "user_id": user_row["id"],
    "name": user_row["name"],
    "skin_type": user_row["skin_type_code"] or "미설정",
    "top_troubles": ["건조", "홍조", "민감"],  # TODO: review/설문 집계로 대체
    "state_score": 7.8,                       # TODO: 최근 상태 모델 점수
}

with st.container():
    st.subheader("0) 내 피부 요약")
    c1, c2, c3, c4 = st.columns([1.2, 1, 1.2, 1])
    with c1:
        st.metric("사용자", user_ctx["name"])
        st.metric("피부타입", user_ctx["skin_type"])
    with c2:
        st.metric("최근 상태 점수", f"{user_ctx['state_score']}/10")
    with c3:
        st.write("**주요 고민 Top3**")
        st.write(" • " + " / ".join(user_ctx["top_troubles"]))
    with c4:
        st.write("**기간 선택**")
        period = st.selectbox("분석 기간", ["최근 30일", "최근 90일", "최근 180일"], index=0)
        st.caption("기간은 일부 집계에 반영됩니다.")

st.divider()

# ─────────────────────────────────────────
# 1) 채팅 → 화장법 레퍼런스 (데모)
# ─────────────────────────────────────────
st.subheader("1) 채팅 → 화장법 레퍼런스")
col1, col2 = st.columns([1.5, 2])
with col1:
    style_text = st.text_input("원하는 화장법을 입력하세요", "청순하고 자연스러운 데일리 메이크업", key="style_text")
    if st.button("🔍 스타일 분석", key="style_btn"):
        # TODO: 규칙/LLM로 태그 추출
        t = style_text.lower()
        tags = []
        if "청순" in t or "natural" in t: tags.append("청순")
        if "글로우" in t or "glow" in t:  tags.append("글로우")
        if "mlbb" in t or "누디" in t:    tags.append("MLBB")
        if not tags: tags = ["내추럴", "소프트"]
        st.session_state["style_tags"] = tags
with col2:
    tags = st.session_state.get("style_tags", ["(미분석)"])
    st.write("**추출 태그:**", ", ".join(tags))
    st.write("**추천 레퍼런스(작게 3장)**")
    # TODO: makeup_reference(tags 매칭) 상위 3장
    st.image(
        ["https://picsum.photos/seed/muA/200/140",
         "https://picsum.photos/seed/muB/200/140",
         "https://picsum.photos/seed/muC/200/140"],
        width=160, caption=["레퍼런스 A", "레퍼런스 B", "레퍼런스 C"]
    )

st.divider()

# ============================================
# 2. 향수 추천 (실제 프로그램)
# ============================================
initialize()

st.subheader('2)🌿 AI 향수 추천')
st.caption('날씨, 상황, 연령, 기분에 맞는 최적의 향수를 찾아보세요.')

# 데이터 로드
all_data = load_all_data()
if not all(all_data):
    st.error("데이터 로드 실패. 관리자에게 문의하세요.")
else:
    # 입력 폼
    with st.form("perfume_form"):
        col1, col2 = st.columns(2)
        
        with col1:
            selected_city = st.selectbox('📍 현재 위치', list(CITY_MAPPING.keys()))
            selected_location = st.selectbox('🧑‍🤝‍🧑 상황', list(LOCATION_NOTES_MAP.keys()))
            selected_mood = st.selectbox('😊 기분', list(MOOD_NOTES_MAP.keys()))
        
        with col2:
            selected_price = st.selectbox('💰 가격대', 
                ["가격 무관", "5만원 이하", "5~10만원", "10~15만원", "15만원 이상"])
            selected_age = st.selectbox('🎂 연령대', list(AGE_NOTES_MAP.keys()))
            selected_gender = st.selectbox('🚻 성별', ["여성", "남성", "공용"])
        
        submitted = st.form_submit_button("✨ 추천받기")
    
    if submitted:
        user_input = {
            'city': selected_city,
            'price_range': selected_price,
            'location': selected_location,
            'age': selected_age,
            'mood': selected_mood,
            'gender': selected_gender
        }
        
        with st.spinner('최적의 향수를 분석 중입니다...'):
            recommendations, weather, condition = recommend_perfume_hybrid(user_input, all_data)
        
        # 날씨 정보
        if weather:
            st.info(f"**{selected_city}**의 현재 날씨는 **'{weather['condition']}'** 이며, "
                   f"**'{condition}'** 조건으로 추천되었습니다.")
        
        # 추천 결과
        if not recommendations:
            st.warning('선택하신 조건에 맞는 향수를 찾지 못했습니다. 다른 조건을 시도해보세요.')
        else:
            st.success(f'총 {len(recommendations)}개의 향수를 추천합니다!')
            
            for idx, product in enumerate(recommendations, 1):
                with st.expander(f"**{idx}. {product['name']}** (점수: {product['final_score']:.2f})"):
                    col1, col2 = st.columns([1, 2])
                    
                    with col1:
                        if product.get('image_url'):
                            st.image(product['image_url'], use_container_width=True)
                        else:
                            st.write("🖼️ 이미지 없음")
                    
                    with col2:
                        st.metric("⭐ 평점", f"{product.get('rating', 'N/A')} / 5.0")
                        st.metric("💰 가격", product.get('price', '정보 없음'))
                        st.metric("📦 용량", product.get('volume', '정보 없음'))
                        st.markdown(f"**카테고리:** {product.get('category', 'N/A')}")
                        
                        # 노트 정보
                        notes = all_data[2].get(product['name'], {}).get('notes_factors', [])
                        if notes:
                            st.markdown(f"**주요 노트:** `{'`, `'.join(notes[:5])}`")

# ─────────────────────────────────────────
# 3) 바우만 피부타입 진단 (적응형) + 프로필 저장
# ─────────────────────────────────────────
st.subheader("3) 바우만 피부타입 진단 (간단·적응형)")

# =========================
# 공통: 설문 상태 초기화 함수
# =========================
def reset_quiz_state():
    # 세션 키 전부 제거
    for k in ["skinq_responses", "skinq_tb_needed", "skinq_tb_answers", "skinq_result", "redo_prompt_dismissed"]:
        if k in st.session_state:
            del st.session_state[k]
    # 초기 상태로 재설정
    st.session_state.skinq_responses = {}
    st.session_state.skinq_tb_needed = []
    st.session_state.skinq_tb_answers = {}
    st.session_state.skinq_result = None

# =========================
# 사용자 변경 감지 → 자동 초기화
# =========================
if "current_user_id" not in st.session_state:
    st.session_state.current_user_id = None

# user_row["id"]가 이전 사용자와 다르면 모든 설문 상태 초기화
if user_row and st.session_state.current_user_id != user_row["id"]:
    reset_quiz_state()
    # 혹시 남아있을 수 있는 컨펌 닫힘 플래그 제거
    if "redo_prompt_dismissed" in st.session_state:
        del st.session_state.redo_prompt_dismissed
    st.session_state.current_user_id = user_row["id"]

# =========================
# 재진단 안내(컨펌) 처리
# - DB의 과거 진단 보유 여부(user_row["skin_type_code"]) 또는
# - 현재 세션에 결과가 있음(skinq_result)
# =========================
has_past_diag = bool(user_row.get("skin_type_code"))          # DB 저장값 기준
has_session_diag = bool(st.session_state.get("skinq_result")) # 세션 기준
needs_redo_prompt = has_past_diag or has_session_diag

# 모달/팝업 대용: 경고 박스 + 버튼 2개
if needs_redo_prompt and not st.session_state.get("redo_prompt_dismissed"):
    with st.container(border=True):
        st.warning("기존에 진단 완료하였습니다. 다시 진단 하시겠습니까?")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("다시 진단", key="redo_yes"):
                reset_quiz_state()
                st.session_state.redo_prompt_dismissed = True
                st.toast("문항을 다시 선택해주세요.")
                try:
                    st.rerun()
                except Exception:
                    st.experimental_rerun()
        with c2:
            if st.button("그대로 둘게요", key="redo_no"):
                st.session_state.redo_prompt_dismissed = True

# ====== 여기서부터 원래 코드 계속 ======
from dataclasses import dataclass
from typing import List, Dict, Optional
from statistics import pstdev
import json

@dataclass
class Item:
    id: str
    axis: str
    text: str
    reverse: bool
    right_letter: str

SURVEY_V1: List[Item] = [
    Item("Q1", "OD", "세안 후 30분 이내에 얼굴이 당기거나 건조하게 느껴진다.", True,  "O"),
    Item("Q2", "OD", "오후가 되면 T존(이마·코)이 번들거린다.",                False, "O"),
    Item("Q3", "OD", "파운데이션이 자주 뜨고 각질이 부각된다.",                True,  "O"),
    Item("Q4", "SR", "새 제품 사용 시 화끈거림·따가움·가려움이 자주 생긴다.",   False, "S"),
    Item("Q5", "SR", "계절/온도 변화에 따라 홍조가 쉽게 나타난다.",            False, "S"),
    Item("Q6", "SR", "알레르기/아토피·여드름 등 피부 트러블 병력이 있다.",     False, "S"),
    Item("Q7", "PN", "기미·잡티가 쉽게 생기거나 오래 남는다.",                  False, "P"),
    Item("Q8", "PN", "외출 시 자외선 차단을 자주 빼먹는 편이다.",              False, "P"),
    Item("Q9", "PN", "여드름·상처 후 갈색/붉은 자국(PIH/PIE)이 오래 남는다.",   False, "P"),
    Item("Q10","WT", "눈가/팔자 등 표정 주름이 점점 또렷해진다.",               False, "W"),
    Item("Q11","WT", "밤샘/스트레스 후 피부 탄력이 확 떨어진다.",               False, "W"),
    Item("Q12","WT", "건조한 곳에서 미세주름(건성주름)이 잘 생긴다.",           False, "W"),
]
TIEBREAKERS = {
    "OD": [Item("OD_TB1","OD","스킨/토너만 바르고 1시간 뒤 T존 번들거림을 닦아낸 적이 자주 있다.",False,"O"),
           Item("OD_TB2","OD","파데·쿠션이 자주 뜨고 각질이 부각된다.", True,"O")],
    "SR": [Item("SR_TB1","SR","약한 각질제거제·레티노이드에도 따가움/홍조가 쉽게 생긴다.", False,"S"),
           Item("SR_TB2","SR","향/알코올/에센셜오일에도 자극을 거의 느끼지 않는다.", True,"S")],
    "PN": [Item("PN_TB1","PN","여름 야외활동 후 피부 톤이 쉽게 어두워지고 오래 돌아오지 않는다.", False,"P"),
           Item("PN_TB2","PN","트러블이 사라진 뒤 자국(PIH/PIE)이 수주 이상 남는다.", False,"P")],
    "WT": [Item("WT_TB1","WT","표정 습관(찌푸림 등) 자국/잔주름이 쉽게 사라지지 않는다.", False,"W"),
           Item("WT_TB2","WT","수분크림만으로도 건조 주름이 금방 펴지는 편이다.", True,"W")],
}
AXES = ["OD","SR","PN","WT"]
LEFT_LETTER  = {"OD":"D", "SR":"R", "PN":"N", "WT":"T"}
RIGHT_LETTER = {"OD":"O", "SR":"S", "PN":"P", "WT":"W"}

def _resp_widget(label: str, key: str):
    # 각 문항에 마우스오버 도움말도 함께 제공
    choice = st.radio(
        label,
        options=[1, 2, 3, 4, 5, "모름"],
        key=key,
        horizontal=True,
        help="1=전혀 아니다 · 5=매우 그렇다 (숫자가 클수록 ‘예’). 애매하면 ‘모름’.",
    )
    return None if choice == "모름" else int(choice)

def _apply_reverse(x: int, reverse: bool) -> int: return (6 - x) if reverse else x
def _axis_items(items: List[Item], axis: str) -> List[Item]: return [it for it in items if it.axis == axis]
def _avg_and_stats(values: List[Optional[int]], item_defs: List[Item]):
    scored, unknown = [], 0
    for v, it in zip(values, item_defs):
        if v is None: unknown += 1; v = 3
        scored.append(_apply_reverse(v, it.reverse))
    avg = sum(scored)/len(scored); stdev = pstdev(scored) if len(scored) > 1 else 0.0
    return avg, unknown, stdev, scored
def _decide_letter(avg: float, axis: str) -> Optional[str]:
    if avg <= 2.6: return LEFT_LETTER[axis]
    if avg >= 3.4: return RIGHT_LETTER[axis]
    return None
def _confidence(stdev: float, unknown_cnt: int, used_tb: bool) -> int:
    base = 100; penalty = (stdev*10) + (unknown_cnt*5) + (5 if used_tb else 0)
    return max(0, min(100, round(base - penalty)))

def evaluate_baumann(responses: Dict[str, Optional[int]], tiebreaker_responses: Optional[Dict[str, Optional[int]]] = None) -> Dict:
    tiebreaker_responses = tiebreaker_responses or {}
    result = {"axes": {}, "needed_tiebreakers": [], "type_code": None, "confidence_overall": None}
    letters, confidences = [], []
    for axis in AXES:
        base_items = _axis_items(SURVEY_V1, axis)
        base_vals  = [responses.get(it.id) for it in base_items]
        avg, unknown, stdev, scored_list = _avg_and_stats(base_vals, base_items)
        letter = _decide_letter(avg, axis); used_tb, tb_id_used = False, None
        if letter is None:
            tb_item = TIEBREAKERS[axis][0]; tb_id = tb_item.id
            if tb_id not in tiebreaker_responses:
                conf = _confidence(stdev, unknown, used_tb=False)
                result["axes"][axis] = {"avg_base": round(avg,2), "final_letter": None, "confidence": conf,
                                        "used_tiebreaker": False, "tiebreaker_id": None, "scores": scored_list}
                result["needed_tiebreakers"].append({"axis": axis, "item": {"id": tb_id, "text": tb_item.text, "reverse": tb_item.reverse}})
                continue
            tb_val = tiebreaker_responses.get(tb_id)
            if tb_val is None: tb_val, unknown = 3, unknown + 1
            tb_scored = _apply_reverse(tb_val, tb_item.reverse)
            avg2 = (avg*len(base_items) + tb_scored) / (len(base_items)+1)
            used_tb, tb_id_used, letter = True, tb_id, _decide_letter(avg2, axis)
            if letter is None: letter = RIGHT_LETTER[axis] if avg2 >= 3.0 else LEFT_LETTER[axis]
            avg, stdev = avg2, stdev + 0.2
        conf = _confidence(stdev, unknown, used_tb)
        result["axes"][axis] = {"avg_base": round(avg,2), "final_letter": letter, "confidence": conf,
                                "used_tiebreaker": used_tb, "tiebreaker_id": tb_id_used, "scores": scored_list}
        letters.append(letter); confidences.append(conf)
    result["type_code"] = letters[0]+letters[1]+letters[2]+letters[3] if len(letters)==4 and all(l in "ODSRPNWT" for l in letters) else None
    result["confidence_overall"] = round(sum(confidences)/len(confidences), 1) if confidences else None
    return result

def _resp_widget(label: str, key: str):
    choice = st.radio(
        label,
        options=[1,2,3,4,5,"모름"],
        key=key,
        horizontal=True,
        help="1=전혀 아니다 · 5=매우 그렇다 (숫자가 클수록 ‘예’). 애매하면 ‘모름’.",
    )
    return None if choice == "모름" else int(choice)

def render_scale_guide():
    st.markdown(
        """
        <p style='font-size:14px; color:gray; margin:0 0 6px 0;'>
        응답 기준: <b>1=전혀 아니다</b>, <b>5=매우 그렇다</b>.
        숫자가 클수록 <b>‘예(그렇다)’</b>에 가깝습니다.
        애매하면 <b>‘모름’</b>을 선택하세요.
        </p>
        """,
        unsafe_allow_html=True
    )

# 설문 상태 기본값(초기화 이후 보장)
if "skinq_responses" not in st.session_state: st.session_state.skinq_responses = {}
if "skinq_tb_needed"  not in st.session_state: st.session_state.skinq_tb_needed = []
if "skinq_tb_answers" not in st.session_state: st.session_state.skinq_tb_answers = {}
if "skinq_result"     not in st.session_state: st.session_state.skinq_result = None

axis_titles = {"OD":"지성↔건성(OD)", "SR":"민감↔저항(SR)", "PN":"색소↔비색소(PN)", "WT":"주름↔탄탄(WT)"}
cols = st.columns(2)
for idx, axis in enumerate(AXES):
    with cols[idx % 2]:
        with st.expander(f"{axis_titles[axis]} · 클릭하여 답변하기", expanded=False):
            render_scale_guide()
            items = _axis_items(SURVEY_V1, axis)
            for it in items:
                st.session_state.skinq_responses[it.id] = _resp_widget(it.text, key=f"skin_{it.id}")

if st.button("1차 채점 ▶", key="score1"):
    r1 = evaluate_baumann(st.session_state.skinq_responses)
    st.session_state.skinq_tb_needed = r1["needed_tiebreakers"]
    st.session_state.skinq_result = r1

tb_needed = st.session_state.skinq_tb_needed
if tb_needed:
    st.info("몇 가지 축에서 애매함이 있어 **타이브레이커** 1문항씩 확인합니다.")
    for tb in tb_needed:
        axis = tb["axis"]; item = tb["item"]
        with st.expander(f"추가 확인 · {axis_titles[axis]}", expanded=True):
            st.session_state.skinq_tb_answers[item["id"]] = _resp_widget(item["text"], key=f"tb_{item['id']}")
    if st.button("최종 결과 보기 ✅", key="final_score"):
        r2 = evaluate_baumann(st.session_state.skinq_responses, tiebreaker_responses=st.session_state.skinq_tb_answers)
        st.session_state.skinq_result = r2
        st.session_state.skinq_tb_needed = []

r = st.session_state.skinq_result
if r and r["type_code"]:
    st.success(f"**최종 바우만 타입: `{r['type_code']}`**  |  확신도 {r['confidence_overall']}/100")
    for axis in AXES:
        ax = r["axes"][axis]
        left, right = LEFT_LETTER[axis], RIGHT_LETTER[axis]
        st.write(f"- **{axis}**: 평균 {ax['avg_base']}, 판정 **{ax['final_letter']}** (신뢰도 {ax['confidence']})  ·  {left}← {(ax['avg_base']-1)/4:.2f} →{right}")

    # 재진단 버튼(결과 화면에서도 제공)
    if st.button("다시 진단하기 🔄", key="redo_from_result"):
        reset_quiz_state()
        st.toast("문항을 다시 선택해주세요.")
        try:
            st.rerun()
        except Exception:
            st.experimental_rerun()

    if st.button("진단 결과를 프로필에 저장 💾", type="primary", key="save_quiz"):
        try:
            axes_payload = {
                ax: {
                    "avg": r["axes"][ax]["avg_base"],
                    "letter": r["axes"][ax]["final_letter"],
                    "confidence": r["axes"][ax]["confidence"],
                } for ax in AXES
            }
            upsert_profile(
                user_id=user_row["id"],
                nickname=user_row["nickname"] or None,
                birth_year=user_row["birth_year"] or None,
                gender=user_row["gender"] or "na",
                skin_type_code=r["type_code"],
                skin_axes_json=json.dumps(axes_payload, ensure_ascii=False),
            )
            st.success("저장 완료! 상단 요약의 바우만 타입이 갱신됩니다.")
        except Exception as e:
            st.error(f"저장 실패: {e}")
else:
    st.markdown(
        """
        <p style='font-size:14px; color:gray;'>
        카드를 눌러 문항에 답변한 뒤 <b>1차 채점 ▶</b> 버튼을 눌러주세요.
        </p>
        """,
        unsafe_allow_html=True
    )

st.divider()

# ─────────────────────────────────────────
# 4) 가상 피부 모델 × 제품 효과 시뮬레이션 (데모)
# ─────────────────────────────────────────
st.subheader("4) 가상 피부 모델 × 제품 효과 시뮬레이션")
colL, colR = st.columns([1.2, 2])
with colL:
    # TODO: DB product 목록 연동
    product = st.selectbox("제품 선택", ["라로슈 수분세럼", "닥터지 진정앰플", "이니스프리 톤업크림"], key="sim_product")
    run_sim = st.button("🧪 시뮬레이션 실행", key="sim_run")
with colR:
    if run_sim:
        # TODO: product_ingredient → ingredient_effect join + skin_type 가중합
        effects = pd.DataFrame({
            "효과": ["보습", "진정", "장벽", "톤업", "피지"],
            "점수": [9.0, 7.0, 6.0, 3.0, 1.0]
        }).sort_values("점수", ascending=False)
        st.dataframe(effects, hide_index=True, use_container_width=True)
        st.success("예상 결과: 보습·진정 효과가 높음. 톤업/피지 개선은 낮음.")
    else:
        st.caption("제품을 선택하고 시뮬레이션을 실행하세요.")

st.divider()

# ─────────────────────────────────────────
# 5) 맞춤형 관리 루틴 (AM/PM)
# ─────────────────────────────────────────
from utils.skincare_routine import recommend_products, render_routine

st.subheader("5) 맞춤형 관리 루틴 (AM/PM)")

# 바우만 피부타입 16개
SKIN_TYPES = [
    "DSPT", "DSPW", "DSNT", "DSNW",
    "DRPT", "DRPW", "DRNT", "DRNW",
    "OSPT", "OSPW", "OSNT", "OSNW",
    "ORPT", "ORPW", "ORNT", "ORNW"
]

# 사용자 피부타입 불러오기 (없으면 DSPT로 기본 설정)
skin_type = st.selectbox(
    "피부타입 선택",
    SKIN_TYPES,
    index=SKIN_TYPES.index(user_ctx["skin_type"]) if user_ctx["skin_type"] in SKIN_TYPES else 0
)

# 계절, 시간대 선택
season = st.radio("계절 선택", ["여름", "겨울"], horizontal=True)
time_choice = st.radio("시간대 선택", ["☀️ 아침 루틴", "🌙 저녁 루틴"], horizontal=True)
time = "아침" if "아침" in time_choice else "저녁"

# 실행 버튼
if st.button("루틴 추천 보기"):
    df = recommend_products(skin_type, season, time, top_n=1)
    if df.empty:
        st.warning("추천할 제품이 없습니다.")
    else:
        st.success(f"{skin_type} / {season} / {time} 루틴 추천 결과")
        render_routine(df)
