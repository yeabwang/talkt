# syntax=docker/dockerfile:1

FROM node:22-slim AS base

RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

# Pre-download LiveKit plugin assets such as turn detector / VAD files. The
# command discovers installed @livekit/agents-plugin-* packages without loading
# the worker source.
RUN npx livekit-agents download-files

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runtime

ARG UID=10001
RUN adduser \
  --disabled-password \
  --gecos "" \
  --home "/app" \
  --shell "/sbin/nologin" \
  --uid "${UID}" \
  appuser

COPY --from=build --chown=appuser:appuser /app/package.json /app/package-lock.json ./
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist

USER appuser
ENV NODE_ENV=production

CMD ["node", "dist/index.js", "start"]
