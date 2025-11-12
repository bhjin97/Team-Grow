# --- Imports ---
import json
import math
import os
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Index, text, DateTime, Enum, BigInteger
from sqlalchemy.dialects.mysql import JSON as MySQL_JSON
from db import get_db
from typing import List
from google.cloud import vision
import io
import re

# --- SQLAlchemy Models (기존과 동일) ---
Base = declarative_base()

class KCIAIngredients(Base):
    __tablename__ = "KCIA_ingredients"
    id = Column(Integer, primary_key=True)
    name = Column(Text)
    name_normalized = Column(Text, index=True)
    name_en = Column(Text)
    cas_no = Column(String(255))
    old_name = Column(Text)
    purpose = Column(Text)
    categories = Column(MySQL_JSON)

class BaumannWeights(Base):
    __tablename__ = "baumann_weights"
    id = Column(Integer, primary_key=True, autoincrement=True)
    skin_type = Column(String(10), index=True)
    keyword = Column(String(50), index=True)
    importance = Column(Float)
    target_min = Column(Integer)
    target_max = Column(Integer)
    __table_args__ = (Index('idx_skin_type_keyword', 'skin_type', 'keyword'),)

class Ingredients6Keyword(Base):
    __tablename__ = "ingredients_6keyword"
    id = Column(Integer, primary_key=True, autoincrement=True)
    keyword = Column(String(50), index=True)
    name = Column(Text)
    name_normalized = Column(Text, index=True)
    kr_name = Column(Text)
    description = Column(Text)

class ProductData(Base):
    __tablename__ = "product_data"
    pid = Column(Integer, primary_key=True)
    product_name = Column(Text)
    category = Column(Text)
    p_ingredients = Column(Text)

# [신규] Ingredients 테이블
class Ingredients(Base):
    __tablename__ = "ingredients"
    id = Column(Integer, primary_key=True, autoincrement=True)
    korean_name = Column(Text)
    english_name = Column(Text)
    description = Column(Text)
    caution_grade = Column(String(50))

# [신규] CautionIngredients 테이블
class CautionIngredients(Base):
    __tablename__ = "caution_ingredients"
    korean_name = Column(Text, primary_key=True)
    description = Column(Text)
    caution_grade = Column(Text)

# [신규] 사용자 개별 성분 선호/주의 테이블
class UserIngredients(Base):
    __tablename__ = "user_ingredients"

    # 실제 스키마에 맞춘 타입 지정 + 복합 PK 구성
    user_id = Column(BigInteger, primary_key=True, nullable=False)               # BIGINT
    korean_name = Column(String(255), primary_key=True, nullable=False)          # VARCHAR
    ing_type = Column(Enum('preference', 'caution', name='user_ing_type'),       # ENUM
                      primary_key=True, nullable=False)

    # PK가 아닌 보조 정보
    user_name = Column(String(255))
    created_at = Column(DateTime)

    # 조회 성능용 인덱스(선택)
    __table_args__ = (
        Index('idx_user_ingtype', 'user_id', 'ing_type'),
        Index('idx_user_korname', 'user_id', 'korean_name'),
    )

# --- Pydantic Models ---
class AnalysisRequest(BaseModel):
    product_name: str
    skin_type: str
    user_id: int | None = None  # [신규] 사용자 주의 성분 조회용

class ProductResponse(BaseModel):
    product_name: str

# --- Constants & Helpers (기존과 동일) ---
KEYWORD_KOR_TO_ENG = {
    '보습': 'moisturizing', '진정': 'soothing', '피지': 'sebum_control',
    '주름': 'anti_aging', '미백': 'brightening', '보호': 'protection'
}
KEYWORD_ENG_TO_KOR = {v: k for k, v in KEYWORD_KOR_TO_ENG.items()}

def normalize_name(name):
    if not name: return None
    return name.strip().lower().replace(' ', '').replace('-', '')

