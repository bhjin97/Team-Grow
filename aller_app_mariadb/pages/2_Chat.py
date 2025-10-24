# pages/2_Chat.py
# ============================================
# 화장품 추천 챗봇 페이지 (OCR 통합 + VectorDB + MariaDB)
# - OCR/제품명 검색 팝오버 유지
# - OpenAI 스트리밍 응답
# - Pinecone 제품 인덱스 검색 → MariaDB 조인 → 카드 렌더링
# ============================================

import os
import sys
import json
import tempfile
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI


ROOT = Path(__file__).resolve().parents[1]  # .../aller_app_mariadb
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# UI
from aller.ui import require_login_redirect, render_app_sidebar

# OCR (utils는 aller의 형제 폴더이므로 utils로 바로 import)
from utils.OCR import process_cosmetic_image, search_product_by_name, format_analysis_for_chat

# Vector + DB
from utils.vector_pinecone import pinecone_query_products  # ← 여기 포인트!
from aller.storage_sql import fetch_products_by_ids

# ============================================
# 환경 변수 로드 및 OpenAI 클라이언트 초기화
# ============================================
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
TOP_K = int(os.getenv("TOP_K", "8"))  # 벡터 검색 상위 개수

# ============================================
# 페이지 설정
# ============================================
st.title("💬 화장품 추천 챗봇")
st.caption("화장품에 대해 무엇이든 물어보세요! 📎 버튼으로 제품을 분석하거나 검색할 수 있습니다.")

# ============================================
# 로그인 체크 및 커스텀 사이드바 렌더링
# ============================================
require_login_redirect()
render_app_sidebar()

# ============================================
# 세션 상태 초기화
# ============================================
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "system",
            "content": (
                "당신은 전문 화장품 상담사입니다. 사용자의 피부 고민을 듣고 적합한 화장품을 추천해주세요.\n\n"
                "- 사용자가 OCR로 분석한 제품 정보가 있다면, 그 정보를 바탕으로 상세한 조언을 제공하세요.\n"
                "- 성분에 대한 설명이 필요하면 자세히 설명해주세요.\n"
                "- 주의 성분이 있다면 왜 주의해야 하는지 설명하고 대안을 제시하세요.\n"
                "- 친근하고 전문적인 톤으로 답변하세요."
            ),
        }
    ]

if "ocr_context" not in st.session_state:
    st.session_state.ocr_context = []

# ============================================
# 채팅 기록 표시 (system 제외)
# ============================================
for message in st.session_state.messages:
    if message["role"] != "system":
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if "image_url" in message and message["image_url"]:
                st.image(message["image_url"], width=300)


# ============================================
# 메타데이터 거르기
# ============================================
# 사용자 표현 → 표준 카테고리(너희 DB/Pinecone 값에 맞춰둠)
CATEGORY_MAP = {
    "스킨": ["스킨/토너"], "토너": ["스킨/토너"], "toner": ["스킨/토너"], "skin": ["스킨/토너"], "토너패드": ["스킨/토너"],
    "세럼": ["에센스/세럼/앰플"], "에센스": ["에센스/세럼/앰플"], "앰플": ["에센스/세럼/앰플"],
    "크림": ["크림"], "cream": ["크림"], "수분크림": ["크림"], "영양크림": ["크림"],
    "로션": ["로션"], "에멀전": ["로션"], "lotion": ["로션"], "emulsion": ["로션"],
    "미스트": ["미스트/오일"], "오일": ["미스트/오일"], "face oil": ["미스트/오일"],
    "클렌징폼": ["클렌징폼/젤"], "폼클": ["클렌징폼/젤"], "젤클": ["클렌징폼/젤"], "gel cleanser": ["클렌징폼/젤"],
    "클렌징오일": ["오일/밤"], "cleansing oil": ["오일/밤"], "클렌징밤": ["오일/밤"], "cleansing balm": ["오일/밤"],
    "클렌징워터": ["워터/밀크"], "리무버": ["워터/밀크"], "클렌징밀크": ["워터/밀크"],
    "시트팩": ["시트팩"], "시트마스크": ["시트팩"], "마스크팩": ["시트팩"], "sheet mask": ["시트팩"],
    "페이셜팩": ["페이셜팩"], "머드팩": ["페이셜팩"], "워시오프팩": ["페이셜팩"], "peel-off": ["페이셜팩"],
    "선크림": ["선크림"], "자차": ["선크림"], "sunscreen": ["선크림"], "spf": ["선크림"],
    "선스틱": ["선스틱"], "sun stick": ["선스틱"],
}

