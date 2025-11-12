# docker/frontend.Dockerfile

# 1) Build
FROM node:20-alpine AS build
WORKDIR /app
COPY ./frontend/package*.json ./
RUN npm ci
COPY ./frontend ./ 
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

# 2) Serve with vite preview
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm i -g vite
EXPOSE 80
# ✅ 프론트 컨테이너 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1
CMD ["vite", "preview", "--host", "0.0.0.0", "--port", "80", "--strictPort"]
