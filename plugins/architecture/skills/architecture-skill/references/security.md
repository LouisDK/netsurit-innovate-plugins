# Security

This document defines the standard security model for **single-tenant Azure applications**. It ensures security is applied consistently without forcing every team to invent its own controls — strong, supportable, and proportionate to actual risk.

Complements: `SKILL.md` · `architecture.md` · `decision-framework.md` · `observability.md` · `deployment.md` · `data-patterns.md` · `web-and-api-patterns.md` · `local-development.md`

---

# Security Principles

- **Follow the standard decision order** — security is evaluated after functionality and supportability, before simplicity and cost. We don't introduce controls that are unnecessarily complex or brittle, but we don't accept shortcuts that leave identity, secrets, authorization, or visibility weak.
- **Secure by default** — the baseline architecture already assumes Entra ID, Key Vault, HTTPS, managed identities, backend authorization, least privilege, and structured logging. Teams shouldn't invent these from scratch.
- **Supportable security** — consistent and understandable beats theoretically stronger but operationally fragile. Prefer Azure-native identity, secrets, ingress, and WAF patterns.
- **Minimize sensitive exposure** — secrets, credentials, authorization logic, and sensitive AI content belong behind the orchestrator and managed services, not spread through UI code or ad hoc scripts.
- **Least privilege** — services, users, and runtime components get only the access they need. Applies to user auth, database, Blob Storage, Key Vault, Azure resources, and AI providers.

---

# Standard Security Stack

The standard security baseline for single-tenant Azure applications:

- **Microsoft Entra ID** for authentication
- **Entra app roles / groups** for authorization inputs
- **Azure Key Vault** for production secret storage
- **Managed identities** for service-to-service Azure authentication where practical
- **HTTPS-only** ingress
- **Azure Application Gateway WAF** as the default production WAF recommendation
- **Azure Front Door** only as an approved exception for global edge needs
- **Backend authorization enforcement** in the orchestrator
- **OpenTelemetry + Azure Monitor** for operational security visibility
- **PostgreSQL + Blob Storage** access constrained to the backend/orchestrator layer

---

# Identity and Authentication

**Microsoft Entra ID** is the standard authentication system.

- Provides enterprise-managed identity, centralized access lifecycle, and predictable integration with internal user populations
- Applications should not create standalone username/password systems unless explicitly justified
- Single-tenant model: one Microsoft tenant, one identity boundary, enterprise-managed users
- Finer-grained data access (by business unit, geography, or role) is still enforced within the Entra ID model

**Session and auth handling:** The web layer may participate in session handling, but authentication authority is rooted in Entra ID. Don't fragment auth decisions across frontend-only checks, inconsistent middleware, or duplicated role evaluation. The backend/orchestrator is the ultimate enforcement boundary.

**Fastify auth middleware example:**

```typescript
// Verify Entra ID JWT and attach user context to request
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.code(401).send({ error: 'Authentication required' });
  const claims = await verifyEntraToken(token, { audience: config.entraClientId });
  request.user = { id: claims.oid, roles: claims.roles ?? [] };
});
```

---

# Authorization

- **Make it explicit** — use app roles in Entra ID, group-based access, and clear backend checks with named, understandable rules
- **Backend enforces, UI reflects** — the UI can show/hide features based on permissions, but no protected action should rely on the frontend alone
- **Data scoping** — business-unit, regional, or country-based data separation must be enforced in backend logic and data access, not only in the presentation layer

**Role-based access check:**

```typescript
function requireRole(role: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user.roles.includes(role))
      return reply.code(403).send({ error: 'Insufficient permissions' });
  };
}
// Usage: fastify.get('/admin/users', { preHandler: requireRole('Admin') }, handler);
```

**Avoid:** hidden role logic in UI components, implicit access rules that are hard to audit, authorization depending entirely on client-side state.

---

# Secrets and Credentials

**Azure Key Vault** is the standard for database credentials, API keys, client secrets, certificates, and other production secrets.

- Production secrets must not live in source control, config files, deployment scripts, or application code
- Local development may use environment variables or approved local mechanisms — this doesn't redefine the production model
- Limit secret access to only the services and operators that genuinely need it
- Prefer **managed identities** over static credentials for Azure-to-Azure authentication — reduces secret sprawl, rotation burden, and exposure risk
- Use static secrets only when no practical managed-identity path exists

**Key Vault secret access:**

```typescript
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const secrets = new SecretClient(process.env.KEY_VAULT_URL!, new DefaultAzureCredential());
const dbPassword = await secrets.getSecret('db-password');
```

**Anti-pattern — hardcoded secrets vs correct approach:**

```typescript
// BAD: secret in source code — exposed in git history, logs, and builds
const apiKey = 'sk-live-abc123-hardcoded-key';
const db = connectDb({ password: 'ProductionPass!' });

// GOOD: secrets from Key Vault or environment, never in code
const apiKey = (await secrets.getSecret('api-key')).value;
const db = connectDb({ password: process.env.DB_PASSWORD });
```

---

# Application and Runtime Security

- **Backend is the trust boundary** — business rules, authorization, data access, provider integrations, AI orchestration, and secret-dependent operations belong in the orchestrator. This is why the standard prefers separate web and orchestrator containers.
- **Stateless services** — use managed persistence (PostgreSQL, Blob Storage, Key Vault, Redis when justified). No hidden runtime state.
- **Dependency control** — keep third-party dependencies limited and intentional, especially in auth, secrets, job execution, scheduling, ingress, and AI integration. A smaller dependency surface is easier to secure.

