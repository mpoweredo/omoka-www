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

# Budujemy aplikację
RUN pnpm run build

# Stage 2: Production - uruchamiamy serwer Node.js
FROM node:20.15.1-alpine AS runtime

WORKDIR /app

# Kopiujemy zbudowaną aplikację
COPY --from=build /app/dist ./dist

# Ustawiamy port (Astro node adapter domyślnie używa 4321)
ENV HOST=0.0.0.0
ENV PORT=3021

# Eksponujemy port
EXPOSE 3021

# Uruchamiamy serwer
CMD ["node", "./dist/server/entry.mjs"]
