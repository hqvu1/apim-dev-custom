# 🚀 Azure Deployment Guide
## Komatsu API Management Portal

This guide will walk you through deploying your application to Azure Container Apps.

---

## 📋 Prerequisites

✅ **Verified:**
- Azure Subscription: `KAC_DigitalOffice_devtest_sub_01`
- Resource Group: `kac_apimarketplace_eus_dev_rg` (East US)
- Azure CLI installed and logged in
- Docker Desktop installed and running

---

## 🎯 What Will Be Created

1. **Azure Container Registry (ACR)**: `kapimdevacr`
   - Stores your Docker images

2. **Azure Container Apps Environment (CAE)**: `komatsu-apim-portal-dev-env`
   - Shared environment for container apps
   - Includes Log Analytics workspace

3. **Azure Container App (ACA)**: `komatsu-apim-portal-dev-ca`
   - Your running application
   - Auto-scaling enabled
   - Health checks configured

4. **Supporting Services**:
   - Application Insights for monitoring
   - Log Analytics for logs

---

## 🏃 Quick Start - One Command Deployment

### Option 1: Full Automated Deployment (Recommended)

Run the custom deployment script that does everything:

```powershell
.\deploy-to-azure.ps1
```

This will:
1. ✅ Check prerequisites
2. ✅ Set correct Azure subscription
3. ✅ Deploy infrastructure (ACR, CAE, ACA) using Bicep
4. ✅ Build Docker image with your environment variables
5. ✅ Push image to Azure Container Registry
6. ✅ Update Container App with new image
7. ✅ Give you the application URL

**Expected Duration:** 5-10 minutes

---

## 📝 Step-by-Step Manual Deployment

If you prefer to run each step manually:

### Step 1: Verify Azure Connection

```powershell
# Check you're logged in
az account show

# Set the correct subscription
az account set --subscription "121789fa-2321-4e44-8aee-c6f1cd5d7045"

# Verify resource group exists
az group show --name "kac_apimarketplace_eus_dev_rg"
```

### Step 2: Deploy Infrastructure Only

```powershell
# Deploy just the Azure resources (ACR, CAE, ACA) without building the app
.\deploy-to-azure.ps1 -DeployInfraOnly
```

This creates:
- Azure Container Registry
- Container Apps Environment
- Container App (placeholder)
- Log Analytics + App Insights

### Step 3: Build and Deploy Application

```powershell
# Build Docker image, push to ACR, and update Container App
.\deploy-to-azure.ps1
```

Or build manually:

```powershell
# Build the Docker image
docker build -t komatsu-apim-portal:dev .

# Login to ACR
az acr login --name kapimdevacr

# Tag and push
docker tag komatsu-apim-portal:dev kapimdevacr.azurecr.io/komatsu-apim-portal:dev
docker push kapimdevacr.azurecr.io/komatsu-apim-portal:dev

# Update Container App
az containerapp update `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --image kapimdevacr.azurecr.io/komatsu-apim-portal:dev
```

---

## 🔍 Monitoring & Troubleshooting

### View Application Logs

```powershell
# Follow logs in real-time
az containerapp logs show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --follow

# View recent logs (last 100 lines)
az containerapp logs show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --tail 100
```

### Check Application Status

```powershell
# Get Container App details
az containerapp show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --query "{name:name, fqdn:properties.configuration.ingress.fqdn, status:properties.runningStatus}"
```

### View in Azure Portal

```powershell
# Open Container App in portal
az containerapp browse `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg
```

---

## 🔧 Common Issues & Solutions

### Issue: Docker build fails

**Solution:**
```powershell
# Make sure Docker Desktop is running
# Check Docker status
docker info

# Try building with verbose output
docker build -t komatsu-apim-portal:dev --progress=plain .
```

### Issue: ACR login fails

**Solution:**
```powershell
# Ensure you're logged into Azure
az login

# Try logging into ACR again
az acr login --name kapimdevacr

# If still failing, check permissions
az acr show --name kapimdevacr --query id
```

### Issue: Application not starting

**Solution:**
```powershell
# Check container app logs
az containerapp logs show `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --follow

# Check revision status
az containerapp revision list `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  -o table
```

### Issue: Environment variables not set

**Solution:**
```powershell
# Update environment variables
az containerapp update `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --set-env-vars `
    "VITE_USE_MOCK_AUTH=false" `
    "PORTAL_API_BACKEND_URL=https://d-apim.developer.azure-api.net"
```

---

## 🔄 Update Deployment

After making code changes:

```powershell
# Rebuild and redeploy (skips infrastructure)
.\deploy-to-azure.ps1
```

Or manually:

```powershell
# 1. Build new image
docker build -t komatsu-apim-portal:dev .

# 2. Push to ACR
az acr login --name kapimdevacr
docker tag komatsu-apim-portal:dev kapimdevacr.azurecr.io/komatsu-apim-portal:dev
docker push kapimdevacr.azurecr.io/komatsu-apim-portal:dev

# 3. Update Container App (creates new revision)
az containerapp update `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --image kapimdevacr.azurecr.io/komatsu-apim-portal:dev
```

---

## 🧹 Cleanup (Delete Resources)

To delete everything (⚠️ WARNING: This will delete all deployed resources):

```powershell
# Delete just the container app
az containerapp delete `
  --name komatsu-apim-portal-dev-ca `
  --resource-group kac_apimarketplace_eus_dev_rg `
  --yes

# Or delete the entire resource group (deletes EVERYTHING)
az group delete `
  --name kac_apimarketplace_eus_dev_rg `
  --yes
```

---

## 📊 Cost Estimation

**Expected monthly costs (dev environment):**
- Azure Container Registry (Basic): ~$5/month
- Container Apps Environment: ~$0 (included)
- Container App (1 instance, 0.5 CPU, 1GB RAM): ~$15-20/month
- Log Analytics (5GB ingestion): ~$10/month
- Application Insights: ~$5/month

**Total: ~$35-40/month**

---

## 🎯 Next Steps

1. Run `.\deploy-to-azure.ps1` to deploy
2. Wait for deployment to complete (~5-10 minutes)
3. Open the application URL provided
4. Test the portal functionality
5. Set up CI/CD with GitHub Actions (optional)

---

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure Container Registry Documentation](https://learn.microsoft.com/en-us/azure/container-registry/)
- [Dockerfile Reference](../Dockerfile)
- [Bicep Template Reference](../azure/container-app.bicep)

---

## ✅ Deployment Checklist

Before deploying:
- [ ] Docker Desktop is running
- [ ] Azure CLI is installed and logged in
- [ ] `.env` file has correct configuration
- [ ] You're in the project root directory

After deployment:
- [ ] Application URL is accessible
- [ ] Health check endpoint returns 200 OK
- [ ] Logs show no errors
- [ ] Application Insights is receiving telemetry

---

**Ready to deploy? Run:** `.\deploy-to-azure.ps1`
