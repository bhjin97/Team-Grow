
from dataclasses import dataclass
from statistics import pstdev
from typing import Dict, List, Optional
import streamlit as st

# ─────────────────────────────────────────────────────────
# Baumann Skin Type (16 types) — compact adaptive questionnaire
# - 4 axes: O/D, S/R, P/N, W/T
# - 12 base items (3 per axis) + up to 1 tie-breaker per axis
# - 5-point Likert (1~5) + "모름" (treated as neutral=3)
# - Scoring thresholds: avg <=2.6 → left letter, >=3.4 → right letter, else tie-break
# - Confidence = 100 - (stdev*10 + unknown*5 + (used_tb?5:0)), clipped 0~100
# ─────────────────────────────────────────────────────────

@dataclass
class Item:
    id: str
    axis: str          # "OD" | "SR" | "PN" | "WT"
    text: str
    reverse: bool      # True -> 6 - x
    right_letter: str  # Right letter: O/S/P/W

# 12 문항 (축별 3개)
SURVEY_V1: List[Item] = [
    # O/D
    Item("Q1", "OD", "세안 후 30분 이내에 얼굴이 당기거나 건조하게 느껴진다.", True,  "O"),
    Item("Q2", "OD", "오후가 되면 T존(이마·코)이 번들거린다.",                False, "O"),
    Item("Q3", "OD", "파운데이션이 자주 뜨고 각질이 부각된다.",                True,  "O"),
    # S/R
    Item("Q4", "SR", "새 제품 사용 시 화끈거림·따가움·가려움이 자주 생긴다.",   False, "S"),
    Item("Q5", "SR", "계절/온도 변화에 따라 홍조가 쉽게 나타난다.",            False, "S"),
    Item("Q6", "SR", "알레르기/아토피·여드름 등 피부 트러블 병력이 있다.",     False, "S"),
    # P/N
    Item("Q7", "PN", "기미·잡티가 쉽게 생기거나 오래 남는다.",                  False, "P"),
    Item("Q8", "PN", "외출 시 자외선 차단을 자주 빼먹는 편이다.",              False, "P"),
    Item("Q9", "PN", "여드름·상처 후 갈색/붉은 자국(PIH/PIE)이 오래 남는다.",   False, "P"),
    # W/T
    Item("Q10","WT", "눈가/팔자 등 표정 주름이 점점 또렷해진다.",               False, "W"),
    Item("Q11","WT", "밤샘/스트레스 후 피부 탄력이 확 떨어진다.",               False, "W"),
    Item("Q12","WT", "건조한 곳에서 미세주름(건성주름)이 잘 생긴다.",           False, "W"),
]

# 축별 타이브레이커 (2개 중 첫 번째를 기본 사용)
TIEBREAKERS = {
    "OD": [
        Item("OD_TB1", "OD", "스킨/토너만 바르고 1시간 뒤 T존 번들거림을 닦아낸 적이 자주 있다.", False, "O"),
        Item("OD_TB2", "OD", "파데·쿠션이 자주 뜨고 각질이 부각된다.",                           True,  "O"),
    ],
    "SR": [
        Item("SR_TB1", "SR", "약한 각질제거제·레티노이드에도 따가움/홍조가 쉽게 생긴다.",         False, "S"),
        Item("SR_TB2", "SR", "향/알코올/에센셜오일에도 자극을 거의 느끼지 않는다.",               True,  "S"),
    ],
    "PN": [
        Item("PN_TB1", "PN", "여름 야외활동 후 피부 톤이 쉽게 어두워지고 오래 돌아오지 않는다.",  False, "P"),
        Item("PN_TB2", "PN", "트러블이 사라진 뒤 자국(PIH/PIE)이 수주 이상 남는다.",              False, "P"),
    ],
    "WT": [
        Item("WT_TB1", "WT", "표정 습관(찌푸림 등) 자국/잔주름이 쉽게 사라지지 않는다.",           False, "W"),
        Item("WT_TB2", "WT", "수분크림만으로도 건조 주름이 금방 펴지는 편이다.",                   True,  "W"),
    ],
}