def detect_categories(user_text: str) -> list[str] | None:
    t = user_text.lower().strip()
    hits = set()
    for key, cats in CATEGORY_MAP.items():
        if key in t:
            hits.update(cats)
    # 복합 표기 보완(스킨/토너)
    if any(k in t for k in ["스킨", "토너", "skin", "toner"]):
        hits.add("스킨/토너")
    return list(hits) if hits else None

# ============================================
# 첨부/검색 Popover + 채팅 초기화 버튼 (입력창 위)
# ============================================
col1, col2, col_rest = st.columns([1, 1, 8])

with col1:
    with st.popover("📎첨부/검색", help="사진 분석 또는 제품명으로 검색", use_container_width=False):
        st.markdown("##### 📸 사진으로 분석")
        uploaded_file = st.file_uploader(
            "화장품 사진을 업로드하세요",
            type=["jpg", "jpeg", "png"],
            key="chat_image_uploader",
            label_visibility="collapsed",
        )

        st.divider()

        st.markdown("##### 🔍 제품명으로 검색")
        with st.form("product_search_form"):
            product_name = st.text_input(
                "제품명 입력",
                placeholder="예: 일리윤 세라마이드 아토 로션",
                key="product_search_input",
                label_visibility="collapsed",
            )
            search_submitted = st.form_submit_button("검색", use_container_width=True)

with col2:
    if st.button("🗑️기록 지우기", help="채팅 기록 지우기", use_container_width=True):
        st.session_state.messages = [st.session_state.messages[0]]  # system만 남김
        st.session_state.ocr_context = []
        st.rerun()

# ============================================
# Popover 로직: 제품명 검색
# ============================================
if "search_submitted" not in st.session_state:
    st.session_state.search_submitted = False

if 'last_uploaded_file' not in st.session_state:
    st.session_state.last_uploaded_file = None

if "product_name_cache" not in st.session_state:
    st.session_state.product_name_cache = None

if search_submitted and product_name:
    with st.spinner("제품을 검색하는 중..."):
        try:
            result = search_product_by_name(product_name)
            if result.get("success"):
                data = result.get("data", {})
                ocr_json = {
                    "product_name": data.get("product_name"),
                    "brand": data.get("brand"),
                    "price_krw": data.get("price_krw"),
                    "capacity": data.get("capacity"),
                    "image_url": data.get("image_url"),
                    "ingredients": data.get("ingredients", []),
                    "caution_ingredients": data.get("caution_ingredients", {}),
                    "source": "database_search",
                }
                st.session_state.ocr_context.append(ocr_json)
                formatted_result = format_analysis_for_chat(result)
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": formatted_result["text"],
                        "image_url": formatted_result["image_url"],
                    }
                )
                st.success("✅ 검색 완료!")
                st.rerun()
            else:
                st.error(f"❌ {result.get('error', '제품을 찾을 수 없습니다.')}")
        except Exception as e:
            st.error(f"오류 발생: {str(e)}")

# ============================================
# Popover 로직: 사진 업로드 → OCR 분석
# ============================================
if uploaded_file is not None:
    if st.session_state.last_uploaded_file != uploaded_file.name:
        st.session_state.last_uploaded_file = uploaded_file.name
        with st.spinner("📸 이미지를 분석하는 중..."):
            import shutil
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                shutil.copyfileobj(uploaded_file, tmp_file)
                tmp_path = tmp_file.name
            try:
                result = process_cosmetic_image(tmp_path)
                if result.get("success"):
                    data = result.get("data", {})
                    ocr_json = {
                        "product_name": data.get("product_name"),
                        "brand": data.get("brand"),
                        "price_krw": data.get("price_krw"),
                        "capacity": data.get("capacity"),
                        "image_url": data.get("image_url"),
                        "ingredients": data.get("ingredients", []),
                        "caution_ingredients": data.get("caution_ingredients", {}),
                        "source": data.get("source"),
                    }
                    st.session_state.ocr_context.append(ocr_json)
                    formatted_result = format_analysis_for_chat(result)
                    st.session_state.messages.append(
                        {
                            "role": "assistant",
                            "content": formatted_result["text"],
                            "image_url": formatted_result["image_url"],
                        }
                    )
                    st.success("✅ 분석 완료!")
                    st.rerun()
                else:
                    st.error(f"❌ {result.get('error', '분석 실패')}")
            except Exception as e:
                st.error(f"오류 발생: {str(e)}")
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

