/**
 * Fastify Server Initialization Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/server.ts
 * and adapt plugin registration, routes, and configuration to your application.
 *
 * Features:
 * - OpenTelemetry SDK setup (must be called before other imports)
 * - Fastify instance with structured logging (pino)
 * - Plugin registration pattern
 * - Graceful shutdown (SIGTERM/SIGINT)
 * - Config validation at startup
 * - Request ID via Fastify built-in
 */

// ============================================================================
// OpenTelemetry must be initialized BEFORE any other imports
// ============================================================================
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { getConfig, validateConfig, isProd } from './config';

const config = getConfig();

const sdk = new NodeSDK({
  traceExporter: config.applicationInsightsConnectionString
    ? new AzureMonitorTraceExporter({
        connectionString: config.applicationInsightsConnectionString,
      })
    : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// ============================================================================
// Application imports (after OTel init)
// ============================================================================
import Fastify from 'fastify';
import { healthRoutes } from './health-routes';
// import { requireAuth } from './auth-middleware';
// import { initPool, closePool } from './pool';

const app = Fastify({
  logger: {
    level: isProd() ? 'info' : 'debug',
    // Structured JSON logging in production, pretty in dev
    ...(isProd() ? {} : { transport: { target: 'pino-pretty' } }),
  },
  requestId: undefined, // Use Fastify's built-in request ID
  genReqId: (req) => {
    return (req.headers['x-request-id'] as string) || crypto.randomUUID();
  },
});

// ============================================================================
// Plugin Registration
// ============================================================================
async function registerPlugins(): Promise<void> {
  // Health routes (no auth required)
  await app.register(healthRoutes);

  // Application routes (add your route plugins here)
  // await app.register(myAppRoutes, { prefix: '/api' });
}

// ============================================================================
// Startup
// ============================================================================
async function start(): Promise<void> {
  try {
    // Validate configuration before starting
    validateConfig();

    // Initialize database pool
    // await initPool();

    // Register all plugins
    await registerPlugins();

    // Start listening
    const address = await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    app.log.info(`Server listening at ${address}`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================
async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Received shutdown signal');

  try {
    await app.close();
    // await closePool();
    sdk.shutdown();
    app.log.info('Server shut down gracefully');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

// ============================================================================
// Usage Example
// ============================================================================
/*
// package.json scripts:
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}

// tsconfig.json:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
*/