AXES = ["OD","SR","PN","WT"]
LEFT_LETTER  = {"OD":"D", "SR":"R", "PN":"N", "WT":"T"}
RIGHT_LETTER = {"OD":"O", "SR":"S", "PN":"P", "WT":"W"}

# ───────────────────────────
# 내부 유틸
# ───────────────────────────
def _apply_reverse(x: int, reverse: bool) -> int:
    return (6 - x) if reverse else x

def _axis_items(items: List[Item], axis: str) -> List[Item]:
    return [it for it in items if it.axis == axis]

def _avg_and_stats(values: List[Optional[int]], item_defs: List[Item]):
    scored, unknown = [], 0
    for v, it in zip(values, item_defs):
        if v is None:
            unknown += 1
            v = 3  # neutral imputation
        scored.append(_apply_reverse(v, it.reverse))
    avg = sum(scored)/len(scored)
    stdev = pstdev(scored) if len(scored) > 1 else 0.0
    return avg, unknown, stdev, scored

def _decide_letter(avg: float, axis: str) -> Optional[str]:
    if avg <= 2.6: return LEFT_LETTER[axis]
    if avg >= 3.4: return RIGHT_LETTER[axis]
    return None

def _confidence(stdev: float, unknown_cnt: int, used_tb: bool) -> int:
    base = 100
    penalty = (stdev * 10) + (unknown_cnt * 5) + (5 if used_tb else 0)
    return max(0, min(100, round(base - penalty)))

# ───────────────────────────
# 평가 함수 (서비스에서 재사용 가능)
# ───────────────────────────
def evaluate_baumann(
    responses: Dict[str, Optional[int]],
    tiebreaker_responses: Optional[Dict[str, Optional[int]]] = None,
) -> Dict:
    tiebreaker_responses = tiebreaker_responses or {}
    result = {"axes": {}, "needed_tiebreakers": [], "type_code": None, "confidence_overall": None}
    letters, confidences = [], []

    for axis in AXES:
        base_items = _axis_items(SURVEY_V1, axis)
        base_vals  = [responses.get(it.id) for it in base_items]
        avg, unknown, stdev, scored_list = _avg_and_stats(base_vals, base_items)

        letter = _decide_letter(avg, axis)
        used_tb, tb_id_used = False, None

        if letter is None:
            tb_item = TIEBREAKERS[axis][0]   # 기본 1번 사용
            tb_id = tb_item.id
            if tb_id not in tiebreaker_responses:
                # tie-break 필요
                result["needed_tiebreakers"].append({
                    "axis": axis, "item": {"id": tb_id, "text": tb_item.text, "reverse": tb_item.reverse}
                })
                conf = _confidence(stdev, unknown, used_tb=False)
                result["axes"][axis] = {
                    "avg_base": round(avg,2), "final_letter": None, "confidence": conf,
                    "used_tiebreaker": False, "tiebreaker_id": None, "scores": scored_list
                }
                continue

            # tie-break 반영
            tb_val = tiebreaker_responses.get(tb_id)
            if tb_val is None:
                tb_val, unknown = 3, unknown + 1
            tb_scored = _apply_reverse(tb_val, tb_item.reverse)
            avg2 = (avg*len(base_items) + tb_scored) / (len(base_items)+1)
            used_tb, tb_id_used, letter = True, tb_id, _decide_letter(avg2, axis)
            if letter is None:  # 여전히 애매하면 가까운 쪽
                letter = RIGHT_LETTER[axis] if avg2 >= 3.0 else LEFT_LETTER[axis]
            avg, stdev = avg2, stdev + 0.2  # 약간의 불확실성 증가

        conf = _confidence(stdev, unknown, used_tb)
        result["axes"][axis] = {
            "avg_base": round(avg,2), "final_letter": letter, "confidence": conf,
            "used_tiebreaker": used_tb, "tiebreaker_id": tb_id_used, "scores": scored_list
        }
        letters.append(letter); confidences.append(conf)

    result["type_code"] = (
        letters[0]+letters[1]+letters[2]+letters[3]
        if len(letters)==4 and all(l in "ODSRPNWT" for l in letters) else None
    )
    result["confidence_overall"] = round(sum(confidences)/len(confidences), 1) if confidences else None
    return result

