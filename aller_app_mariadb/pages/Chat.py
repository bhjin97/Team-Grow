import streamlit as st
st.title('Chat')
require_login_redirect()     # 로그인 안 되어 있으면 로그인 화면으로 보냄
render_app_sidebar()         # ← 로그인 된 경우에만 사이드바 메뉴가 보임
