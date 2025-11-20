<!-- Improved compatibility of back to top link -->
<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/Team-Alere/Alere">
    <img src="./images/aller_logo.png" alt="Logo" width="200" height="140">
  </a>

<h3 align="center">💄 Alere — 챗봇 기반 화장품 상담 서비스</h3>

  <p align="center">
    AI가 통합한 데이터(수천 개 리뷰 + 상품, 성분 분석 + 효능 데이터)를 통해 화장품 성분 분석 및 구매 가이드를 제공하는 플랫폼 
  </p>
</div>

---

<details>
  <summary>📋 Table of Contents</summary>

  - <a href="#team-members">Team Members</a>
  - <a href="#about-the-project">About The Project</a>
  - <a href="#built-with">Built With</a>
  - <a href="#key-features">Key Features</a>
  - <a href="#system-architecture">System Architecture</a>
  - <a href="#erd">ERD</a>
  - <a href="#getting-started">Getting Started</a>
  - <a href="#usage">Usage</a>
  - <a href="#contact">Contact</a>

</details>

---

<a id="team-members"></a>
## 👥 Team Members

<div align="center">

| <img src="./images/member_bhj.png" width="120" height="120"> | <img src="./images/member_kjh.png" width="120" height="120"> | <img src="./images/member_leeu.png" width="120" height="120"> | <img src="./images/member_ljs.png" width="120" height="120"> | <img src="./images/member_psj.png" width="120" height="120"> |
|:--:|:--:|:--:|:--:|:--:|
| 🧠 **배형진**<br>팀 리더 / 백엔드 | 💻 **김지희**<br>프론트엔드 / 데이터 분석 | 🧾 **이은영**<br>프론트엔드 / 데이터 분석 | ⚙️ **이정석**<br>백엔드 | 🎤 **박상준**<br>발표자 / 문서화 |
| FastAPI · 데이터 파이프라인 · AI 모델 연동 · 배포 | React · Next.js · UI/UX · 추천 루틴 설계 | 문서 · 추천 루틴 설계 · 테스트 시나리오 작성 | 데이터 파이프라인 · Pinecone 임베딩 · 유사도 계산 | 성분 DB 구축 · 피부타입 점수 계산 · README 정리 |

</div>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<a id="about-the-project"></a>
## 🧠 About The Project

> **Alere**는 사용자의 피부 타입, 성분 분석, 리뷰 기반 데이터 시각화를 통해  
> “피부에 맞는 화장품과 향수, 케어 루틴을 자동 추천하는 AI 기반 플랫폼”입니다.  

💧 바우만 피부타입 분석 + 📷 성분 추출(OCR) + 🔍 실시간 상담 챗팅 +  
💡 가상 피부 시뮬레이션 + 맞춤형 루틴 추천까지 한 번에 제공합니다.

![Product Screenshot][Product Screenshot]

[Product Screenshot]: ./images/product_screenshot.png

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<a id="built-with"></a>
## ⚙️ Built With

이 프로젝트는 여러 최신 기술 스택을 통합하여 구성되었습니다.

* ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
* ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
* ![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
* ![Airflow](https://img.shields.io/badge/Airflow-017CEE?style=for-the-badge&logo=apache-airflow&logoColor=white)
* ![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white)
* ![Pinecone](https://img.shields.io/badge/Pinecone-00A0DC?style=for-the-badge&logo=pinecone&logoColor=white)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<a id="key-features"></a>
## 🌟 Key Features

| 기능명 | 설명 |
|--------|------|
| 🧬 가상피부 시뮬레이션 | 사용자의 피부 타입(바우만 피부타입)을 기반으로 화장품 성분 즉시 비교 분석, 객관적인 점수로 반환 |
| 💐 맞춤 향수 추천 | 사용자 선택 기반 향 성분 매칭을 통한 맞춤형 향수 추천 |
| 💧 맞춤 케어 루틴 추천 | 계절, 시간대별, 사용사 선택 키워드 반영한 루틴을 추천 |
| 🔍 피부타입 간단 진단 | 설문 기반 바우만 피부타입 간이 테스트 |
| 📊 리뷰 기반 시각화 | 리뷰 데이터를 이용한 인기 제품 탐색, 리뷰 증가율 및 평점 기반 랭킹 시각화 |
| ⚡ 실시간 화장품 AI 추천 | Pinecone 벡터 검색 기반 유사 제품 실시간 추천 |
| 🧾 OCR 연동 성분 분석 | 사진 업로드 → 성분 자동 추출 → 주의성분 색상 표시 |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<a id="system-architecture"></a>
## 🏗 System Architecture

```text
[사용자]
   ↓ (React / Next.js)
[프론트엔드]
   ↓ REST API
[FastAPI 백엔드] ──▶ [AI 분석 모듈 (Python, Pinecone)]
   ↓
[MariaDB / Airflow 파이프라인]

Airflow : 매주 목요일, 리뷰 트렌드 데이터 자동 수집 및 분석
Pinecone : 성분 유사도 기반 실시간 추천
Next.js + React : 클라이언트 UI 및 대시보드
FastAPI : 모델 연동 및 API 게이트웨이 
```
![System Architecture][System Architecture]

[System Architecture]: ./images/system_architecture.png

<p align="right">(<a href="#readme-top">back to top</a>)</p>
--- 

<a id="erd"></a>
## 🕸️ ERD

![ERD][erd]

[erd]: ./images/ERD.png

---

<a id="getting-started"></a>
## 🚀 Getting Started

#### 1. 저장소 클론
git clone https://github.com/Team-Alere/Alere.git
cd Alere

#### 2. 백엔드 설치
pip install -r requirements.txt

#### 3. 프론트엔드 설치
cd frontend
npm install

---

<a id="usage"></a>
## 💻 Usage

#### 백엔드 실행
uvicorn main:app --reload

#### 프론트엔드 실행
npm run dev
브라우저에서 http://localhost:5173 접속 후
피부타입 분석, OCR 분석, 맞춤 추천 기능을 바로 체험할 수 있습니다.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<a id="contact"></a>
## 📫 Contact
Team Alere
문의: team.alere@gmail.com
프로젝트 링크: https://github.com/Team-Alere/Alere

<p align="right">(<a href="#readme-top">back to top</a>)</p>