/**
 * Health Check Routes Template for Fastify
 *
 * This is a reference template. Copy to apps/orchestrator/src/health-routes.ts
 * and adapt dependency checks to your application's services.
 *
 * Three-tier health check pattern:
 * - /api/health: Liveness (fast, no dependencies)
 * - /api/ready: Readiness (checks critical dependencies like database)
 * - /api/health/diagnostics: Full diagnostics (admin only)
 */

import { FastifyPluginAsync } from 'fastify';
// import { healthCheck as dbHealthCheck } from './pool';
// import { requireAuth, requireRole } from './auth-middleware';

interface DependencyCheck {
  status: 'ok' | 'error' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'ready' | 'not_ready' | 'degraded';
  timestamp: string;
  version?: string;
  checks?: Record<string, DependencyCheck>;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/health — Liveness probe
   *
   * Purpose: Tell the platform the process is alive.
   * Speed: Must be fast (< 10ms). No dependency checks.
   * Used by: Container Apps liveness probe.
   */
  app.get('/api/health', async (): Promise<HealthResponse> => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.BUILD_VERSION || 'dev',
    };
  });

  /**
   * GET /api/ready — Readiness probe
   *
   * Purpose: Tell the platform the service can handle requests.
   * Speed: Can take up to 500ms (checks dependencies).
   * Returns: 200 if ready, 503 if not ready.
   * Used by: Container Apps readiness probe, deploy verification.
   */
  app.get('/api/ready', async (_request, reply): Promise<HealthResponse> => {
    const checks: Record<string, DependencyCheck> = {};

    // Check PostgreSQL connection pool
    checks.database = await checkDatabase();

    // Add more checks as needed:
    // checks.blobStorage = await checkBlobStorage();
    // checks.externalApi = await checkExternalApi();

    const statuses = Object.values(checks).map((c) => c.status);
    const allOk = statuses.every((s) => s === 'ok');
    const anyError = statuses.some((s) => s === 'error');

    let status: 'ready' | 'not_ready' | 'degraded';
    if (allOk) {
      status = 'ready';
    } else if (anyError) {
      status = 'not_ready';
    } else {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.BUILD_VERSION || 'dev',
      checks,
    };

    if (status === 'not_ready') {
      return reply.status(503).send(response);
    }

    return response;
  });

  /**
   * GET /api/health/diagnostics — Full diagnostics (admin only)
   *
   * Purpose: Debugging production issues.
   * Auth: Should require admin role in production.
   * Returns: Detailed system info, masked env vars, all dependency checks.
   */
  app.get(
    '/api/health/diagnostics',
    // Uncomment when auth is set up:
    // { preHandler: [requireAuth, requireRole('{app-name}.Admin')] },
    async (_request, reply) => {
      const startTime = Date.now();

      const diagnostics = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.BUILD_VERSION || 'dev',

        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },

        environment: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          DATABASE_URL: maskSecret(process.env.DATABASE_URL),
          AZURE_AD_CLIENT_ID: maskSecret(process.env.AZURE_AD_CLIENT_ID),
          AZURE_AD_TENANT_ID: maskSecret(process.env.AZURE_AD_TENANT_ID),
          APPLICATIONINSIGHTS_CONNECTION_STRING: maskSecret(
            process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
          ),
        },

        checks: {
          database: await checkDatabase(),
        },

        diagnosticsLatencyMs: Date.now() - startTime,
      };

      return reply.send(diagnostics);
    },
  );
};

// ============================================================================
// Dependency Check Functions
// ============================================================================

async function checkDatabase(): Promise<DependencyCheck> {
  const startTime = Date.now();

  try {
    // Replace with actual pool health check:
    // const result = await dbHealthCheck();
    // return result;

    // Placeholder — remove when pool.ts is wired up
    return {
      status: 'ok',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function maskSecret(value?: string): string {
  if (!value) return '(not set)';
  if (value.length <= 12) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
