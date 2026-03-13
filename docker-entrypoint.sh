#!/usr/bin/env sh
set -eu

# Set defaults for runtime environment variables
: "${USE_MOCK_MODE:=false}"
: "${AZURE_SUBSCRIPTION_ID:=}"
: "${AZURE_RESOURCE_GROUP:=}"
: "${APIM_SERVICE_NAME:=}"
: "${APIM_API_VERSION:=2022-08-01}"
: "${MANAGED_IDENTITY_CLIENT_ID:=}"
: "${ENTRA_TENANT_ID:=}"
: "${ENTRA_CLIENT_ID:=}"
: "${ENTRA_EXTERNAL_TENANT_ID:=}"
: "${ENTRA_CIAM_HOST:=}"
: "${APIM_SP_TENANT_ID:=}"
: "${APIM_SP_CLIENT_ID:=}"
: "${APIM_SP_CLIENT_SECRET:=}"
: "${APIM_ARM_SCOPE:=https://management.azure.com/.default}"
: "${APIM_DATA_API_SCOPE:=https://management.azure.com/.default}"

# Export env vars for supervisord (.NET BFF process)
export USE_MOCK_MODE AZURE_SUBSCRIPTION_ID AZURE_RESOURCE_GROUP APIM_SERVICE_NAME APIM_API_VERSION MANAGED_IDENTITY_CLIENT_ID
export ENTRA_TENANT_ID ENTRA_CLIENT_ID ENTRA_EXTERNAL_TENANT_ID ENTRA_CIAM_HOST
export APIM_SP_TENANT_ID APIM_SP_CLIENT_ID APIM_SP_CLIENT_SECRET APIM_ARM_SCOPE APIM_DATA_API_SCOPE

# Copy nginx config template to final location (no substitution needed - proxies to localhost BFF)
cp /etc/nginx/conf.d/default.conf.template /etc/nginx/conf.d/default.conf

# Generate runtime config for the frontend
cat > /usr/share/nginx/html/runtime-config.js <<EOF
// Auto-generated at container startup - DO NOT EDIT
window.__RUNTIME_CONFIG__ = {};
EOF

echo "✅ Runtime config generated (BFF: .NET):"
echo "   PUBLIC_HOME_PAGE=${PUBLIC_HOME_PAGE}"
echo "   APIM_SERVICE_NAME=${APIM_SERVICE_NAME}"
echo "   AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}"
echo "   APIM_API_VERSION=${APIM_API_VERSION}"
echo "   USE_MOCK_MODE=${USE_MOCK_MODE}"
echo "   MANAGED_IDENTITY_CLIENT_ID=${MANAGED_IDENTITY_CLIENT_ID:-(not set, using system-assigned)}"
echo "   ENTRA_TENANT_ID=${ENTRA_TENANT_ID:-(not set)}"
echo "   ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID:-(not set)}"
echo "   APIM_SP_TENANT_ID=${APIM_SP_TENANT_ID:-(not set)}"
echo "   APIM_SP_CLIENT_ID=${APIM_SP_CLIENT_ID:-(not set)}"
echo "   APIM_SP_CLIENT_SECRET=${APIM_SP_CLIENT_SECRET:+********(set)}${APIM_SP_CLIENT_SECRET:-(not set)}"

exec "$@"
