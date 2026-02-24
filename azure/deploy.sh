#!/bin/bash
# Azure Container Apps Deployment Script for Komatsu APIM Portal (Bash)
# Usage: ./deploy.sh [dev|staging|prod] [resource-group] [subscription-id]

set -e  # Exit on error

# Configuration
ENVIRONMENT=${1:-dev}
RESOURCE_GROUP=${2:-rg-komatsu-apim-portal-$ENVIRONMENT}
SUBSCRIPTION_ID=${3:-}
LOCATION="East US 2"

APP_NAME="komatsu-apim-portal"
CONTAINER_IMAGE="$APP_NAME:$ENVIRONMENT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "❌ Invalid environment. Must be: dev, staging, or prod"
    exit 1
fi

echo "🚀 Komatsu API Management Portal - Azure Container Apps Deployment"
echo "Environment: $ENVIRONMENT"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"

# Function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

if ! command_exists az; then
    echo "❌ Azure CLI is not installed"
    echo "Install from: https://aka.ms/installazurecli"
    exit 1
fi

if ! command_exists docker; then
    echo "❌ Docker is not installed"
    echo "Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check Azure login
echo ""
echo "🔐 Checking Azure login..."
if az account show &> /dev/null; then
    echo "✅ Already logged in to Azure"
else
    echo "Please log in to Azure..."
    az login
fi

# Set subscription if provided
if [ -n "$SUBSCRIPTION_ID" ]; then
    echo ""
    echo "📋 Setting subscription to $SUBSCRIPTION_ID..."
    az account set --subscription "$SUBSCRIPTION_ID"
fi

# Get current subscription
CURRENT_SUBSCRIPTION=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "✅ Using subscription: $SUBSCRIPTION_NAME ($CURRENT_SUBSCRIPTION)"

# Check if resource group exists, create if it doesn't
echo ""
echo "🏗️ Checking resource group..."
if ! az group exists --name "$RESOURCE_GROUP" | grep -q "true"; then
    echo "Creating resource group $RESOURCE_GROUP in $LOCATION..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" \
        --tags "Environment=$ENVIRONMENT" "Application=Komatsu APIM Portal"
    echo "✅ Resource group created"
else
    echo "✅ Resource group $RESOURCE_GROUP exists"
fi

# Build container image
echo ""
echo "🐳 Building container image..."
cd "$PROJECT_ROOT"

# Load environment variables from .env file if exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Build the image with build args
docker build -t "$CONTAINER_IMAGE" \
    --build-arg "VITE_ENTRA_CLIENT_ID=${VITE_ENTRA_CLIENT_ID}" \
    --build-arg "VITE_EXTERNAL_TENANT_ID=${VITE_EXTERNAL_TENANT_ID}" \
    --build-arg "VITE_WORKFORCE_TENANT_ID=${VITE_WORKFORCE_TENANT_ID}" \
    --build-arg "VITE_CIAM_HOST=${VITE_CIAM_HOST}" \
    --build-arg "VITE_KPS_URL=${VITE_KPS_URL}" \
    --build-arg "VITE_LOGIN_SCOPES=${VITE_LOGIN_SCOPES}" \
    --build-arg "VITE_LOGOUT_MODE=${VITE_LOGOUT_MODE}" \
    --build-arg "VITE_USE_MOCK_AUTH=${VITE_USE_MOCK_AUTH}" \
    --build-arg "VITE_PUBLIC_HOME_PAGE=${VITE_PUBLIC_HOME_PAGE}" \
    --build-arg "VITE_PORTAL_API_BASE=${VITE_PORTAL_API_BASE}" \
    --build-arg "VITE_PORTAL_API_SCOPE=${VITE_PORTAL_API_SCOPE}" \
    --build-arg "VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE}" \
    --build-arg "VITE_AEM_LOGOUT_URL=${VITE_AEM_LOGOUT_URL}" \
    --build-arg "VITE_CDN_ICON=${VITE_CDN_ICON}" \
    --build-arg "VITE_BASE_URL=${VITE_BASE_URL}" \
    -f Dockerfile .

echo "✅ Docker image built successfully"

# Get ACR name (will be created by Bicep if it doesn't exist)
ACR_NAME=$(echo "$APP_NAME$ENVIRONMENT" | tr -d '-')acr

# Deploy infrastructure first (creates ACR if needed)
echo ""
echo "🏗️ Deploying infrastructure..."
DEPLOYMENT_NAME="apim-portal-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S)"

# Check if parameters file exists
PARAMS_FILE="$SCRIPT_DIR/parameters.$ENVIRONMENT.json"
if [ ! -f "$PARAMS_FILE" ]; then
    echo "⚠️ Parameters file not found: $PARAMS_FILE"
    echo "Creating infrastructure with default parameters..."
    
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --template-file "$SCRIPT_DIR/container-app.bicep" \
        --parameters environment="$ENVIRONMENT" \
                     containerImage="$CONTAINER_IMAGE" \
                     azureClientId="${VITE_AZURE_CLIENT_ID}" \
                     azureAuthority="${VITE_AZURE_AUTHORITY}" \
                     redirectUri="${VITE_AZURE_REDIRECT_URI}" \
                     postLogoutRedirectUri="${VITE_AZURE_POST_LOGOUT_REDIRECT_URI}" \
                     apiBaseUrl="${VITE_API_BASE_URL}"
else
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --template-file "$SCRIPT_DIR/container-app.bicep" \
        --parameters "@$PARAMS_FILE"
fi

echo "✅ Infrastructure deployed successfully"

# Get ACR login server
echo ""
echo "🔑 Getting ACR credentials..."
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)

# Log in to ACR
echo "Logging in to ACR: $ACR_LOGIN_SERVER..."
az acr login --name "$ACR_NAME"

# Tag and push image
echo ""
echo "📤 Pushing container image to ACR..."
ACR_IMAGE="$ACR_LOGIN_SERVER/$CONTAINER_IMAGE"
docker tag "$CONTAINER_IMAGE" "$ACR_IMAGE"
docker push "$ACR_IMAGE"

echo "✅ Container image pushed successfully"

# Update container app with new image
echo ""
echo "🔄 Updating Container App..."
CONTAINER_APP_NAME="komatsu-apim-portal-$ENVIRONMENT-ca"

az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_IMAGE"

# Get the application URL
APP_URL=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Application URL: https://$APP_URL"
echo ""
echo "📊 View logs and metrics:"
echo "   az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"

cd "$SCRIPT_DIR"
