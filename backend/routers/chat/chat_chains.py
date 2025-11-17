# backend/routers/chat/chat_chains.py
# -*- coding: utf-8 -*-

from typing import Any, Dict, List

from langchain_core.runnables import (
    RunnableLambda,
    RunnableSequence,
)

from .recommender_core import (
    log_event,
    analyze_with_llm,
    search_pipeline_from_parsed,
    generate_general_answer,
    build_presented,
    stream_finalize_from_rag_texts,
)


# ─────────────────────────────────────────────────────
# 1) 입력 래핑 + 파서 체인
# ─────────────────────────────────────────────────────
def _wrap_input(user_query: str) -> Dict[str, Any]:
    """체인 입력을 통일된 dict 형태로 감싸기."""
    return {"user_query": user_query}


def _parse_query(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    state: {"user_query": str}
    반환: {"user_query": str, "intent": ..., "parsed": {...}}
    """
    q = state["user_query"]
    analyzed = analyze_with_llm(q)  # { "intent": ..., "parsed": {...} }

    log_event("intent_decided_by_chain", intent=analyzed["intent"], parsed=analyzed["parsed"])
    return {**state, **analyzed}


ParseQueryChain: RunnableSequence = RunnableLambda(_wrap_input) | RunnableLambda(_parse_query)


# ─────────────────────────────────────────────────────
# 2) PRODUCT_FIND용 검색 + 카드 빌드 체인
# ─────────────────────────────────────────────────────
def _routing_retrieval(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    state: {"user_query": str, "intent": ..., "parsed": {...}}
    반환: {"user_query", "intent", "parsed", "normalized", "results", "message"}
    """
    q = state["user_query"]
    parsed = state["parsed"]

    out = search_pipeline_from_parsed(parsed, q)
    # out: { "parsed": parsed, "normalized": {...}, "results": rows, "message": ... }

    return {
        **state,
        "normalized": out.get("normalized"),
        "results": out.get("results") or [],
        "message": out.get("message"),
    }


RoutingChain = RunnableLambda(_routing_retrieval)


def _build_presented_chain(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    state: { ..., "results": rows }
    반환: { ..., "presented": presented_cards }
    """
    rows: List[Dict[str, Any]] = state.get("results") or []
    presented = build_presented(rows)
    return {
        **state,
        "presented": presented,
    }


BuildPresentedChain = RunnableLambda(_build_presented_chain)

# PRODUCT_FIND 용 검색 + 카드 빌드 전체
RetrievalChain: RunnableSequence = RoutingChain | BuildPresentedChain


# ─────────────────────────────────────────────────────
# 3) GENERAL 의도용 체인
# ─────────────────────────────────────────────────────
def _general_answer_chain(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    GENERAL 의도일 때: LLM 설명 텍스트 생성.
    state: {"user_query": ..., "intent": "GENERAL", "parsed": {...}}
    """
    q = state["user_query"]
    txt = generate_general_answer(q)

    return {
        **state,
        "text": (txt or "").strip(),
        "normalized": None,
        "results": [],
        "presented": [],
        "message": None,
    }


GeneralAnswerChain = RunnableLambda(_general_answer_chain)


# ─────────────────────────────────────────────────────
# 4) intent 기반 수동 브랜칭 (RunnableBranch 대신)
# ─────────────────────────────────────────────────────
def _intent_branch(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    intent 값에 따라 GENERAL / PRODUCT_FIND 체인 중 하나 실행.
    - intent == GENERAL      → GeneralAnswerChain
    - intent == PRODUCT_FIND → RetrievalChain
    """
    intent = (state.get("intent") or "GENERAL").upper()

    if intent == "GENERAL":
        return GeneralAnswerChain.invoke(state)
    else:
        # 기본은 PRODUCT_FIND로 처리
        return RetrievalChain.invoke(state)


IntentBranch = RunnableLambda(_intent_branch)


# 최종 MainChain: 입력(str) → 래핑+파싱 → intent 브랜칭
MainChain: RunnableSequence = ParseQueryChain | IntentBranch


# ─────────────────────────────────────────────────────
# 5) SummarizerChain (옵션: 한 번에 요약 뽑기용)
# ─────────────────────────────────────────────────────
def _summarize_chain(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    results(rows) 기반으로 전체 요약 텍스트를 만들어 state에 추가.
    스트리밍이 필요 없고, 한 번에 문자열만 뽑을 때 사용.
    """
    q = state["user_query"]
    rows: List[Dict[str, Any]] = state.get("results") or []

    chunks: List[str] = []
    for chunk in stream_finalize_from_rag_texts(q, rows):
        if chunk:
            chunks.append(chunk)
    text = "".join(chunks).strip()

    return {
        **state,
        "summary": text,
    }


SummarizerChain = RunnableLambda(_summarize_chain)
