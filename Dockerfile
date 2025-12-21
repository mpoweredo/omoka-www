# Stage 1: Build
FROM node:20.15.1-alpine AS build

WORKDIR /app

# Instalujemy pnpm
RUN npm install -g pnpm

# Kopiujemy pliki zależności
COPY package.json pnpm-lock.yaml ./

# Instalujemy zależności
RUN pnpm install --frozen-lockfile

# Kopiujemy kod źródłowy
COPY . .

# Budujemy statyczne pliki
RUN pnpm run build

# Stage 2: Production - serwujemy przez nginx
FROM nginx:alpine AS runtime

# Kopiujemy konfigurację nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Kopiujemy zbudowane statyczne pliki
COPY --from=build /app/dist /usr/share/nginx/html

# Eksponujemy port
EXPOSE 3021