def get_product_from_db(product_name: str, db: Session):
    try:
        query = text("""
            SELECT product_name, category, p_ingredients
            FROM product_data
            WHERE product_name = :name
        """)
        result = db.execute(query, {"name": product_name}).fetchone()
        if result:
            return dict(result._mapping)
        else:
            return None
    except Exception as e:
        print(f"❌ DB 조회 오류 (get_product_from_db): {e}")
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")

# --- [신규] 전체 성분 매칭 함수 ---
def match_all_ingredients(ingredients_str: str, db: Session):
    """
    '실제 전체 성분'을 더 정확히 세기 위해
    - KCIA.name_normalized와 정규화 일치 OR
    - ingredients.korean_name과 원문 정확 일치
    를 만족하는 원소들을 수집하여 반환한다.
    """
    if not ingredients_str:
        return []

    # 원문 토큰 & 정규화
    ingredients_list = [ing.strip().strip('"') for ing in ingredients_str.split(',') if ing.strip()]
    norm_list = [normalize_name(ing) for ing in ingredients_list if normalize_name(ing)]
    norm_set = set(norm_list)
    orig_set = set(ingredients_list)

    # KCIA 정규화 매칭
    kcia_rows = db.query(KCIAIngredients.name_normalized).filter(
        KCIAIngredients.name_normalized.in_(norm_set)
    ).all()
    kcia_norm_set = {r[0] for r in kcia_rows}

    # ingredients 국문 정확 일치
    ing_rows = db.query(Ingredients.korean_name).filter(
        Ingredients.korean_name.in_(orig_set)
    ).all()
    ing_exact_set = {r[0] for r in ing_rows}

    # 두 기준을 만족하는 원문 표기만 반환(중복 제거)
    matched = []
    seen = set()
    for ing in ingredients_list:
        n = normalize_name(ing)
        if (n in kcia_norm_set) or (ing in ing_exact_set):
            key = n if (n in kcia_norm_set) else f"EXACT::{ing}"
            if key not in seen:
                matched.append(ing)
                seen.add(key)

    return matched

# --- [신규] 주의 성분 조회 함수 (시스템 DB) ---
def query_caution_ingredients(ingredients_list: List[str], db: Session):
    """
    caution_ingredients 테이블에서 주의 성분 조회
    """
    if not ingredients_list:
        return []

    try:
        caution_results = db.query(
            CautionIngredients.korean_name,
            CautionIngredients.caution_grade
        ).filter(
            CautionIngredients.korean_name.in_(ingredients_list)
        ).all()

        return [
            {
                'korean_name': row[0],
                'caution_grade': row[1]
            }
            for row in caution_results
        ]
    except Exception as e:
        print(f"❌ 주의 성분 조회 오류: {e}")
        return []

# --- [신규] 사용자 주의 성분 조회 (정규화 교집합) ---
def query_user_caution_ingredients(user_id: int | None, product_tokens: List[str], db: Session) -> List[str]:
    """
    user_ingredients에서 (user_id, ing_type='caution') 전체를 읽어 정규화 교집합으로 매칭.
    DB에서 문자열 IN 비교를 하지 않아 표기차(공백/하이픈/대소문자/따옴표)를 흡수한다.
    """
    if not user_id or not product_tokens:
        return []

    product_norm_set = {normalize_name(t) for t in product_tokens if normalize_name(t)}

    try:
        rows = db.query(UserIngredients.korean_name).filter(
            UserIngredients.user_id == user_id,
            UserIngredients.ing_type == 'caution'
        ).all()

        hits = []
        for (kor_name,) in rows:
            if not kor_name:
                continue
            if normalize_name(kor_name) in product_norm_set:
                hits.append(kor_name)
        # 디버깅 도움:
        if hits:
            print(f"[USER_CAUTION] user_id={user_id}, hits={hits}")
        return hits
    except Exception as e:
        print(f"❌ 사용자 주의 성분 정규화 매칭 오류: {e}")
        return []

