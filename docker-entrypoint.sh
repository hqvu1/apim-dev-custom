#!/usr/bin/env sh
set -eu

# Set defaults for runtime environment variables
: "${PUBLIC_HOME_PAGE:=false}"
: "${USE_MOCK_MODE:=false}"
: "${AZURE_SUBSCRIPTION_ID:=}"
: "${AZURE_RESOURCE_GROUP:=}"
: "${APIM_SERVICE_NAME:=}"
: "${APIM_API_VERSION:=2022-08-01}"
: "${MANAGED_IDENTITY_CLIENT_ID:=}"

# Export env vars for supervisord (BFF process)
export USE_MOCK_MODE AZURE_SUBSCRIPTION_ID AZURE_RESOURCE_GROUP APIM_SERVICE_NAME APIM_API_VERSION MANAGED_IDENTITY_CLIENT_ID

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
echo "   APIM_SERVICE_NAME=${APIM_SERVICE_NAME}"
echo "   AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}"
echo "   APIM_API_VERSION=${APIM_API_VERSION}"
echo "   USE_MOCK_MODE=${USE_MOCK_MODE}"
echo "   MANAGED_IDENTITY_CLIENT_ID=${MANAGED_IDENTITY_CLIENT_ID:-(not set, using system-assigned)}"

exec "$@"
