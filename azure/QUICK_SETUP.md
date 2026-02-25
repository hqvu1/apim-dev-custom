# Quick Setup: Create Managed Identity for APIM Access

This guide will help you create a managed identity and grant it access to your APIM instance.

## 🚀 Quick Start

### Option 1: Automated Script (Recommended)

Run the PowerShell script that does everything for you:

```powershell
cd azure
.\create-managed-identity.ps1
```

The script will:
1. ✅ Create a resource group (if needed)
2. ✅ Create a User-Assigned Managed Identity
3. ✅ Find your APIM instance
4. ✅ Grant the identity access to APIM
5. ✅ Output configuration for your BFF

### Option 2: Custom Parameters

If your APIM is in a different resource group or has a different name:

```powershell
.\create-managed-identity.ps1 `
  -ApimName "demo-apim-feb" `
  -ApimResourceGroup "rg-apim-production" `
  -IdentityName "my-custom-identity" `
  -ResourceGroup "rg-my-app-dev"
```

**Parameters:**
- `-ApimName`: Your APIM instance name (default: `demo-apim-feb`)
- `-ApimResourceGroup`: Resource group where APIM is located
- `-IdentityName`: Name for the managed identity
- `-ResourceGroup`: Resource group for the identity
- `-Location`: Azure region (default: `eastus`)
- `-SubscriptionId`: Azure subscription ID (optional)

## 📋 What Gets Created

### 1. Resource Group
- **Name**: `rg-komatsu-apim-portal-dev` (or your custom name)
- **Location**: `eastus`

### 2. Managed Identity
- **Name**: `komatsu-apim-portal-identity`
- **Type**: User-Assigned Managed Identity
- **Visibility**: ✅ Shows up in Azure Portal

### 3. RBAC Role Assignment
- **Role**: API Management Service Contributor
- **Scope**: Your APIM instance
- **Access**: Full read/write access to APIM

## 🔍 Verify in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Resource Groups** > `rg-komatsu-apim-portal-dev`
3. Find the resource: **`komatsu-apim-portal-identity`**
4. Click on it and go to **Azure role assignments**
5. Verify it has access to your APIM instance

## 🔧 Configure Your BFF

After running the script, update your `bff/.env` file:

```env
# Disable mock mode to use real Azure authentication
USE_MOCK_MODE=false

# Managed Identity Client ID (from script output)
AZURE_CLIENT_ID=your-managed-identity-client-id

# APIM Management URL
APIM_MANAGEMENT_URL=https://demo-apim-feb.management.azure-api.net
APIM_API_VERSION=2021-08-01
```

## 🧪 Test Locally

### 1. Login to Azure CLI
```powershell
az login
```

This allows `DefaultAzureCredential` to use your Azure CLI credentials for local testing.

### 2. Start the BFF
```powershell
cd bff
npm run dev
```

You should see:
```
✅ Azure Managed Identity credential initialized (User-Assigned: xxx)
🔑 Access token acquired, expires at ...
```

### 3. Test an API Call
```powershell
curl http://localhost:3001/apis?api-version=2021-08-01
```

## 🌩️ Deploy to Azure

### Option A: Update Bicep Parameters

Edit `azure/parameters.dev.json`:

```json
{
  "parameters": {
    "apimResourceId": {
      "value": "/subscriptions/{sub-id}/resourceGroups/{apim-rg}/providers/Microsoft.ApiManagement/service/demo-apim-feb"
    }
  }
}
```

### Option B: Use Existing Identity

If you ran the script, the identity is already created. Your Bicep deployment will use it automatically.

### Deploy

```powershell
cd azure
.\deploy.ps1 -Environment dev
```

## 🐛 Troubleshooting

### "APIM instance not found"

**Solution**: Specify the correct APIM name and resource group:
```powershell
.\create-managed-identity.ps1 `
  -ApimName "your-actual-apim-name" `
  -ApimResourceGroup "your-apim-resource-group"
```

List all APIM instances in your subscription:
```powershell
az apim list --query "[].{Name:name, ResourceGroup:resourceGroup}" --output table
```

### "Insufficient permissions"

**Problem**: You don't have permission to create role assignments.

**Solution**: You need one of these roles:
- **Owner** on the APIM resource
- **User Access Administrator** on the APIM resource
- **Contributor** + **User Access Administrator** on the subscription

Ask your Azure admin to:
1. Grant you the necessary permissions, OR
2. Run the script for you, OR
3. Manually assign the role in the Azure Portal

### "Failed to acquire access token"

**Problem**: BFF can't authenticate.

**Checklist**:
1. ✅ Run `az login` for local testing
2. ✅ Set `USE_MOCK_MODE=false` in `bff/.env`
3. ✅ Verify `AZURE_CLIENT_ID` matches the managed identity client ID
4. ✅ Check RBAC assignment in Azure Portal (APIM > Access control)
5. ✅ Restart the BFF server

### "Authorization failed" or 403 errors

**Problem**: Identity has no access to APIM.

**Solution**: Manually assign the role in Azure Portal:
1. Go to your APIM instance
2. Click **Access control (IAM)**
3. Click **+ Add** > **Add role assignment**
4. Select **API Management Service Contributor**
5. Click **Next**
6. Click **+ Select members**
7. Search for your managed identity name
8. Click **Select** > **Review + assign**

## 📊 View Role Assignments

Check what permissions the identity has:

```powershell
# Get the managed identity principal ID
$principalId = az identity show `
  --name komatsu-apim-portal-identity `
  --resource-group rg-komatsu-apim-portal-dev `
  --query principalId -o tsv

# List all role assignments
az role assignment list `
  --assignee $principalId `
  --all `
  --output table
```

## 🔐 Security Best Practices

1. **Use User-Assigned Identity**: Easier to manage and rotate
2. **Least Privilege**: Only grant necessary roles (Reader vs. Contributor)
3. **Separate Identities**: Use different identities for dev/staging/prod
4. **Monitor Access**: Enable diagnostic logs on APIM
5. **Audit Regularly**: Review role assignments monthly

## 📖 Additional Resources

- [Create User-Assigned Managed Identity](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/how-manage-user-assigned-managed-identities)
- [Azure RBAC Built-in Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential)
- [APIM Access Policies](https://learn.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies)

## 💡 FAQ

**Q: Can I use this identity for multiple apps?**  
A: Yes! User-assigned identities can be shared across multiple Azure resources.

**Q: What's the difference between System-Assigned and User-Assigned?**  
A: System-Assigned identities are tied to a single resource and deleted with it. User-Assigned identities are standalone resources you can share and manage independently.

**Q: Do I need to create a new identity for each environment?**  
A: Yes, it's recommended to have separate identities for dev, staging, and prod for better security isolation.

**Q: Can I use this with Azure Functions or App Service?**  
A: Absolutely! The same managed identity can be assigned to Functions, App Service, Container Apps, VMs, etc.

**Q: How do I revoke access?**  
A: Remove the role assignment from the APIM instance or delete the managed identity.
