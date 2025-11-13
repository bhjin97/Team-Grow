# backend/routers/ocr.py
# ============================================
# 화장품 OCR 분석 (MVP Router 버전)
# - 프로토타입의 OCR 로직을 그대로 포함
# - FastAPI 라우터를 함께 정의
# ============================================

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse
import os
import io
import re
import difflib
import tempfile
from typing import Dict, List, Optional, Any

from dotenv import load_dotenv, find_dotenv
from google.cloud import vision
from PIL import Image  # 사용 가능성 대비
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from urllib.parse import quote_plus

router = APIRouter(prefix="/ocr", tags=["ocr"])

# ============================================
# DB 연결 (프로토 동일)
# ============================================
def get_engine() -> Engine:
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
# OCR + 검증 (프로토 동일)
# ============================================
def extract_text_from_image(image_path: str) -> Optional[str]:
    try:
        # 1) .env 있으면 로드, 없어도 통과
        base_dir = ""
        try:
            dotenv_path = find_dotenv()
            if dotenv_path:
                load_dotenv(dotenv_path)
                base_dir = os.path.dirname(dotenv_path)
        except Exception:
            pass  # .env 강제 의존 제거

        # 2) 환경변수 우선
        json_path = (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
        if not json_path:
            raise Exception("GOOGLE_APPLICATION_CREDENTIALS not set")

        # 3) 상대경로면 .env 기준으로 보정
        if not os.path.isabs(json_path) and base_dir:
            json_path = os.path.join(base_dir, json_path)

        if not os.path.exists(json_path):
            raise Exception(f"서비스키 파일이 없습니다: {json_path}")

        client = vision.ImageAnnotatorClient.from_service_account_json(json_path)
        with io.open(image_path, "rb") as f:
            content = f.read()
        image = vision.Image(content=content)
        resp = client.document_text_detection(image=image)
        if resp.error.message:
            raise Exception(f"Vision API 오류: {resp.error.message}")
        return resp.full_text_annotation.text
    except Exception as e:
        print(f"OCR 추출 오류: {e}")
        return None

def validate_cosmetic_image(ocr_text: str) -> Dict[str, Any]:
    if not ocr_text or len(ocr_text.strip()) < 10:
        return {
            "is_valid": False, "has_text": False,
            "error_message": "텍스트가 없는 사진입니다.", "match_count": 0
        }
    cosmetic_keywords = [
        "화장품","크림","로션","에센스","세럼","토너","스킨","에멀전","클렌징",
        "마스크","팩","선크림","파운데이션","쿠션","립스틱","샴푸","린스","바디","향수",
        "용량","ml","g","성분","사용법","제조","유통기한","화장품제조업자","화장품책임판매업자",
        "식약처","전성분","ingredients"
    ]
    mc = sum(1 for k in cosmetic_keywords if k.lower() in ocr_text.lower())
    return {
        "is_valid": mc >= 1, "has_text": True, "match_count": mc,
        "error_message": None if mc >= 1 else "화장품 사진이 아닙니다."
    }

# ============================================
# 분석기 (프로토 동일)
# ============================================
class CosmeticAnalyzer:
    def __init__(self):
        self.engine = get_engine()

    def analyze_from_text(self, ocr_text: str) -> Optional[Dict[str, Any]]:
        validation = validate_cosmetic_image(ocr_text)
        if not validation["is_valid"]:
            pass

        lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
        product_candidates: List[str] = []
        STOP = ["사용","펌프","공기","분리배출","플라스틱","전성분","주의","제조","용량","ml","방법","피부","고민"]
        for line in lines[:10]:
            if len(line) < 3 or len(line) > 60:
                continue
            if any(k in line for k in STOP):
                continue
            if len(re.findall(r"[가-힣a-zA-Z]", line)) > len(line) * 0.5:
                product_candidates.append(line)

        product_data = None
        clean_search_text = " ".join(product_candidates)
        print(f"[DEBUG] FTS Search Text: '{clean_search_text}'")
        if clean_search_text:
            product_data = self._fuzzy_search_product(clean_search_text)

        if not product_data:
            print("[DEBUG] FTS Failed. Falling back to LIKE search...")
            for c in product_candidates:
                product_data = self._search_product_by_name(c, use_fts=False)
                if product_data:
                    break

        if not product_data:
            ocr_ingredients = self._extract_ingredients_from_ocr(ocr_text)
            caution = self._query_caution_ingredients(ocr_ingredients)
            return {
                "source":"ocr_direct_analysis",
                "product_name":None,"brand":None,"price_krw":None,"capacity":None,"image_url":None,
                "ingredients": ocr_ingredients, "caution_ingredients": caution,
                "ocr_text": ocr_text, "validation": validation,
                "error":"데이터베이스에서 제품을 찾지 못해 OCR 텍스트로 성분만 분석합니다."
            }

        caution = self._query_caution_ingredients(product_data.get("ingredients", []))
        return {
            "source":"database",
            "product_name": product_data.get("product_name"),
            "brand": product_data.get("brand"),
            "price_krw": product_data.get("price_krw"),
            "capacity": product_data.get("capacity"),
            "image_url": product_data.get("image_url"),
            "ingredients": product_data.get("ingredients", []),
            "caution_ingredients": caution,
            "ocr_text": ocr_text,
            "validation": validation
        }

    def _extract_ingredients_from_ocr(self, ocr_text: str) -> List[str]:
        try:
            m = re.search(r"전성분|ingredients", ocr_text, re.IGNORECASE)
            if m:
                s = ocr_text[m.end():].strip(": \n")
            else:
                s = ocr_text
            return [ing.strip() for ing in re.split(r"[,/\n]", s) if ing.strip() and len(ing.strip()) > 1]
        except Exception:
            return []

    def analyze_from_product_name(self, product_name: str) -> Optional[Dict[str, Any]]:
        pdata = self._search_product_by_name(product_name, use_fts=True)
        if not pdata:
            return None
        caution = self._query_caution_ingredients(pdata.get("ingredients", []))
        return {
            "source":"database",
            "product_name": pdata.get("product_name"),
            "brand": pdata.get("brand"),
            "price_krw": pdata.get("price_krw"),
            "capacity": pdata.get("capacity"),
            "image_url": pdata.get("image_url"),
            "ingredients": pdata.get("ingredients", []),
            "caution_ingredients": caution,
            "ocr_text": None,
            "validation": {"is_valid": True, "has_text": True, "match_count": 0}
        }

    def _search_product_by_name(self, product_name: str, use_fts: bool=True) -> Optional[Dict[str, Any]]:
        try:
            with self.engine.connect() as conn:
                result = None
                if use_fts:
                    q_fts = text("""
                        SELECT product_name,brand,image_url,price_krw,capacity,ingredients,
                               MATCH(product_name) AGAINST(:name IN NATURAL LANGUAGE MODE) AS relevance_score
                        FROM product_data
                        WHERE MATCH(product_name) AGAINST(:name IN NATURAL LANGUAGE MODE)
                        ORDER BY relevance_score DESC
                        LIMIT 1
                    """)
                    r = conn.execute(q_fts, {"name": product_name}).fetchone()
                    if r and r[6] > 0.5:
                        result = r
                if not result:
                    q_like = text("""
                        SELECT product_name,brand,image_url,price_krw,capacity,ingredients
                        FROM product_data
                        WHERE product_name LIKE :name
                        LIMIT 1
                    """)
                    r = conn.execute(q_like, {"name": f"%{product_name}%"}).fetchone()
                    result = r
                if result:
                    return {
                        "product_name": result[0], "brand": result[1], "image_url": result[2],
                        "price_krw": result[3], "capacity": result[4],
                        "ingredients": result[5].split(",") if result[5] else []
                    }
                return None
        except Exception as e:
            print(f"DB 검색 오류 (_search_product_by_name): {e}")
            return None

    def _fuzzy_search_product(self, clean_search_text: str) -> Optional[Dict[str, Any]]:
        try:
            with self.engine.connect() as conn:
                q = text("""
                    SELECT product_name,brand,image_url,price_krw,capacity,ingredients,
                           MATCH(product_name) AGAINST(:text IN NATURAL LANGUAGE MODE) AS relevance_score
                    FROM product_data
                    WHERE MATCH(product_name) AGAINST(:text IN NATURAL LANGUAGE MODE)
                    ORDER BY relevance_score DESC
                    LIMIT 5
                """)
                rows = conn.execute(q, {"text": clean_search_text}).fetchall()
                if not rows:
                    return None
                best = None
                best_ratio = 0.0
                base = clean_search_text.lower()
                for row in rows:
                    name_l = row[0].lower()
                    ratio = difflib.SequenceMatcher(None, base, name_l).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best = row
                if best and best_ratio >= 0.6:
                    print(f"[DEBUG] FTS Best Match Found (SimRatio: {best_ratio:.0%})")
                    return {
                        "product_name": best[0], "brand": best[1], "image_url": best[2],
                        "price_krw": best[3], "capacity": best[4],
                        "ingredients": best[5].split(",") if best[5] else []
                    }
                else:
                    print(f"[DEBUG] FTS Failed (Best SimRatio {best_ratio:.0%} < 60%)")
                    return None
        except Exception as e:
            print(f"퍼지 검색 오류 (_fuzzy_search_product): {e}")
            return None

    def _query_caution_ingredients(self, ingredients: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        if not ingredients:
            return {"official": [], "ml_predicted": []}
        try:
            with self.engine.connect() as conn:
                ph = ",".join([":ing"+str(i) for i in range(len(ingredients))])
                params = {f"ing{i}": ing.strip() for i, ing in enumerate(ingredients)}
                q_off = text(f"""
                    SELECT korean_name, caution_grade, description
                    FROM caution_ingredients
                    WHERE korean_name IN ({ph})
                """)
                off_rows = conn.execute(q_off, params).fetchall()
                official = [{"korean_name":r[0],"caution_grade":r[1],"description":r[2]} for r in off_rows]

                official_names = {x["korean_name"] for x in official}
                remain = [ing for ing in ingredients if ing not in official_names]
                ml_list: List[Dict[str, Any]] = []
                if remain:
                    ph2 = ",".join([":rem"+str(i) for i in range(len(remain))])
                    params2 = {f"rem{i}": ing.strip() for i, ing in enumerate(remain)}
                    q_ml = text(f"""
                        SELECT korean_name, caution_grade, description
                        FROM ML_caution_ingredients
                        WHERE korean_name IN ({ph2})
                    """)
                    try:
                        ml_rows = conn.execute(q_ml, params2).fetchall()
                        ml_list = [{"korean_name":r[0],"caution_grade":r[1],"description":r[2]} for r in ml_rows]
                    except Exception as e:
                        print(f"ML 주의 성분 조회 오류 (ML_caution_ingredients): {e}")
                        ml_list = []
                return {"official": official, "ml_predicted": ml_list}
        except Exception as e:
            print(f"주의 성분 조회 오류: {e}")
            return {"official": [], "ml_predicted": []}

# ============================================
# 포매팅 (프로토 동일)
# ============================================
def format_analysis_for_chat(analysis_result: Dict[str, Any]) -> Dict[str, Any]:
    """마크다운을 카드형으로 예쁘게 구성"""
    if not analysis_result.get("success"):
        return {"text": f"❌ {analysis_result.get('error', '분석 실패')}", "image_url": None}

    data = analysis_result.get("data", {})
    img_url = data.get("image_url") or None
    src = data.get("source")

    out: list[str] = []

    # 1) 제목 + (선택)제품 이미지
    out.append("## 💄 화장품 분석 결과\n")
    if img_url:
        out.append(f"![제품 이미지]({img_url})\n")

    # 2) 제품 기본 정보
    if src == "database":
        name = data.get("product_name", "N/A")
        brand = data.get("brand")
        price = data.get("price_krw")
        cap   = data.get("capacity")

        out.append(f"**제품명:** {name}  ")
        if brand: out.append(f"**브랜드:** {brand}  ")
        if price: out.append(f"**가격:** {price:,}원  ")
        if cap:   out.append(f"**용량:** {cap}  ")
    else:
        out.append("ℹ️ DB에서 제품을 찾지 못했습니다. OCR 텍스트 기반으로 성분만 분석합니다.")

    out.append("\n---\n")

    # 3) 주의 성분 섹션
    caution = data.get("caution_ingredients", {}) or {}
    official = caution.get("official", []) or []
    mlp = caution.get("ml_predicted", []) or []

    # 공식 주의 성분
    if official:
        out.append(f"### ⚠️ 주의 성분 ({len(official)}개)\n")
        for i, ing in enumerate(official, 1):
            name = ing.get("korean_name", "N/A")
            grade = ing.get("caution_grade", "N/A")
            desc = (ing.get("description") or "").strip()
            out.append(f"**{i}️⃣ {name}** (등급: {grade})  ")
            if desc:
                out.append(f"> {desc}")
            out.append("")  # 줄바꿈
        out.append("\n")
    else:
        out.append("### ✅ 공식 주의 성분 없음\n")

    # ML 예측 성분
    if mlp:
        out.append(f"### 📊 추가로 알아두면 좋을 성분 (AI 예측) ({len(mlp)}개)")
        out.append("*머신러닝 모델로 예측된 비안전/주의 성분입니다.*\n")
        for i, ing in enumerate(mlp, 1):
            name = ing.get("korean_name", "N/A")
            grade = ing.get("caution_grade", "N/A")
            desc = (ing.get("description") or "").strip()
            out.append(f"- **{name}** (예측 등급: {grade})")
            if desc:
                out.append(f"  {desc}")
        out.append("\n")

        # ─────────────────────────────────────────
    # 🧾 과학적 요약 (주의 성분 개수·등급·종류 기반)
    # ─────────────────────────────────────────
    def _grade_to_score(g: str) -> float:
        """
        caution_grade를 0~3 점수로 정규화.
        - 문자열 등급 대응 + 숫자(0~10) 대응
        """
        if g is None:
            return 0.0
        s = str(g).strip().lower()

        # 문자열 등급 맵(예시는 프로젝트 상황에 맞게 보정 가능)
        map_str = {
            "저위험": 0.5, "low": 0.5, "낮음": 0.5,
            "중간": 1.5, "보통": 1.5, "moderate": 1.5,
            "주의": 2.0, "주의필요": 2.0, "warning": 2.0,
            "고위험": 3.0, "high": 3.0, "위험": 3.0,
        }
        if s in map_str:
            return map_str[s]

        # 숫자 등급(예: 1~10형식) → 0~3로 스케일링
        if s.replace(".", "", 1).isdigit():
            val = float(s)
            # 보편적인 0~10 스케일을 0~3으로 변환
            return max(0.0, min(3.0, (val / 10.0) * 3.0))

        return 0.0

    def _tag_flags(name: str) -> dict:
        """성분명 키워드로 특성 플래그 추출"""
        n = (name or "").lower()
        return {
            "fragrance": any(k in n for k in ["fragrance", "향료", "퍼퓸", "리모넨", "리날룰", "제라니올", "시트로넬롤"]),
            "alcohol": any(k in n for k in ["alcohol", "에탄올"]),
            "acid": any(k in n for k in ["aha", "bha", "pha", "salicylic", "glycolic", "lactic", "mandelic", "아하", "비하", "살리실"]),
            "retinoid": any(k in n for k in ["retinol", "retinal", "비타민 a"]),
            "oil": any(k in n for k in ["oil", "오일", "essential oil", "정유"]),
            "silicone": any(k in n for k in ["siloxane", "silicone", "디메치콘", "디메티콘"]),
        }

    # 공식/ML 합치되, 신뢰도 가중치 부여(ML은 0.7배)
    weighted = []
    flags_acc = {"fragrance":0, "alcohol":0, "acid":0, "retinoid":0, "oil":0, "silicone":0}

    for ing in official:
        sc = _grade_to_score(ing.get("caution_grade"))
        nm = ing.get("korean_name") or ""
        flags = _tag_flags(nm)
        for k,v in flags.items():
            flags_acc[k] += int(v)
        weighted.append(("official", nm, sc))

    for ing in mlp:
        sc = _grade_to_score(ing.get("caution_grade")) * 0.7  # ML은 신뢰도 70%
        nm = ing.get("korean_name") or ""
        flags = _tag_flags(nm)
        for k,v in flags.items():
            flags_acc[k] += int(v)
        weighted.append(("ml", nm, sc))

    total_cnt = len(weighted)
    avg_score = (sum(x[2] for x in weighted) / total_cnt) if total_cnt else 0.0
    max_score = max([x[2] for x in weighted], default=0.0)

    # 위험도 판단(평균 + 최대치 함께 고려)
    # - max가 높으면 국소 자극 위험, avg가 높으면 전반적 리스크 증가
    if total_cnt == 0:
        risk_level = "낮음"
    else:
        if max_score >= 2.5 or avg_score >= 2.0:
            risk_level = "높음"
        elif max_score >= 1.5 or avg_score >= 1.0:
            risk_level = "중간"
        else:
            risk_level = "낮음"

    # 특성 플래그 문장 생성
    flag_msgs = []
    if flags_acc["fragrance"] > 0:
        flag_msgs.append("향료/에센셜오일 성분 포함")
    if flags_acc["alcohol"] > 0:
        flag_msgs.append("알코올계 성분 포함")
    if flags_acc["acid"] > 0:
        flag_msgs.append("AHA/BHA 등 각질 케어 성분 포함")
    if flags_acc["retinoid"] > 0:
        flag_msgs.append("레티노이드(비타민 A 계열) 포함")
    if flags_acc["oil"] > 0:
        flag_msgs.append("오일 성분 다수")
    if flags_acc["silicone"] > 0:
        flag_msgs.append("실리콘계 성분 포함")

    # 요약 헤더
    out.append("### 🧾 분석 요약")

    # 한줄 핵심
    if total_cnt == 0:
        out.append("공식·AI 예측 기준 **주의 성분이 확인되지 않았습니다**. 전반적으로 안전한 편입니다.\n")
    else:
        out.append(
            f"주의 성분 {total_cnt}개, 평균 위험도 {avg_score:.1f}/3, 최대 위험도 {max_score:.1f}/3 → **종합 위험도: {risk_level}**.\n"
        )

    # 피부 타입별 권장사항(간단 규칙)
    recs = []
    if risk_level == "높음":
        recs.append("민감성 피부는 패치 테스트 후 사용을 권장합니다.")
    elif risk_level == "중간":
        recs.append("민감성·장벽 약한 피부는 사용 전 주의가 필요합니다.")

    if flags_acc["acid"] > 0 or flags_acc["retinoid"] > 0:
        recs.append("각질 케어/레티노이드 성분이 있어 **저녁 위주 사용** 및 **자외선 차단**을 권장합니다.")
    if flags_acc["fragrance"] > 0:
        recs.append("향료 성분에 민감하다면 동일 제품군 내 **무향/저자극 대안**을 고려하세요.")
    if flags_acc["alcohol"] > 0:
        recs.append("건성·민감성 피부는 **알코올 함량**에 유의하세요.")
    if not recs:
        recs.append("일반 피부에는 무난하지만, 개인별 민감도 차이를 고려하세요.")

    out.append("• " + " ".join(recs) + ("\n" if recs else ""))

    # 특성 메타 정보(있을 때만)
    if flag_msgs:
        out.append("**특이사항:** " + ", ".join(flag_msgs) + "\n")


    return {"text": "\n".join(out), "image_url": img_url}


# ============================================
# 메인 처리/검색 (프로토 동일)
# ============================================
def process_cosmetic_image(image_path: str) -> Dict[str, Any]:
    txt = extract_text_from_image(image_path)
    if not txt:
        return {"success": False, "error": "OCR 텍스트 추출 실패", "data": None}
    analyzer = CosmeticAnalyzer()
    res = analyzer.analyze_from_text(txt)
    if res:
        return {"success": True, "error": None, "data": res}
    return {"success": False, "error": "화장품 정보를 찾을 수 없습니다.", "data": None}

def search_product_by_name(product_name: str) -> Dict[str, Any]:
    analyzer = CosmeticAnalyzer()
    res = analyzer.analyze_from_product_name(product_name)
    if res:
        return {"success": True, "error": None, "data": res}
    return {"success": False, "error": "제품을 찾을 수 없습니다.", "data": None}

# ============================================
# FastAPI Endpoints (프론트에서 호출)
# ============================================

@router.post("/upload")
async def ocr_upload(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "image 파일을 업로드해주세요.")
    # 임시 저장
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image.filename or "")[-1]) as tmp:
        content = await image.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = process_cosmetic_image(tmp_path)
        formatted = format_analysis_for_chat(result)
        return JSONResponse({
            "success": result.get("success", False),
            "markdown": formatted.get("text"),
            "image_url": formatted.get("image_url"),
            "raw": result
        })
    finally:
        try: os.remove(tmp_path)
        except: pass

@router.post("/by-name")
async def ocr_by_name(
    product_name_form: Optional[str] = Form(None),
    payload: Optional[dict] = Body(None),
):
    # JSON(product_name) 우선, 없으면 form 값 사용
    product_name = (payload or {}).get("product_name") if payload else None
    if product_name is None:
        product_name = product_name_form

    if not product_name or not product_name.strip():
        raise HTTPException(400, "product_name is required")

    result = search_product_by_name(product_name.strip())
    formatted = format_analysis_for_chat(result)
    return JSONResponse({
        "success": result.get("success", False),
        "markdown": formatted.get("text"),
        "image_url": formatted.get("image_url"),
        "raw": result
    })

@router.get("/health")
def ocr_health():
    return {"ok": True}

@router.post("/analyze-image")
async def analyze_image_alias(image: UploadFile = File(...)):
    # /ocr/upload와 동일 동작을 하도록 그대로 재사용
    return await ocr_upload(image)
