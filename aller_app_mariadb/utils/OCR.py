# utils/OCR.py
# ============================================
# 화장품 OCR 분석 모듈 (MariaDB + SQLAlchemy 버전)
# [수정] FTS 검색 로직을 'Top-K' + 'difflib.SequenceMatcher'로 변경
# ============================================

import os
import io
import re
import difflib  # <-- [신규] 문자열 유사도 비교 라이브러리 import
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv, find_dotenv
from google.cloud import vision
from PIL import Image
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from urllib.parse import quote_plus

# ============================================
# 데이터베이스 연결 (수정 없음)
# ============================================

def get_engine() -> Engine:
    """환경 변수에서 DB 정보를 읽어 SQLAlchemy 엔진을 생성합니다."""
    load_dotenv()
    
    dialect = os.getenv("DB_DIALECT", "{DB_DIALECT}")
    host    = os.getenv("DB_HOST", "{DB_HOST}")
    port    = os.getenv("DB_PORT", "{DB_PORT}")
    user    = os.getenv("DB_USER", "{DB_USER}")
    pw      = os.getenv("DB_PASSWORD", "{DB_PASSWORD}")
    name    = os.getenv("DB_NAME", "{DB_NAME}")
    
    dsn = f"{dialect}://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{quote_plus(name)}?charset=utf8mb4"
    return create_engine(dsn, pool_pre_ping=True, future=True)

# ============================================
# OCR 및 검증 함수 (수정 없음)
# ============================================

def extract_text_from_image(image_path: str) -> Optional[str]:
    """[수정] Google Cloud Vision API 인증을 '절대 경로'로 수정"""
    try:
        dotenv_path = find_dotenv()
        if not dotenv_path:
            raise Exception("'.env' 파일을 찾을 수 없습니다. (find_dotenv() 실패)")
        load_dotenv(dotenv_path) 
        base_dir = os.path.dirname(dotenv_path)
        json_filename = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not json_filename:
            raise Exception("'.env' 파일에 GOOGLE_APPLICATION_CREDENTIALS가 없습니다.")
        abs_json_path = os.path.join(base_dir, json_filename)
        client = vision.ImageAnnotatorClient.from_service_account_json(abs_json_path)
        if not os.path.exists(abs_json_path):
            raise Exception(f"파일을 찾을 수 없습니다 (경로 확인): {abs_json_path}")
            
        with io.open(image_path, 'rb') as image_file:
            content = image_file.read()
        image = vision.Image(content=content)
        response = client.document_text_detection(image=image)
        if response.error.message:
            raise Exception(f"API 오류: {response.error.message}")
        return response.full_text_annotation.text
    except Exception as e:
        print(f"OCR 추출 오류: {e}") 
        return None

def validate_cosmetic_image(ocr_text: str) -> Dict[str, Any]:
    """OCR 텍스트로 화장품 이미지 여부를 판별합니다."""
    if not ocr_text or len(ocr_text.strip()) < 10:
        return {
            'is_valid': False,
            'has_text': False,
            'error_message': '텍스트가 없는 사진입니다.',
            'match_count': 0
        }
    
    cosmetic_keywords = [
        '화장품', '크림', '로션', '에센스', '세럼', '토너', '스킨',
        '에멀전', '클렌징', '마스크', '팩', '선크림', '파운데이션',
        '쿠션', '립스틱', '샴푸', '린스', '바디', '향수',
        '용량', 'ml', 'g', '성분', '사용법', '제조', '유통기한',
        '화장품제조업자', '화장품책임판매업자', '식약처',
        '전성분', 'ingredients'
    ]
    
    match_count = sum(1 for keyword in cosmetic_keywords if keyword.lower() in ocr_text.lower())
    
    is_valid = match_count >= 1
    
    return {
        'is_valid': is_valid,
        'has_text': True,
        'match_count': match_count,
        'error_message': None if is_valid else '화장품 사진이 아닙니다.'
    }

# ============================================
# 화장품 분석기 클래스
# ============================================

