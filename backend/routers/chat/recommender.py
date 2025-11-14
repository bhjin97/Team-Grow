# recommender.py
# -*- coding: utf-8 -*-
"""
추천 엔진 엔트리 레이어.
- recommender_core.py의 실제 로직을 가져와 API 레이어에서 호출하기 쉬운 형태로 래핑.
"""

import time
from typing import Any, Dict, List

from .recommender_core import (
    log_event,
    Intent,
    analyze_with_llm,
    search_pipeline_from_parsed,
    generate_general_answer,
    build_presented,
    stream_finalize_from_rag_texts,
)


# ============================================================================
# 1) PRODUCT_FIND / GENERAL 공통 로직
# ============================================================================
def run_product_core(user_query: str) -> Dict[str, Any]:
    t0 = time.time()
    log_event("core_start", query=user_query)

    # ---------------------------
    # (1) LLM 분석
    # ---------------------------
    t1 = time.time()
    analyzed = analyze_with_llm(user_query)
    intent: Intent = analyzed["intent"]
    parsed: Dict[str, Any] = analyzed["parsed"]

    log_event("intent_decided", intent=intent, parsed=parsed)
    log_event("timing_analyze_llm", ms=int((time.time() - t1) * 1000))

    # ---------------------------
    # (2) GENERAL 질문 처리
    # ---------------------------
    if intent == "GENERAL":
        t2 = time.time()
        txt = generate_general_answer(user_query)
        log_event("general_answer_generated", length=len(txt))
        log_event("timing_general_answer_llm", ms=int((time.time() - t2) * 1000))
        log_event("core_done", ms=int((time.time() - t0) * 1000))

        return {
            "intent": "GENERAL",
            "text": txt,
            "parsed": parsed,
            "normalized": None,
            "rows": [],
            "presented": [],
            "message": None,
        }

    # ---------------------------
    # (3) PRODUCT_FIND → 검색 실행
    # ---------------------------
    t3 = time.time()
    out = search_pipeline_from_parsed(parsed, user_query)
    rows: List[Dict[str, Any]] = out.get("results") or []

    log_event(
        "timing_search_pipeline",
        ms=int((time.time() - t3) * 1000),
        result_count=len(rows),
    )

    # 검색 결과 없음
    if not rows:
        log_event("no_results")
        log_event("core_done", ms=int((time.time() - t0) * 1000))
        return {
            "intent": "PRODUCT_FIND",
            "text": "",
            "parsed": parsed,
            "normalized": out.get("normalized"),
            "rows": [],
            "presented": [],
            "message": (
                "죄송합니다. 조건에 맞는 제품을 찾을 수 없습니다.\n"
                "입력 조건이 너무 좁거나 데이터베이스에 제품이 없을 수 있어요.\n"
                "브랜드, 성분, 가격 등의 필터를 조금 완화해보세요."
            ),
        }

    # Top5 → 요약 LLM 입력 후보 (디버깅용 요약)
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

    # 프론트 추천 카드용 데이터 구성
    presented = build_presented(rows)

    log_event("core_done", ms=int((time.time() - t0) * 1000))

    return {
        "intent": "PRODUCT_FIND",
        "text": "",
        "parsed": parsed,
        "normalized": out.get("normalized"),
        "rows": rows,
        "presented": presented,
        "message": None,
    }


# ============================================================================
# 2) 요약 전용 엔트리 (동기 JSON 응답)
#    → stream_finalize_from_rag_texts 기반으로 전체 문장 생성
# ============================================================================
def run_product_finalize(user_query: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    t0 = time.time()
    log_event("finalize_start", query=user_query, row_count=len(rows))

    # 스트리밍 요약을 전체 문자열로 합치기
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
