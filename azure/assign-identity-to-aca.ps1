# Hook up Azure Container App with Existing Managed Identity
# This script assigns your existing managed identity to a Container App

param(
    [Parameter(Mandatory=$false)]
    [string]$ContainerAppName = "komatsu-apim-portal-dev-ca",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerAppResourceGroup = "rg-komatsu-apim-portal-dev",
    
    [Parameter(Mandatory=$false)]
    [string]$ManagedIdentityName = "demo-apim-managed-identity",
    
    [Parameter(Mandatory=$false)]
    [string]$ManagedIdentityResourceGroup = "kac_apimarketplace_eus_dev_rg"
)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔗 Hook Up Container App with Managed Identity" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Get managed identity details
Write-Host "📋 Step 1: Getting Managed Identity Details..." -ForegroundColor Yellow
$identity = az identity show `
    --name $ManagedIdentityName `
    --resource-group $ManagedIdentityResourceGroup `
    --output json | ConvertFrom-Json

if (-not $identity) {
    Write-Host "❌ Managed identity not found: $ManagedIdentityName" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found Managed Identity:" -ForegroundColor Green
Write-Host "   Name:         $($identity.name)" -ForegroundColor White
Write-Host "   Client ID:    $($identity.clientId)" -ForegroundColor White
Write-Host "   Principal ID: $($identity.principalId)" -ForegroundColor White
Write-Host "   Resource ID:  $($identity.id)" -ForegroundColor White
Write-Host ""

# Check if Container App exists
Write-Host "📋 Step 2: Checking Container App..." -ForegroundColor Yellow
$containerApp = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ContainerAppResourceGroup `
    --output json 2>$null | ConvertFrom-Json

if (-not $containerApp) {
    Write-Host "⚠️  Container App not found: $ContainerAppName" -ForegroundColor Yellow
    Write-Host "   The managed identity will be assigned when you deploy the Container App." -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Configuration Ready - Use these parameters for deployment:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "In azure/parameters.dev.json:" -ForegroundColor Yellow
    Write-Host @"
    "existingManagedIdentityId": {
      "value": "$($identity.id)"
    },
    "existingManagedIdentityClientId": {
      "value": "$($identity.clientId)"
    }
"@ -ForegroundColor White
    Write-Host ""
    Write-Host "Run deployment with: cd azure && .\deploy.ps1 -Environment dev" -ForegroundColor Yellow
    exit 0
}

# Assign managed identity to Container App
Write-Host "📋 Step 3: Assigning Managed Identity to Container App..." -ForegroundColor Yellow

az containerapp identity assign `
    --name $ContainerAppName `
    --resource-group $ContainerAppResourceGroup `
    --user-assigned $identity.id `
    --output none

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully assigned managed identity to Container App" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to assign managed identity" -ForegroundColor Red
    exit 1
}

# Update environment variables
Write-Host "📋 Step 4: Updating Container App Environment Variables..." -ForegroundColor Yellow

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ContainerAppResourceGroup `
    --set-env-vars "MANAGED_IDENTITY_CLIENT_ID=$($identity.clientId)" "USE_MOCK_MODE=false" `
    --output none

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully updated environment variables" -ForegroundColor Green
} else {
    Write-Host "⚠️  Failed to update environment variables (may need manual update)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Managed Identity: $($identity.name)" -ForegroundColor White
Write-Host "Client ID:        $($identity.clientId)" -ForegroundColor White
Write-Host "Container App:    $ContainerAppName" -ForegroundColor White
Write-Host ""
Write-Host "The Container App can now authenticate to APIM using the managed identity." -ForegroundColor White
Write-Host ""

# Verify the assignment
Write-Host "📋 Verifying Identity Assignment..." -ForegroundColor Yellow
$updatedApp = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ContainerAppResourceGroup `
    --query identity `
    --output json | ConvertFrom-Json

Write-Host "Identity Configuration:" -ForegroundColor Cyan
Write-Host "   Type: $($updatedApp.type)" -ForegroundColor White
if ($updatedApp.userAssignedIdentities) {
    Write-Host "   User-Assigned Identities:" -ForegroundColor White
    $updatedApp.userAssignedIdentities.PSObject.Properties | ForEach-Object {
        Write-Host "     - $($_.Name)" -ForegroundColor White
    }
}
Write-Host ""