class CosmeticAnalyzer:
    """화장품 데이터 분석 및 주의 성분 조회를 담당하는 클래스"""
    
    def __init__(self):
        self.engine = get_engine()
    
    def analyze_from_text(self, ocr_text: str) -> Optional[Dict[str, Any]]:
        """
        [수정] FTS 검색 로직을 'Top-K 후보 검증' 방식으로 변경
        """
        # 1. 검증
        validation = validate_cosmetic_image(ocr_text)
        if not validation['is_valid']:
            pass
        
        # 2. 제품명 후보 추출 (상위 10줄 + 불용어 필터링)
        lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
        product_candidates = []
        STOP_KEYWORDS = ['사용', '펌프', '공기', '분리배출', '플라스틱', '전성분', '주의', '제조', '용량', 'ml', '방법', '피부', '고민']

        for line in lines[:10]:
            if len(line) < 3 or len(line) > 60: 
                continue
            if any(keyword in line for keyword in STOP_KEYWORDS):
                continue
            if len(re.findall(r'[가-힣a-zA-Z]', line)) > len(line) * 0.5:
                product_candidates.append(line)
        
        # 3. [수정] DB에서 제품 검색 (FTS 우선, LIKE 차선)
        product_data = None
        
        # 3-1. FTS
        clean_search_text = " ".join(product_candidates) 
        print(f"[DEBUG] FTS Search Text: '{clean_search_text}'") 
        
        if clean_search_text:
             # [수정] Top-K 로직은 'clean_search_text'만 사용
             product_data = self._fuzzy_search_product(clean_search_text)
        
        # 3-2. FTS 실패 시, LIKE
        if not product_data:
            print("[DEBUG] FTS Failed. Falling back to LIKE search...") 
            for candidate in product_candidates:
                product_data = self._search_product_by_name(candidate, use_fts=False) 
                if product_data:
                    break 
        
        # 4. DB 조회 최종 실패 시, OCR 텍스트 직접 분석 (기존과 동일)
        if not product_data:
            ocr_ingredients = self._extract_ingredients_from_ocr(ocr_text)
            caution_ingredients = self._query_caution_ingredients(ocr_ingredients)
            
            return {
                'source': 'ocr_direct_analysis',
                'product_name': None,
                'brand': None,
                'price_krw': None,
                'capacity': None,
                'image_url': None,
                'ingredients': ocr_ingredients,
                'caution_ingredients': caution_ingredients,
                'ocr_text': ocr_text,
                'validation': validation,
                'error': '데이터베이스에서 제품을 찾지 못해 OCR 텍스트로 성분만 분석합니다.'
            }
        
        # 5. DB 조회 성공 시 주의 성분 조회 (기존과 동일)
        caution_ingredients = self._query_caution_ingredients(product_data.get('ingredients', []))
        
        # 6. 결과 반환 (기존과 동일)
        return {
            'source': 'database',
            'product_name': product_data.get('product_name'),
            'brand': product_data.get('brand'),
            'price_krw': product_data.get('price_krw'),
            'capacity': product_data.get('capacity'),
            'image_url': product_data.get('image_url'),
            'ingredients': product_data.get('ingredients', []),
            'caution_ingredients': caution_ingredients,
            'ocr_text': ocr_text,
            'validation': validation
        }

    def _extract_ingredients_from_ocr(self, ocr_text: str) -> List[str]:
        """OCR 텍스트에서 '전성분' 이후의 텍스트를 파싱합니다."""
        try:
            match = re.search(r'전성분|ingredients', ocr_text, re.IGNORECASE)
            
            if match:
                ingredients_str = ocr_text[match.end():].strip(': \n')
            else:
                ingredients_str = ocr_text

            all_ingredients = [
                ing.strip() 
                for ing in re.split(r'[,/\n]', ingredients_str) 
                if ing.strip() and len(ing.strip()) > 1
            ]
            return all_ingredients
        except Exception:
            return []

    def analyze_from_product_name(self, product_name: str) -> Optional[Dict[str, Any]]:
        """
        제품명으로 직접 검색하여 분석합니다. (채팅 UI의 '검색' 버튼용)
        """
        product_data = self._search_product_by_name(product_name, use_fts=True)
        if not product_data:
            return None
        caution_ingredients = self._query_caution_ingredients(product_data.get('ingredients', []))
        return {
            'source': 'database',
            'product_name': product_data.get('product_name'),
            'brand': product_data.get('brand'),
            'price_krw': product_data.get('price_krw'),
            'capacity': product_data.get('capacity'),
            'image_url': product_data.get('image_url'),
            'ingredients': product_data.get('ingredients', []),
            'caution_ingredients': caution_ingredients,
            'ocr_text': None,
            'validation': {'is_valid': True, 'has_text': True, 'match_count': 0}
        }
    
    def _search_product_by_name(self, product_name: str, use_fts: bool = True) -> Optional[Dict[str, Any]]:
        """[수정] 제품명으로 DB를 검색 (FTS 또는 LIKE)"""
        try:
            with self.engine.connect() as conn:
                result = None
                if use_fts:
                    query_fts = text("""
                        SELECT 
                            product_name, brand, image_url, price_krw, capacity, ingredients,
                            MATCH(product_name) AGAINST(:name IN NATURAL LANGUAGE MODE) as relevance_score
                        FROM product_data 
                        WHERE MATCH(product_name) AGAINST(:name IN NATURAL LANGUAGE MODE)
                        ORDER BY relevance_score DESC
                        LIMIT 1
                    """)
                    result_fts = conn.execute(query_fts, {"name": product_name}).fetchone()
                    if result_fts and result_fts[6] > 0.5:
                        result = result_fts
                if not result:
                    query_like = text("""
                        SELECT product_name, brand, image_url, price_krw, capacity, ingredients
                        FROM product_data
                        WHERE product_name LIKE :name
                        LIMIT 1
                    """)
                    result_like = conn.execute(query_like, {"name": f"%{product_name}%"}).fetchone()
                    result = result_like
                if result:
                    return {
                        'product_name': result[0],
                        'brand': result[1],
                        'image_url': result[2],
                        'price_krw': result[3],
                        'capacity': result[4],
                        'ingredients': result[5].split(',') if result[5] else []
                    }
                return None
        except Exception as e:
            print(f"DB 검색 오류 (_search_product_by_name): {e}")
            return None
    
    def _fuzzy_search_product(self, clean_search_text: str) -> Optional[Dict[str, Any]]:
        """
        [수정] FTS Top-K (K=5) + difflib.SequenceMatcher 로직
        """
        try:
            with self.engine.connect() as conn:
                # 1. FTS LIMIT 5로 변경
                query = text("""
                    SELECT 
                        product_name, brand, image_url, price_krw, capacity, ingredients,
                        MATCH(product_name) AGAINST(:text IN NATURAL LANGUAGE MODE) as relevance_score
                    FROM product_data
                    WHERE MATCH(product_name) AGAINST(:text IN NATURAL LANGUAGE MODE)
                    ORDER BY relevance_score DESC
                    LIMIT 5 
                """)
                
                results = conn.execute(query, {"text": clean_search_text}).fetchall()
                
                if not results:
                    return None

                # [수정] '깨끗한 검색어'를 비교 기준으로 사용
                search_text_lower = clean_search_text.lower()
                best_match = None
                best_ratio = 0.0

                # 2. [신규] 5개의 후보를 모두 반복하며 최고의 '유사도'를 찾음
                for row in results:
                    product_name_lower = row[0].lower() # DB 제품명
                    
                    # [수정] SequenceMatcher로 문자열 유사도 계산
                    s = difflib.SequenceMatcher(None, search_text_lower, product_name_lower)
                    match_ratio = s.ratio()
                    
                    if match_ratio > best_ratio:
                        best_ratio = match_ratio
                        best_match = row
                
                # 3. [수정] 최고의 '유사도'가 60% 이상일 때만 통과
                if best_match and best_ratio >= 0.6: 
                    print(f"[DEBUG] FTS Best Match Found (SimRatio: {best_ratio:.0%})")
                    return {
                        'product_name': best_match[0],
                        'brand': best_match[1],
                        'image_url': best_match[2],
                        'price_krw': best_match[3],
                        'capacity': best_match[4],
                        'ingredients': best_match[5].split(',') if best_match[5] else []
                    }
                else:
                    print(f"[DEBUG] FTS Failed (Best SimRatio {best_ratio:.0%} < 60%)")
                    return None

        except Exception as e:
            print(f"퍼지 검색 오류 (_fuzzy_search_product): {e}")
            return None
    
    def _query_caution_ingredients(self, ingredients: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """
        [수정]
        1. ML 테이블명: ML_caution_ingredients
        2. ML 테이블 컬럼: korean_name, caution_grade, description
        """
        if not ingredients:
            return {'official': [], 'ml_predicted': []}
        
        try:
            with self.engine.connect() as conn:
                # 1. 파라미터 준비
                placeholders = ','.join([':ing' + str(i) for i in range(len(ingredients))])
                params = {f'ing{i}': ing.strip() for i, ing in enumerate(ingredients)}
                
                # 2. 공식 주의 성분 조회
                official_query = text(f"""
                    SELECT 
                        korean_name,
                        caution_grade,
                        description
                    FROM caution_ingredients
                    WHERE korean_name IN ({placeholders})
                """)
                
                official_results = conn.execute(official_query, params).fetchall()
                official_list = [
                    {
                        'korean_name': row[0],
                        'caution_grade': row[1],
                        'description': row[2]
                    }
                    for row in official_results
                ]
                
                # 3. ML 예측 주의 성분 조회 (공식에 없는 것만)
                official_names = {item['korean_name'] for item in official_list}
                remaining_ingredients = [ing for ing in ingredients if ing not in official_names]
                
                ml_list = []
                if remaining_ingredients:
                    # 4. 남은 성분용 파라미터 준비
                    ml_placeholders = ','.join([':rem' + str(i) for i in range(len(remaining_ingredients))])
                    ml_params = {f'rem{i}': ing.strip() for i, ing in enumerate(remaining_ingredients)}

                    # [수정] 테이블명과 컬럼명 변경
                    ml_query = text(f"""
                        SELECT 
                            korean_name,
                            caution_grade,
                            description
                        FROM ML_caution_ingredients 
                        WHERE korean_name IN ({ml_placeholders})
                    """)
                    
                    try:
                        ml_results = conn.execute(ml_query, ml_params).fetchall()
                        ml_list = [
                            {
                                'korean_name': row[0],
                                'caution_grade': row[1],
                                'description': row[2]
                            }
                            for row in ml_results
                        ]
                    except Exception as e:
                        print(f"ML 주의 성분 조회 오류 (ML_caution_ingredients): {e}")
                        ml_list = [] 
                
                return {
                    'official': official_list,
                    'ml_predicted': ml_list
                }
        except Exception as e:
            print(f"주의 성분 조회 오류: {e}")
            return {'official': [], 'ml_predicted': []}

# ============================================
# 메인 처리 함수 (수정 없음)
# ============================================

def process_cosmetic_image(image_path: str) -> Dict[str, Any]:
    """
    화장품 이미지를 처리하고 분석 결과를 반환합니다.
    """
    ocr_text = extract_text_from_image(image_path)
    
    if not ocr_text:
        return {
            'success': False,
            'error': 'OCR 텍스트 추출 실패',
            'data': None
        }
    
    analyzer = CosmeticAnalyzer()
    result = analyzer.analyze_from_text(ocr_text)
    
    if result:
        return {
            'success': True,
            'error': None,
            'data': result
        }
    else:
        return {
            'success': False,
            'error': '화장품 정보를 찾을 수 없습니다.',
            'data': None
        }

def search_product_by_name(product_name: str) -> Dict[str, Any]:
    """
    제품명으로 직접 검색합니다.
    """
    analyzer = CosmeticAnalyzer()
    result = analyzer.analyze_from_product_name(product_name)
    
    if result:
        return {
            'success': True,
            'error': None,
            'data': result
        }
    else:
        return {
            'success': False,
            'error': '제품을 찾을 수 없습니다.',
            'data': None
        }

def format_analysis_for_chat(analysis_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    [수정] ML 예측 성분 포매팅 로직 수정
    """
    if not analysis_result.get('success'):
        return {
            'text': f"❌ {analysis_result.get('error', '분석 실패')}",
            'image_url': None
        }
    
    data = analysis_result.get('data', {})
    
    output = []
    output.append("## 🧴 화장품 분석 결과\n")
    
    # 제품 정보
    if data.get('source') == 'database':
        output.append(f"**제품명**: {data.get('product_name', 'N/A')}")
        if data.get('brand'):
            output.append(f"**브랜드**: {data['brand']}")
        if data.get('price_krw'):
            output.append(f"**가격**: {data['price_krw']:,}원")
        if data.get('capacity'):
            output.append(f"**용량**: {data['capacity']}")
    elif data.get('source') == 'ocr_direct_analysis':
        output.append("ℹ️ DB에서 제품을 찾지 못했습니다.")
        output.append(f"{data.get('error', 'OCR 텍스트를 기반으로 성분만 분석합니다.')}\n")

    output.append("")
    
    # 주의 성분
    caution = data.get('caution_ingredients', {})
    official = caution.get('official', [])
    ml_predicted = caution.get('ml_predicted', [])
    
    # 1차: 공식 주의 성분
    if official:
        output.append(f"### ⚠️ 주의 성분 ({len(official)}개)")
        output.append("\n**공식 주의 성분:**")
        for ing in official:
            grade = ing.get('caution_grade', 'N/A')
            name = ing.get('korean_name', 'N/A')
            desc = ing.get('description', '')
            output.append(f"- **{name}** (등급: {grade})")
            if desc:
                output.append(f"  {desc}")
        output.append("")
    
    # 공식/ML 모두 없을 때
    if not official and not ml_predicted:
        output.append("### ✅ 주의 성분 없음")
        output.append("이 제품에는 공식 등록된 주의 성분이나 AI 예측 유해 성분이 없습니다.\n")
    # 공식은 없지만 ML은 있을 때
    elif not official and ml_predicted:
        output.append("### ✅ 공식 주의 성분 없음")
        output.append("이 제품에는 공식 등록된 주의 성분이 없습니다.\n")
    
    # 2차: ML 예측 주의 성분 (추가 정보)
    if ml_predicted:
        output.append(f"### 📊 추가로 알아두면 좋을 성분 (AI 예측) ({len(ml_predicted)}개)")
        output.append("*머신러닝 모델로 예측된 비안전 성분입니다.*\n")
        for ing in ml_predicted:
            name = ing.get('korean_name', 'N/A')
            grade = ing.get('caution_grade', 'N/A')
            desc = ing.get('description', '')
            output.append(f"- **{name}** (예측 등급: {grade})")
            if desc:
                output.append(f"  {desc}")
    
    return {
        'text': "\n".join(output),
        'image_url': data.get('image_url')
    }