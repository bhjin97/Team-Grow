# -*- coding: utf-8 -*-
# streamlit run chat_panel.py
# 또는 다른 Streamlit 페이지에서: from chat_panel import render_chat; render_chat()

import os
from typing import List, Dict, Generator, Optional

import streamlit as st
from aller.ui import require_login_redirect, render_app_sidebar

require_login_redirect()   # 비로그인 접근 차단 + 기본 네비 숨김
render_app_sidebar()       # 로그인 후 커스텀 사이드바 표시 (로그인은 없음)

try:
    # OpenAI SDK v1
    from openai import OpenAI
except Exception as e:
    st.error("OpenAI SDK를 찾을 수 없습니다. `pip install openai` 후 다시 시도하세요.")
    raise

# ─────────────────────────────────────────
# 구성 옵션
# ─────────────────────────────────────────
DEFAULT_MODEL = "gpt-4o-mini"
SYSTEM_PROMPT = (
    "너는 화장품/스킨케어 도메인에 친절한 어시스턴트야. "
    "사실과 근거를 중시하고, 의학적 진단은 피하되 전문 상담이 필요하면 권유해."
)

# ─────────────────────────────────────────
# 상태 초기화
# ─────────────────────────────────────────
def _init_state():
    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages: List[Dict[str, str]] = [
            {"role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요? 😊"}
        ]
    if "chat_model" not in st.session_state:
        st.session_state.chat_model = DEFAULT_MODEL
    if "chat_system_prompt" not in st.session_state:
        st.session_state.chat_system_prompt = SYSTEM_PROMPT
    if "chat_history_limit" not in st.session_state:
        st.session_state.chat_history_limit = 16  # 직전 N쌍만 보내서 토큰 최적화

# ─────────────────────────────────────────
# OpenAI 스트리밍 호출
# ─────────────────────────────────────────
def _stream_openai_reply(
    messages: List[Dict[str, str]],
    model: str,
    system_prompt: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    OpenAI Chat API 스트리밍 응답을 토큰 단위로 yield.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다.")

    client = OpenAI(api_key=api_key)

    # 대화 길이 제한(가장 최근 발화부터) + 시스템 프롬프트
    trimmed = messages[-st.session_state.chat_history_limit :]
    chat_messages = []
    if system_prompt:
        chat_messages.append({"role": "system", "content": system_prompt})
    chat_messages.extend(trimmed)

    stream = client.chat.completions.create(
        model=model,
        messages=chat_messages,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if hasattr(delta, "content") and delta.content:
            yield delta.content

# ─────────────────────────────────────────
# 메인 렌더러
# ─────────────────────────────────────────
def render_chat(title: str = "💬 Aller Chat"):
    """
    채팅 패널을 렌더링. 다른 페이지에서 임포트해 호출 가능.
    """
    _init_state()

    # 상단 설정(필요 시 숨겨도 됨)
    with st.container():
        left, right = st.columns([0.6, 0.4])
        with left:
            st.subheader(title)
            st.caption("Streamlit용 최소 채팅 모듈 (OpenAI GPT / 스트리밍)")
        with right:
            with st.popover("⚙️ 설정", use_container_width=True):
                st.session_state.chat_model = st.selectbox(
                    "모델", ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"], index=0
                )
                st.session_state.chat_history_limit = st.slider(
                    "히스토리 제한(최근 메시지 수)", 4, 32, st.session_state.chat_history_limit, 2
                )
                st.session_state.chat_system_prompt = st.text_area(
                    "시스템 프롬프트",
                    st.session_state.chat_system_prompt,
                    height=100,
                )
                if st.button("대화 초기화", use_container_width=True):
                    st.session_state.chat_messages = [
                        {"role": "assistant", "content": "대화를 새로 시작합니다. 무엇을 도와드릴까요?"}
                    ]
                    st.rerun()

    # 대화 표시
    for m in st.session_state.chat_messages:
        with st.chat_message(m["role"]):
            st.markdown(m["content"])

    # 입력창
    user_input = st.chat_input("메시지를 입력하세요…")
    if user_input:
        # 유저 메시지 즉시 반영
        st.session_state.chat_messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        # 어시스턴트 응답(스트리밍)
        with st.chat_message("assistant"):
            try:
                stream = _stream_openai_reply(
                    messages=st.session_state.chat_messages,
                    model=st.session_state.chat_model,
                    system_prompt=st.session_state.chat_system_prompt,
                )
                full_text = st.write_stream(stream)  # Streamlit 1.30+ 권장
            except Exception as e:
                full_text = f"오류가 발생했습니다: {e}"
                st.error(full_text)

        st.session_state.chat_messages.append({"role": "assistant", "content": full_text})


# ─────────────────────────────────────────
# 단독 실행 진입점
# ─────────────────────────────────────────
def main():
    st.set_page_config(page_title="Aller Chat", page_icon="💬", layout="wide")
    render_chat()

if __name__ == "__main__":
    main()
