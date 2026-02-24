# ---------- build stage ----------
FROM node:20-alpine AS builder

# Install security updates and basic tools
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --frozen-lockfile --prefer-offline --no-audit

# Copy source code (including public folder)
COPY . .

# Build arguments are now OPTIONAL - .env.production is used by default
# Only pass --build-arg if you need to override specific values
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_EXTERNAL_TENANT_ID
ARG VITE_WORKFORCE_TENANT_ID
ARG VITE_CIAM_HOST
ARG VITE_KPS_URL
ARG VITE_LOGIN_SCOPES
ARG VITE_LOGOUT_MODE
ARG VITE_USE_MOCK_AUTH
ARG VITE_PUBLIC_HOME_PAGE
ARG VITE_PORTAL_API_BASE
ARG VITE_PORTAL_API_SCOPE
ARG VITE_DEFAULT_LOCALE
ARG VITE_AEM_LOGOUT_URL
ARG VITE_CDN_ICON
ARG VITE_BASE_URL

# Set as ENV only if provided (otherwise Vite uses .env.production)
ARG VITE_AEM_LOGOUT_URL
ARG VITE_CDN_ICON
ARG VITE_BASE_URL

# Set environment variables for build
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID
ENV VITE_EXTERNAL_TENANT_ID=$VITE_EXTERNAL_TENANT_ID
ENV VITE_WORKFORCE_TENANT_ID=$VITE_WORKFORCE_TENANT_ID
ENV VITE_CIAM_HOST=$VITE_CIAM_HOST
ENV VITE_KPS_URL=$VITE_KPS_URL
ENV VITE_LOGIN_SCOPES=$VITE_LOGIN_SCOPES
ENV VITE_LOGOUT_MODE=$VITE_LOGOUT_MODE
ENV VITE_USE_MOCK_AUTH=$VITE_USE_MOCK_AUTH
ENV VITE_PUBLIC_HOME_PAGE=$VITE_PUBLIC_HOME_PAGE
ENV VITE_PORTAL_API_BASE=$VITE_PORTAL_API_BASE
ENV VITE_PORTAL_API_SCOPE=$VITE_PORTAL_API_SCOPE
ENV VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
ENV VITE_AEM_LOGOUT_URL=$VITE_AEM_LOGOUT_URL
ENV VITE_CDN_ICON=$VITE_CDN_ICON
ENV VITE_BASE_URL=$VITE_BASE_URL

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

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy entrypoint to render template with env vars
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built frontend from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Use existing nginx user and fix permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Use dumb-init for proper signal handling in containers
ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