# --- Matching Logic (기존과 동일) ---
def match_ingredients(ingredients_str: str, db: Session):
    if not ingredients_str:
        return [], {}, [], 0
    ingredients_list = [ing.strip().strip('"') for ing in ingredients_str.split(',') if ing.strip()]
    matched_details = []
    matched_stats = defaultdict(list)
    unmatched = []
    normalized_names = list(set(normalize_name(ing) for ing in ingredients_list if normalize_name(ing)))

    keyword_results = db.query(
        Ingredients6Keyword.name_normalized,
        Ingredients6Keyword.keyword
    ).filter(
        Ingredients6Keyword.name_normalized.in_(normalized_names)
    ).all()
    keyword_map = defaultdict(set)
    for norm_name, kw in keyword_results:
        keyword_map[norm_name].add(kw)

    kcia_results = db.query(
        KCIAIngredients.name_normalized,
        KCIAIngredients.purpose
    ).filter(
        KCIAIngredients.name_normalized.in_(normalized_names)
    ).all()
    purpose_map = {norm_name: purp for norm_name, purp in kcia_results}

    for ingredient in ingredients_list:
        normalized = normalize_name(ingredient)
        if not normalized: continue
        keywords = keyword_map.get(normalized)
        purpose = purpose_map.get(normalized, '미확인')

        if keywords:
            for keyword in keywords:
                kor_keyword = KEYWORD_ENG_TO_KOR.get(keyword, keyword)
                matched_details.append({
                    '성분명': ingredient,
                    '배합목적': purpose,
                    '효능': kor_keyword
                })
                matched_stats[keyword].append(ingredient)
        else:
            unmatched.append({
                '성분명': ingredient,
                '배합목적': purpose,
                '효능': '미분류'
            })

    return matched_details, dict(matched_stats), unmatched, len(ingredients_list)

# --- Score Logic (기존과 동일) ---
def calculate_keyword_ratios(matched_stats, total_matched_count):
    if total_matched_count == 0: return {}
    ratios = {}
    for keyword in ['moisturizing', 'soothing', 'sebum_control', 'anti_aging', 'brightening', 'protection']:
        count = len(matched_stats.get(keyword, []))
        ratios[keyword] = round((count / total_matched_count) * 100, 2)
    return ratios

def calculate_fit_score(percent, target_range, importance=1.0):
    if not isinstance(target_range, list) or len(target_range) != 2: return 0.5
    min_ideal, max_ideal = target_range
    try: percent = float(percent)
    except (ValueError, TypeError): return 0.0
    if min_ideal <= percent <= max_ideal: return 1.0
    if percent < min_ideal:
        if min_ideal <= 0: return 1.0 if percent == 0 else 0.5
        ratio = percent / min_ideal
        return max(0.0, ratio)
    if percent > max_ideal:
        if importance < 0:
            excess_ratio = (percent - max_ideal) / 100
            return max(-0.5, 1.0 - excess_ratio * 5)
        else:
            soft_max = max_ideal * 1.5
            if percent <= soft_max:
                ratio = (percent - max_ideal) / (soft_max - max_ideal) if (soft_max - max_ideal) != 0 else 0
                return max(0.2, 1.0 - ratio * 0.8)
            else:
                divisor = max_ideal if max_ideal != 0 else 1
                return max(0.0, 0.2 - (percent - soft_max) / divisor * 0.2)
    return 0.5

def calculate_contribution(percent, target_range, importance):
    if importance < 0:
        if not target_range or len(target_range) != 2:
             fit_score = 0.0
             contribution = 0.0
        elif percent <= target_range[1]:
            fit_score = 1.0
            contribution = 0
        else:
            fit_score = calculate_fit_score(percent, target_range, importance)
            contribution = (1.0 - fit_score) * importance * 0.75
    else:
        fit_score = calculate_fit_score(percent, target_range, importance)
        contribution = fit_score * importance
    return fit_score, contribution

