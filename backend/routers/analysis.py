# --- Imports ---
import json
import math
import os
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, declarative_base
# [수정] text 함수 임포트
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Index, text
from sqlalchemy.dialects.mysql import JSON as MySQL_JSON
# [수정] ..db -> db로 변경
from db import get_db 
from typing import List # [★] List 타입 힌트를 위해 추가

# --- SQLAlchemy Models (migrate_json_to_db.py 에서 복사) ---
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

# --- [★] product_data 테이블 모델 추가 ---
# (DB 마이그레이션엔 없었지만, 쿼리 시 ORM을 사용하기 위해 정의)
class ProductData(Base):
    __tablename__ = "product_data"
    pid = Column(Integer, primary_key=True)
    product_name = Column(Text)
    category = Column(Text)
    p_ingredients = Column(Text)
    # ... (다른 컬럼이 있다면 추가)

# --- Pydantic Models ---
class AnalysisRequest(BaseModel):
    product_name: str
    skin_type: str

# [★] 제품 목록 반환을 위한 Pydantic 모델
class ProductResponse(BaseModel):
    product_name: str

# --- Constants ---
KEYWORD_KOR_TO_ENG = {
    '보습': 'moisturizing', '진정': 'soothing', '피지': 'sebum_control',
    '주름': 'anti_aging', '미백': 'brightening', '보호': 'protection'
}
KEYWORD_ENG_TO_KOR = {v: k for k, v in KEYWORD_KOR_TO_ENG.items()}

# --- Helper Functions ---
def normalize_name(name):
    if not name: return None
    return name.strip().lower().replace(' ', '').replace('-', '')

# --- DB Helper (get_product_from_db 수정) ---
def get_product_from_db(product_name: str, db: Session):
    """DB에서 제품 조회 (ORM 사용)"""
    try:
        # [수정] Raw SQL 대신 ORM 쿼리로 변경 (더 안전하고 명확함)
        product = db.query(ProductData).filter(ProductData.product_name == product_name).first()
        
        if product:
            # SQLAlchemy 모델 객체를 dict로 변환 (주의: 이 방식은 lazy loading을 유발할 수 있으나,
            # ProductData 모델이 간단하므로 여기서는 사용)
            return {c.name: getattr(product, c.name) for c in product.__table__.columns}
        else:
            return None
    except Exception as e:
        print(f"❌ DB 조회 오류 (get_product_from_db): {e}")
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")

# --- Matching Logic (DB 조회 방식으로 수정) ---
def match_ingredients(ingredients_str: str, db: Session):
    if not ingredients_str:
        return [], {}, [], 0

    ingredients_list = [ing.strip().strip('"') for ing in ingredients_str.split(',') if ing.strip()]
    
    matched_details = []
    matched_stats = defaultdict(list)
    unmatched = []
    
    normalized_names = list(set(normalize_name(ing) for ing in ingredients_list if normalize_name(ing)))
    
    # 1. ingredients_6keyword 테이블에서 필요한 정보 조회
    keyword_results = db.query(
        Ingredients6Keyword.name_normalized, 
        Ingredients6Keyword.keyword
    ).filter(
        Ingredients6Keyword.name_normalized.in_(normalized_names)
    ).all()
    
    keyword_map = defaultdict(set)
    for norm_name, kw in keyword_results:
        keyword_map[norm_name].add(kw)

    # 2. KCIA_ingredients 테이블에서 필요한 정보 조회
    kcia_results = db.query(
        KCIAIngredients.name_normalized,
        KCIAIngredients.purpose
    ).filter(
        KCIAIngredients.name_normalized.in_(normalized_names)
    ).all()
    
    purpose_map = {norm_name: purp for norm_name, purp in kcia_results}

    # 3. 성분 리스트 순회하며 매칭 수행
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

# --- Score Logic (기존 skin_simulate.py v3.2/v3.1 로직 - 변경 없음) ---
# (calculate_keyword_ratios, calculate_fit_score, 
#  calculate_contribution, calculate_score_final 함수들은
# 와 동일하므로 생략하지 않고 모두 포함)

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
                # [수정] 0으로 나누기 방지
                ratio = (percent - max_ideal) / (soft_max - max_ideal) if (soft_max - max_ideal) != 0 else 0
                return max(0.2, 1.0 - ratio * 0.8)
            else:
                divisor = max_ideal if max_ideal != 0 else 1 # 0으로 나누는 것 방지
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

