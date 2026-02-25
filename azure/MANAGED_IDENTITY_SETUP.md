# Managed Identity Setup Guide

## Overview

This deployment now creates a **User-Assigned Managed Identity** that will be visible in your Azure resource group. The identity is used by the BFF server to authenticate with Azure API Management.

## What's Configured

### Resources Created

1. **User-Assigned Managed Identity**: `komatsu-apim-portal-{env}-identity`
   - Visible in the Azure Portal under your resource group
   - Used by the Container App to authenticate to APIM

2. **Container App**: Uses both identities
   - System-Assigned Identity (automatic)
   - User-Assigned Identity (manually created)

3. **RBAC Role Assignment** (optional)
   - Grants "API Management Service Contributor" role to the managed identity
   - Only created if you provide the APIM resource ID

## Deployment Steps

### 1. Deploy the Infrastructure

```powershell
# Navigate to the azure directory
cd azure

# Deploy to dev environment
.\deploy.ps1 -Environment dev
```

Or manually:

```powershell
# Set variables
$resourceGroup = "rg-komatsu-apim-portal-dev"
$location = "eastus"

# Create resource group
az group create --name $resourceGroup --location $location

# Deploy the Bicep template
az deployment group create `
  --resource-group $resourceGroup `
  --template-file container-app.bicep `
  --parameters parameters.dev.json
```

### 2. Verify Managed Identity in Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your resource group (e.g., `rg-komatsu-apim-portal-dev`)
3. Look for the resource: **`komatsu-apim-portal-dev-identity`**
4. Type: `Managed Identity`

### 3. Grant APIM Permissions (If Not Automated)

If you didn't provide the APIM resource ID during deployment, you need to manually grant permissions:

#### Option A: Using Azure Portal

1. Go to your **APIM instance** in the portal
2. Click **Access control (IAM)**
3. Click **+ Add** → **Add role assignment**
4. Select role: **API Management Service Contributor**
5. Click **Next**
6. Click **+ Select members**
7. Search for: `komatsu-apim-portal-dev-identity`
8. Click **Select** → **Review + assign**

#### Option B: Using Azure CLI

```powershell
# Get the APIM resource ID
$apimResourceId = az apim show `
  --name "your-apim-name" `
  --resource-group "your-apim-resource-group" `
  --query id -o tsv

# Get the managed identity principal ID
$managedIdentityId = az identity show `
  --name "komatsu-apim-portal-dev-identity" `
  --resource-group "rg-komatsu-apim-portal-dev" `
  --query principalId -o tsv

# Assign the role
az role assignment create `
  --assignee $managedIdentityId `
  --role "API Management Service Contributor" `
  --scope $apimResourceId
```

### 4. Deploy with APIM Resource ID (Automated)

To automate the RBAC assignment, update your parameters file:

**parameters.dev.json**:
```json
{
  "apimResourceId": {
    "value": "/subscriptions/{subscription-id}/resourceGroups/{apim-rg}/providers/Microsoft.ApiManagement/service/{apim-name}"
  }
}
```

Then redeploy:
```powershell
az deployment group create `
  --resource-group rg-komatsu-apim-portal-dev `
  --template-file container-app.bicep `
  --parameters parameters.dev.json
```

## Managed Identity Information

After deployment, the Bicep template outputs:

- **managedIdentityId**: Full Azure Resource ID
- **managedIdentityPrincipalId**: Object ID (for RBAC)
- **managedIdentityClientId**: Client ID (used by the BFF server)

To view these:

```powershell
# Get deployment outputs
az deployment group show `
  --resource-group rg-komatsu-apim-portal-dev `
  --name container-app `
  --query properties.outputs

# Or get identity details directly
az identity show `
  --name komatsu-apim-portal-dev-identity `
  --resource-group rg-komatsu-apim-portal-dev
```

## BFF Configuration

The BFF server is automatically configured to use the managed identity:

**Environment Variables** (set by Bicep):
- `MANAGED_IDENTITY_CLIENT_ID`: Client ID of the user-assigned identity
- `USE_MOCK_MODE`: Set to `false` in production
- `APIM_MANAGEMENT_URL`: Your APIM management endpoint
- `APIM_API_VERSION`: API version for APIM calls

## Testing Authentication

### 1. Check Container App Logs

```powershell
# Get container app logs
az containerapp logs show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group rg-komatsu-apim-portal-dev `
  --tail 50
```

Look for:
- ✅ `Azure Managed Identity credential initialized (User-Assigned: xxx)`
- 🔑 `Access token acquired, expires at ...`

### 2. Test the BFF Endpoint

```powershell
# Get the container app URL
$appUrl = az containerapp show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group rg-komatsu-apim-portal-dev `
  --query properties.configuration.ingress.fqdn -o tsv

# Test health endpoint
curl "https://$appUrl/health"

# Test APIM proxy (example)
curl "https://$appUrl/apis?api-version=2021-08-01"
```

## Troubleshooting

### Managed Identity Not Showing Up

**Symptom**: Can't find the managed identity in the portal

**Solution**:
1. Check deployment status:
   ```powershell
   az deployment group show `
     --resource-group rg-komatsu-apim-portal-dev `
     --name container-app
   ```

2. Verify the identity exists:
   ```powershell
   az identity list `
     --resource-group rg-komatsu-apim-portal-dev
   ```

3. Redeploy if needed:
   ```powershell
   .\deploy.ps1 -Environment dev
   ```

### Authentication Errors

**Symptom**: BFF logs show "Failed to acquire access token"

**Possible Causes**:
1. **Missing RBAC permissions**: Grant "API Management Service Contributor" role
2. **Wrong APIM URL**: Verify `APIM_MANAGEMENT_URL` in parameters
3. **Identity not assigned**: Check Container App identity configuration

**Verify RBAC**:
```powershell
# Check role assignments for the managed identity
$principalId = az identity show `
  --name komatsu-apim-portal-dev-identity `
  --resource-group rg-komatsu-apim-portal-dev `
  --query principalId -o tsv

az role assignment list --assignee $principalId --all
```

### Token Acquisition Fails

**Symptom**: "DefaultAzureCredential failed to retrieve a token"

**Solutions**:

1. **Check Container App identity**:
   ```powershell
   az containerapp show `
     --name komatsu-apim-portal-dev-ca `
     --resource-group rg-komatsu-apim-portal-dev `
     --query identity
   ```

   Should show both `SystemAssigned` and `UserAssigned` identities.

2. **Verify environment variables**:
   ```powershell
   az containerapp show `
     --name komatsu-apim-portal-dev-ca `
     --resource-group rg-komatsu-apim-portal-dev `
     --query properties.template.containers[0].env
   ```

   Look for `MANAGED_IDENTITY_CLIENT_ID`.

3. **Restart the Container App**:
   ```powershell
   az containerapp revision restart `
     --name komatsu-apim-portal-dev-ca `
     --resource-group rg-komatsu-apim-portal-dev
   ```

## Security Best Practices

1. **Use User-Assigned Identity** for easier management and rotation
2. **Grant Least Privilege**: Only assign necessary RBAC roles
3. **Monitor Access**: Enable diagnostic logs on APIM
4. **Rotate Secrets**: Managed identities don't use secrets, but review other credentials
5. **Audit Regularly**: Review role assignments periodically

## Additional Resources

- [Azure Managed Identities Documentation](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)
- [Azure Container Apps Identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity)
- [Azure APIM Access Policies](https://learn.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential)
