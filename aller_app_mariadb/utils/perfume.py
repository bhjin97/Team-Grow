# utils/perfume.py
import os
import requests
import streamlit as st
import pymysql
from dotenv import load_dotenv

# ============================================
# 전역 변수 (초기화 전)
# ===========================================

# 상수들 (변하지 않음)
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

# ============================================
# 초기화 함수
# ============================================
def initialize():
    """
    향수 추천 시스템 초기화
    - .env 로드
    - API 키 설정
    """
    global API_KEY
    load_dotenv()
    API_KEY = os.getenv("MY_API_KEY")
    
    if not API_KEY:
        st.warning("⚠️ MY_API_KEY가 설정되지 않았습니다. 날씨 기능이 제한될 수 있습니다.")

# ============================================
# DB 연결 함수
# ============================================
def get_db_connection():
    """MariaDB 연결"""
    load_dotenv()
    try:
        conn = pymysql.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT")),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor  # 딕셔너리 형태로 결과 받기
        )
        return conn
    except Exception as e:
        st.error(f"❌ DB 연결 실패: {e}")
        return None

# ============================================
# 데이터 로드 (MariaDB)
# ============================================
@st.cache_data(ttl=3600)  # 1시간 캐시
def load_all_data():
    """MariaDB에서 추천에 필요한 모든 데이터를 로드합니다."""
    conn = get_db_connection()
    if not conn:
        return None, None, None
    
    try:
        cursor = conn.cursor()
        
        # ========== 1. 향수 기본 정보 + 태그 로드 ==========
        cursor.execute("""
            SELECT 
                p.category, p.name, p.url, p.brand, p.volume, 
                p.price, p.rating, p.description, p.image_url
            FROM perfumes p
        """)
        perfumes_data = cursor.fetchall()
        
        # 향수별 태그 로드
        cursor.execute("SELECT perfume_name, tag FROM perfume_tags")
        tags_data = cursor.fetchall()
        
        # 태그를 향수별로 그룹화
        tags_by_perfume = {}
        for row in tags_data:
            perfume_name = row['perfume_name']
            if perfume_name not in tags_by_perfume:
                tags_by_perfume[perfume_name] = []
            tags_by_perfume[perfume_name].append(row['tag'])
        
        # perfume_details_map 생성
        perfume_details_map = {}
        for perfume in perfumes_data:
            name = perfume['name']
            perfume_details_map[name] = {
                'category': perfume['category'],
                'name': name,
                'url': perfume['url'],
                'brand': perfume['brand'],
                'volume': perfume['volume'],
                'price': perfume['price'],
                'rating': str(perfume['rating']),  # 문자열로 변환
                'description': perfume['description'],
                'image_url': perfume['image_url'],
                'tags': tags_by_perfume.get(name, [])
            }
        
        # ========== 2. 날씨별 추천 데이터 로드 ==========
        cursor.execute("""
            SELECT 
                weather_condition, category, current_level,
                total_mentions, positive, negative, 
                confidence, recommendation
            FROM weather_recommendations
        """)
        weather_data = cursor.fetchall()
        
        # validation_data 생성
        validation_data = {}
        for row in weather_data:
            weather_condition = row['weather_condition']
            category = row['category']
            
            if weather_condition not in validation_data:
                validation_data[weather_condition] = {}
            
            validation_data[weather_condition][category] = {
                'current_level': row['current_level'],
                'total_mentions': row['total_mentions'],
                'positive': row['positive'],
                'negative': row['negative'],
                'confidence': float(row['confidence']),
                'recommendation': row['recommendation']
            }
        
        # ========== 3. 향수 노트 정보 로드 ==========
        cursor.execute("""
            SELECT perfume_name, note
            FROM perfume_notes
            ORDER BY perfume_name, note_order
        """)
        notes_data = cursor.fetchall()
        
        # perfume_features_db 생성
        perfume_features_db = {}
        for row in notes_data:
            perfume_name = row['perfume_name']
            if perfume_name not in perfume_features_db:
                perfume_features_db[perfume_name] = {
                    'notes_factors': [],
                    'age_score': {},
                    'mood_score': {}
                }
            perfume_features_db[perfume_name]['notes_factors'].append(row['note'])
        
        cursor.close()
        conn.close()
        
        return perfume_details_map, validation_data, perfume_features_db
    
    except Exception as e:
        st.error(f"❌ 데이터 로드 중 오류 발생: {e}")
        if conn:
            conn.close()
        return None, None, None