def calculate_score_final(product_ratios, user_weights_dict):
    if not isinstance(product_ratios, dict): return 0, {}
    if not isinstance(user_weights_dict, dict): return 0, {}
    total_contribution = 0
    max_possible_score = 0
    min_possible_score = 0
    breakdown = {}
    for effect_eng in ['moisturizing', 'soothing', 'sebum_control', 'anti_aging', 'brightening', 'protection']:
        effect_kor = KEYWORD_ENG_TO_KOR[effect_eng]
        effect_settings = user_weights_dict.get(effect_kor)
        importance = 0
        target_range = [0, 100]
        if isinstance(effect_settings, dict):
            imp_val = effect_settings.get('importance')
            tr_val = effect_settings.get('target_range')
            if isinstance(imp_val, (int, float)): importance = imp_val
            if isinstance(tr_val, list) and len(tr_val) == 2: target_range = tr_val
        percent = product_ratios.get(effect_eng, 0)
        fit_score, contribution = calculate_contribution(percent, target_range, importance)
        total_contribution += contribution
        if importance > 0: max_possible_score += (1.0 * importance)
        elif importance < 0: min_possible_score += (importance * 0.7)
        breakdown[effect_eng] = {
            "percent": round(percent, 1), "target_range": target_range,
            "fit_score": round(fit_score, 2), "importance": importance,
            "contribution": round(contribution, 2)
        }
    if max_possible_score == 0: max_possible_score = 1
    score_range = max_possible_score - min_possible_score
    if score_range == 0: final_score = 50
    else:
        normalized = (total_contribution - min_possible_score) / score_range
        base_score = 25
        variable_score = normalized * 75
        final_score = base_score + variable_score
    final_score = max(0, min(math.ceil(final_score), 100))
    return final_score, breakdown

# --- Reliability helpers (신규) ---
def classify_reliability(total_keyword_hits: int) -> str:
    """
    total_keyword_hits 기준 신뢰등급:
    - <3      : 'very_low'  (하드-스탑 대상)
    - 3 ~ 6   : 'low'       (소프트-패스: 경고 + 점수 캡)
    - >=7     : 'normal'
    """
    if total_keyword_hits < 3:
        return "very_low"
    if total_keyword_hits < 7:
        return "low"
    return "normal"

def prepend_low_reliability_warning(opinion_text: str) -> str:
    """
    Low 등급일 때 종합 의견 앞에 강한 경고 문구를 덧붙인다.
    """
    warning = "⚠️ **저신뢰 분석**: OCR 매칭 성분이 적어 결과가 부정확할 수 있습니다. 성분표 재촬영(정면/밝게/클로즈업) 후 재분석을 권장합니다.\n\n"
    return warning + opinion_text

