# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs \
  && mkdir -p uploads/attachments \
  && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
