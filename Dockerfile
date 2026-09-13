FROM node:20-bookworm-slim AS base
WORKDIR /app
# Debian (glibc) بدل Alpine (musl) - ثنائي Chromium الخاص بـPlaywright (تصدير PDF) غير متوافق مع musl.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
# يثبّت متصفح Chromium + كل مكتبات النظام المطلوبة له (تصدير PDF - src/lib/services/pdfExport.ts).
RUN npx playwright install --with-deps chromium
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["npm", "run", "start"]
