FROM node:20-alpine

WORKDIR /app

# Install necessary packages
RUN apk add --no-cache openssl postgresql-client

COPY package*.json ./
RUN npm ci --quiet --no-audit

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "index.js"]
