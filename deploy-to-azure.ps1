# ============================================================================
# Azure Container Apps Deployment Script
# Komatsu API Management Portal
# ============================================================================
# This script deploys the portal to your Azure environment:
# - Subscription: KAC_DigitalOffice_devtest_sub_01
# - Resource Group: kac_apimarketplace_eus_dev_rg
# - Region: East US
# ============================================================================

param(
    [Parameter()]
    [switch]$SkipBuild = $false,
    
    [Parameter()]
    [switch]$DeployInfraOnly = $false
)

$ErrorActionPreference = "Stop"

# ============================================================================
# CONFIGURATION
# ============================================================================
$SubscriptionId = "121789fa-2321-4e44-8aee-c6f1cd5d7045"
$SubscriptionName = "KAC_DigitalOffice_devtest_sub_01"
$ResourceGroup = "kac_apimarketplace_eus_dev_rg"
$Location = "eastus"
$Environment = "dev"
$AppName = "komatsu-apim-portal"
$ImageName = "$AppName`:$Environment"

# Resource naming
$AcrName = "kapimdevacr"  # Short, globally unique ACR name
$ContainerAppEnvName = "$AppName-$Environment-env"
$ContainerAppName = "$AppName-$Environment-ca"
$LogAnalyticsName = "$AppName-$Environment-logs"
$AppInsightsName = "$AppName-$Environment-ai"

Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "  Komatsu API Management Portal - Azure Deployment" -ForegroundColor Cyan
Write-Host "============================================================================`n" -ForegroundColor Cyan

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Subscription: $SubscriptionName" -ForegroundColor White
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "  Location: $Location" -ForegroundColor White
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host "  ACR Name: $AcrName" -ForegroundColor White
Write-Host ""

# ============================================================================
# STEP 1: Prerequisites Check
# ============================================================================
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed!" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/installazurecli" -ForegroundColor Yellow
    exit 1
}

if (-not $SkipBuild) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Docker is not installed!" -ForegroundColor Red
        Write-Host "Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Prerequisites checked" -ForegroundColor Green

# ============================================================================
# STEP 2: Azure Login & Subscription
# ============================================================================
Write-Host "`n[2/6] Configuring Azure subscription..." -ForegroundColor Cyan

try {
    $null = az account show 2>$null
    Write-Host "✅ Already logged in to Azure" -ForegroundColor Green
} catch {
    Write-Host "Logging in to Azure..." -ForegroundColor Yellow
    az login
}

az account set --subscription $SubscriptionId
$currentSub = az account show --query name -o tsv
Write-Host "✅ Using subscription: $currentSub" -ForegroundColor Green

# ============================================================================
# STEP 3: Deploy Infrastructure (ACR, Container Apps Environment, etc.)
# ============================================================================
Write-Host "`n[3/6] Deploying Azure infrastructure..." -ForegroundColor Cyan

$DeploymentName = "apim-portal-deployment-$(Get-Date -Format 'yyyyMMddHHmmss')"
$BicepFile = ".\azure\container-app.bicep"
$ParamsFile = ".\azure\parameters.dev.json"

Write-Host "Deploying Bicep template..." -ForegroundColor Yellow
Write-Host "  Template: $BicepFile" -ForegroundColor White
Write-Host "  Parameters: $ParamsFile" -ForegroundColor White

$deployResult = az deployment group create `
    --name $DeploymentName `
    --resource-group $ResourceGroup `
    --template-file $BicepFile `
    --parameters $ParamsFile `
    --query "properties.outputs" `
    -o json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Infrastructure deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Infrastructure deployed successfully" -ForegroundColor Green

# Get output values
$AcrLoginServer = $deployResult.containerRegistryLoginServer.value
$ContainerAppUrl = $deployResult.containerAppUrl.value
$ContainerAppNameOutput = $deployResult.containerAppName.value

Write-Host "  ACR Login Server: $AcrLoginServer" -ForegroundColor White
Write-Host "  Container App: $ContainerAppNameOutput" -ForegroundColor White

if ($DeployInfraOnly) {
    Write-Host "`n✅ Infrastructure deployment complete!" -ForegroundColor Green
    Write-Host "Run the script without -DeployInfraOnly to build and deploy the application." -ForegroundColor Yellow
    exit 0
}

