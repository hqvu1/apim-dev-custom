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

# Accept build arguments for Azure AD configuration
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_AUTHORITY
ARG VITE_AZURE_REDIRECT_URI
ARG VITE_AZURE_POST_LOGOUT_REDIRECT_URI
ARG VITE_API_BASE_URL

# Set environment variables for build
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_AUTHORITY=$VITE_AZURE_AUTHORITY
ENV VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI
ENV VITE_AZURE_POST_LOGOUT_REDIRECT_URI=$VITE_AZURE_POST_LOGOUT_REDIRECT_URI
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Verify public assets are present before build
RUN ls -la public/ && echo "Found $(ls public/ | wc -l) files in public folder"

# Build the Vite React app
# Support Docker BuildKit secrets for potentially sensitive build-time values
# Note: For SPAs, build-time env vars are embedded in the bundle
# Use secrets only when absolutely necessary (e.g., API keys for build-time operations)
RUN --mount=type=secret,id=buildenv,required=false \
    if [ -f /run/secrets/buildenv ]; then \
        echo "Loading additional build environment from secrets..." && \
        set -a && . /run/secrets/buildenv && set +a; \
    fi && \
    npm run build

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

# ---------- runtime stage ----------
FROM nginx:alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
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
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
