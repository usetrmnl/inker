# All-in-one Dockerfile for Inker
# Bundles: frontend (nginx), backend (bun/nestjs), PostgreSQL 17, Redis 8

# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY frontend/ .
RUN bun run build

# =============================================================================
# Stage 2: Install backend production dependencies
# =============================================================================
FROM oven/bun:1-slim AS backend-install

WORKDIR /app

# Node.js binary for Prisma generate (bun segfaults with Prisma CLI)
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock* ./
COPY backend/prisma ./prisma/

# Install all deps → generate prisma → reinstall production-only → prune
RUN bun install --frozen-lockfile && \
    node ./node_modules/prisma/build/index.js generate && \
    cp -r node_modules/.prisma /tmp/.prisma && \
    rm -rf node_modules && \
    bun install --production --frozen-lockfile && \
    cp -r /tmp/.prisma node_modules/.prisma && \
    rm -rf /tmp/.prisma \
    node_modules/typescript \
    node_modules/@types && \
    # Prune unnecessary files from production node_modules
    find node_modules \( \
        -name "*.md" -o -name "*.map" -o -name "CHANGELOG*" -o \
        -name "README*" -o -name "LICENSE*" -o -name "*.d.ts" -o \
        -name "*.test.*" -o -name "*.spec.*" -o \
        -name "__tests__" -o -name "docs" -o -name ".github" -o \
        -name "example" -o -name "examples" -o -name ".npmignore" -o \
        -name "tsconfig.json" -o -name ".eslintrc*" -o -name ".prettierrc*" \
    \) -exec rm -rf {} + 2>/dev/null || true && \
    # Remove swagger UI (not needed in production)
    rm -rf node_modules/swagger-ui-dist && \
    # Remove musl variants of sharp (only glibc needed on Debian)
    rm -rf node_modules/@img/sharp-libvips-linuxmusl-x64 \
           node_modules/@img/sharp-linuxmusl-x64

# =============================================================================
# Stage 3: Build backend
# =============================================================================
FROM oven/bun:1-slim AS backend-builder

WORKDIR /app

COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY backend/prisma ./prisma/
RUN node ./node_modules/prisma/build/index.js generate

COPY backend/ .
RUN bun run build

# =============================================================================
# Stage 4: Production (all-in-one)
# =============================================================================
FROM debian:trixie-slim AS production

ARG S6_OVERLAY_VERSION=3.2.1.0

