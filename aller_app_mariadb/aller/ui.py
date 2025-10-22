# aller/ui.py
import streamlit as st

def _hide_default_nav():
    # 기본 멀티페이지 네비 통째로 숨김 (모든 페이지에서 공통으로 적용)
    st.markdown("""
    <style>
      [data-testid="stSidebarNav"] { display: none !important; }
    </style>
    """, unsafe_allow_html=True)

def switch_to(path: str):
    try:
        st.switch_page(path)  # Streamlit >= 1.22
    except Exception:
        st.experimental_set_query_params(go=path)
        st.rerun()

def require_login_redirect(login_page="🏠_Login.py"):
    _hide_default_nav()
    if not st.session_state.get("auth_user"):
        st.warning("로그인이 필요합니다.")
        switch_to(login_page)

def render_app_sidebar():
    """로그인 후에만 보이는 커스텀 사이드바 메뉴"""
    _hide_default_nav()  # 기본 네비 숨김(중복 호출 OK)
    user = st.session_state.get("auth_user")
    with st.sidebar:
        if not user:
            # 비로그인 상태에선 커스텀 메뉴도 표시하지 않음
            return

        st.markdown("### 🧴 Aller")
        st.caption(f"**{user['name']}** ({user['email']})")

        # Streamlit 1.25+라면 page_link, 아니면 버튼으로 전환
        try:
            st.page_link("pages/1_Dashboard.py", label="📊 대시보드", icon="📊")
            st.page_link("pages/2_Chat.py", label="💬 채팅", icon="💬")
            st.page_link("pages/3_Profile.py", label="👤 사용자 정보", icon="👤")
            st.page_link("pages/4_Settings.py", label="⚙️ 설정", icon="⚙️")
        except Exception:
            if st.button("📊 대시보드"): switch_to("pages/1_Dashboard.py")
            if st.button("💬 채팅"):     switch_to("pages/2_Chat.py")
            if st.button("👤 사용자 정보"): switch_to("pages/3_Profile.py")
            if st.button("⚙️ 설정"):     switch_to("pages/4_Settings.py")

        st.markdown("---")
        if st.button("🚪 로그아웃"):
            st.session_state["auth_user"] = None
            switch_to("🏠_Login.py")  # ← 로그인 화면으로 이동 (로그인 메뉴는 없음)
# aller/ui.py (추가)
def hide_multipage_nav():
    _hide_default_nav()
