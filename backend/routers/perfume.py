# --- Imports ---
import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text # Raw SQL을 위해 text 임포트
from db import get_db # 팀원이 만든 DB 세션 의존성
from typing import List, Dict, Any
from collections import defaultdict # [★★★ 오류 수정: defaultdict 임포트 추가 ★★★]

# --- SQLAlchemy Models ---
# (SQLAlchemy 모델 정의는 이전과 동일)
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, Float, Text, Index
from sqlalchemy.dialects.mysql import JSON as MySQL_JSON

Base = declarative_base()

class PerfumeFeatures(Base):
    """
    perfume_features 테이블 모델
    (테이블이 DB에 존재해야 합니다)
    """
    __tablename__ = "perfume_features"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(512), index=True)
    notes_factors = Column(MySQL_JSON) 
    # (실제 DB 스키마에 맞게 조정 필요)

class Perfumes(Base):
    __tablename__ = "perfumes"
    name = Column(String(512), primary_key=True)
    category = Column(String(255))
    url = Column(Text)
    brand = Column(String(255))
    volume = Column(String(255))
    price = Column(String(255))
    rating = Column(Float)
    description = Column(Text)
    image_url = Column(Text)

class PerfumeTags(Base):
    __tablename__ = "perfume_tags"
    id = Column(Integer, primary_key=True, autoincrement=True)
    perfume_name = Column(String(512), index=True)
    tag = Column(String(255))

class WeatherRecommendations(Base):
    __tablename__ = "weather_recommendations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    weather_condition = Column(String(255), index=True)
    category = Column(String(255), index=True)
    current_level = Column(String(255))
    total_mentions = Column(Integer)
    positive = Column(Integer)
    negative = Column(Integer)
    confidence = Column(Float)
    recommendation = Column(String(255))

class PerfumeNotes(Base):
    __tablename__ = "perfume_notes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    perfume_name = Column(String(512), index=True)
    note = Column(String(255))
    note_order = Column(Integer)


# --- Pydantic Models ---
class PerfumeRequest(BaseModel):
    city: str
    location: str # [수정] perfume.py 원본의 'location' 키 사용
    age: str
    mood: str
    price_range: str

# --- Constants (perfume.py에서 복사) ---
CITY_MAPPING = {
    "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon",
    "광주": "gwangju", "대전": "daejeon", "울산": "ulsan", "세종": "sejong",
    "경기": "suwon", "창원": "changwon", "제주": "jeju"
}
LOCATION_NOTES_MAP = {
    '데이트': ['플로럴', '머스크', '프루티', '바닐라', '장미꽃잎', '꿀'],
    '출근': ['아로마틱', '시트러스', '우디', '화이트 머스크', '프리지아', '시더우드'],
    '휴식': ['파우더리', '앰버', '화이트 플로럴', '코튼', '은방울꽃']
}
AGE_NOTES_MAP = {
    '10대': ['프루티', '시트러스', '스위트', '바닐라', '리치', '꿀', '베르가못'],
    '20대초반': ['프루티', '플로럴', '시트러스', '피오니', '프리지아', '그린'],
    '20대후반': ['플로럴', '머스크', '화이트 플로럴', '장미꽃잎', '파우더리', '비누'],
    '30대': ['머스크', '우디', '앰버', '스파이시', '바닐라', '파우더리', '시더우드'],
    '40대이상': ['우디', '오리엔탈', '앰버', '시프레', '파츌리', '샌달우드', '스파이시']
}
MOOD_NOTES_MAP = {
    '기분전환': ['시트러스', '아로마틱', '그린', '베르가못', '레몬', '자몽', '민트'],
    '차분한': ['우디', '파우더리', '샌달우드', '라벤더', '앰버', '코튼', '머스크'],
    '설렘': ['플로럴', '프루티', '자스민', '장미꽃잎', '피오니', '스위트', '바닐라'],
    '섹시한': ['머스크', '오리엔탈', '앰버', '바닐라', '스파이시', '자스민', '파츌리'],
    '데일리': ['아쿠아', '그린', '시트러스', '코튼', '머스크', '화이트 플로럴', '비누']
}
WEIGHTS = {
    'location': 1.5,
    'age': 1.0,
    'mood': 1.0,
    'rating': 0.5
}
API_KEY = os.getenv("MY_API_KEY") #

