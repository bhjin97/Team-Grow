import streamlit as st
from aller.auth import create_user, login
from aller.ui import hide_multipage_nav, switch_to, render_app_sidebar

st.set_page_config(page_title="Aller | Login", page_icon="🧴",
                   layout="centered", initial_sidebar_state="collapsed") # collapsed를 유지해도 되지만, 아래 CSS가 우선합니다.

# 1. CSS를 주입하여 사이드바 영역 전체를 'display: none'으로 설정
#    Streamlit 사이드바의 data-testid는 'stSidebar'입니다.
st.markdown(
    """
<style>
    section[data-testid="stSidebar"] {
        display: none !important;
    }
</style>
""",
    unsafe_allow_html=True,
)


# 비로그인 화면: 사이드바 네비 숨김 (이 함수는 멀티페이지 네비게이션을 숨기는 역할은 계속 수행합니다)
hide_multipage_nav()

st.title("🧴 Aller 로그인 / 회원가입")
tab_login, tab_signup = st.tabs(["로그인", "회원가입"])

with tab_login:
    email = st.text_input("이메일", key="login_email")
    pw = st.text_input("비밀번호", type="password", key="login_pw")
    if st.button("로그인", key="login_btn"):
        user = login(email, pw)
        if user:
            st.session_state["auth_user"] = user
            st.success("로그인 성공! 대시보드로 이동합니다…")
            switch_to("pages/1_Dashboard.py")
        else:
            st.error("로그인 실패")

with tab_signup:
    name = st.text_input("이름", key="signup_name")
    email2 = st.text_input("이메일(회원가입)", key="signup_email")
    pw1 = st.text_input("비밀번호", type="password", key="signup_pw1")
    pw2 = st.text_input("비밀번호 확인", type="password", key="signup_pw2")
    if st.button("회원가입", key="signup_btn"):
        if pw1 != pw2 or len(pw1) < 6:
            st.error("비밀번호 확인/길이를 확인하세요. (6자 이상)")
        else:
            ok, err = create_user(email2, name, pw1)
            st.success("가입 완료! 로그인 탭으로 이동") if ok else st.error(err)