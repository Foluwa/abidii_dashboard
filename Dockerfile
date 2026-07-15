# Multi-stage build for Next.js Dashboard
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure .env.production is present for Next.js build
# (NEXT_PUBLIC_* vars are baked into the JS at build time)
RUN if [ ! -f .env.production ]; then echo "Warning: .env.production not found"; fi

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time public env vars (baked into the JS bundle). The admin token is
# deliberately NOT here — it's attached server-side only, by the /api/admin/*
# proxy route, from the non-NEXT_PUBLIC_ ADMIN_MONITORING_TOKEN env var. A
# NEXT_PUBLIC_-prefixed copy must never exist here again: Next.js inlines it
# into the client bundle at build time regardless of whether any code path
# references it.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