# --- DB 데이터 로드 (SQLAlchemy로 수정) ---
def load_all_data_from_db(db: Session):
    """
    MariaDB에서 추천에 필요한 모든 데이터를 로드합니다.
    (perfume.py의 load_all_data 함수를 SQLAlchemy로 포팅)
    """
    try:
        # ========== 1. 향수 기본 정보 + 태그 로드 ==========
        query1 = text("""
            SELECT p.category, p.name, p.url, p.brand, p.volume, 
                   p.price, p.rating, p.description, p.image_url
            FROM perfumes p
        """)
        perfumes_result = db.execute(query1).fetchall()
        
        query2 = text("SELECT perfume_name, tag FROM perfume_tags")
        tags_result = db.execute(query2).fetchall()
        
        tags_by_perfume = defaultdict(list) # [★] defaultdict 사용
        for row in tags_result:
            tags_by_perfume[row.perfume_name].append(row.tag)
            
        perfume_details_map = {}
        for perfume in [dict(row._mapping) for row in perfumes_result]:
            name = perfume['name']
            perfume_details_map[name] = {
                'category': perfume['category'], 'name': name,
                'url': perfume['url'], 'brand': perfume['brand'],
                'volume': perfume['volume'], 'price': perfume['price'],
                'rating': str(perfume['rating']),
                'description': perfume['description'],
                'image_url': perfume['image_url'],
                'tags': tags_by_perfume.get(name, [])
            }
        
        # ========== 2. 날씨별 추천 데이터 로드 ==========
        query3 = text("""
            SELECT weather_condition, category, current_level,
                   total_mentions, positive, negative, 
                   confidence, recommendation
            FROM weather_recommendations
        """)
        weather_result = db.execute(query3).fetchall()
        
        validation_data = defaultdict(dict) # [★] defaultdict 사용
        for row in [dict(row._mapping) for row in weather_result]:
            validation_data[row['weather_condition']][row['category']] = {
                'current_level': row['current_level'],
                'total_mentions': row['total_mentions'],
                'positive': row['positive'], 'negative': row['negative'],
                'confidence': float(row['confidence']),
                'recommendation': row['recommendation']
            }
        
        # ========== 3. 향수 노트 정보 로드 ==========
        query4 = text("""
            SELECT perfume_name, note
            FROM perfume_notes
            ORDER BY perfume_name, note_order
        """)
        notes_result = db.execute(query4).fetchall()
        
        # [★] defaultdict 사용
        perfume_features_db = defaultdict(lambda: {'notes_factors': [], 'age_score': {}, 'mood_score': {}})
        for row in notes_result:
            perfume_features_db[row.perfume_name]['notes_factors'].append(row.note)
            
        print(f"✅ DB 데이터 로드 완료: 향수 {len(perfume_details_map)}개, 날씨 {len(validation_data)}개, 노트 {len(perfume_features_db)}개")
        return perfume_details_map, dict(validation_data), dict(perfume_features_db)
        
    except Exception as e:
        print(f"❌ DB 데이터 로드 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"DB 데이터 로드 실패: {e}")

# --- 날씨 관련 함수 (perfume.py에서 복사) ---
def get_weather(city):
    """위치 기반 현재 날씨 조회 (api.weatherapi.com)"""
    if not API_KEY:
        print("⚠️ .env 파일에 MY_API_KEY가 없습니다. '맑음'으로 기본 처리합니다.")
        return {"temp": 20, "humidity": 50, "precip": 0, "condition": "맑음"}
    
    city_en = CITY_MAPPING.get(city, city.lower())
    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={city_en}&lang=ko"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        return {
            "temp": data['current']['temp_c'],
            "humidity": data['current']['humidity'],
            "precip": data['current']['precip_mm'],
            "condition": data['current']['condition']['text']
        }
    except requests.RequestException as e:
        print(f"❌ 날씨 API 요청 중 오류: {e}. '맑음'으로 기본 처리합니다.")
        return {"temp": 20, "humidity": 50, "precip": 0, "condition": "맑음"}

def classify_weather(weather):
    """날씨 조건 분류 (perfume.py에서 복사)"""
    if not weather:
        return "맑고 건조한 봄/가을"
    temp, humidity, precip, condition = weather.values()
    rain_keywords = ["비", "rain", "소나기", "shower"]
    if precip > 0 or any(kw in condition.lower() for kw in rain_keywords):
        return "비 오는 날"
    if temp >= 27 and humidity >= 60:
        return "고온다습한 여름"
    if temp < 10:
        return "한랭건조한 겨울"
    return "맑고 건조한 봄/가을"

# --- 추천 로직 (perfume.py에서 복사) ---
def get_recommended_categories(weather_condition, validation_results):
    weather_data = validation_results.get(weather_condition, {})
    highly_recommended, recommended = [], []
    for category, data in weather_data.items():
        confidence = data.get('confidence', 0)
        if confidence >= 0.95:
            highly_recommended.append(category)
        elif confidence >= 0.90:
            recommended.append(category)
    return set(highly_recommended + recommended)

def filter_by_price(products_list, price_range):
    if price_range in ["가격 무관", "전체"] or not price_range:
        return products_list
    price_ranges = {
        "5만원 이하": (0, 50000), "5~10만원": (50000, 100000),
        "10~15만원": (100000, 150000), "15만원 이상": (150000, float('inf'))
    }
    if price_range not in price_ranges:
        return products_list
    min_price, max_price = price_ranges[price_range]
    filtered = []
    for p in products_list:
        price_str = (p.get('price') or '0').replace(',', '').replace('원', '')
        try:
            price = int(price_str)
            if min_price <= price < max_price:
                filtered.append(p)
        except:
            continue
    return filtered

