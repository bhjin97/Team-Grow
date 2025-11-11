# docker/backend.Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 시스템 의존 패키지 (필요 최소)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 루트의 requirements 파일을 그대로 사용 (현재 구조 유지)
COPY ./requirements /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# 애플리케이션 복사
COPY ./backend /app/backend

# 기본 포트
EXPOSE 8000

# 헬스체크용 엔드포인트가 없다면 uvicorn만 띄워도 무방
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