# --- Text Analysis Logic (기존 streamlit.py 로직 - 변경 없음) ---
def generate_analysis_text(skin_type, final_score, breakdown):
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
            # [수정] target_max가 0이 아닌 경우(예: [0, 100])만 초과 비교
            elif percent_val > target_max and target_max != 100 and target_max != 0: 
                excess = percent_val - target_max
                weak_points.append(f"**{effect_kor}**: {percent_val}% (타겟 최대 {target_max}% 권장, {excess:.1f}% 초과)")
    
    if final_score >= 70: opinion = f"이 제품은 **{skin_type}** 피부타입에 **매우 적합**합니다..."
    elif final_score >= 50: opinion = f"이 제품은 **{skin_type}** 피부타입에 **보통** 수준입니다..."
    else: opinion = f"이 제품은 **{skin_type}** 피부타입에 **적합하지 않습니다**..."
    
    return {
        "good_points": good_points if good_points else ["특별히 우수한 항목이 없습니다."],
        "weak_points": weak_points if weak_points else ["모든 항목이 적절합니다!"],
        "opinion": opinion
    }

# --- API Router ---
router = APIRouter()

# --- [★★★ 1단계: 신규 API 엔드포인트 2개 추가 ★★★] ---

@router.get("/api/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    """
    프론트엔드에 카테고리 목록을 반환하는 API
    (분석 가능한 제품이 있는 카테고리만)
    """
    try:
        categories_query = db.query(ProductData.category).filter(
            ProductData.p_ingredients.is_not(None),
            ProductData.category.is_not(None)
        ).distinct().order_by(ProductData.category)
        
        # 쿼리 결과는 (value,) 형태의 튜플 리스트이므로, 리스트로 변환
        categories = [row[0] for row in categories_query.all() if row[0]]
        return categories
    except Exception as e:
        print(f"❌ /api/categories 서버 오류: {e}")
        raise HTTPException(status_code=500, detail="카테고리 조회 중 오류가 발생했습니다.")

@router.get("/api/products-by-category", response_model=List[ProductResponse])
def get_products_by_category(category: str, db: Session = Depends(get_db)):
    """
    특정 카테고리에 속하는 제품 목록을 반환하는 API
    """
    try:
        products_query = db.query(ProductData.product_name).filter(
            ProductData.category == category,
            ProductData.p_ingredients.is_not(None) # 분석 가능한 제품만
        ).order_by(ProductData.product_name)
        
        products = [{"product_name": row[0]} for row in products_query.all()]
        return products
    except Exception as e:
        print(f"❌ /api/products-by-category 서버 오류: {e}")
        raise HTTPException(status_code=500, detail="제품 목록 조회 중 오류가 발생했습니다.")

# --- [★★★ --------------------------------- ★★★] ---


@router.post("/api/analyze")
def analyze_product_api(request: AnalysisRequest, db: Session = Depends(get_db)):
    """React에서 호출할 메인 분석 API 엔드포인트 (DB 조회 버전)"""
    try:
        # 1. DB에서 제품 조회
        product = get_product_from_db(request.product_name, db)
        if not product:
            raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다.")
        ingredients_str = product.get('p_ingredients')
        if not ingredients_str:
             raise HTTPException(status_code=400, detail="제품에 분석 가능한 성분 정보(p_ingredients)가 없습니다.")

        # 2. 성분 매칭 (DB 조회)
        matched_details, matched_stats, unmatched, total_count = match_ingredients(
            ingredients_str,
            db
        )

        if len(matched_details) < 7:
             raise HTTPException(status_code=400, detail=f"분석 불가: 매칭된 성분이 {len(matched_details)}개로 너무 적습니다. (최소 7개 필요)")
        
        # 3. 비율 계산 (v3.2)
        total_matched_count = len(matched_details) 
        ratios = calculate_keyword_ratios(matched_stats, total_matched_count)

        # 4. 바우만 가중치 DB 조회
        weights_from_db = db.query(BaumannWeights).filter(BaumannWeights.skin_type == request.skin_type).all()
        if not weights_from_db:
             raise HTTPException(status_code=404, detail="피부 타입 가중치를 DB에서 찾을 수 없습니다.")
        
        user_weights_dict = {}
        for w in weights_from_db:
            user_weights_dict[w.keyword] = { 
                "importance": w.importance,
                "target_range": [w.target_min, w.target_max]
            }

        # 5. 점수 계산 (v3.1)
        final_score, breakdown = calculate_score_final(ratios, user_weights_dict)
        
        # 6. 텍스트 분석
        analysis_texts = generate_analysis_text(request.skin_type, final_score, breakdown)
        
        # 7. React에 필요한 모든 정보를 JSON으로 반환
        return {
            "product_info": {
                "name": product.get('product_name', 'N/A'),
                "category": product.get('category', 'N/A'),
                "total_count": total_count,
                "matched_count": len(matched_details)
            },
            "skin_type": request.skin_type,
            "final_score": final_score,
            "charts": { "ratios": ratios, "breakdown": breakdown },
            "analysis": analysis_texts,
            "ingredients": { "matched": matched_details, "unmatched_count": len(unmatched) }
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ /api/analyze 서버 오류: {e}")
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")