# --- [수정] Text Analysis Logic - 주의 성분 개수 기반 멘트 ---
def generate_analysis_text(skin_type, final_score, breakdown, caution_count):
    good_points = []
    for effect_eng, data in breakdown.items():
        effect_kor = KEYWORD_ENG_TO_KOR[effect_eng]
        if data['contribution'] > 0.5:
            target_min, target_max = data.get('target_range', [0,0])
            percent_val = data.get('percent', 0)
            if target_min <= percent_val <= target_max:
                good_points.append(f"**{effect_kor}**: {percent_val}% (타겟 범위 {target_min}-{target_max}% 만족)")
    weak_points = []
    for effect_eng, data in breakdown.items():
        effect_kor = KEYWORD_ENG_TO_KOR[effect_eng]
        target_min, target_max = data.get('target_range', [0,0])
        importance_val = data.get('importance', 0)
        percent_val = data.get('percent', 0)
        if importance_val >= 1.0:
            if percent_val < target_min:
                deficit = target_min - percent_val
                weak_points.append(f"**{effect_kor}**: {percent_val}% (타겟 최소 {target_min}% 필요, {deficit:.1f}% 부족)")
            elif percent_val > target_max and target_max != 100 and target_max != 0:
                excess = percent_val - target_max
                weak_points.append(f"**{effect_kor}**: {percent_val}% (타겟 최대 {target_max}% 권장, {excess:.1f}% 초과)")

    # [수정] 주의 성분 개수 기반 종합 의견
    if final_score >= 80:
        fit_level = "매우 적합"
    elif final_score >= 70:
        fit_level = "적합"
    else:
        fit_level = "적합하지 않음"

    # 주의 성분 멘트
    if caution_count == 0:
        caution_msg = "주의 성분이 없어 안심하고 사용하실 수 있습니다."
    elif caution_count < 4:
        caution_msg = f"{caution_count}개의 주의 성분이 있으니 참고하세요."
    else:
        caution_msg = f"{caution_count}개의 주의 성분이 있으니 주의하셔서 사용해주세요."

    opinion = f"이 제품은 **{skin_type}** 피부타입에 **{fit_level}**합니다. {caution_msg}"

    return {
        "good_points": good_points if good_points else ["특별히 우수한 항목이 없습니다."],
        "weak_points": weak_points if weak_points else ["모든 항목이 적절합니다!"],
        "opinion": opinion
    }

# --- API Router ---
router = APIRouter()

