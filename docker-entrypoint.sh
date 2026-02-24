#!/usr/bin/env sh
set -eu

: "${PORTAL_API_BACKEND_URL:=https://d-apim.developer.azure-api.net}"

envsubst '${PORTAL_API_BACKEND_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
