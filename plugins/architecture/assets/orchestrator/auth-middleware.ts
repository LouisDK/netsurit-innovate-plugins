/**
 * Entra ID (Azure AD) Authentication Middleware Template for Fastify
 *
 * This is a reference template. Copy to apps/orchestrator/src/auth-middleware.ts
 * and adapt role names and configuration to your application.
 *
 * Features:
 * - Azure AD JWT verification via JWKS
 * - JWKS key caching (24 hours)
 * - Role-based access control
 * - Optional auth for public-with-optional-identity routes
 * - Development bypass via x-dev-bypass header
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { getConfig } from './config';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
  tenantId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// ============================================================================
// JWKS Client (singleton, cached)
// ============================================================================

let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient {
  if (!jwksClient) {
    const config = getConfig();
    jwksClient = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${config.azureAd.tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 86_400_000, // 24 hours
    });
  }
  return jwksClient;
}

async function getSigningKey(kid: string): Promise<string> {
  const key = await getJwksClient().getSigningKey(kid);
  return key.getPublicKey();
}

// ============================================================================
// Middleware: requireAuth
// ============================================================================

/**
 * Authentication preHandler.
 * Validates Bearer JWT and attaches user to request.
 *
 * Usage:
 *   app.get('/api/me', { preHandler: [requireAuth] }, handler);
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const config = getConfig();

  // Development bypass (NEVER enable in production)
  if (
    config.nodeEnv === 'development' &&
    request.headers['x-dev-bypass'] === 'true'
  ) {
    request.user = {
      sub: 'dev-user',
      email: 'dev@localhost',
      name: 'Development User',
      roles: ['{app-name}.Admin', '{app-name}.User'],
    };
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    const kid = decoded.header.kid;
    if (!kid) throw new Error('Token missing key ID');

    const signingKey = await getSigningKey(kid);

    const payload = jwt.verify(token, signingKey, {
      audience: config.azureAd.clientId,
      issuer: `https://login.microsoftonline.com/${config.azureAd.tenantId}/v2.0`,
    }) as jwt.JwtPayload;

    request.user = {
      sub: payload.sub!,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      roles: payload.roles || [],
      tenantId: payload.tid,
    };
  } catch (error) {
    request.log.warn({ error }, 'Token verification failed');
    return reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}

// ============================================================================
// Middleware: requireRole
// ============================================================================

/**
 * Role-based authorization preHandler factory.
 *
 * Usage:
 *   app.get('/api/admin', { preHandler: [requireAuth, requireRole('{app-name}.Admin')] }, handler);
 *   app.get('/api/dashboard', { preHandler: [requireAuth, requireRole('{app-name}.Admin', '{app-name}.User')] }, handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    const hasRole = allowedRoles.some((role) => request.user!.roles.includes(role));
    if (!hasRole) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Required roles: ${allowedRoles.join(' or ')}`,
        },
      });
    }
  };
}

// ============================================================================
// Middleware: optionalAuth
// ============================================================================

/**
 * Optional auth — attaches user if token present, but does not fail.
 * Use for routes that work for both anonymous and authenticated users.
 *
 * Usage:
 *   app.get('/api/public', { preHandler: [optionalAuth] }, handler);
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const config = getConfig();
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) return;

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') return;

    const kid = decoded.header.kid;
    if (!kid) return;

    const signingKey = await getSigningKey(kid);
    const payload = jwt.verify(token, signingKey, {
      audience: config.azureAd.clientId,
      issuer: `https://login.microsoftonline.com/${config.azureAd.tenantId}/v2.0`,
    }) as jwt.JwtPayload;

    request.user = {
      sub: payload.sub!,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      roles: payload.roles || [],
      tenantId: payload.tid,
    };
  } catch {
    // Invalid token — just don't set user
  }
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
import { FastifyPluginAsync } from 'fastify';
import { requireAuth, requireRole, optionalAuth } from './auth-middleware';

export const appRoutes: FastifyPluginAsync = async (app) => {
  // Public route (no auth)
  app.get('/api/status', async () => ({ status: 'ok' }));

  // Public with optional identity
  app.get('/api/content', { preHandler: [optionalAuth] }, async (request) => {
    return {
      content: '...',
      viewedBy: request.user?.email || 'anonymous',
    };
  });

  // Authenticated (any logged-in user)
  app.get('/api/me', { preHandler: [requireAuth] }, async (request) => {
    return { user: request.user };
  });

  // Admin only
  app.delete(
    '/api/admin/users/:id',
    { preHandler: [requireAuth, requireRole('{app-name}.Admin')] },
    async (request) => {
      // ...
    },
  );
};
*/