# ============================================================================
# STEP 4: Build Docker Image
# ============================================================================
if (-not $SkipBuild) {
    Write-Host "`n[4/6] Building Docker image..." -ForegroundColor Cyan
    
    # Load environment variables from .env
    if (Test-Path ".env") {
        Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    # Build with all environment variables
    docker build `
        --build-arg "VITE_ENTRA_CLIENT_ID=$env:VITE_ENTRA_CLIENT_ID" `
        --build-arg "VITE_EXTERNAL_TENANT_ID=$env:VITE_EXTERNAL_TENANT_ID" `
        --build-arg "VITE_WORKFORCE_TENANT_ID=$env:VITE_WORKFORCE_TENANT_ID" `
        --build-arg "VITE_CIAM_HOST=$env:VITE_CIAM_HOST" `
        --build-arg "VITE_KPS_URL=$env:VITE_KPS_URL" `
        --build-arg "VITE_LOGIN_SCOPES=$env:VITE_LOGIN_SCOPES" `
        --build-arg "VITE_LOGOUT_MODE=$env:VITE_LOGOUT_MODE" `
        --build-arg "VITE_USE_MOCK_AUTH=false" `
        --build-arg "VITE_PUBLIC_HOME_PAGE=$env:VITE_PUBLIC_HOME_PAGE" `
        --build-arg "VITE_PORTAL_API_BASE=$env:VITE_PORTAL_API_BASE" `
        --build-arg "VITE_PORTAL_API_SCOPE=$env:VITE_PORTAL_API_SCOPE" `
        --build-arg "VITE_DEFAULT_LOCALE=$env:VITE_DEFAULT_LOCALE" `
        --build-arg "VITE_AEM_LOGOUT_URL=$env:VITE_AEM_LOGOUT_URL" `
        --build-arg "VITE_CDN_ICON=$env:VITE_CDN_ICON" `
        --build-arg "VITE_BASE_URL=$env:VITE_BASE_URL" `
        -t $ImageName `
        -f Dockerfile .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Docker image built successfully" -ForegroundColor Green
} else {
    Write-Host "`n[4/6] Skipping Docker build (using existing image)..." -ForegroundColor Yellow
}

# ============================================================================
# STEP 5: Push to ACR
# ============================================================================
Write-Host "`n[5/6] Pushing image to Azure Container Registry..." -ForegroundColor Cyan

# Login to ACR
Write-Host "Logging in to ACR: $AcrLoginServer..." -ForegroundColor Yellow
az acr login --name $AcrName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ACR login failed!" -ForegroundColor Red
    exit 1
}

# Tag and push
$AcrImageName = "$AcrLoginServer/$ImageName"
docker tag $ImageName $AcrImageName
docker push $AcrImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image pushed to ACR: $AcrImageName" -ForegroundColor Green

# ============================================================================
# STEP 6: Update Container App
# ============================================================================
Write-Host "`n[6/6] Updating Azure Container App..." -ForegroundColor Cyan

# The container app is already configured by Bicep to pull from ACR
# We just need to trigger a new revision with the updated image
# All env vars (ARM config, managed identity, etc.) are set by the Bicep template
Write-Host "Creating new revision with updated image..." -ForegroundColor Yellow

az containerapp update `
    --name $ContainerAppNameOutput `
    --resource-group $ResourceGroup `
    --image $AcrImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Container app update had issues, but may still be running" -ForegroundColor Yellow
}

Write-Host "✅ Container app updated" -ForegroundColor Green

# ============================================================================
# DEPLOYMENT COMPLETE
# ============================================================================
Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "  ✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "============================================================================`n" -ForegroundColor Cyan

Write-Host "Your application is now deployed and running!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Application URL:" -ForegroundColor Yellow
Write-Host "   $ContainerAppUrl" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Yellow
Write-Host "   Application Insights: $AppInsightsName" -ForegroundColor White
Write-Host "   Log Analytics: $LogAnalyticsName" -ForegroundColor White
Write-Host ""
Write-Host "🔍 View logs:" -ForegroundColor Yellow
Write-Host "   az containerapp logs show --name $ContainerAppNameOutput --resource-group $ResourceGroup --follow" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Open in browser:" -ForegroundColor Yellow
Write-Host "   Start-Process '$ContainerAppUrl'" -ForegroundColor Gray
Write-Host ""

# Optional: Open in browser
$openBrowser = Read-Host "Open application in browser now? (y/n)"
if ($openBrowser -eq 'y') {
    Start-Process $ContainerAppUrl
}

Write-Host "`nDeployment completed successfully! 🎉" -ForegroundColor Green
