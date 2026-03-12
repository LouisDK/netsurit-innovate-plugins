# Deployment

This document defines the standard deployment model for **single-tenant Azure applications**. It ensures deployments are repeatable, traceable, supportable by a small team, and aligned with the standard architecture.

Complements: `SKILL.md`, `architecture.md`, `decision-framework.md`, `observability.md`, `security.md`

---

# Deployment Principles

- **Repeatable over manual** — Deployments should be scriptable: provision infra via Bicep, build container images, push to ACR, deploy to Container Apps, run migrations, verify health.
- **Traceable over convenient** — Every deployment should trace to a commit, build, container image, environment, and migration set. Avoid relying only on `latest` tags or undocumented manual changes.
- **Simple enough for a small team** — One standard deployment script shape, one CI/CD path, explicit environments, tags, migration handling, and health verification. Prefer a clear, boring deployment path.
- **Keep infra and app deployment aligned** — Infrastructure and application deployment are separate concerns but should work together as one controlled release. Avoid infra drifting from app needs, app releases assuming undeployed infra, or secret/config changes happening outside the deployment path.

---

# Standard Deployment Model

1. **Provision or update infrastructure with Bicep**
2. **Build container images for web and orchestrator**
3. **Push images to Azure Container Registry**
4. **Deploy web and orchestrator to Azure Container Apps**
5. **Run or verify database migrations**
6. **Verify `/api/health` and `/api/ready`**
7. **Verify logs, revisions, and version info**
8. **Rollback by revision or redeploy if required**

This follows the `deploy.sh` workflow, which standardizes infra, build, deploy, status, rollback, and all-in-one commands.

## Standard deployment target: Azure Container Apps

Normally this means:
- One Container App for web, one for orchestrator
- Shared environment and supporting Azure resources
- Environment-specific configuration and secret references
- Health/readiness probes configured

## Revision-based deployment

- Create a new revision when app code changes
- Verify the new revision becomes healthy
- Keep visibility into current and previous revisions
- Support rollback by revision when necessary

A deploy is not successful just because the Container Apps update API returned success. Success requires: new revision created, readiness passing, health passing, expected version visible, and basic smoke behavior confirmed where appropriate.

---

# Standard Environments

Define a small set: `dev`, `test`/`staging`, `prod`. Keep names consistent across Bicep parameter files, resource naming, GitHub Actions workflows, image deployment logic, and environment-specific config. Avoid ad hoc environments without real operational need.

Each environment should have:
- Clear configuration boundaries and separate secrets
- Separate database instances or schemas as appropriate
- Distinct deployment targets and monitoring context

Production should not depend on runtime shortcuts used in development.

---

# Infrastructure as Code

## Standard choice: Bicep

Bicep should define standard Azure resources: resource group references, ACR, Container Apps environment, web Container App, orchestrator Container App, PostgreSQL Flexible Server, Blob Storage, Key Vault, Log Analytics / Application Insights wiring, managed identities, and ingress/WAF-related resources when included.

## Example Bicep resource

```bicep
resource orchestrator 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${appPrefix}-orchestrator'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    template: {
      containers: [{ name: 'orchestrator', image: '${acrName}.azurecr.io/orchestrator:${imageTag}' }]
    }
  }
}
```

## Parameterization

Use environment-specific parameter files for: app name/prefix, region, SKU/scale values, environment naming, ingress/DNS settings, and infra-level feature toggles. Do not hard-code environment-specific values in the main template.

## What not to do

Do not treat the Azure portal as the primary source of truth. Avoid hand-editing production resources without codifying the change, one-off network or secret wiring that only exists in the portal, or hidden environment assumptions not reflected in Bicep.

---

# Build and Image Strategy

## Registry and containers

Container images go to **Azure Container Registry (ACR)**. The standard architecture defaults to separate **web** and **orchestrator** containers, so deployment should build and publish **two images**. The `../../../assets/infra/deploy.sh` template demonstrates ACR login, tagging, and Docker push.

## Tagging strategy

Use immutable image tags that map to code:
- Commit SHA (preferred)
- Optionally semantic release tag or build timestamp as secondary identifiers

Do not rely on `latest` as the only deployment reference. The reference template pushes `latest` as a convenience, but immutable tags are the real deployment reference.

## Version visibility

Each deployed service should expose a version identifier through health endpoint output, logs, environment variables or build metadata, and deployment status checks.

---

# CI/CD Standard

## Standard choice: GitHub Actions

A standard pipeline should include:
1. Checkout
2. Dependency installation
3. Type check
4. Lint
5. Test
6. Build
7. Container image build
8. Image push to ACR
9. Deployment to target environment
10. Migration step or verification
11. Health verification

## Example deploy step

```yaml
- name: Deploy orchestrator
  run: |
    az containerapp update \
      --name ${{ vars.APP_PREFIX }}-orchestrator \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --image ${{ vars.ACR_NAME }}.azurecr.io/orchestrator:${{ github.sha }}
    az containerapp ingress show --name ${{ vars.APP_PREFIX }}-orchestrator \
      --resource-group ${{ vars.RESOURCE_GROUP }} --query fqdn -o tsv
```

## Merge and deployment model

