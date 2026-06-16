FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev --workspace backend

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init reaps zombies and forwards SIGTERM, which the graceful
# shutdown in index.js depends on.
RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node backend ./backend

USER node
WORKDIR /app/backend
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