# ───────────────────────────
# Streamlit 렌더러
# ───────────────────────────
def render_quiz():
    st.subheader("바우만 피부타입 진단 (간단·적응형)")

    def _resp_widget(label: str, key: str):
        choice = st.radio(label, options=[1,2,3,4,5,"모름"], key=key, horizontal=True)
        return None if choice == "모름" else int(choice)

    # 세션 상태
    if "skinq_responses" not in st.session_state:
        st.session_state.skinq_responses = {}
    if "skinq_tb_needed" not in st.session_state:
        st.session_state.skinq_tb_needed = []
    if "skinq_tb_answers" not in st.session_state:
        st.session_state.skinq_tb_answers = {}
    if "skinq_result" not in st.session_state:
        st.session_state.skinq_result = None

    axis_titles = {"OD":"지성↔건성(OD)", "SR":"민감↔저항(SR)", "PN":"색소↔비색소(PN)", "WT":"주름↔탄탄(WT)"}

    # 카드(확장형): 축별 문항
    cols = st.columns(2)
    for idx, axis in enumerate(AXES):
        with cols[idx % 2]:
            with st.expander(f"{axis_titles[axis]} · 클릭하여 답변하기", expanded=False):
                items = _axis_items(SURVEY_V1, axis)
                for it in items:
                    st.session_state.skinq_responses[it.id] = _resp_widget(it.text, key=f"skin_{it.id}")

    # 1차 채점
    if st.button("1차 채점 ▶"):
        r1 = evaluate_baumann(st.session_state.skinq_responses)
        st.session_state.skinq_tb_needed = r1["needed_tiebreakers"]
        st.session_state.skinq_result = r1

    # 타이브레이커
    tb_needed = st.session_state.skinq_tb_needed
    if tb_needed:
        st.info("몇 가지 축에서 애매함이 있어 **타이브레이커** 1문항씩 확인합니다.")
        for tb in tb_needed:
            axis = tb["axis"]; item = tb["item"]
            with st.expander(f"추가 확인 · {axis_titles[axis]}", expanded=True):
                st.session_state.skinq_tb_answers[item["id"]] = _resp_widget(item["text"], key=f"tb_{item['id']}")

        if st.button("최종 결과 보기 ✅"):
            r2 = evaluate_baumann(
                st.session_state.skinq_responses,
                tiebreaker_responses=st.session_state.skinq_tb_answers
            )
            st.session_state.skinq_result = r2
            st.session_state.skinq_tb_needed = []  # 소진

    # 결과
    r = st.session_state.skinq_result
    if r and r["type_code"]:
        st.success(f"**최종 바우만 타입: `{r['type_code']}`**  |  확신도 {r['confidence_overall']}/100")
        for axis in AXES:
            ax = r["axes"][axis]
            left, right = LEFT_LETTER[axis], RIGHT_LETTER[axis]
            st.write(f"- **{axis}**: 평균 {ax['avg_base']}, 판정 **{ax['final_letter']}** (신뢰도 {ax['confidence']})  ·  {left}← {(ax['avg_base']-1)/4:.2f} →{right}")
        st.caption("※ 결과는 사용자 프로필에 저장하여 추천/성분 필터에 즉시 반영하세요.")
    elif r and not r["type_code"]:
        st.warning("아직 모든 축이 결정되지 않았습니다. 타이브레이커에 답해주세요.")
    else:
        st.caption("카드를 눌러 문항에 답변한 뒤 **1차 채점 ▶**을 눌러주세요.")