def calculate_match_score(perfume_notes, target_notes):
    if not target_notes:
        return 0.0
    perfume_notes_set = set(perfume_notes)
    target_notes_set = set(target_notes)
    matches = perfume_notes_set.intersection(target_notes_set)
    return len(matches) / len(target_notes_set)

# --- API Router ---
router = APIRouter()

# [★] DB 데이터를 API 호출 시마다 로드하는 대신, 서버 시작 시 한 번 로드하도록 수정 (성능 향상)
# (주의: 이 방식은 DB가 변경되어도 서버 재시작 전까지 반영되지 않음)
# (만약 실시간 반영이 필요하면 이 데이터를 @st.cache_data처럼 캐싱하는 로직이 필요)
perfume_details_map_global = {}
validation_data_global = {}
perfume_features_db_global = {}

@router.on_event("startup")
def load_perfume_data_on_startup():
    """서버 시작 시 향수 데이터를 메모리에 로드"""
    print("⏳ FastAPI 서버 시작... 향수 추천 데이터 로드 중...")
    db = next(get_db()) # DB 세션 생성
    try:
        global perfume_details_map_global, validation_data_global, perfume_features_db_global
        perfume_details_map, validation_data, perfume_features_db = load_all_data_from_db(db)
        perfume_details_map_global = perfume_details_map
        validation_data_global = validation_data
        perfume_features_db_global = perfume_features_db
    finally:
        db.close()

@router.post("/api/perfume/recommend_v2", response_model=Dict[str, Any]) # [수정] 반환 타입
def recommend_perfume_hybrid_api(request: PerfumeRequest, db: Session = Depends(get_db)):
    """
    하이브리드 향수 추천 API
    (메모리에 로드된 글로벌 변수 사용)
    """
    try:
        # 1. 메모리에 로드된 데이터 사용
        if not perfume_details_map_global or not validation_data_global or not perfume_features_db_global:
             raise HTTPException(status_code=500, detail="서버에 향수 데이터가 로드되지 않았습니다. (관리자 문의)")

        # 2. 날씨 분류
        weather = get_weather(request.city)
        condition = classify_weather(weather)
        
        # 3. 1차 필터링: 날씨 카테고리
        weather_target_cats = get_recommended_categories(condition, validation_data_global)
        all_perfumes_list = list(perfume_details_map_global.values())
        
        # 4. 2차 필터링: 가격
        price_filtered_products = filter_by_price(all_perfumes_list, request.price_range)
        
        # 5. 3차 필터링: 날씨 카테고리 + 가격 만족
        candidates = [p for p in price_filtered_products if p['category'] in weather_target_cats]
        
        if not candidates:
            print("⚠️ 1, 2, 3차 필터링 결과, 추천할 향수가 없습니다.")
            return {"recommendations": [], "weather_info": weather, "weather_condition": condition}
            
        # 6. 타겟 노트 정의
        target_loc_notes = LOCATION_NOTES_MAP.get(request.location, [])
        target_age_notes = AGE_NOTES_MAP.get(request.age, [])
        target_mood_notes = MOOD_NOTES_MAP.get(request.mood, [])
        
        # 7. 점수 계산
        final_scores = {}
        for product in candidates:
            perfume_name = product['name']
            if perfume_name not in perfume_features_db_global:
                continue
            
            perfume_notes = perfume_features_db_global[perfume_name].get('notes_factors', [])
            
            loc_score = calculate_match_score(perfume_notes, target_loc_notes)
            age_score = calculate_match_score(perfume_notes, target_age_notes)
            mood_score = calculate_match_score(perfume_notes, target_mood_notes)
            rating_score = float(product.get('rating', 2.5)) / 5.0
            
            final_score = (loc_score * WEIGHTS['location']) + \
                          (age_score * WEIGHTS['age']) + \
                          (mood_score * WEIGHTS['mood']) + \
                          (rating_score * WEIGHTS['rating'])
            
            final_scores[perfume_name] = final_score

        sorted_recommendations = sorted(final_scores.items(), key=lambda item: item[1], reverse=True)
        
        # 8. 최종 결과 포맷팅
        top_results = []
        for name, score in sorted_recommendations[:5]: # 상위 5개
            product_details = perfume_details_map_global[name]
            product_details['final_score'] = round(score, 2)
            top_results.append(product_details)

        return {
            "recommendations": top_results,
            "weather_info": weather,
            "weather_condition": condition
        }

    except Exception as e:
        print(f"❌ /api/perfume/recommend_v2 서버 오류: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")