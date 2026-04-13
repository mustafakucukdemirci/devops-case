# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Build-time variable: empty in K8s (nginx proxies), set to http://localhost:5050 for local dev
ARG REACT_APP_API_URL=""
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

COPY --from=builder /app/build /usr/share/nginx/html

# React Router için tüm route'ları index.html'e yönlendir
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
