# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app
 
# this variable setting provides us it will be http://localhost:5050 on local development, and empty in kubernetes&nginx proxies 
ARG REACT_APP_API_URL=""
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# Stage 2: we built react so we have static files now, we will serve those static whiles with this method.
FROM nginx:stable-alpine

COPY --from=builder /app/build /usr/share/nginx/html

# Override main nginx.conf — moves pid and temp paths to /tmp (writable by UID 101)
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
