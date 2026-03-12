targetScope = 'resourceGroup'

@description('Application short name, used in resource naming.')
param appName string

@description('Environment name, e.g. dev, test, prod.')
@allowed([
  'dev'
  'test'
  'prod'
])
param environment string

@description('Azure location for all resources.')
param location string = resourceGroup().location

@description('Container Apps environment name.')
param containerAppsEnvironmentName string

@description('Azure Container Registry name.')
param acrName string

@description('Web Container App name.')
param webAppName string

@description('Orchestrator Container App name.')
param orchestratorAppName string

@description('Log Analytics workspace name.')
param logAnalyticsWorkspaceName string

@description('Application Insights name.')
param applicationInsightsName string

@description('Storage account name. Must be globally unique and lowercase.')
param storageAccountName string

@description('Blob container name for application files.')
param blobContainerName string = 'app-files'

@description('Key Vault name.')
param keyVaultName string

@description('PostgreSQL server name.')
param postgresServerName string

@description('PostgreSQL database name.')
param postgresDatabaseName string = 'appdb'

@description('PostgreSQL admin username.')
param postgresAdminUsername string

@secure()
@description('PostgreSQL admin password.')
param postgresAdminPassword string

@description('Container CPU for web.')
param webCpu int = 1

@description('Container memory for web.')
param webMemory string = '2Gi'

@description('Container CPU for orchestrator.')
param orchestratorCpu int = 1

@description('Container memory for orchestrator.')
param orchestratorMemory string = '2Gi'

@description('Minimum replicas for web.')
param webMinReplicas int = 1

@description('Maximum replicas for web.')
param webMaxReplicas int = 2

@description('Minimum replicas for orchestrator.')
param orchestratorMinReplicas int = 1

@description('Maximum replicas for orchestrator.')
param orchestratorMaxReplicas int = 2

@description('Whether public ingress is enabled for the web app.')
param enableWebIngress bool = true

@description('Whether public ingress is enabled for the orchestrator app.')
param enableOrchestratorIngress bool = false

@description('Container port for the web app.')
param webTargetPort int = 3000

@description('Container port for the orchestrator app.')
param orchestratorTargetPort int = 3001

var tags = {
  application: appName
  environment: environment
  managedBy: 'bicep'
  architecture: 'azure-single-tenant-standard'
}

// Placeholder image for initial deployment before real images are pushed
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// ============================================================================
// Azure Container Registry
// ============================================================================
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ============================================================================
// Logging & Monitoring
// ============================================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ============================================================================
// Storage
// ============================================================================
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storage
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: blobContainerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

// ============================================================================
// Key Vault
// ============================================================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enabledForDeployment: false
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    publicNetworkAccess: 'Enabled'
    softDeleteRetentionInDays: 90
  }
}

// ============================================================================
// Key Vault Secrets
// ============================================================================
resource dbUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: 'database-url'
  parent: keyVault
  properties: {
    value: 'postgresql://${postgresAdminUsername}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'
  }
}

resource appInsightsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: 'appinsights-connection-string'
  parent: keyVault
  properties: {
    value: appInsights.properties.ConnectionString
  }
}

// ============================================================================
// PostgreSQL
// ============================================================================
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    highAvailability: {
      mode: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  name: postgresDatabaseName
  parent: postgres
}

resource postgresFirewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  name: 'AllowAzureServices'
  parent: postgres
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource postgresSecureTransport 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  name: 'require_secure_transport'
  parent: postgres
  properties: {
    value: 'ON'
    source: 'user-override'
  }
}

// ============================================================================
// Container Apps Environment
// ============================================================================
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, logAnalytics.apiVersion).primarySharedKey
      }
    }
  }
}

// ============================================================================
// Container App: Web (Next.js)
// ============================================================================
resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: webAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: enableWebIngress
        targetPort: webTargetPort
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      activeRevisionsMode: 'Single'
      secrets: [
        {
          name: 'appinsights-connection-string'
          keyVaultUrl: appInsightsConnectionStringSecret.properties.secretUri
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: placeholderImage
          resources: {
            cpu: json(string(webCpu))
            memory: webMemory
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment == 'prod' ? 'production' : 'development'
            }
            {
              name: 'APP_ENV'
              value: environment
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsights-connection-string'
            }
            {
              name: 'BLOB_CONTAINER_NAME'
              value: blobContainerName
            }
            {
              name: 'ORCHESTRATOR_BASE_URL'
              value: 'http://${orchestratorAppName}'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: webTargetPort
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/ready'
                port: webTargetPort
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: webMinReplicas
        maxReplicas: webMaxReplicas
      }
    }
  }
}

// ============================================================================
// Container App: Orchestrator (Fastify / backend)
// ============================================================================
resource orchestratorApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: orchestratorAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: enableOrchestratorIngress
        targetPort: orchestratorTargetPort
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      activeRevisionsMode: 'Single'
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: dbUrlSecret.properties.secretUri
          identity: 'system'
        }
        {
          name: 'appinsights-connection-string'
          keyVaultUrl: appInsightsConnectionStringSecret.properties.secretUri
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'orchestrator'
          image: placeholderImage
          resources: {
            cpu: json(string(orchestratorCpu))
            memory: orchestratorMemory
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment == 'prod' ? 'production' : 'development'
            }
            {
              name: 'APP_ENV'
              value: environment
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsights-connection-string'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'BLOB_CONTAINER_NAME'
              value: blobContainerName
            }
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storage.name
            }
            {
              name: 'KEY_VAULT_NAME'
              value: keyVault.name
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: orchestratorTargetPort
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/ready'
                port: orchestratorTargetPort
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: orchestratorMinReplicas
        maxReplicas: orchestratorMaxReplicas
      }
    }
  }
}

// ============================================================================
// RBAC Role Assignments
// ============================================================================

// Orchestrator -> Key Vault Secrets User
resource kvRoleAssignmentOrchestrator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, orchestratorApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: orchestratorApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Web -> Key Vault Secrets User
resource kvRoleAssignmentWeb 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, webApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Orchestrator -> ACR Pull
resource acrRoleAssignmentOrchestrator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, orchestratorApp.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: orchestratorApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Web -> ACR Pull
resource acrRoleAssignmentWeb 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webApp.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Orchestrator -> Storage Blob Data Contributor
resource storageRoleAssignmentOrchestrator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, orchestratorApp.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: orchestratorApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Web -> Storage Blob Data Contributor
resource storageRoleAssignmentWeb 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, webApp.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Outputs
// ============================================================================
output webAppName string = webApp.name
output orchestratorAppName string = orchestratorApp.name
output webAppUrl string = enableWebIngress ? 'https://${webApp.properties.configuration.ingress.fqdn}' : ''
output orchestratorInternalName string = orchestratorApp.name
output postgresServerFqdn string = postgres.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output keyVaultName string = keyVault.name
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