---

# Network, Ingress, and Edge Security

- **HTTPS everywhere** — unencrypted access is not part of production design
- **Default WAF: Application Gateway WAF** — the normal path for regional ingress and standard enterprise web apps
- **Exception: Azure Front Door** — approved only when the app clearly needs global edge routing, multi-region ingress, or broader internet acceleration
- **Avoid unnecessary edge complexity** — don't default to global edge services, advanced ingress layering, multiple WAF paths, or extra network appliances without real justification

---

# Database and Storage Security

- Database and Blob Storage access belongs behind the orchestrator — the web layer should not handle database credentials, privileged queries, or raw storage access
- Services should access only the data they need: limit query scope, apply authorization filters, minimize bulk exposure, avoid accidental over-fetching of sensitive records, and constrain file access patterns
- Database migrations should be explicit, versioned, reviewable, and part of the deployment process — operational convenience should not lead to uncontrolled schema changes in production
- Blob Storage access should be mediated through backend logic, scoped carefully, logged or auditable where important, and consistent with authorization rules

---

# Background Jobs and Scheduled Tasks Security

- Jobs and scheduled tasks follow the same security model as interactive requests: controlled identities, authorization/data-scope logic, no broad privileged access, traceable telemetry
- Prefer **PostgreSQL-backed jobs and schedules** — fewer infrastructure products mean fewer credentials and fewer management surfaces
- Don't introduce RabbitMQ or custom brokers casually — extra messaging infrastructure expands the security surface
- Scheduled execution should be durable, reviewable, and observable — not cron in containers, in-memory timers, or loosely governed scripts

---

# Observability and Security Visibility

Security requires operational visibility, not just prevention.

**Log security-relevant events:**
- Auth/authorization outcomes, secret/config validation results, dependency failures, abnormal job/schedule failure rates, security-sensitive admin actions, AI provider failures or abnormal usage

**Avoid logging sensitive data:**
- Secrets, tokens, credentials, protected headers, full prompt/response content by default, sensitive personal or business data unless explicitly justified

Signals should be structured, queryable, and tied to trace/correlation context. See `observability.md` for the full observability model.

---

# AI and LLM Security Guidance

**Keep AI orchestration in the backend** — model invocation, retrieval orchestration, tool selection, fallback logic, prompt construction with sensitive context, provider auth, and cost/policy enforcement all belong in the orchestrator.

**Treat prompts and retrieved content as sensitive by default** — they may contain internal business information, user data, or derived sensitive content. Don't log broadly or expose casually.

**Tool-calling discipline:**
- Keep tool surfaces narrow
- Validate inputs and outputs explicitly
- Avoid tools with broad destructive capability unless clearly required
- Keep side effects explicit and auditable

**Human review where appropriate** — for higher-risk AI actions, consider approval workflows, confirmation steps, or additional audit visibility based on the business action being taken.

---

# Secure Defaults for Delivery and Operations

- **CI/CD** — standardized, controlled pipelines with scoped credentials, no embedded secrets, traceability to code versions, consistent validation steps
- **Operational scripts** (logs, health, restart, deploy verification, migrations) — standardized, documented, minimally privileged. Avoid one-off scripts with unclear provenance.
- **Change traceability** — operations should be traceable to deploy version, commit/build identifier, migration version, and environment

---

# Secure Development Guidance

- **Reuse the standard** — don't independently invent auth models, secret handling, queue/scheduler security, ingress models, or AI provider patterns
- **Validate at boundaries** — inbound API input, tool input/output, job payloads, schedule config, file metadata, external integration responses
- **Minimize privilege in code** — keep powerful actions centralized and easy to inspect, not spread across many layers

---

# Scope, Checklist, and Evolution

**Good fit for:** internal line-of-business apps, single-tenant enterprise apps, small-team operations, AI-enabled apps needing practical governance, Azure-first deployments, greenfield solutions.

**Not trying to be:** a universal enterprise cybersecurity program, every regulatory requirement for every domain, a bespoke zero-trust architecture per app, a full threat model for every workload, or a reason to over-engineer low-risk applications. Applications with special regulatory, legal, or domain-specific requirements may need additional controls, but those should build on the standard rather than replace it.

**Production checklist — a production app should usually include:**
- Entra ID authentication with explicit backend authorization and app roles
- Key Vault for secrets, managed identities where practical
- HTTPS-only ingress with Application Gateway WAF where needed
- Backend-only access to database and sensitive integrations
- Structured security-relevant logs with request correlation
- Controlled job/schedule execution, secure AI/provider patterns where applicable
- Deployment/version traceability and documented operational scripts

**What good looks like** — a team should be able to answer: Who can access the app? How is access enforced? Where are secrets? Which identity accesses which resource? Can jobs and AI usage be traced and governed? Can we investigate failures without exposing sensitive data?

**Evolution** — start with the baseline (Entra ID, Key Vault, backend auth, HTTPS, least privilege, managed identities, structured telemetry, controlled jobs, secure AI boundaries). Layer on stricter controls later where justified. The goal is a consistent, supportable, Azure-aligned security baseline that teams apply reliably.