# ============================================
# 추천 카드 렌더링 함수 (Pinecone matches + DB rows)
# ============================================
def render_product_cards(matches, rows_by_id):
    for m in matches:
        pid = m.get("id")
        meta = m.get("metadata", {}) or {}
        r = rows_by_id.get(pid, {})
        score = m.get("score", 0)

        with st.container(border=True):
            st.caption(f"유사도: {score:.3f}")
            brand = r.get("brand") or meta.get("brand") or ""
            name  = r.get("product_name") or meta.get("product_name") or pid
            st.subheader(f"{brand} · {name}".strip(" ·"))
            st.write(r.get("category") or meta.get("category") or "")
            price = r.get("price_krw") or meta.get("price_krw")
            if price:
                st.write(f"₩{price}")
            if r.get("image_url"):
                st.image(r["image_url"])
            if r.get("product_url"):
                st.link_button("상품 페이지", r["product_url"])

            # ↓↓↓ 성분 블록 삭제
            # if r.get("ingredients"):
            #     with st.expander("주요 성분(조인)"):
            #         st.write(r["ingredients"])

            # ↓↓↓ RAG 텍스트 표시 추가
            if r.get("rag_text"):
                with st.expander("제품 평가"):
                    st.write(r["rag_text"])


# ============================================
# 채팅 입력 및 GPT + 추천 처리
# ============================================
if prompt := st.chat_input("메시지를 입력하세요..."):
    # 사용자 메시지 추가/표시
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        message_placeholder = st.empty()

        # ---------- (A) GPT 스트리밍 응답 ----------
        messages_to_send = st.session_state.messages.copy()
        if st.session_state.ocr_context:
            ocr_context_text = "\n\n### 분석된 제품 정보:\n"
            for idx, ocr_data in enumerate(st.session_state.ocr_context, 1):
                ocr_context_text += f"\n**제품 {idx}:**\n"
                ocr_context_text += f"- 제품명: {ocr_data.get('product_name', 'N/A')}\n"
                ocr_context_text += f"- 브랜드: {ocr_data.get('brand', 'N/A')}\n"
                caution = ocr_data.get("caution_ingredients", {})
                official_ings = [ing.get("korean_name", "") for ing in caution.get("official", [])]
                ml_ings = [ing.get("korean_name", "") for ing in caution.get("ml_predicted", [])]
                if official_ings:
                    ocr_context_text += f"- 공식 주의 성분: {', '.join([x for x in official_ings if x])}\n"
                if ml_ings:
                    ocr_context_text += f"- AI 예측 유해 성분: {', '.join([x for x in ml_ings if x])}\n"

            messages_to_send[0] = {
                "role": "system",
                "content": messages_to_send[0]["content"] + ocr_context_text,
            }

        try:
            stream = client.chat.completions.create(
                model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
                messages=messages_to_send,
                stream=True,
                temperature=0.7,
                max_tokens=2000,
            )

            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    full_response += chunk.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            message_placeholder.markdown(full_response)
        except Exception as e:
            st.error(f"❌ GPT 응답 생성 중 오류 발생: {str(e)}")
            message_placeholder.markdown("죄송합니다. 응답 생성 중 오류가 발생했습니다.")
            full_response = ""

# ---------- (B) Pinecone → MariaDB 추천 카드 ----------
        try:
            with st.spinner("🔎 유사 제품을 검색하는 중..."):
                # 1) 사용자 질의에서 카테고리 감지 → Pinecone 메타 필터
                cats = detect_categories(prompt)
                meta_filter = {"category": {"$in": cats}} if cats else None

                qres = pinecone_query_products(prompt, top_k=TOP_K, meta_filter=meta_filter)
                matches = qres.get("matches", [])

                if matches:
                    ids = [m["id"] for m in matches]

                    # 2) DB에서 상세 정보 조회 + pid 타입 정규화(str 매칭)
                    rows = fetch_products_by_ids(ids)
                    rows_by_id = {str(r["pid"]): r for r in rows}

                    # 3) DB 카테고리로 최종 검증(복합 문자열 대응: 완전 or 부분일치)
                    if cats:
                        def ok(row):
                            c = (row.get("category") or "").strip()
                            return c in cats or any(tok in c for tok in cats)
                        filtered = [m for m in matches if (row := rows_by_id.get(m["id"])) and ok(row)]
                    else:
                        filtered = [m for m in matches if rows_by_id.get(m["id"])]

                    # 4) 결과가 너무 적으면(예: 0~2개) 필터 없이 한 번 더 백업 검색
                    if cats and len(filtered) < 3:
                        fb = pinecone_query_products(prompt, top_k=TOP_K, meta_filter=None).get("matches", [])
                        seen = {m["id"] for m in filtered}
                        filtered += [m for m in fb if rows_by_id.get(m["id"]) and m["id"] not in seen]

                    st.markdown("### 🔎 추천 제품")
                    render_product_cards(filtered or matches, rows_by_id)
                else:
                    st.info("벡터 검색 결과가 없습니다. 조금 더 구체적으로 물어보세요.")
        except Exception as e:
            st.warning(f"추천 검색 중 오류: {e}")