@router.get("/api/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    try:
        categories_query = db.query(ProductData.category).filter(
            ProductData.p_ingredients.is_not(None),
            ProductData.category.is_not(None)
        ).distinct().order_by(ProductData.category)
        categories = [row[0] for row in categories_query.all() if row[0]]
        return categories
    except Exception as e:
        print(f"❌ /api/categories 서버 오류: {e}")
        raise HTTPException(status_code=500, detail="카테고리 조회 중 오류가 발생했습니다.")

@router.get("/api/products-by-category", response_model=List[ProductResponse])
def get_products_by_category(category: str, db: Session = Depends(get_db)):
    try:
        products_query = db.query(ProductData.product_name).filter(
            ProductData.category == category,
            ProductData.p_ingredients.is_not(None)
        ).order_by(ProductData.product_name)
        products = [{"product_name": row[0]} for row in products_query.all()]
        return products
    except Exception as e:
        print(f"❌ /api/products-by-category 서버 오류: {e}")
        raise HTTPException(status_code=500, detail="제품 목록 조회 중 오류가 발생했습니다.")

# --- [수정] API - 기존 제품 분석 (주의 성분 + 사용자 주의 -40 적용) ---
@router.post("/api/analyze")
def analyze_product_api(request: AnalysisRequest, db: Session = Depends(get_db)):
    print(f"[REQ] /api/analyze user_id={request.user_id}, product={request.product_name}")
    """React에서 호출할 메인 분석 API 엔드포인트 (주의 성분 + 사용자 주의 감점)"""
    try:
        # 1. DB 조회
        product = get_product_from_db(request.product_name, db)
        if not product:
            raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다.")
        ingredients_str = product.get('p_ingredients')
        if not ingredients_str:
            raise HTTPException(status_code=400, detail="제품에 분석 가능한 성분 정보(p_ingredients)가 없습니다.")

        # 2. 성분 매칭(키워드/목적용)
        matched_details, matched_stats, unmatched, total_count = match_ingredients(
            ingredients_str, db
        )

        # ✅ 전체 성분(검증된 원문) 확보
        all_matched_ingredients = match_all_ingredients(ingredients_str, db)
        actual_total_count = len(all_matched_ingredients)

        # [신규] 고유 매칭 성분 수 계산
        unique_matched_set = set()
        for ing_list in matched_stats.values():
            unique_matched_set.update(ing_list)
        unique_matched_count = len(unique_matched_set)

        # 비율 계산 + 신뢰등급 결정
        total_keyword_hits = len(matched_details)
        reliability = classify_reliability(total_keyword_hits)
        if reliability == "low":
            print(f"[WARN] low reliability (product): hits={total_keyword_hits}, product={product.get('product_name','N/A')}")

        # 하드-스탑: very_low(<3)
        if reliability == "very_low":
            raise HTTPException(
                status_code=400,
                detail=f"분석 중단: OCR 매칭 성분이 {total_keyword_hits}개로 매우 적습니다. 성분표를 더 선명하게 촬영해 다시 시도해주세요."
            )
        # 소프트-패스: low(3~6) → 경고 표시 + 점수 캡은 아래에서 적용

        # 3. 비율 계산
        ratios = calculate_keyword_ratios(matched_stats, total_keyword_hits)

        # 4. 가중치 조회
        weights_from_db = db.query(BaumannWeights).filter(BaumannWeights.skin_type == request.skin_type).all()
        if not weights_from_db:
            raise HTTPException(status_code=404, detail="피부 타입 가중치를 DB에서 찾을 수 없습니다.")
        user_weights_dict = {}
        for w in weights_from_db:
            user_weights_dict[w.keyword] = {
                "importance": w.importance,
                "target_range": [w.target_min, w.target_max]
            }

        # 5. 점수 계산
        final_score, breakdown = calculate_score_final(ratios, user_weights_dict)
        # 소프트-패스면 점수 캡 + 경고 문구 주입
        if reliability == "low":
            if final_score > 75:
                print(f"[WARN] score cap (product): from={final_score} to=75, product={product.get('product_name','N/A')}")
                final_score = 75

        # ✅ 6. 시스템 주의 성분 (검증된 원문 사용)
        caution_ingredients = query_caution_ingredients(all_matched_ingredients, db)

        # ✅ 7. 사용자 주의 성분 매칭 (정규화 교집합, 검증된 원문 사용) 및 -40 즉시 감점
        user_cautions = query_user_caution_ingredients(request.user_id, all_matched_ingredients, db)
        score_before = final_score
        has_user_caution = False
        warning_message = None
        modal_variant = None
        if user_cautions:
            has_user_caution = True
            final_score = max(0, final_score - 40)
            warning_message = "선택하신 주의 성분이 포함되어 있습니다."
            modal_variant = "danger"

        # 8. 텍스트 분석 (주의 성분 개수 전달: 시스템 주의 기준)
        analysis_texts = generate_analysis_text(request.skin_type, final_score, breakdown, len(caution_ingredients))
        # 저신뢰 경고 문구를 종합 의견 앞에 덧붙임
        if reliability == "low":
            analysis_texts["opinion"] = prepend_low_reliability_warning(analysis_texts["opinion"])

        # 9. JSON 반환
        return {
            "product_info": {
                "name": product.get('product_name', 'N/A'),
                "category": product.get('category', 'N/A'),
                "total_count": actual_total_count,  # 실제 성분 개수
                "matched_count": unique_matched_count
            },
            "meta": {
                "reliability": reliability,
                "total_keyword_hits": total_keyword_hits
            },

            "skin_type": request.skin_type,
            "score_before": score_before,
            "final_score": final_score,
            "has_user_caution": has_user_caution,
            "user_caution": [{"korean_name": n} for n in user_cautions],
            "warning_message": warning_message,
            "modal_variant": modal_variant,
            "charts": { "ratios": ratios, "breakdown": breakdown },
            "analysis": analysis_texts,
            "ingredients": {
                "matched": matched_details,
                "unmatched": unmatched,
                "caution": caution_ingredients  # 시스템 주의 성분
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ /api/analyze 서버 오류: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

# ============================================
# [신규] OCR 기능 추가 (기존 기능과 독립적)
# ============================================

# Google Vision API 클라이언트 초기화
def get_vision_client():
    """Google Vision API 클라이언트 생성"""
    try:
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path:
            raise Exception("GOOGLE_APPLICATION_CREDENTIALS가 설정되지 않았습니다.")

        if not os.path.isabs(credentials_path):
            base_dir = os.path.dirname(os.path.dirname(__file__))
            credentials_path = os.path.join(base_dir, credentials_path)

        return vision.ImageAnnotatorClient.from_service_account_json(credentials_path)
    except Exception as e:
        print(f"❌ Vision API 클라이언트 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"Vision API 설정 오류: {e}")

def extract_text_from_image_bytes(image_bytes: bytes) -> str:
    """이미지 바이트에서 OCR 텍스트 추출 (Google Vision API)"""
    try:
        client = get_vision_client()
        image = vision.Image(content=image_bytes)
        response = client.text_detection(image=image)

        if response.error.message:
            raise Exception(f"Vision API 오류: {response.error.message}")

        texts = response.text_annotations
        if texts:
            return texts[0].description
        else:
            return ""
    except Exception as e:
        print(f"❌ OCR 텍스트 추출 실패: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 처리 오류: {e}")

def extract_ingredients_from_ocr_with_db(full_text: str, db: Session) -> str:
    """
    OCR 텍스트에서 '전체 성분 후보'를 최대한 보존한다.
    - KCIA.name_normalized ∈ 정규화토큰집합 → 포함
    - ingredients.korean_name ∈ 원문토큰집합 → 포함(국문 정확일치)
    결과: 중복 제거한 원문 표기를 콤마로 반환
    """
    try:
        # 1) 토큰화 & 전처리
        words = re.findall(r'[가-힣a-zA-Z0-9\-]+', full_text)
        words = [w for w in words if len(w) >= 2]
        if not words:
            return ""

        normalized_words = []
        original_map = {}
        for w in words:
            n = normalize_name(w)
            if n:
                normalized_words.append(n)
                if n not in original_map:
                    original_map[n] = w

        if not normalized_words:
            return ""

        unique_norm = list(set(normalized_words))
        words_set = set(words)  # 국문 정확일치용

        # 2) KCIA 정규화 매칭
        kcia_rows = db.query(KCIAIngredients.name_normalized).filter(
            KCIAIngredients.name_normalized.in_(unique_norm)
        ).distinct().all()
        kcia_norm_set = {row[0] for row in kcia_rows}

        # 3) ingredients 국문 정확 일치
        ing_rows = db.query(Ingredients.korean_name).filter(
            Ingredients.korean_name.in_(words_set)
        ).distinct().all()
        ing_exact_set = {row[0] for row in ing_rows}

        # 4) 최종 후보 구성: (KCIA 정규화) ∪ (ingredients 국문 정확일치)
        result = []
        seen = set()
        for w in words:
            n = normalize_name(w)
            if (n in kcia_norm_set) or (w in ing_exact_set):
                key = n if (n in kcia_norm_set) else f"EXACT::{w}"
                if key not in seen:
                    result.append(w)
                    seen.add(key)

        ingredients_str = ', '.join(result)
        print(f"[DEBUG] OCR 전체 성분 후보 포함: {len(result)}개")
        return ingredients_str

    except Exception as e:
        print(f"❌ 성분 추출 오류: {e}")
        import traceback; traceback.print_exc()
        return ""

@router.post("/api/analyze-ocr")
async def analyze_ocr_image(
    file: UploadFile = File(...),
    skin_type: str = Form(...),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db)
):
    """[신규] 이미지 OCR을 통한 제품 분석 (주의 성분 + 사용자 주의 감점)"""
    try:
        content = await file.read()
        full_text = extract_text_from_image_bytes(content)

        if not full_text or len(full_text.strip()) < 10:
            raise HTTPException(status_code=400, detail="이미지에서 텍스트를 찾을 수 없습니다.")

        print(f"[DEBUG] OCR 전체 텍스트 길이: {len(full_text)} 문자")

        ingredients_str = extract_ingredients_from_ocr_with_db(full_text, db)

        if not ingredients_str:
            raise HTTPException(status_code=400, detail="이미지에서 화장품 성분을 찾을 수 없습니다.")

        print(f"[DEBUG] 추출된 성분: {ingredients_str[:100]}...")

        # 키워드/목적 매칭
        matched_details, matched_stats, unmatched, total_count = match_ingredients(
            ingredients_str, db
        )

        # ✅ OCR도 '검증된 원문' 사용
        all_matched_ingredients = match_all_ingredients(ingredients_str, db)
        actual_total_count = len(all_matched_ingredients)

        total_keyword_hits = len(matched_details)
        reliability = classify_reliability(total_keyword_hits)
        if reliability == "low":
            print(f"[WARN] low reliability (ocr): hits={total_keyword_hits}, file={getattr(file,'filename', 'N/A')}")

        if reliability == "very_low":
            raise HTTPException(
                status_code=400,
                detail=f"분석 중단: OCR 매칭 성분이 {total_keyword_hits}개로 매우 적습니다. 성분표를 더 선명하게 촬영해 다시 시도해주세요."
            )

        ratios = calculate_keyword_ratios(matched_stats, total_keyword_hits)

        weights_from_db = db.query(BaumannWeights).filter(
            BaumannWeights.skin_type == skin_type
        ).all()

        if not weights_from_db:
            raise HTTPException(status_code=404, detail="피부 타입 가중치를 찾을 수 없습니다.")

        user_weights_dict = {}
        for w in weights_from_db:
            user_weights_dict[w.keyword] = {
                "importance": w.importance,
                "target_range": [w.target_min, w.target_max]
            }

        final_score, breakdown = calculate_score_final(ratios, user_weights_dict)
        if reliability == "low":
            if final_score > 75:
                print(f"[WARN] score cap (ocr): from={final_score} to=75, file={getattr(file,'filename','N/A')}")
                final_score = 75

        # ✅ 시스템 주의 성분 (검증된 원문 사용)
        caution_ingredients = query_caution_ingredients(all_matched_ingredients, db)

        # ✅ 사용자 주의 성분(정규화 교집합, 검증된 원문 사용) 및 -40 즉시 감점
        user_cautions = query_user_caution_ingredients(user_id, all_matched_ingredients, db)
        score_before = final_score
        has_user_caution = False
        warning_message = None
        modal_variant = None
        if user_cautions:
            has_user_caution = True
            final_score = max(0, final_score - 40)
            warning_message = "선택하신 주의 성분이 포함되어 있습니다."
            modal_variant = "danger"

        analysis_texts = generate_analysis_text(skin_type, final_score, breakdown, len(caution_ingredients))
        if reliability == "low":
            analysis_texts["opinion"] = prepend_low_reliability_warning(analysis_texts["opinion"])

        unique_matched_set = set()
        for ing_list in matched_stats.values():
            unique_matched_set.update(ing_list)
        unique_matched_count = len(unique_matched_set)

        return {
            "product_info": {
                "name": "업로드한 이미지",
                "category": "이미지 분석",
                "total_count": actual_total_count,  # 실제 성분 개수
                "matched_count": unique_matched_count
            },
            "meta": {
                "reliability": reliability,
                "total_keyword_hits": total_keyword_hits
            },

            "skin_type": skin_type,
            "score_before": score_before,
            "final_score": final_score,
            "has_user_caution": has_user_caution,
            "user_caution": [{"korean_name": n} for n in user_cautions],
            "warning_message": warning_message,
            "modal_variant": modal_variant,
            "charts": { "ratios": ratios, "breakdown": breakdown },
            "analysis": analysis_texts,
            "ingredients": {
                "matched": matched_details,
                "unmatched": unmatched,
                "caution": caution_ingredients  # 시스템 주의 성분
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ OCR 분석 오류: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR 분석 중 오류: {e}")
