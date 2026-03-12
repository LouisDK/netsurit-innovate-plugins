/**
 * Typed Application Configuration Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/config.ts
 * and adapt to your application's configuration needs.
 *
 * Features:
 * - Typed config interface with nested sections
 * - Lazy singleton initialization
 * - Fail-fast validation in production
 * - isDev() / isProd() helpers
 */

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  applicationInsightsConnectionString?: string;

  azureAd: {
    tenantId: string;
    clientId: string;
  };

  azureStorage: {
    connectionString: string;
    blobContainerName: string;
  };
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    applicationInsightsConnectionString:
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,

    azureAd: {
      tenantId: process.env.AZURE_AD_TENANT_ID || '',
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
    },

    azureStorage: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      blobContainerName: process.env.BLOB_CONTAINER_NAME || 'app-files',
    },
  };

  return cachedConfig;
}

/**
 * Validate that all required configuration is present.
 * Call at startup. Fails fast in production if required vars are missing.
 */
export function validateConfig(): void {
  const config = getConfig();
  const missing: string[] = [];

  if (!config.databaseUrl) missing.push('DATABASE_URL');

  if (isProd()) {
    if (!config.azureAd.tenantId) missing.push('AZURE_AD_TENANT_ID');
    if (!config.azureAd.clientId) missing.push('AZURE_AD_CLIENT_ID');
    if (!config.applicationInsightsConnectionString) {
      missing.push('APPLICATIONINSIGHTS_CONNECTION_STRING');
    }
  }

  if (missing.length > 0) {
    const message = `Missing required configuration: ${missing.join(', ')}`;
    if (isProd()) {
      throw new Error(message);
    } else {
      console.warn(`[config] WARNING: ${message}`);
    }
  }
}

export function isDev(): boolean {
  return getConfig().nodeEnv === 'development';
}

export function isProd(): boolean {
  return getConfig().nodeEnv === 'production';
}
