// Azure Container Apps deployment for Komatsu API Management Portal
@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Application name')
param appName string = 'komatsu-apim-portal'

@description('Container image')
param containerImage string = 'komatsu-apim-portal:latest'

@description('Microsoft Entra ID Client ID')
param entraClientId string

@description('External (CIAM) Tenant ID')
param externalTenantId string

@description('Workforce Tenant ID')
param workforceTenantId string

@description('CIAM Host')
param ciamHost string = 'kltdexternaliddev.ciamlogin.com'

@description('Komatsu Portal System URL')
param kpsUrl string

@description('OAuth Login Scopes')
param loginScopes string = 'User.Read'

@description('Logout Mode')
@allowed(['msal-plus-bff', 'msal-only', 'direct'])
param logoutMode string = 'msal-plus-bff'

@description('Use mock authentication')
param useMockAuth string = 'false'

@description('Allow public home page')
param publicHomePage string = 'false'

@description('Portal API Base URL (APIM Gateway URL)')
param portalApiBase string

@description('Portal API OAuth Scope')
param portalApiScope string = 'api://komatsu-apim-portal/.default'

@description('Default Locale')
param defaultLocale string = 'en'

@description('AEM Logout URL (optional)')
param aemLogoutUrl string = ''

@description('CDN Icon URL (optional)')
param cdnIcon string = ''

@description('Base URL for redirects (optional)')
param baseUrl string = ''

@description('Portal API Backend URL for Nginx proxy / APIM Management URL')
param portalApiBackendUrl string

@description('Azure Subscription ID for ARM API calls')
param azureSubscriptionId string

@description('Azure Resource Group containing the APIM instance')
param azureResourceGroup string

@description('APIM Service Name')
param apimServiceName string

@description('Azure Container Registry name (optional, auto-generated if not provided)')
param acrNameOverride string = ''

@description('Existing User-Assigned Managed Identity Resource ID (full resource ID)')
param existingManagedIdentityId string = ''

@description('Existing User-Assigned Managed Identity Client ID')
param existingManagedIdentityClientId string = ''

// Variables
var resourcePrefix = '${appName}-${environment}'
var containerAppName = '${resourcePrefix}-ca'
var containerAppEnvName = '${resourcePrefix}-env'
var logAnalyticsName = '${resourcePrefix}-logs'
var appInsightsName = '${resourcePrefix}-ai'
var acrName = !empty(acrNameOverride) ? acrNameOverride : replace('${resourcePrefix}acr', '-', '')

// Determine if using existing identity
var useExistingIdentity = !empty(existingManagedIdentityId) && !empty(existingManagedIdentityClientId)

var commonTags = {
  Environment: environment
  Application: 'Komatsu API Management Portal'
  Owner: 'Komatsu IT'
  CostCenter: 'Engineering'
  Project: 'API Management Portal'
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: commonTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
      legacy: 0
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: commonTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 90
    DisableIpMasking: false
    DisableLocalAuth: false
  }
}

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  tags: commonTags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
  }
}

// Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvName
  location: location
  tags: commonTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// Container App - Using existing managed identity
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: commonTags
  identity: useExistingIdentity ? {
    type: 'SystemAssigned,UserAssigned'
    userAssignedIdentities: {
      '${existingManagedIdentityId}': {}
    }
  } : {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'entra-client-id'
          value: entraClientId
        }
        {
          name: 'portal-api-scope'
          value: portalApiScope
        }
        {
          name: 'app-insights-key'
          value: appInsights.properties.InstrumentationKey
        }
      ]
      maxInactiveRevisions: 5
    }
    template: {
      containers: [
        {
          name: 'apim-portal'
          image: '${acr.properties.loginServer}/${containerImage}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'VITE_ENTRA_CLIENT_ID'
              secretRef: 'entra-client-id'
            }
            {
              name: 'VITE_EXTERNAL_TENANT_ID'
              value: externalTenantId
            }
            {
              name: 'VITE_WORKFORCE_TENANT_ID'
              value: workforceTenantId
            }
            {
              name: 'VITE_CIAM_HOST'
              value: ciamHost
            }
            {
              name: 'VITE_KPS_URL'
              value: kpsUrl
            }
            {
              name: 'VITE_LOGIN_SCOPES'
              value: loginScopes
            }
            {
              name: 'VITE_LOGOUT_MODE'
              value: logoutMode
            }
            {
              name: 'VITE_USE_MOCK_AUTH'
              value: useMockAuth
            }
            {
              name: 'VITE_PUBLIC_HOME_PAGE'
              value: publicHomePage
            }
            {
              name: 'PUBLIC_HOME_PAGE'
              value: publicHomePage
            }
            {
              name: 'VITE_PORTAL_API_BASE'
              value: portalApiBase
            }
            {
              name: 'VITE_PORTAL_API_SCOPE'
              secretRef: 'portal-api-scope'
            }
            {
              name: 'VITE_DEFAULT_LOCALE'
              value: defaultLocale
            }
            {
              name: 'VITE_AEM_LOGOUT_URL'
              value: aemLogoutUrl
            }
            {
              name: 'VITE_CDN_ICON'
              value: cdnIcon
            }
            {
              name: 'VITE_BASE_URL'
              value: baseUrl
            }
            {
              name: 'PORTAL_API_BACKEND_URL'
              value: portalApiBackendUrl
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsights.properties.ConnectionString
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'BFF_PORT'
              value: '3001'
            }
            {
              name: 'USE_MOCK_MODE'
              value: 'false'
            }
            {
              name: 'MANAGED_IDENTITY_CLIENT_ID'
              value: useExistingIdentity ? existingManagedIdentityClientId : ''
            }
            {
              name: 'AZURE_SUBSCRIPTION_ID'
              value: azureSubscriptionId
            }
            {
              name: 'AZURE_RESOURCE_GROUP'
              value: azureResourceGroup
            }
            {
              name: 'APIM_SERVICE_NAME'
              value: apimServiceName
            }
            {
              name: 'APIM_API_VERSION'
              value: '2022-08-01'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// Outputs
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerRegistryLoginServer string = acr.properties.loginServer
output containerAppName string = containerApp.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output managedIdentityClientId string = useExistingIdentity ? existingManagedIdentityClientId : 'system-assigned'
