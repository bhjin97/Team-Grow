# docker/backend.Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend

# 시스템 의존 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 파이썬 의존성
COPY ./backend/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

# 애플리케이션 복사
COPY ./backend /app/backend

EXPOSE 8000

# 기본 동시성: workers=2, timeout=60 (필요 시 ENV로 조절)
ENV GUNICORN_WORKERS=2 \
    GUNICORN_TIMEOUT=60

# gunicorn + uvicorn workers
CMD ["bash", "-lc", "exec gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS} --timeout ${GUNICORN_TIMEOUT}"]
