# Quick Setup: Create App Registration (Service Principal) for APIM Access

> **⚠️ Updated March 2026:** This guide replaces the previous Managed Identity setup. The BFF now authenticates to Azure ARM / Data API using an **App Registration (Service Principal)** with `ClientSecretCredential` via `ITokenProvider`.

This guide will help you create an Azure Entra ID App Registration and grant it access to your APIM instance.

## 🚀 Quick Start

### Step 1: Create the App Registration

```powershell
# Login to Azure
az login

# Create the App Registration
$app = az ad app create --display-name "komatsu-apim-portal-bff" --query "{appId:appId, id:id}" -o json | ConvertFrom-Json
Write-Host "Client ID: $($app.appId)"

# Create a Service Principal for the app
az ad sp create --id $app.appId

# Create a client secret (valid for 1 year)
$secret = az ad app credential reset --id $app.appId --years 1 --query "{password:password}" -o json | ConvertFrom-Json
Write-Host "Client Secret: $($secret.password)"
Write-Host "⚠️  Save this secret — it cannot be retrieved later!"
```

### Step 2: Grant APIM Access (RBAC)

```powershell
# Get the Service Principal object ID
$spId = az ad sp show --id $app.appId --query id -o tsv

# Grant API Management Service Reader on the APIM instance
az role assignment create `
  --assignee-object-id $spId `
  --assignee-principal-type ServicePrincipal `
  --role "API Management Service Reader Role" `
  --scope "/subscriptions/{sub-id}/resourceGroups/{apim-rg}/providers/Microsoft.ApiManagement/service/demo-apim-feb"
```

> **Note:** Use **API Management Service Contributor** if the BFF needs write access (subscriptions, user management).

### Step 3: Note Your Tenant ID

```powershell
az account show --query tenantId -o tsv
```

## 📋 What Gets Created

| Resource | Name | Purpose |
|----------|------|---------|
| **App Registration** | `komatsu-apim-portal-bff` | Identity for the BFF to authenticate |
| **Service Principal** | (auto-created) | Enables RBAC role assignments |
| **Client Secret** | (generated) | Credential for `ClientSecretCredential` |
| **RBAC Assignment** | Reader or Contributor | Access to APIM instance |

## 🔧 Configure Your BFF

### For Local Development

Update `bff-dotnet/appsettings.Development.json`:

```json
{
  "Apim": {
    "ServicePrincipal": {
      "TenantId": "your-tenant-id",
      "ClientId": "your-app-registration-client-id",
      "ClientSecret": "your-client-secret"
    },
    "ArmScope": "https://management.azure.com/.default",
    "DataApiScope": "https://your-apim.management.azure-api.net/.default"
  }
}
```

### For Docker / Container Apps

Set these environment variables:

```env
Apim__ServicePrincipal__TenantId=your-tenant-id
Apim__ServicePrincipal__ClientId=your-app-registration-client-id
Apim__ServicePrincipal__ClientSecret=your-client-secret
Apim__ArmScope=https://management.azure.com/.default
Apim__DataApiScope=https://your-apim.management.azure-api.net/.default
```

## 🧪 Test Locally

### 1. Set configuration in appsettings.Development.json (see above)

### 2. Disable mock mode

In `appsettings.Development.json`, set:
```json
{
  "Features": {
    "UseMockMode": false
  }
}
```

### 3. Start the BFF

```powershell
cd bff-dotnet
dotnet run
```

You should see:
```
APIM Portal BFF (.NET 10) Started
Port:          http://localhost:3001
Auth:          App Registration (Service Principal) + JWT Bearer
```

### 4. Test an API Call

```powershell
curl http://localhost:3001/api/health
```

## 🌩️ Deploy to Azure

### Update Bicep Parameters

Edit `azure/parameters.dev.json` and add the Service Principal values:

```json
{
  "parameters": {
    "servicePrincipalTenantId": { "value": "your-tenant-id" },
    "servicePrincipalClientId": { "value": "your-app-registration-client-id" },
    "servicePrincipalClientSecret": { "value": "your-client-secret" }
  }
}
```

### Deploy

```powershell
cd azure
.\deploy.ps1 -Environment dev
```

## 🐛 Troubleshooting

### "Failed to acquire access token" / 401

**Checklist:**
1. ✅ Verify `TenantId`, `ClientId`, and `ClientSecret` are correct
2. ✅ Ensure the App Registration has a Service Principal (`az ad sp show --id <clientId>`)
3. ✅ Check that the secret has not expired (`az ad app credential list --id <clientId>`)
4. ✅ Verify the scope is correct (`https://management.azure.com/.default` for ARM)
5. ✅ Restart the BFF after changing configuration

### "Authorization failed" or 403

**Problem:** Service Principal has no RBAC access to APIM.

**Solution:** Assign a role in Azure Portal:
1. Go to your APIM instance
2. Click **Access control (IAM)**
3. Click **+ Add** > **Add role assignment**
4. Select **API Management Service Reader Role** (or Contributor)
5. Click **Next** > **Select members**
6. Search for `komatsu-apim-portal-bff`
7. Click **Select** > **Review + assign**

### "Client secret expired"

**Solution:** Rotate the secret:
```powershell
$newSecret = az ad app credential reset --id <appId> --years 1 --query password -o tsv
Write-Host "New secret: $newSecret"
# Update appsettings / Container App env vars / Key Vault
```

## 🔐 Security Best Practices

1. **Store secrets in Azure Key Vault** — never commit secrets to source control
2. **Least privilege** — use Reader role unless write access is needed
3. **Separate registrations per environment** — different App Registrations for dev/staging/prod
4. **Rotate secrets regularly** — set a reminder before expiry (max 2 years)
5. **Monitor sign-in logs** — review Entra ID sign-in logs for the Service Principal
6. **Use `@secure()` in Bicep** — the `container-app.bicep` already marks client secret as secure

## 📖 Additional Resources

- [Register an application with Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [ClientSecretCredential (Azure.Identity)](https://learn.microsoft.com/en-us/dotnet/api/azure.identity.clientsecretcredential)
- [Azure RBAC Built-in Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles)
- [APIM Access Policies](https://learn.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies)

## 💡 FAQ

**Q: Why App Registration instead of Managed Identity?**
A: App Registration (Service Principal) provides consistent authentication across all environments (local dev, Docker, Azure) without requiring Azure infrastructure. The `ClientSecretCredential` works identically everywhere.

**Q: Can I reuse one App Registration for all environments?**
A: It's recommended to create separate registrations for dev, staging, and prod for security isolation and independent secret rotation.

**Q: How do I store the secret securely in production?**
A: Use **Azure Key Vault** and reference it from Container Apps via Key Vault secrets. The `container-app.bicep` supports this pattern.

**Q: What permissions does the App Registration need?**
A: At minimum, **API Management Service Reader Role** on the APIM instance. For subscription management, use **API Management Service Contributor**.
