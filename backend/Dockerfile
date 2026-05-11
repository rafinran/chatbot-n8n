FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app
 
COPY package*.json ./
RUN npm install
 
COPY prisma ./prisma
RUN npx prisma generate
 
COPY . .
RUN mkdir -p uploads
 
CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node src/index.js"]
