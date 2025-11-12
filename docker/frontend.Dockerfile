# docker/frontend.Dockerfile

# 1) Build
FROM node:20-alpine AS build
WORKDIR /app
COPY ./frontend/package*.json ./
RUN npm ci
COPY ./frontend ./
# API 엔드포인트 주입 (Actions에서 --build-arg로 넣음)
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

# 2) Serve with vite preview (no Nginx)
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
# vite preview가 dist를 서빙
RUN npm i -g vite
EXPOSE 80
CMD ["vite", "preview", "--host", "0.0.0.0", "--port", "80", "--strictPort"]
