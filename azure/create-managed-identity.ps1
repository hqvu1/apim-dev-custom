# Create Managed Identity and Grant APIM Access
# This script creates a User-Assigned Managed Identity and grants it access to APIM

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rg-komatsu-apim-portal-dev",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory=$false)]
    [string]$IdentityName = "komatsu-apim-portal-identity",
    
    [Parameter(Mandatory=$false)]
    [string]$ApimName = "demo-apim-feb",
    
    [Parameter(Mandatory=$false)]
    [string]$ApimResourceGroup = "",  # If APIM is in a different resource group
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = ""
)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔐 Create Managed Identity and Grant APIM Access" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check if Azure CLI is installed
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/installazurecli" -ForegroundColor Yellow
    exit 1
}

# Login to Azure (if not already logged in)
Write-Host "🔑 Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please login to Azure..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to login to Azure" -ForegroundColor Red
        exit 1
    }
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-Host "Setting subscription: $SubscriptionId" -ForegroundColor Yellow
    az account set --subscription $SubscriptionId
}

# Get current subscription
$currentSub = az account show | ConvertFrom-Json
Write-Host "✅ Using subscription: $($currentSub.name)" -ForegroundColor Green
Write-Host ""

# Step 1: Create Resource Group if it doesn't exist
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📦 Step 1: Create Resource Group" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq "true") {
    Write-Host "✅ Resource group already exists: $ResourceGroup" -ForegroundColor Green
} else {
    Write-Host "Creating resource group: $ResourceGroup in $Location" -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location --output none
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Resource group created successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create resource group" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Step 2: Create User-Assigned Managed Identity
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🆔 Step 2: Create Managed Identity" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
$existingIdentity = az identity show --name $IdentityName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
if ($existingIdentity) {
    Write-Host "✅ Managed identity already exists: $IdentityName" -ForegroundColor Green
    $identity = $existingIdentity
} else {
    Write-Host "Creating managed identity: $IdentityName" -ForegroundColor Yellow
    $identity = az identity create `
        --name $IdentityName `
        --resource-group $ResourceGroup `
        --location $Location `
        --output json | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Managed identity created successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create managed identity" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Managed Identity Details:" -ForegroundColor Cyan
Write-Host "  Name:         $($identity.name)" -ForegroundColor White
Write-Host "  Resource ID:  $($identity.id)" -ForegroundColor White
Write-Host "  Principal ID: $($identity.principalId)" -ForegroundColor White
Write-Host "  Client ID:    $($identity.clientId)" -ForegroundColor White
Write-Host ""

# Step 3: Find APIM instance
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔍 Step 3: Locate APIM Instance" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Try to find APIM in the specified resource group first
if ($ApimResourceGroup) {
    $apimRg = $ApimResourceGroup
} else {
    $apimRg = $ResourceGroup
}

Write-Host "Looking for APIM: $ApimName in resource group: $apimRg" -ForegroundColor Yellow
$apim = az apim show --name $ApimName --resource-group $apimRg 2>$null | ConvertFrom-Json

if (-not $apim) {
    # Try to find APIM across all resource groups
    Write-Host "APIM not found in $apimRg. Searching across subscription..." -ForegroundColor Yellow
    $allApims = az apim list | ConvertFrom-Json
    $apim = $allApims | Where-Object { $_.name -eq $ApimName } | Select-Object -First 1
    
    if ($apim) {
        # Extract resource group from the APIM id
        $apimRg = ($apim.id -split '/')[4]
        Write-Host "✅ Found APIM in resource group: $apimRg" -ForegroundColor Green
    } else {
        Write-Host "❌ APIM instance not found: $ApimName" -ForegroundColor Red
        Write-Host "Available APIM instances:" -ForegroundColor Yellow
        az apim list --query "[].{Name:name, ResourceGroup:resourceGroup}" --output table
        Write-Host ""
        Write-Host "Please verify the APIM name and resource group:" -ForegroundColor Yellow
        Write-Host "  .\create-managed-identity.ps1 -ApimName 'your-apim-name' -ApimResourceGroup 'your-apim-rg'" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host ""
Write-Host "APIM Instance Details:" -ForegroundColor Cyan
Write-Host "  Name:           $($apim.name)" -ForegroundColor White
Write-Host "  Resource Group: $apimRg" -ForegroundColor White
Write-Host "  Resource ID:    $($apim.id)" -ForegroundColor White
Write-Host "  Management URL: https://$($apim.name).management.azure-api.net" -ForegroundColor White
Write-Host ""

# Step 4: Grant Permissions
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔐 Step 4: Grant APIM Permissions" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Role definition IDs
$roles = @(
    @{
        Name = "API Management Service Contributor"
        Id = "312a565d-c81f-4fd8-895a-4e21e48d571c"
        Description = "Full access to manage APIM service"
    },
    @{
        Name = "API Management Service Reader Role"
        Id = "71522526-b88f-4d52-b57f-d31fc3546d0d"
        Description = "Read-only access to APIM"
    }
)

Write-Host "Select the role to assign:" -ForegroundColor Yellow
Write-Host "1. API Management Service Contributor (Full Access - Recommended for BFF)" -ForegroundColor White
Write-Host "2. API Management Service Reader Role (Read-Only)" -ForegroundColor White
Write-Host "3. Both roles" -ForegroundColor White
$roleChoice = Read-Host "Enter choice (1-3)"

$rolesToAssign = @()
switch ($roleChoice) {
    "1" { $rolesToAssign = @($roles[0]) }
    "2" { $rolesToAssign = @($roles[1]) }
    "3" { $rolesToAssign = $roles }
    default { 
        Write-Host "Invalid choice. Defaulting to Contributor role." -ForegroundColor Yellow
        $rolesToAssign = @($roles[0])
    }
}

Write-Host ""
foreach ($role in $rolesToAssign) {
    Write-Host "Assigning role: $($role.Name)" -ForegroundColor Yellow
    
    # Check if role assignment already exists
    $existingAssignment = az role assignment list `
        --assignee $identity.principalId `
        --scope $apim.id `
        --role $role.Id `
        --output json | ConvertFrom-Json
    
    if ($existingAssignment.Count -gt 0) {
        Write-Host "✅ Role already assigned: $($role.Name)" -ForegroundColor Green
    } else {
        az role assignment create `
            --assignee-object-id $identity.principalId `
            --assignee-principal-type ServicePrincipal `
            --role $role.Id `
            --scope $apim.id `
            --output none
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully assigned role: $($role.Name)" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to assign role: $($role.Name)" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Step 5: Summary and Next Steps
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "  Managed Identity:  $IdentityName" -ForegroundColor White
Write-Host "  Resource Group:    $ResourceGroup" -ForegroundColor White
Write-Host "  APIM Instance:     $ApimName" -ForegroundColor White
Write-Host "  APIM Resource Group: $apimRg" -ForegroundColor White
Write-Host ""

# Output environment variables for BFF
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔧 BFF Configuration" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add these environment variables to your BFF configuration:" -ForegroundColor Yellow
Write-Host ""
Write-Host "For local testing (bff/.env):" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Gray
Write-Host "USE_MOCK_MODE=false" -ForegroundColor White
Write-Host "AZURE_CLIENT_ID=$($identity.clientId)" -ForegroundColor White
Write-Host "APIM_MANAGEMENT_URL=https://$($apim.name).management.azure-api.net" -ForegroundColor White
Write-Host "APIM_API_VERSION=2021-08-01" -ForegroundColor White
Write-Host ""
Write-Host "Also run: az login" -ForegroundColor Yellow
Write-Host ""

Write-Host "For Azure deployment (Bicep parameters):" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Gray
Write-Host "managedIdentityClientId: $($identity.clientId)" -ForegroundColor White
Write-Host "apimResourceId: $($apim.id)" -ForegroundColor White
Write-Host ""

# Save configuration to file
$configFile = "managed-identity-config.json"
$config = @{
    managedIdentity = @{
        name = $identity.name
        resourceGroup = $ResourceGroup
        clientId = $identity.clientId
        principalId = $identity.principalId
        resourceId = $identity.id
    }
    apim = @{
        name = $apim.name
        resourceGroup = $apimRg
        resourceId = $apim.id
        managementUrl = "https://$($apim.name).management.azure-api.net"
    }
    createdAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

$config | ConvertTo-Json -Depth 10 | Out-File $configFile -Encoding UTF8
Write-Host "💾 Configuration saved to: $configFile" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📖 Next Steps:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verify in Azure Portal:" -ForegroundColor Yellow
Write-Host "   - Navigate to: Resource Groups > $ResourceGroup" -ForegroundColor White
Write-Host "   - Look for: $IdentityName (Managed Identity)" -ForegroundColor White
Write-Host ""
Write-Host "2. Test locally:" -ForegroundColor Yellow
Write-Host "   - Update bff/.env with the configuration above" -ForegroundColor White
Write-Host "   - Run: az login" -ForegroundColor White
Write-Host "   - Run: cd bff && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Deploy to Azure:" -ForegroundColor Yellow
Write-Host "   - Update azure/parameters.dev.json with managed identity details" -ForegroundColor White
Write-Host "   - Run: cd azure && .\deploy.ps1 -Environment dev" -ForegroundColor White
Write-Host ""
Write-Host "4. Verify access:" -ForegroundColor Yellow
Write-Host "   - Check container app logs for successful token acquisition" -ForegroundColor White
Write-Host "   - Test API calls through the BFF" -ForegroundColor White
Write-Host ""

Write-Host "✨ Setup completed successfully!" -ForegroundColor Green
