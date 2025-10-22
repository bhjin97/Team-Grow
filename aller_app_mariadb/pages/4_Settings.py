import streamlit as st
st.title('Settings')
import streamlit as st
# --- 공통 유틸리티에서 사이드바 함수 임포트 ---
# [수정] aller.ui 모듈에서 함수 임포트
try:
    from aller.ui import render_app_sidebar, require_login_redirect
except ImportError:
    # aller.ui를 찾을 수 없는 경우 (예: 경로 문제)
    # 임시 폴백(Fallback) 함수 정의
    st.error("UI 모듈(aller.ui)을 찾을 수 없습니다. 'aller' 폴더가 PYTHONPATH에 있는지 확인하세요.")
    def render_app_sidebar():
        st.sidebar.error("사이드바 로드 실패")
    def require_login_redirect(login_page=""):
        if not st.session_state.get("auth_user"):
            st.warning("로그인이 필요합니다. (폴백)")
            st.stop()

# --- 페이지 설정 (필수) ---
# 이 코드는 항상 스크립트 최상단에, 다른 Streamlit 호출보다 먼저 위치해야 합니다.
st.set_page_config(
    page_title="설정",
    page_icon="⚙️", # 브라우저 탭 아이콘
    layout="centered"
)

# ============================================
# [추가] 로그인 체크 및 커스텀 사이드바 렌더링
# ============================================
require_login_redirect() # 로그인 확인
render_app_sidebar()     # 커스텀 사이드바 표시

# ============================================
# 콜백 함수 정의 (UI 렌더링 코드보다 위에 정의)
# ============================================

def handle_benefit_toggle():
    """혜택 알림 토글 시 호출되는 함수"""
    # 이 함수는 토글 값이 '변경될 때' 호출됩니다.
    # st.session_state.benefit_agree 에는 이미 변경된 값이 들어있습니다.
    
    # 예: DB 업데이트 로직
    # user_id = st.session_state.get("user_id")
    # if user_id:
    #     update_user_notification(user_id, st.session_state.benefit_agree)
    
    st.toast("알림 설정이 변경되었습니다.", icon="🔔")

def handle_marketing_toggle():
    """마케팅 동의 토글 시 호출되는 함수"""
    # 예: DB 업데이트 로직
    # user_id = st.session_state.get("user_id")
    # if user_id:
    #     update_user_marketing_consent(user_id, st.session_state.marketing_agree)
        
    st.toast("마케팅 동의 정보가 변경되었습니다.", icon="📝")

# ============================================
# 세션 상태 초기화 (콜백 정의 후, UI 렌더링 전)
# ============================================
# 스크립트가 실행될 때 세션 상태에 키가 없으면 기본값을 설정합니다.
# key를 사용하는 위젯(st.toggle)은 이 값을 자동으로 value로 사용합니다.

if 'benefit_agree' not in st.session_state:
    st.session_state.benefit_agree = True  # 예: 기본값 '동의'

if 'marketing_agree' not in st.session_state:
    st.session_state.marketing_agree = False # 예: 기본값 '비동의'

# ============================================
# UI 렌더링
# ============================================

st.title("⚙️ 설정")
st.markdown("---")

# --- 1. 알림 설정 ---
st.subheader("알림 설정")

# [수정] 누락되었던 benefit_agree 토글 UI 추가
# [수정] value= 인수를 제거하고, on_change= 콜백을 연결
st.toggle(
    "혜택 정보 수신 동의 (Push/Email)",
    key="benefit_agree",
    on_change=handle_benefit_toggle,
    help="신제품 출시, 이벤트 및 할인 혜택 정보를 받습니다."
)

st.markdown("---")

# --- 2. 이용 약관 및 정보 동의 ---
st.subheader("약관 및 정보 동의")

# [수정] 'is_marketing_agreed' 변수 제거 (key로 충분함)
# [수정] value= 인수를 제거하고, on_change= 콜백을 연결
# [수정] key="marketing_agree"로 통일 (d가 없음)
st.toggle(
    "마케팅 정보 수신 동의 (선택)",
    key="marketing_agree",
    on_change=handle_marketing_toggle,
    help="맞춤형 광고 및 마케팅 분석에 사용자 정보를 활용하는 데 동의합니다."
)

# [수정] 오류를 발생시키는 'if' 블록 제거. on_change 콜백이 이 역할을 대신합니다.

# 약관 링크
st.markdown("""
- [서비스 이용약관 보기](https://www.example.com/terms)
- [개인정보 처리방침 보기](https://www.example.com/privacy)
""")

st.markdown("---")

# --- 3. 버전 정보 ---
st.subheader("버전 정보")

st.info("현재 최신 버전을 사용하고 있습니다.")

st.text("App Version: 1.0.0")
st.caption(f"Last updated: 2025-10-22") # 동적으로 날짜를 표시할 수 있습니다.

st.markdown("---")

# (선택) 로그아웃 버튼
# ui.py의 render_app_sidebar()에 로그아웃 버튼이 이미 있으므로
# 이 부분은 중복될 수 있습니다. 필요 없다면 이 if 블록을 제거하세요.
if st.button("🏠로그아웃)", use_container_width=True, type="secondary"):
    st.warning("로그아웃 되었습니다.")
    st.session_state.clear()