# Install all system packages in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    # PostgreSQL
    postgresql-17 \
    # Redis
    redis-server \
    # Nginx
    nginx \
    # Chrome headless shell dependencies
    wget ca-certificates openssl unzip \
    fonts-liberation fontconfig \
    libnss3 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 \
    libgbm1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libasound2t64 libcups2t64 libatk1.0-0t64 libnspr4 libdbus-1-3 \
    # s6-overlay dependencies
    xz-utils \
    && \
    # Install Chrome Headless Shell
    CHROME_VERSION=$(wget -qO- "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_STABLE") && \
    wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-headless-shell-linux64.zip" -O /tmp/chrome.zip && \
    unzip /tmp/chrome.zip -d /opt/ && \
    chmod +x /opt/chrome-headless-shell-linux64/chrome-headless-shell && \
    rm /tmp/chrome.zip && \
    # Strip Chrome: remove GPU libs (--disable-gpu), keep only en-US locale, remove hyphen data
    rm -f /opt/chrome-headless-shell-linux64/libEGL.so \
          /opt/chrome-headless-shell-linux64/libGLESv2.so \
          /opt/chrome-headless-shell-linux64/libvk_swiftshader.so \
          /opt/chrome-headless-shell-linux64/libvulkan.so.1 \
          /opt/chrome-headless-shell-linux64/vk_swiftshader_icd.json \
          /opt/chrome-headless-shell-linux64/LICENSE.headless_shell && \
    find /opt/chrome-headless-shell-linux64/locales -type f ! -name 'en-US.pak' -delete && \
    rm -rf /opt/chrome-headless-shell-linux64/hyphen-data && \
    # Install s6-overlay
    wget -q "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" -O /tmp/s6-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-noarch.tar.xz && \
    wget -q "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz" -O /tmp/s6-x86_64.tar.xz && \
    tar -C / -Jxpf /tmp/s6-x86_64.tar.xz && \
    rm /tmp/s6-noarch.tar.xz /tmp/s6-x86_64.tar.xz && \
    # Install PostgreSQL 15 from PGDG for data migration (15→17) support
    # Existing users upgrading from bookworm need PG 15 binaries to dump their data
    echo "deb http://apt.postgresql.org/pub/repos/apt trixie-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget -qO /etc/apt/trusted.gpg.d/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends postgresql-15 >/dev/null 2>&1 && \
    rm -rf /var/lib/postgresql/15 /etc/apt/sources.list.d/pgdg.list && \
    # Remove build-only tools normally
    apt-get purge -y unzip xz-utils wget && apt-get autoremove -y && \
    # Force-remove transitive deps not needed at runtime
    # (bypass dependency checks to avoid cascading removal of postgresql/chrome)
    dpkg --purge --force-depends \
    libllvm19 libz3-4 libperl5.40 perl perl-modules-5.40 \
    libavahi-client3 libavahi-common-data libavahi-common3 \
    libelf1t64 libc-l10n locales \
    2>/dev/null || true && \
    rm -rf /var/lib/apt/lists/* /var/log/dpkg.log /var/log/apt && \
    # Remove system locales and unused data (keep only C/POSIX and en_US)
    rm -rf /usr/share/locale /usr/share/i18n /usr/share/doc /usr/share/man \
           /usr/share/info /usr/share/lintian /usr/share/X11/xkb \
           /var/cache/debconf/*-old && \
    # Remove auto-created PostgreSQL cluster (will be initialized on first run)
    rm -rf /var/lib/postgresql/17/main/*

# Install Bun runtime (copy from build image)
COPY --from=oven/bun:1-slim /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Puppeteer configuration
ENV PUPPETEER_EXECUTABLE_PATH=/opt/chrome-headless-shell-linux64/chrome-headless-shell
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Application environment defaults
ENV NODE_ENV=production \
    PORT=3002 \
    DATABASE_URL=postgresql://inker_user:inker_password@localhost:5432/inker_db \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    REDIS_PASSWORD=inker_redis \
    REDIS_URL=redis://:inker_redis@localhost:6379 \
    ADMIN_PIN="1111" \
    CORS_ORIGINS=* \
    LOG_LEVEL=info

# Set up application directory
WORKDIR /app

# Copy backend production dependencies
COPY --from=backend-install /app/node_modules ./node_modules

# Copy Prisma schema and generated client
COPY backend/prisma ./prisma/
COPY --from=backend-install /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-install /app/node_modules/@prisma ./node_modules/@prisma

# Copy backend build
COPY --from=backend-builder /app/dist ./dist
COPY backend/package.json ./

# Copy backend font assets
COPY backend/assets/fonts /app/assets/fonts

# Copy frontend build to nginx html directory
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy frontend font files
COPY frontend/public/fonts /usr/share/nginx/html/fonts

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Copy s6-overlay service definitions
COPY docker/cont-init.d/ /etc/cont-init.d/
COPY docker/services.d/ /etc/services.d/
RUN chmod +x /etc/cont-init.d/* && \
    chmod +x /etc/services.d/*/run

# Create required directories
RUN mkdir -p /app/uploads/screens /app/uploads/firmware /app/uploads/widgets \
    /app/uploads/captures /app/uploads/drawings /app/logs \
    /data /var/lib/postgresql/17/main /run/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql

# Create non-root user for backend process
RUN useradd --system --no-create-home --shell /usr/sbin/nologin inker && \
    chown -R inker:inker /app

EXPOSE 80

# Health check via nginx
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD bun -e "const r=await fetch('http://127.0.0.1/health');process.exit(r.ok?0:1)" || exit 1

# s6-overlay entrypoint
ENTRYPOINT ["/init"]
