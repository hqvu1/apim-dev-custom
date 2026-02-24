# Azure Container Apps Deployment Script for Komatsu APIM Portal (PowerShell)
# Usage: .\deploy.ps1 [dev|staging|prod] [resource-group] [subscription-id]

param(
    [Parameter(Position=0)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter(Position=1)]
    [string]$ResourceGroup = "rg-komatsu-apim-portal-$Environment",
    
    [Parameter(Position=2)]
    [string]$SubscriptionId,
    
    [Parameter()]
    [string]$Location = "East US 2"
)

# Configuration
$AppName = "komatsu-apim-portal"
$ContainerImage = "$AppName`:$Environment"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "🚀 Komatsu API Management Portal - Azure Container Apps Deployment" -ForegroundColor Blue
Write-Host "Environment: $Environment" -ForegroundColor Blue
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor Blue
Write-Host "Location: $Location" -ForegroundColor Blue

# Function to check if command exists
function Test-CommandExists {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Check prerequisites
Write-Host "`n🔍 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-CommandExists "az")) {
    Write-Host "❌ Azure CLI is not installed" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/installazurecli" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-CommandExists "docker")) {
    Write-Host "❌ Docker is not installed" -ForegroundColor Red
    Write-Host "Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check Azure login
Write-Host "`n🔐 Checking Azure login..." -ForegroundColor Yellow
try {
    $null = az account show 2>$null
    Write-Host "✅ Already logged in to Azure" -ForegroundColor Green
} catch {
    Write-Host "Please log in to Azure..." -ForegroundColor Yellow
    az login
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-Host "`n📋 Setting subscription to $SubscriptionId..." -ForegroundColor Yellow
    az account set --subscription $SubscriptionId
}

# Get current subscription
$CurrentSubscription = az account show --query id -o tsv
$SubscriptionName = az account show --query name -o tsv
Write-Host "✅ Using subscription: $SubscriptionName ($CurrentSubscription)" -ForegroundColor Green

# Check if resource group exists, create if it doesn't
Write-Host "`n🏗️ Checking resource group..." -ForegroundColor Yellow
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq "false") {
    Write-Host "Creating resource group $ResourceGroup in $Location..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location --tags "Environment=$Environment" "Application=Komatsu APIM Portal"
    Write-Host "✅ Resource group created" -ForegroundColor Green
} else {
    Write-Host "✅ Resource group $ResourceGroup exists" -ForegroundColor Green
}

# Build container image
Write-Host "`n🐳 Building container image..." -ForegroundColor Yellow
Set-Location $ProjectRoot

# Load environment variables from .env file if exists
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Build the image with build args
$buildArgs = @(
    "--build-arg", "VITE_ENTRA_CLIENT_ID=$env:VITE_ENTRA_CLIENT_ID",
    "--build-arg", "VITE_EXTERNAL_TENANT_ID=$env:VITE_EXTERNAL_TENANT_ID",
    "--build-arg", "VITE_WORKFORCE_TENANT_ID=$env:VITE_WORKFORCE_TENANT_ID",
    "--build-arg", "VITE_CIAM_HOST=$env:VITE_CIAM_HOST",
    "--build-arg", "VITE_KPS_URL=$env:VITE_KPS_URL",
    "--build-arg", "VITE_LOGIN_SCOPES=$env:VITE_LOGIN_SCOPES",
    "--build-arg", "VITE_LOGOUT_MODE=$env:VITE_LOGOUT_MODE",
    "--build-arg", "VITE_USE_MOCK_AUTH=$env:VITE_USE_MOCK_AUTH",
    "--build-arg", "VITE_PUBLIC_HOME_PAGE=$env:VITE_PUBLIC_HOME_PAGE",
    "--build-arg", "VITE_PORTAL_API_BASE=$env:VITE_PORTAL_API_BASE",
    "--build-arg", "VITE_PORTAL_API_SCOPE=$env:VITE_PORTAL_API_SCOPE",
    "--build-arg", "VITE_DEFAULT_LOCALE=$env:VITE_DEFAULT_LOCALE",
    "--build-arg", "VITE_AEM_LOGOUT_URL=$env:VITE_AEM_LOGOUT_URL",
    "--build-arg", "VITE_CDN_ICON=$env:VITE_CDN_ICON",
    "--build-arg", "VITE_BASE_URL=$env:VITE_BASE_URL"
)

docker build -t $ContainerImage -f Dockerfile . @buildArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker image built successfully" -ForegroundColor Green

# Get ACR name (will be created by Bicep if it doesn't exist)
$AcrName = "$AppName$Environment" + "acr"
$AcrName = $AcrName -replace '-', ''

# Deploy infrastructure first (creates ACR if needed)
Write-Host "`n🏗️ Deploying infrastructure..." -ForegroundColor Yellow
$DeploymentName = "apim-portal-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Check if parameters file exists
$ParamsFile = "$ScriptDir\parameters.$Environment.json"
if (-not (Test-Path $ParamsFile)) {
    Write-Host "⚠️ Parameters file not found: $ParamsFile" -ForegroundColor Yellow
    Write-Host "Creating infrastructure with default parameters..." -ForegroundColor Yellow
    
    az deployment group create `
        --resource-group $ResourceGroup `
        --name $DeploymentName `
        --template-file "$ScriptDir\container-app.bicep" `
        --parameters environment=$Environment `
                     containerImage=$ContainerImage `
                     azureClientId="$env:VITE_AZURE_CLIENT_ID" `
                     azureAuthority="$env:VITE_AZURE_AUTHORITY" `
                     redirectUri="$env:VITE_AZURE_REDIRECT_URI" `
                     postLogoutRedirectUri="$env:VITE_AZURE_POST_LOGOUT_REDIRECT_URI" `
                     apiBaseUrl="$env:VITE_API_BASE_URL"
} else {
    az deployment group create `
        --resource-group $ResourceGroup `
        --name $DeploymentName `
        --template-file "$ScriptDir\container-app.bicep" `
        --parameters "@$ParamsFile"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Infrastructure deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Infrastructure deployed successfully" -ForegroundColor Green

# Get ACR login server
Write-Host "`n🔑 Getting ACR credentials..." -ForegroundColor Yellow
$AcrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroup --query loginServer -o tsv

# Log in to ACR
Write-Host "Logging in to ACR: $AcrLoginServer..." -ForegroundColor Yellow
az acr login --name $AcrName

# Tag and push image
Write-Host "`n📤 Pushing container image to ACR..." -ForegroundColor Yellow
$AcrImage = "$AcrLoginServer/$ContainerImage"
docker tag $ContainerImage $AcrImage
docker push $AcrImage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Container image pushed successfully" -ForegroundColor Green

# Update container app with new image
Write-Host "`n🔄 Updating Container App..." -ForegroundColor Yellow
$ContainerAppName = "komatsu-apim-portal-$Environment-ca"

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --image $AcrImage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Container App update failed" -ForegroundColor Red
    exit 1
}

# Get the application URL
$AppUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

Write-Host "`n✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "`n🌐 Application URL: https://$AppUrl" -ForegroundColor Cyan
Write-Host "`n📊 View logs and metrics:" -ForegroundColor Yellow
Write-Host "   az containerapp logs show --name $ContainerAppName --resource-group $ResourceGroup --follow" -ForegroundColor Gray

# Return to original directory
Set-Location $PSScriptRoot
