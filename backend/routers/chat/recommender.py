# backend/routers/chat/recommender.py
# -*- coding: utf-8 -*-
"""
추천 엔진 엔트리 레이어.
- LangChain MainChain을 호출해서 intent/parsed/rows/presented를 얻는다.
"""

import time
from typing import Any, Dict, List

from .recommender_core import (
    log_event,
    stream_finalize_from_rag_texts,
)
from .chat_chains import MainChain  # ✅ 네가 만든 체인 import


def run_product_core(user_query: str) -> Dict[str, Any]:
    """
    /chat/recommend, /chat/finalize 에서 공통으로 쓰는 메인 엔트리.

    반환 형식 (routes.py 기준):

    - GENERAL 일 때:
        {
          "intent": "GENERAL",
          "text": str,   # 설명 텍스트 (routes에서 message로 사용)
        }

    - PRODUCT_FIND 일 때:
        {
          "intent": "PRODUCT_FIND",
          "parsed": {...},
          "normalized": {...},
          "rows": [...],       # RDB 결과 (디버깅/후속 질의용)
          "presented": [...],  # 추천 카드용 상위 5개 구조
          "message": str | None
        }
    """
    t0 = time.time()
    log_event("core_start", query=user_query)

    # 1) LangChain MainChain 실행
    state = MainChain.invoke(user_query)
    intent = state.get("intent", "GENERAL")

    # ---------------------------
    # (1) GENERAL 질문 처리
    # ---------------------------
    if intent == "GENERAL":
        txt = (state.get("text") or "").strip()
        log_event("general_answer_generated", length=len(txt))
        log_event("core_done", ms=int((time.time() - t0) * 1000))

        return {
            "intent": "GENERAL",
            "text": txt,
            "parsed": state.get("parsed"),
            "normalized": None,
            "rows": [],
            "presented": [],
            "message": None,
        }

    # ---------------------------
    # (2) PRODUCT_FIND → 검색 결과 사용
    # ---------------------------
    rows: List[Dict[str, Any]] = state.get("results") or []
    presented: List[Dict[str, Any]] = state.get("presented") or []

    log_event(
        "search_done_by_chain",
        result_count=len(rows),
        presented_count=len(presented),
    )

    # 검색 결과 없음
    if not rows:
        log_event("no_results")
        log_event("core_done", ms=int((time.time() - t0) * 1000))
        return {
            "intent": "PRODUCT_FIND",
            "text": "",
            "parsed": state.get("parsed"),
            "normalized": state.get("normalized"),
            "rows": [],
            "presented": [],
            "message": (
                "죄송합니다. 조건에 맞는 제품을 찾을 수 없습니다.\n"
                "입력 조건이 너무 좁거나 데이터베이스에 제품이 없을 수 있어요.\n"
                "브랜드, 성분, 가격 등의 필터를 조금 완화해보세요."
            ),
        }

    # Top5 디버깅용 로그 (기존과 동일)
    top5 = rows[:5]
    log_event(
        "llm_finalize_candidates",
        top5=[
            {
                "pid": int(r["pid"]),
                "brand": r.get("brand"),
                "product_name": r.get("product_name"),
            }
            for r in top5
        ],
    )

    log_event("core_done", ms=int((time.time() - t0) * 1000))

    return {
        "intent": "PRODUCT_FIND",
        "text": "",
        "parsed": state.get("parsed"),
        "normalized": state.get("normalized"),
        "rows": rows,
        "presented": presented,
        "message": state.get("message"),
    }


def run_product_finalize(user_query: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    요약 전용 엔트리 (동기 JSON 응답).
    - stream_finalize_from_rag_texts 기반으로 전체 문장 생성.
    """
    t0 = time.time()
    log_event("finalize_start", query=user_query, row_count=len(rows))

    chunks: List[str] = []
    for chunk in stream_finalize_from_rag_texts(user_query, rows):
        if chunk:
            chunks.append(chunk)

    text = "".join(chunks).strip()

    log_event(
        "finalize_done",
        length=len(text),
        ms=int((time.time() - t0) * 1000),
    )

    return {
        "intent": "PRODUCT_FIND",
        "text": text,
    }