- Pull requests run validation
- Merge to main triggers deployment or a release workflow
- Production deployment is traceable and deliberate

The exact gating can vary, but pipeline shape should stay consistent across projects. Avoid creating a completely different CI/CD model for every application.

---

# Deployment Script Standard

Even with GitHub Actions as primary CI/CD, a deployment script is useful for initial setup, local operator workflows, break-glass tasks, and debugging.

## Standard commands

Required: `infra`, `build`, `deploy`, `status`, `rollback`, `all`
Optional: `migrate`, `verify`, `smoke`, `logs`

## Reference template capabilities

The `../../../assets/infra/deploy.sh` template implements the standard command set. Copy it into `infra/deploy.sh` and adapt for your application. It already handles:

- **Two deployable services** — web and orchestrator Container Apps
- **Immutable tags over `latest`** — deploys target immutable tags
- **Explicit migration step** — migrations are a first-class deployment concern
- **Health and readiness verification** — checks `/api/health` and `/api/ready`
- **Version verification** — confirms running version matches intended image/build
- **Secret injection without interactive prompting** — prefers Key Vault, managed identities, and CI/CD secret injection

---

# Configuration and Secrets

Production secrets should come from Azure Key Vault, managed identities, or controlled CI/CD secret injection. Do not rely on checked-in `.env` files or long-lived embedded secrets. Environment variables should be explicitly defined, environment-specific, documented, and sourced from secure systems in production.

Deployment automation should never print or expose secrets unnecessarily. Avoid echoing secrets to logs, writing them to lingering workspace files, or passing them through loosely controlled shell flows when a managed alternative exists.

See also: `security.md`

---

# Database Migrations

Migrations are part of deployment — versioned, idempotent where possible, reviewable, and traceable to the release.

## Standard migration flow

1. Deploy infra changes if required
2. Build/push images
3. Run migrations in a controlled step
4. Deploy new app revisions
5. Verify readiness and health

The migration policy should be explicit. Rollout order may vary depending on backward compatibility.

## Migration safety

Avoid hidden startup-time migrations with unpredictable side effects, manual production schema edits outside the release process, and migrations assuming zero concurrent traffic without planning.

## Rollback caution

App revisions can often roll back quickly, but destructive schema changes require more care. Forward-fix is sometimes safer than reversing a migration.

See also: `data-patterns.md`

---

# Health Verification and Smoke Checks

Every production service must expose `/api/health` and `/api/ready`. After deployment, verify health and readiness for both web and orchestrator, expected version, and critical dependency readiness if surfaced in diagnostics.

Where appropriate, include lightweight smoke tests: load the health route, call a simple orchestrator route, verify database connectivity through readiness, verify storage access if critically depended upon. Keep smoke checks small and fast.

---

# Status, Logs, and Operational Checks

A standard status operation should show: deployed app names, FQDNs, latest active revision, current image, health status, environment, and version/build info.

Operational workflows should include paths for recent logs, live logs, revision-specific investigation, and Log Analytics queries. Support teams should be able to answer: which revision is running, which image is deployed, whether readiness is failing, whether errors started after a deploy, and whether the issue is web, orchestrator, migration, or dependency related.

---

# Rollback Guidance

**Revision rollback first** — For application code issues: identify previous healthy revision, shift traffic back, verify health/readiness, continue investigation separately.

**Rollback is not always symmetric** — Be careful when schema changes are not backward compatible, secrets/config changed with incompatible assumptions, external dependencies changed, or data migrations already transformed state.

**Forward-fix versus rollback** — For application code issues, rollback is often appropriate. For schema evolution or external state changes, a controlled forward-fix may be safer. Teams should not treat rollback as magically risk-free.

---

# What to Avoid

- Portal-only deployments
- Deploying from `latest` without immutable version references
- One-off production fixes not codified in infra or release automation
- Hidden startup-time migrations
- Separate deployment approaches for every app
- Mixing CI/CD platforms without reason
- Storing production secrets in repo files
- Declaring success before readiness/health/version are verified

**Anti-pattern — deploying without health verification:**

```bash
# Bad: deploy and walk away
az containerapp update --name myapp --image myacr.azurecr.io/app:latest

# Better: deploy with immutable tag, then verify health
az containerapp update --name myapp --image myacr.azurecr.io/app:${COMMIT_SHA}
curl --fail --retry 5 --retry-delay 3 "https://${FQDN}/api/health"
```

---

# Operational Baseline

A production application should include: Bicep-based infra, environment parameter files, ACR image build/push, immutable tags, GitHub Actions CI/CD, explicit migration process, Container Apps deployment for web and orchestrator, `/api/health` and `/api/ready` verification, revision visibility, rollback path, status/log commands, version/build traceability, and secure secret/config handling.

## What good looks like

A team should be able to answer: What version is deployed? Which images and revisions are running? Did migrations run? Are web and orchestrator healthy and ready? Can we roll back safely? Did the issue start with this deploy? If those questions lack clear answers, the deployment model is incomplete.

## Evolution guidance

Start with the baseline first — everything above is part of the standard, not optional later improvements. More advanced additions (richer smoke tests, staged promotion, canary strategies, deployment policy gates, infra drift detection, release analytics) can come later where justified.
