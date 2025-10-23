# pages/2_Chat.py
# ============================================
# 화장품 추천 챗봇 페이지 (OCR 통합 버전)
# [수정] UI/UX 개선 (채팅 초기화 버튼 위치 변경)
# ============================================

import streamlit as st
import json
import tempfile
import os
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# ============================================
# UI 모듈 import
# ============================================
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from aller.ui import require_login_redirect, render_app_sidebar
except ImportError:
    st.error("aller/ui.py 파일을 찾을 수 없습니다. aller 폴더에 ui.py가 있는지 확인하세요.")
    st.stop()

# ============================================
# OCR 모듈 import
# ============================================
try:
    from utils.OCR import process_cosmetic_image, search_product_by_name, format_analysis_for_chat
except ImportError:
    st.error("utils/OCR.py 파일을 찾을 수 없습니다. utils 폴더에 OCR.py가 있는지 확인하세요.")
    st.stop()

# ============================================
# 로그인 체크 및 커스텀 사이드바 렌더링
# ============================================
require_login_redirect()
render_app_sidebar()

# ============================================
# 환경 변수 로드 및 OpenAI 클라이언트 초기화
# ============================================
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ============================================
# 페이지 설정
# ============================================
st.title("💬 화장품 추천 챗봇")
st.caption("화장품에 대해 무엇이든 물어보세요! 📎 버튼으로 제품을 분석할 수 있습니다.")

# ============================================
# 세션 상태 초기화
# ============================================
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "system",
            "content": """당신은 전문 화장품 상담사입니다. 사용자의 피부 고민을 듣고 적합한 화장품을 추천해주세요.
            
- 사용자가 OCR로 분석한 제품 정보가 있다면, 그 정보를 바탕으로 상세한 조언을 제공하세요.
- 성분에 대한 설명이 필요하면 자세히 설명해주세요.
- 주의 성분이 있다면 왜 주의해야 하는지 설명하고 대안을 제시하세요.
- 친근하고 전문적인 톤으로 답변하세요."""
        }
    ]

if "ocr_context" not in st.session_state:
    st.session_state.ocr_context = []

# ============================================
# 채팅 기록 표시
# ============================================
for message in st.session_state.messages:
    if message["role"] != "system":
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if "image_url" in message and message["image_url"]:
                st.image(message["image_url"], width=300)

# ============================================
# [수정] 첨부/검색 Popover 및 채팅 초기화 버튼
# ============================================

# [수정] chat_input 바로 위에 두 개의 열 생성
col1, col2, col_rest = st.columns([1, 1, 8]) # 버튼들을 왼쪽에 작게 배치

with col1:
    # Popover 컨트롤러
    with st.popover("📎첨부/검색", help="첨부/검색", use_container_width=False):
        st.markdown("##### 📸 사진으로 분석")
        uploaded_file = st.file_uploader(
            "화장품 사진을 업로드하세요",
            type=["jpg", "jpeg", "png"],
            key="chat_image_uploader",
            label_visibility="collapsed"
        )
        
        st.divider()
        
        st.markdown("##### 🔍 제품명으로 검색")
        with st.form("product_search_form"):
            product_name = st.text_input(
                "제품명 입력",
                placeholder="예: 일리윤 세라마이드 아토 로션",
                key="product_search_input",
                label_visibility="collapsed"
            )
            search_submitted = st.form_submit_button("검색", use_container_width=True)

with col2:
    # [신규] 채팅 기록 지우기 버튼
    if st.button("🗑️기록 지우기", help="채팅 기록 지우기", use_container_width=True):
         st.session_state.messages = [st.session_state.messages[0]]
         st.session_state.ocr_context = []
         st.rerun()