# ============================================
# 날씨 관련 함수
# ============================================
def get_weather(city):
    """위치 기반 현재 날씨 조회"""
    if not API_KEY:
        st.error("오류: MY_API_KEY가 설정되지 않았습니다.")
        return None
    
    city_en = CITY_MAPPING.get(city, city.lower())
    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={city_en}&lang=ko"
    
    try:
        response = requests.get(url)
        if response.status_code != 200:
            st.warning(f"날씨 조회 실패! (상태 코드: {response.status_code})")
            return None
        
        data = response.json()
        return {
            "temp": data['current']['temp_c'],
            "humidity": data['current']['humidity'],
            "precip": data['current']['precip_mm'],
            "condition": data['current']['condition']['text']
        }
    except requests.RequestException as e:
        st.error(f"날씨 API 요청 중 오류: {e}")
        return None

def classify_weather(weather):
    """날씨 조건 분류"""
    if not weather:
        return "맑고 건조한 봄/가을"
    
    temp, humidity, precip, condition = weather.values()
    rain_keywords = ["비", "rain", "소나기", "shower"]
    
    if precip > 0 or any(kw in condition for kw in rain_keywords):
        return "비 오는 날"
    if temp >= 27 and humidity >= 60:
        return "고온다습한 여름"
    if temp < 10:
        return "한랭건조한 겨울"
    return "맑고 건조한 봄/가을"

# ============================================
# 추천 로직
# ============================================
def get_recommended_categories(weather_condition, validation_results):
    """추천 카테고리 추출"""
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
    """가격대 필터링"""
    if price_range in ["가격 무관", "전체"]:
        return products_list
    
    price_ranges = {
        "5만원 이하": (0, 50000),
        "5~10만원": (50000, 100000),
        "10~15만원": (100000, 150000),
        "15만원 이상": (150000, float('inf'))
    }
    
    if price_range not in price_ranges:
        return products_list
    
    min_price, max_price = price_ranges[price_range]
    filtered = []
    
    for p in products_list:
        price_str = p['price'].replace(',', '').replace('원', '')
        try:
            price = int(price_str)
            if min_price <= price < max_price:
                filtered.append(p)
        except:
            continue
    
    return filtered

def calculate_match_score(perfume_notes, target_notes):
    """노트 매칭 점수 계산"""
    if not target_notes:
        return 0.0
    
    perfume_notes_set = set(perfume_notes)
    target_notes_set = set(target_notes)
    matches = perfume_notes_set.intersection(target_notes_set)
    
    return len(matches) / len(target_notes_set)

def recommend_perfume_hybrid(user_input, all_data, top_n=5):
    """하이브리드 향수 추천"""
    perfume_details_map, validation_data, perfume_features_db = all_data
    
    weather = get_weather(user_input.get('city', ''))
    condition = classify_weather(weather)
    weather_target_cats = get_recommended_categories(condition, validation_data)
    all_perfumes_list = list(perfume_details_map.values())
    price_filtered_products = filter_by_price(all_perfumes_list, user_input.get('price_range', '가격 무관'))
    
    candidates = [p for p in price_filtered_products if p['category'] in weather_target_cats]
    
    if not candidates:
        return [], weather, condition
        
    target_loc_notes = LOCATION_NOTES_MAP.get(user_input.get('location'), [])
    target_age_notes = AGE_NOTES_MAP.get(user_input.get('age'), [])
    target_mood_notes = MOOD_NOTES_MAP.get(user_input.get('mood'), [])
    
    final_scores = {}
    for product in candidates:
        perfume_name = product['name']
        if perfume_name not in perfume_features_db:
            continue
        
        perfume_notes = perfume_features_db[perfume_name].get('notes_factors', [])
        
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
    
    top_results = []
    for name, score in sorted_recommendations[:top_n]:
        product_details = perfume_details_map[name]
        product_details['final_score'] = score
        top_results.append(product_details)

    return top_results, weather, condition