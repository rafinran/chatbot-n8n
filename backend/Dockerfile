# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled JS from builder (dist/ already contains index.js, db.js, routes/, middleware/)
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads

# Run migrations and seed, then start the app
CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/index.js"]
