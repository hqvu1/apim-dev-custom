# ---------- frontend build stage ----------
FROM node:20-alpine AS frontend-builder

# Install security updates and basic tools
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --frozen-lockfile --prefer-offline --no-audit

# Copy the component library source for source-level compilation.
# The library is built with React 19 / MUI 7; compiling from source lets
# Vite use the consumer's React 18 / MUI 5 instead of the pre-built dist.
# When the library is published to a registry with matching peer deps this
# COPY and the COMPONENT_LIB_SRC variable can be removed.
COPY component-library/ ./component-library/

# Copy source code
COPY . .

# Tell vite.config.ts where the component library source lives inside the
# Docker build context (instead of the default ../react-template path).
ENV COMPONENT_LIB_SRC=./component-library/src/index.ts

# NOTE: Build automatically uses .env.production for VITE_* variables
# Vite embeds these at build time - they become hardcoded in the JS bundle
# To override, pass --build-arg VITE_VARIABLE_NAME=value to docker build
# Runtime variables (non-VITE_*) are set via Container App environment

# Verify public assets are present before build
RUN ls -la public/ && echo "Found $(ls public/ | wc -l) files in public folder"

# Build the Vite React app
# .env.production provides all VITE_* variables at build time
# Skip TypeScript type checking for faster builds (use: npx vite build)
RUN npx vite build --mode production

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

# ---------- BFF build stage (.NET) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS bff-builder

WORKDIR /src

# Copy project file first for better layer caching
COPY bff-dotnet/BffApi.csproj ./bff-dotnet/
RUN dotnet restore ./bff-dotnet/BffApi.csproj

# Copy BFF source code and build
COPY bff-dotnet/ ./bff-dotnet/
RUN dotnet publish ./bff-dotnet/BffApi.csproj \
    -c Release \
    -o /app/bff \
    --no-restore

# ---------- runtime stage ----------
FROM nginx:alpine AS runtime

# Install security updates, .NET ASP.NET runtime, and process management tools
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    supervisor \
    icu-libs \
    krb5-libs \
    libgcc \
    libintl \
    libssl3 \
    libstdc++ \
    zlib

# Install .NET ASP.NET Core runtime (Alpine)
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
COPY --from=mcr.microsoft.com/dotnet/aspnet:10.0-preview-alpine /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy entrypoint to render template with env vars
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor.d/services.ini

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy published .NET BFF from bff-builder stage
COPY --from=bff-builder /app/bff /app/bff

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

# Note: supervisor runs as root to manage processes, but nginx and dotnet run as nginx user

# Health check (increased start-period for .NET cold start)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Expose port (only nginx port, BFF is internal)
EXPOSE 8080

# Use dumb-init for proper signal handling in containers
ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]

# Start both services via supervisor
CMD ["supervisord", "-c", "/etc/supervisor.d/services.ini", "-n"]
