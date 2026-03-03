// ============================================================================
// QuestionPad Server - Azure Container Apps Infrastructure
// Usage: az deployment group create --template-file main.bicep --parameters baseName=questionpad
// ============================================================================

@description('Base name for all resources (lowercase, no special chars)')
@minLength(3)
@maxLength(20)
param baseName string = 'questionpad'

@description('Location for all resources')
param location string = resourceGroup().location

// ============================================================================
// Azure Container Registry
// ============================================================================
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${replace(baseName, '-', '')}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ============================================================================
// Log Analytics Workspace (required for Container Apps logging)
// ============================================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${baseName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ============================================================================
// Container Apps Environment
// ============================================================================
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${baseName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ============================================================================
// Container App: QuestionPad Server
// ============================================================================
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: baseName
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
      ]
    }
    template: {
      containers: [
        {
          name: 'questionpad-server'
          // Placeholder - replaced after first build
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'BASE_URL', value: 'https://${baseName}.${containerAppsEnv.properties.defaultDomain}' }
            { name: 'TTL_MINUTES', value: '60' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: { concurrentRequests: '10' }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Outputs (used by deployment scripts)
// ============================================================================
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output appFqdn string = containerApp.properties.configuration.ingress.fqdn
output appUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