# [수정] Popover 로직 (위젯 정의 이후에 위치해야 함)
if search_submitted and product_name:
    with st.spinner("제품을 검색하는 중..."):
        try:
            result = search_product_by_name(product_name)
            
            if result.get('success'):
                data = result.get('data', {})
                ocr_json = {
                    "product_name": data.get('product_name'),
                    "brand": data.get('brand'),
                    "price_krw": data.get('price_krw'),
                    "capacity": data.get('capacity'),
                    "image_url": data.get('image_url'),
                    "ingredients": data.get('ingredients', []),
                    "caution_ingredients": data.get('caution_ingredients', {}),
                    "source": "database_search"
                }
                st.session_state.ocr_context.append(ocr_json)
                formatted_result = format_analysis_for_chat(result)
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": formatted_result['text'],
                    "image_url": formatted_result['image_url']
                })
                st.success("✅ 검색 완료!")
                st.rerun()
            else:
                st.error(f"❌ {result.get('error', '제품을 찾을 수 없습니다.')}")
        except Exception as e:
            st.error(f"오류 발생: {str(e)}")

if uploaded_file is not None:
    if 'last_uploaded_file' not in st.session_state or st.session_state.last_uploaded_file != uploaded_file.name:
        st.session_state.last_uploaded_file = uploaded_file.name
        with st.spinner("📸 이미지를 분석하는 중..."):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                tmp_path = tmp_file.name
            try:
                result = process_cosmetic_image(tmp_path)
                if result.get('success'):
                    data = result.get('data', {})
                    ocr_json = {
                        "product_name": data.get('product_name'),
                        "brand": data.get('brand'),
                        "price_krw": data.get('price_krw'),
                        "capacity": data.get('capacity'),
                        "image_url": data.get('image_url'),
                        "ingredients": data.get('ingredients', []),
                        "caution_ingredients": data.get('caution_ingredients', {}),
                        "source": data.get('source')
                    }
                    st.session_state.ocr_context.append(ocr_json)
                    formatted_result = format_analysis_for_chat(result)
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": formatted_result['text'],
                        "image_url": formatted_result['image_url']
                    })
                    st.success("✅ 분석 완료!")
                    st.rerun()
                else:
                    st.error(f"❌ {result.get('error', '분석 실패')}")
            except Exception as e:
                st.error(f"오류 발생: {str(e)}")
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

# ============================================
# 채팅 입력 및 GPT 응답 처리
# ============================================
if prompt := st.chat_input("메시지를 입력하세요..."):
    # 사용자 메시지 추가
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # GPT 응답 생성
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        
        # OCR 컨텍스트가 있다면 시스템 메시지에 추가
        messages_to_send = st.session_state.messages.copy()
        
        if st.session_state.ocr_context:
            ocr_context_text = "\n\n### 분석된 제품 정보:\n"
            for idx, ocr_data in enumerate(st.session_state.ocr_context, 1):
                ocr_context_text += f"\n**제품 {idx}:**\n"
                ocr_context_text += f"- 제품명: {ocr_data.get('product_name', 'N/A')}\n"
                ocr_context_text += f"- 브랜드: {ocr_data.get('brand', 'N/A')}\n"
                
                caution = ocr_data.get('caution_ingredients', {})
                official_ings = [ing['korean_name'] for ing in caution.get('official', [])]
                ml_ings = [ing['korean_name'] for ing in caution.get('ml_predicted', [])]
                
                if official_ings:
                    ocr_context_text += f"- 공식 주의 성분: {', '.join(official_ings)}\n"
                if ml_ings:
                    ocr_context_text += f"- AI 예측 유해 성분: {', '.join(ml_ings)}\n"
            
            messages_to_send[0] = {
                "role": "system",
                "content": messages_to_send[0]["content"] + ocr_context_text
            }
        
        try:
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_to_send,
                stream=True,
                temperature=0.7,
                max_tokens=2000
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    full_response += chunk.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            
            message_placeholder.markdown(full_response)
            
            st.session_state.messages.append({
                "role": "assistant",
                "content": full_response
            })
        
        except Exception as e:
            st.error(f"❌ GPT 응답 생성 중 오류 발생: {str(e)}")
            message_placeholder.markdown("죄송합니다. 응답 생성 중 오류가 발생했습니다.")

# ============================================
# [삭제] 채팅 기록 초기화 버튼 (하단)
# ============================================
# st.divider()
# col1, col2, col3 = st.columns([1, 1, 1])
# ... (하단 버튼 로직 전체 삭제) ...