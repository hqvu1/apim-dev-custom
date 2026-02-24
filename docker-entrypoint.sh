#!/usr/bin/env sh
set -eu

# Set defaults for runtime environment variables
: "${PORTAL_API_BACKEND_URL:=https://demo-apim-feb.management.azure-api.net}"
: "${PUBLIC_HOME_PAGE:=false}"

# Export APIM URL for BFF service (used by supervisord)
export APIM_MANAGEMENT_URL="${PORTAL_API_BACKEND_URL}"

# Copy nginx config template to final location (no substitution needed - proxies to localhost BFF)
cp /etc/nginx/conf.d/default.conf.template /etc/nginx/conf.d/default.conf

# Generate runtime config for the frontend
cat > /usr/share/nginx/html/runtime-config.js <<EOF
// Auto-generated at container startup - DO NOT EDIT
window.__RUNTIME_CONFIG__ = {
  PUBLIC_HOME_PAGE: '${PUBLIC_HOME_PAGE}'
};
EOF

echo "✅ Runtime config generated:"
echo "   PUBLIC_HOME_PAGE=${PUBLIC_HOME_PAGE}"
echo "   APIM_MANAGEMENT_URL=${APIM_MANAGEMENT_URL}"

exec "$@"
