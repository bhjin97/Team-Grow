import streamlit as st
from sqlalchemy import text
from aller.storage_sql import get_engine

st.set_page_config(page_title="DB Test", page_icon="🗃️", layout="centered")
st.title("MariaDB 연결 테스트")

try:
    with get_engine().connect() as conn:
        version = conn.execute(text("SELECT VERSION() v")).mappings().fetchone()["v"]
        st.success(f"연결 성공! DB 버전: {version}")
        cnt = conn.execute(text("SELECT COUNT(*) c FROM users")).mappings().fetchone()["c"]
        st.write(f"`users` 행 수: {cnt}")
except Exception as e:
    st.error(f"연결 실패: {e}")
