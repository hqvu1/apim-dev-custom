# Komatsu API Management Portal - Azure Container Apps Deployment Guide

This guide covers deploying the Komatsu API Management Portal to Azure Container Apps using containerization.

> **💡 Recommended**: Use [GitHub Actions for automated deployments](../.github/GITHUB_ACTIONS_SETUP.md). This guide covers manual deployment using scripts.

## 🏗️ Architecture Overview

The application is deployed as a containerized React SPA (Single Page Application):
- **Frontend**: React application built with Vite and Material-UI
- **Web Server**: Nginx serving static files
- **Container**: Linux-based Alpine with Nginx
- **Azure Services**: Container Apps, Container Registry, Log Analytics, Application Insights
- **CI/CD**: GitHub Actions workflows with Bicep infrastructure deployment

## 📋 Prerequisites

### Required Tools
- **Azure CLI** (latest version) - [Install](https://aka.ms/installazurecli)
- **Docker Desktop** - [Install](https://www.docker.com/products/docker-desktop)
- **Node.js 20+** (for local development)
- **PowerShell 7+** (Windows) or **Bash** (Linux/macOS) for deployment scripts

### Azure Requirements
- Azure subscription with appropriate permissions
- Contributor access to create resource groups and resources
- Azure AD application registration for authentication

## 🚀 Quick Start Deployment

### 1. Configure Environment Variables

Create or update your `.env` file in the project root:

```env
VITE_AZURE_CLIENT_ID=your-azure-ad-client-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
VITE_AZURE_REDIRECT_URI=https://your-app-url/auth/callback
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=https://your-app-url
VITE_API_BASE_URL=https://your-apim-gateway.azure-api.net
```

### 2. Local Testing

Test the containerized application locally:

```bash
# Build and run using Docker Compose
docker-compose up --build

# Test the application
curl http://localhost:8080/health

# Access the app at http://localhost:8080
```

### 3. Azure Deployment

#### Option A: Using PowerShell (Windows)

```powershell
# Navigate to the azure directory
cd azure

# Deploy to development environment
.\deploy.ps1 -Environment dev

# Deploy to staging environment
.\deploy.ps1 -Environment staging

# Deploy to production environment with custom resource group
.\deploy.ps1 -Environment prod -ResourceGroup "rg-komatsu-apim-prod" -SubscriptionId "your-sub-id"
```

#### Option B: Using Bash (Linux/WSL/macOS)

```bash
# Make script executable
chmod +x azure/deploy.sh

# Navigate to the azure directory
cd azure

# Deploy to development environment
./deploy.sh dev

# Deploy to production environment
./deploy.sh prod rg-komatsu-apim-prod your-subscription-id
```

### 4. Manual Deployment Using Azure CLI

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "your-subscription-id"

# Create resource group
az group create --name "rg-komatsu-apim-portal-dev" --location "East US 2"

# Deploy infrastructure
az deployment group create \
  --resource-group "rg-komatsu-apim-portal-dev" \
  --template-file azure/container-app.bicep \
  --parameters @azure/parameters.dev.json
```

## 🔧 Configuration

### Environment Variables

The application requires these environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_AZURE_CLIENT_ID` | Azure AD Application (Client) ID | Yes | `12345678-1234-1234-1234-123456789012` |
| `VITE_AZURE_AUTHORITY` | Azure AD Authority URL with Tenant ID | Yes | `https://login.microsoftonline.com/YOUR_TENANT_ID` |
| `VITE_AZURE_REDIRECT_URI` | Redirect URI after login | Yes | `https://your-app.azurecontainerapps.io/auth/callback` |
| `VITE_AZURE_POST_LOGOUT_REDIRECT_URI` | Redirect URI after logout | Yes | `https://your-app.azurecontainerapps.io` |
| `VITE_API_BASE_URL` | Azure APIM Gateway URL | Yes | `https://your-apim.azure-api.net` |

### Parameter Files

Update the parameter files in the `azure` directory for each environment:

- `parameters.dev.json` - Development environment
- `parameters.staging.json` - Staging environment
- `parameters.prod.json` - Production environment

## 🏭 CI/CD Pipeline Setup

### GitHub Actions (Recommended)

The repository includes pre-configured GitHub Actions workflows for automated deployments.

**Complete setup guide**: See [../.github/GITHUB_ACTIONS_SETUP.md](../.github/GITHUB_ACTIONS_SETUP.md)

**Workflows included**:
- `.github/workflows/build-test.yml` - Build and test on PRs
- `.github/workflows/deploy-dev.yml` - Deploy to development
- `.github/workflows/deploy-staging.yml` - Deploy to staging
- `.github/workflows/deploy-prod.yml` - Deploy to production

**Features**:
- ✅ Automated deployments on branch push
- ✅ Bicep infrastructure deployment
- ✅ Docker image building in Azure ACR
- ✅ Environment-based approvals for production
- ✅ Deployment summaries with app URLs
- ✅ Passwordless authentication with federated credentials

### Alternative CI/CD Platforms

If you're using Azure DevOps or other CI/CD platforms, the deployment scripts (`deploy.ps1` or `deploy.sh`) can be integrated into your pipeline. The key steps are:
1. Authenticate to Azure
2. Run the Bicep deployment
3. Build and push the Docker image
4. Update the Container App

## 📊 Monitoring and Operations

### View Application Logs

```bash
# Follow real-time logs
az containerapp logs show \
  --name komatsu-apim-portal-dev-ca \
  --resource-group rg-komatsu-apim-portal-dev \
  --follow

# View recent logs
az containerapp logs show \
  --name komatsu-apim-portal-dev-ca \
  --resource-group rg-komatsu-apim-portal-dev \
  --tail 100
```

### Application Insights

Access metrics and telemetry in the Azure Portal:
1. Navigate to your Container App
2. Click on "Application Insights" in the left menu
3. View performance metrics, failures, and custom events

### Health Check

The application includes a health endpoint:

```bash
curl https://your-app.azurecontainerapps.io/health
```

### Scaling

Container Apps automatically scales based on HTTP traffic:

- **Development**: 1-3 replicas
- **Production**: 2-10 replicas
- **Scaling Rule**: 50 concurrent requests per replica

Manual scaling:

```bash
az containerapp update \
  --name komatsu-apim-portal-prod-ca \
  --resource-group rg-komatsu-apim-portal-prod \
  --min-replicas 2 \
  --max-replicas 20
```

## 🔒 Security Best Practices

### 1. Use Managed Identity

Enable managed identity for accessing Azure resources:

```bash
az containerapp identity assign \
  --name komatsu-apim-portal-prod-ca \
  --resource-group rg-komatsu-apim-portal-prod \
  --system-assigned
```

### 2. Store Secrets in Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name kv-komatsu-apim-prod \
  --resource-group rg-komatsu-apim-portal-prod

# Store secrets
az keyvault secret set \
  --vault-name kv-komatsu-apim-prod \
  --name azure-client-id \
  --value "your-client-id"
```

### 3. Enable HTTPS Only

The Bicep template configures HTTPS by default. Verify:

```bash
az containerapp show \
  --name komatsu-apim-portal-prod-ca \
  --resource-group rg-komatsu-apim-portal-prod \
  --query properties.configuration.ingress.allowInsecure
```

Should return: `false`

### 4. Restrict Network Access

Configure IP restrictions if needed:

```bash
az containerapp ingress access-restriction set \
  --name komatsu-apim-portal-prod-ca \
  --resource-group rg-komatsu-apim-portal-prod \
  --rule-name allow-corporate \
  --ip-address 203.0.113.0/24 \
  --action Allow
```

## 🛠️ Troubleshooting

### Container Won't Start

```bash
# Check revision status
az containerapp revision list \
  --name komatsu-apim-portal-dev-ca \
  --resource-group rg-komatsu-apim-portal-dev

# View container events
az containerapp logs show \
  --name komatsu-apim-portal-dev-ca \
  --resource-group rg-komatsu-apim-portal-dev \
  --type console
```

### Build Failures

1. Verify Docker is running locally
2. Check `.env` file has all required variables
3. Test build locally:
   ```bash
   docker build -t test:local .
   docker run -p 8080:8080 test:local
   ```

### Configuration Issues

Verify environment variables are set correctly:

```bash
az containerapp show \
  --name komatsu-apim-portal-dev-ca \
  --resource-group rg-komatsu-apim-portal-dev \
  --query properties.template.containers[0].env
```

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure CLI Reference](https://learn.microsoft.com/cli/azure/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)

## 📝 Cost Estimation

Approximate monthly costs (USD):

| Environment | Compute | ACR | Log Analytics | Total |
|-------------|---------|-----|---------------|-------|
| Development | $15-30 | $5 | $10 | $30-45 |
| Staging | $30-60 | $5 | $15 | $50-80 |
| Production | $100-300 | $10 | $30 | $140-340 |

*Costs vary based on usage, region, and scaling settings*

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Azure Container Apps logs
3. Contact the DevOps team
4. Open an issue in the repository
