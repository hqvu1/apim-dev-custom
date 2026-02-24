# ---------- build stage ----------
FROM node:20-alpine AS builder

# Install security updates and basic tools
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --frozen-lockfile --prefer-offline --no-audit

# Copy source code (including public folder and BFF)
COPY . .

# Install BFF dependencies (will be copied to runtime later)
WORKDIR /app/bff
COPY bff/package*.json ./
RUN npm ci --frozen-lockfile --prefer-offline --no-audit

# Back to main app directory for frontend build
WORKDIR /app

# NOTE: Build automatically uses .env.production for VITE_* variables
# Vite embeds these at build time - they become hardcoded in the JS bundle
# To override, pass --build-arg VITE_VARIABLE_NAME=value to docker build
# Runtime variables (non-VITE_*) are set via Container App environment

# Verify public assets are present before build
RUN ls -la public/ && echo "Found $(ls public/ | wc -l) files in public folder"

# Build the Vite React app
# Support Docker BuildKit secrets for potentially sensitive build-time values
# Note: For SPAs, build-time env vars are embedded in the bundle
# Use secrets only when absolutely necessary (e.g., API keys for build-time operations)
# Skip TypeScript type checking for faster builds (use: npx vite build)
RUN --mount=type=secret,id=buildenv,required=false \
    if [ -f /run/secrets/buildenv ]; then \
        echo "Loading additional build environment from secrets..." && \
        set -a && . /run/secrets/buildenv && set +a; \
    fi && \
    npx vite build --mode production

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

# ---------- runtime stage ----------
FROM nginx:alpine AS runtime

# Install security updates, Node.js for BFF, and process management tools
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    nodejs \
    npm \
    supervisor

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy entrypoint to render template with env vars
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor.d/services.ini

# Copy built frontend from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy BFF service
COPY --from=builder /app/bff /app/bff
COPY --from=builder /app/bff/package*.json /app/bff/

# Install BFF production dependencies
WORKDIR /app/bff
RUN npm ci --omit=dev --frozen-lockfile --prefer-offline --no-audit

# Back to root for supervisor setup
WORKDIR /

# Use existing nginx user and fix permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /app/bff && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Note: supervisor runs as root to manage processes, but nginx and node run as nginx user

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Expose port (only nginx port, BFF is internal)
EXPOSE 8080

# Use dumb-init for proper signal handling in containers
ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]

# Start both services via supervisor
CMD ["supervisord", "-c", "/etc/supervisor.d/services.ini", "-n"]
