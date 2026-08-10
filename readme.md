<a id="readme-top"></a>

# Aller

<div align="center">
  <img src="./images/aller_logo.png" alt="Aller logo" width="200" height="140">
  <h3>자연어 검색과 피부 타입 분석을 결합한 화장품 추천 서비스</h3>
</div>

Aller는 자연어로 입력한 제품 특징과 브랜드·가격·카테고리·성분 조건을 분석해 적합한 화장품을 찾고, 추천 이유를 제공하는 서비스입니다.

<details>
<summary><strong>목차</strong></summary>

- [팀원 및 역할](#팀원-및-역할)
- [1. 프로젝트 소개](#1-프로젝트-소개)
- [2. 핵심 기능](#2-핵심-기능)
- [3. 서비스 화면](#3-서비스-화면)
- [4. 시스템 아키텍처](#4-시스템-아키텍처)
- [5. Hybrid RAG 검색 구조](#5-hybrid-rag-검색-구조)
- [6. 데이터 파이프라인 및 Airflow 자동화](#6-데이터-파이프라인-및-airflow-자동화)
- [7. 주요 기술 선택과 한계](#7-주요-기술-선택과-한계)
- [8. 기술 스택](#8-기술-스택)
- [9. 데이터 모델](#9-데이터-모델)
- [10. 실행 방법](#10-실행-방법)

</details>

## 팀원 및 역할

| 팀원 | 담당 영역 |
| --- | --- |
| <img src="./images/member_bhj.png" width="64" height="64" alt="배형진"><br>**배형진** | 팀 리더·백엔드, 전성분을 제외한 제품·리뷰 데이터 파이프라인, 이정석과 Hybrid RAG 및 Pinecone 검색 구조 공동 설계·통합, Docker/ECR 배포 구성 |
| <img src="./images/member_kjh.png" width="64" height="64" alt="김지희"><br>**김지희** | 프론트엔드·데이터 분석, React·Next.js UI/UX, 추천 루틴 설계 |
| <img src="./images/member_leeu.png" width="64" height="64" alt="이은영"><br>**이은영** | 프론트엔드·데이터 분석, 문서화, 추천 루틴 설계, 테스트 시나리오 작성 |
| <img src="./images/member_ljs.png" width="64" height="64" alt="이정석"><br>**이정석** | 백엔드, 데이터 파이프라인, Pinecone 임베딩·유사도 계산, 배형진과 Hybrid RAG 및 Pinecone 검색 구조 공동 설계·통합 |
| <img src="./images/member_psj.png" width="64" height="64" alt="박상준"><br>**박상준** | 발표·문서화, 성분 DB 구축, 피부 타입 점수 계산, README 정리 |

## 1. 프로젝트 소개

Pinecone의 의미 검색과 MariaDB의 조건 검색을 결합해 자연어 요청에 맞는 상품 후보를 탐색합니다. 설문으로 분석한 바우만 피부 타입과 제품 정보를 이용한 적합도 계산, 이미지 OCR을 이용한 제품 분석도 함께 제공합니다.

향수 추천, 계절·시간대별 케어 루틴, 상품과 리뷰 추이 시각화 기능을 통해 검색 이후의 제품 탐색을 지원합니다.

## 2. 핵심 기능

- **Hybrid RAG 기반 화장품 검색 및 AI 채팅**<br>
  자연어 질의에서 제품 특징과 구조화 조건을 분석하고, Pinecone 의미 검색과 MariaDB 조건 검색을 조합합니다. 검색된 후보 상품과 관련 데이터를 추천 카드와 AI 응답에 활용합니다.

- **바우만 피부 타입 분석 및 제품 적합도 계산**<br>
  설문 결과를 바탕으로 회원의 바우만 피부 타입을 분석합니다. 피부 타입별 가중치와 제품 성분 정보를 이용해 제품별 적합도를 계산합니다.

- **OCR 기반 제품 인식 및 기능 연계**<br>
  화장품 이미지에서 제품·성분 정보를 인식합니다. 피부 분석 화면에서는 회원의 피부 타입에 따른 제품 적합도를 계산하고, AI 채팅 화면에서는 인식 결과를 제품·성분 안내에 활용합니다.

### 부가 기능

- 사용자 선택을 반영한 향수 추천
- 계절·시간대·키워드 기반 케어 루틴 추천
- 상품별 리뷰 수 추이와 인기 상품 시각화

## 3. 서비스 화면

![Aller service screens](./images/product_screenshot.png)

<!-- 대표 서비스 화면 추가 예정 -->

## 4. 시스템 아키텍처

<div align="center">
  <img src="./images/architecture.png" alt="Aller system architecture" width="900px">
</div>

- **Frontend**: React와 Vite 기반 사용자 인터페이스
- **Backend**: FastAPI 기반 추천·OCR·피부 분석 API
- **MariaDB**: 상품, 성분, 브랜드, 사용자 등 관계형 데이터 관리
- **Pinecone**: 상품 특징 임베딩을 이용한 의미 검색
- **Application memory**: `/recommend`와 `/finalize` 사이의 검색 후보 임시 보관
- **Deployment**: GitHub Actions를 이용한 frontend/backend 이미지 빌드와 AWS ECR push, Docker Compose 실행 구성

## 5. Hybrid RAG 검색 구조

사용자 질의에서 제품 특징과 구조화 조건을 분리한 뒤, 조건 조합에 따라 검색 경로를 선택합니다.

```mermaid
flowchart TD
    A["사용자 질의"] --> B["의도·검색 조건 분석"]
    B -->|"일반 질의"| C["일반 응답"]
    B -->|"상품 검색"| D{"특징·필터 조합"}
    D -->|"특징만"| E["Pinecone 검색"]
    E --> F["rdb_fetch_by_pids로 상품 정보 조회"]
    D -->|"특징 + 필터"| G["Pinecone 후보 검색"]
    G --> H["rdb_filter로 조건 적용"]
    D -->|"강한 복합 필터"| I["rdb_filter로 후보 축소"]
    I --> J["후보 벡터 유사도 재정렬"]
    D -->|"필터만"| K["rdb_filter로 조회"]
    F --> L["후보 정렬"]
    H --> L
    J --> L
    K --> L
    L --> M["recommend API: 상품 카드와 cache_key"]
    M --> N["메모리 캐시"]
    N --> O["finalize API: 추천 이유 스트리밍"]
```

| 질의 조건 | 검색 흐름 |
| --- | --- |
| 상품 특징만 존재 | Pinecone 검색 후 `rdb_fetch_by_pids()`로 상품 정보 조회 |
| 특징과 구조화 조건이 함께 존재 | Pinecone 후보에 `rdb_filter()`로 브랜드·성분·가격·카테고리 조건 적용 |
| 특징과 모든 주요 필터가 존재 | MariaDB에서 후보를 먼저 줄인 뒤 후보 벡터의 유사도로 재정렬 |
| 구조화 조건만 존재 | `rdb_filter()`로 MariaDB 조회 |

`/recommend`는 상품 후보와 `cache_key`를 반환하고 검색 결과를 메모리에 임시 저장합니다. `/finalize`는 캐시된 후보를 우선 사용해 추천 이유를 스트리밍하며, 캐시가 없으면 검색을 다시 수행합니다.

## 6. 데이터 파이프라인 및 Airflow 자동화

Airflow 파이프라인을 별도로 구현해 상품 데이터 수집부터 MariaDB 갱신까지 주간 단위로 자동화했습니다. 해당 DAG와 크롤러 코드는 현재 공개 저장소에 포함되어 있지 않습니다.

`4개 카테고리 크롤링 → MariaDB stage 적재 → 상품명 정제·중복 통합 → 상품 upsert → 주간 리뷰 수 이력 upsert`

- `weekly_product_pipeline`은 매주 월요일 오전 10시(KST)에 실행됩니다.
- 스킨/토너, 에센스/세럼/앰플, 크림, 선크림을 페이지 범위에 따라 7개 Playwright 크롤링 task로 나눕니다.
- 크롤링 task는 `Olive_pool`을 사용하며, 7개 task가 모두 성공한 뒤 `upsert_master`를 실행합니다.
- 정제된 상품명의 SHA-256 기반 식별자로 중복 데이터를 통합하고 `INSERT ... ON DUPLICATE KEY UPDATE`로 갱신합니다.
- 상품별 리뷰 수를 제품 ID와 연결해 주간 이력으로 저장합니다.

| 구분 | 처리 내용 | Airflow 자동화 |
| --- | --- | :---: |
| 상품 수집 | 4개 카테고리 상품 상세 정보 수집 | O |
| 상품 정제 | 상품명 정제 및 중복 통합 | O |
| MariaDB | stage 및 상품 데이터 upsert | O |
| 리뷰 이력 | 상품별 주간 리뷰 수 갱신 | O |
| 리뷰 본문 수집 | 현재 DAG의 처리 범위 아님 | X |
| 임베딩 생성 | 현재 DAG의 처리 범위 아님 | X |
| Pinecone upsert | 현재 DAG의 처리 범위 아님 | X |

현재 DAG에는 자동 재시도와 실패 데이터 복구 로직이 적용되어 있지 않습니다.

## 7. 주요 기술 선택과 한계

### 검색 경로 분리

특징 중심 질의는 Pinecone에서 의미 기반으로 검색하고, 가격·브랜드·카테고리·성분처럼 정확한 조건은 MariaDB에서 처리합니다. 주요 조건이 모두 포함된 질의는 MariaDB 후보를 먼저 제한한 뒤 해당 후보의 벡터 유사도로 순서를 조정합니다.

### 동적 페이지 수집과 중복 갱신

상품 페이지의 탭 클릭, 스크롤, selector 대기와 페이지네이션을 처리하기 위해 Playwright를 사용했습니다. 수집 결과는 stage 테이블에 적재하고, 정제된 상품명을 기준으로 통합한 뒤 upsert합니다.

### 현재 한계

- 정제된 상품명만으로 hash ID를 생성하므로 브랜드나 용량이 다른 동명 상품이 합쳐질 수 있습니다.
- 일부 페이지·상품 오류를 건너뛰기 때문에 부분 수집 상태에서도 크롤링 task가 성공할 수 있습니다.
- 상품과 리뷰 이력 upsert는 하나의 transaction으로 묶여 있지 않습니다.
- Airflow DAG에는 자동 재시도와 Pinecone upsert가 포함되어 있지 않습니다.

## 8. 기술 스택

### Frontend

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

### Backend

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)
![Google Cloud Vision](https://img.shields.io/badge/Google_Cloud_Vision-4285F4?style=flat-square&logo=googlecloud&logoColor=white)

### AI · RAG

![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![Pinecone](https://img.shields.io/badge/Pinecone-000000?style=flat-square&logo=pinecone&logoColor=white)

### Data Pipeline · Database

![Apache Airflow](https://img.shields.io/badge/Apache_Airflow-017CEE?style=flat-square&logo=apacheairflow&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=flat-square&logo=mariadb&logoColor=white)

### Infrastructure · Deployment

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![AWS ECR](https://img.shields.io/badge/AWS_ECR-FF9900?style=flat-square&logo=amazonaws&logoColor=white)

## 9. 데이터 모델

![Aller ERD](./images/ERD.png)

Hybrid RAG 추천 검색은 `product_data_chain`과 상품·성분 관계 데이터를 사용합니다. 피부 타입 기반 적합도 계산과 일반 상품 조회에는 `product_data`를 사용합니다. 별도 Airflow 파이프라인의 stage 및 리뷰 이력 테이블은 현재 공개 저장소의 애플리케이션 모델에 포함되어 있지 않습니다.

## 10. 실행 방법

### 1. 저장소 클론 및 Python 환경 구성

```bash
git clone https://github.com/bhjin97/Team-Grow.git
cd Team-Grow
conda env create -f environment.yml
conda activate grow
```

### 2. Backend 실행

```bash
cd backend
uvicorn main:app --reload
```

Backend는 사용하는 기능에 따라 MariaDB, OpenAI, Pinecone, Google Cloud Vision 관련 환경변수와 인증 정보가 필요합니다. 실제 비밀값은 저장소에 포함하지 않습니다.

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

필요한 경우 `VITE_API_BASE`로 Backend 주소를 지정합니다. 별도 Airflow 파이프라인은 현재 저장소의 기본 실행 절차에 포함되지 않습니다.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
