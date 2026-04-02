# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl postgresql-client
# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/index.js ./

# Prune node_modules to ensure only production deps remain
RUN npm prune --production

EXPOSE 3000
CMD ["node", "index.js"]
