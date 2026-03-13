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

@description('Service Principal Tenant ID for APIM API access')
param apimSpTenantId string = ''

@description('Service Principal Client ID for APIM API access')
param apimSpClientId string = ''

@secure()
@description('Service Principal Client Secret for APIM API access')
param apimSpClientSecret string = ''

@description('ARM API scope for service principal token acquisition')
param apimArmScope string = '${az.environment().resourceManager}.default'

@description('Data API scope for service principal token acquisition')
param apimDataApiScope string = '${az.environment().resourceManager}.default'

// Variables
var resourcePrefix = '${appName}-${environment}'
var containerAppName = '${resourcePrefix}-ca'
var containerAppEnvName = '${resourcePrefix}-env'
var logAnalyticsName = '${resourcePrefix}-logs'
var appInsightsName = '${resourcePrefix}-ai'
var acrName = !empty(acrNameOverride) ? acrNameOverride : replace('${resourcePrefix}acr', '-', '')

// Determine if using existing identity
var useExistingIdentity = !empty(existingManagedIdentityId) && !empty(existingManagedIdentityClientId)

// Entra ID login endpoint (cloud-agnostic)
var loginEndpoint = az.environment().authentication.loginEndpoint

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
        {
          name: 'apim-sp-client-secret'
          value: apimSpClientSecret
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
            cpu: json('1.0')
            memory: '2Gi'
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
            // .NET BFF also reads this as Data API URL (when UseDataApi=true)
            {
              name: 'Apim__DataApiUrl'
              value: portalApiBackendUrl
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsights.properties.ConnectionString
            }
            // .NET BFF configuration (ASP.NET Core environment variables)
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:3001'
            }
            {
              name: 'Apim__SubscriptionId'
              value: azureSubscriptionId
            }
            {
              name: 'Apim__ResourceGroup'
              value: azureResourceGroup
            }
            {
              name: 'Apim__ServiceName'
              value: apimServiceName
            }
            {
              name: 'Apim__ApiVersion'
              value: '2022-08-01'
            }
            {
              name: 'Apim__ManagedIdentityClientId'
              value: useExistingIdentity ? existingManagedIdentityClientId : ''
            }
            // Service Principal credentials for ARM / Data API access
            {
              name: 'Apim__ServicePrincipal__TenantId'
              value: apimSpTenantId
            }
            {
              name: 'Apim__ServicePrincipal__ClientId'
              value: apimSpClientId
            }
            {
              name: 'Apim__ServicePrincipal__ClientSecret'
              secretRef: 'apim-sp-client-secret'
            }
            {
              name: 'Apim__ArmScope'
              value: apimArmScope
            }
            {
              name: 'Apim__DataApiScope'
              value: apimDataApiScope
            }
            {
              name: 'EntraId__TenantId'
              value: workforceTenantId
            }
            {
              name: 'EntraId__ClientId'
              value: entraClientId
            }
            {
              name: 'EntraId__ExternalTenantId'
              value: externalTenantId
            }
            {
              name: 'EntraId__CiamHost'
              value: ciamHost
            }
            {
              name: 'EntraId__Instance'
              value: loginEndpoint
            }
            {
              name: 'EntraId__ValidAudiences__0'
              value: entraClientId
            }
            {
              name: 'EntraId__ValidAudiences__1'
              value: 'api://${entraClientId}'
            }
            {
              name: 'EntraId__ValidAudiences__2'
              value: portalApiScope
            }
            {
              name: 'EntraId__ValidIssuers__0'
              value: '${loginEndpoint}${workforceTenantId}/v2.0'
            }
            {
              name: 'EntraId__ValidIssuers__1'
              value: 'https://sts.windows.net/${workforceTenantId}/'
            }
            {
              name: 'EntraId__ValidIssuers__2'
              value: '${loginEndpoint}${externalTenantId}/v2.0'
            }
            {
              name: 'EntraId__ValidIssuers__3'
              value: 'https://sts.windows.net/${externalTenantId}/'
            }
            {
              name: 'EntraId__ValidIssuers__4'
              value: 'https://${ciamHost}/${externalTenantId}/v2.0'
            }
            {
              name: 'Features__UseMockMode'
              value: 'false'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: useExistingIdentity ? existingManagedIdentityClientId : ''
            }
            // Env vars passed through to supervisord / docker-entrypoint.sh
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
            {
              name: 'ENTRA_TENANT_ID'
              value: workforceTenantId
            }
            {
              name: 'ENTRA_CLIENT_ID'
              value: entraClientId
            }
            {
              name: 'ENTRA_EXTERNAL_TENANT_ID'
              value: externalTenantId
            }
            {
              name: 'ENTRA_CIAM_HOST'
              value: ciamHost
            }
            // Service Principal env vars for supervisord / docker-entrypoint.sh
            {
              name: 'APIM_SP_TENANT_ID'
              value: apimSpTenantId
            }
            {
              name: 'APIM_SP_CLIENT_ID'
              value: apimSpClientId
            }
            {
              name: 'APIM_SP_CLIENT_SECRET'
              secretRef: 'apim-sp-client-secret'
            }
            {
              name: 'APIM_ARM_SCOPE'
              value: apimArmScope
            }
            {
              name: 'APIM_DATA_API_SCOPE'
              value: apimDataApiScope
            }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 10
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 15
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
              initialDelaySeconds: 10
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
