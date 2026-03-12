using './main.bicep'

param appName = 'sampleapp'
param environment = 'dev'
param location = 'eastus'

param containerAppsEnvironmentName = 'cae-sampleapp-dev'
param acrName = 'sampleappacrdev'

param webAppName = 'sampleapp-web-dev'
param orchestratorAppName = 'sampleapp-orchestrator-dev'

param logAnalyticsWorkspaceName = 'log-sampleapp-dev'
param applicationInsightsName = 'appi-sampleapp-dev'

param storageAccountName = 'sampleappdevstorage'
param blobContainerName = 'app-files'

param keyVaultName = 'kv-sampleapp-dev'

param postgresServerName = 'psql-sampleapp-dev'
param postgresDatabaseName = 'appdb'
param postgresAdminUsername = 'pgadmin'

// REPLACE before real use. For CI/CD, pass via --parameters postgresAdminPassword="$PG_ADMIN_PASSWORD"
@secure()
param postgresAdminPassword = 'REPLACE-ME-IN-REAL-USAGE'

param webCpu = 1
param webMemory = '2Gi'
param orchestratorCpu = 1
param orchestratorMemory = '2Gi'

param webMinReplicas = 1
param webMaxReplicas = 2

param orchestratorMinReplicas = 1
param orchestratorMaxReplicas = 2

param enableWebIngress = true
param enableOrchestratorIngress = false

param webTargetPort = 3000
param orchestratorTargetPort = 3001
