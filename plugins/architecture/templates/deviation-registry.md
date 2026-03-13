# Architecture Deviation Registry

**Standard Version:** {{STANDARD_VERSION}}
**Created:** {{CREATION_DATE}}

This file tracks intentional departures from the Netsurit AppFoundry architecture standard. Deviations are not failures — they are documented architectural decisions where this project chose a different approach from the standard recommendation.

## Schema

Each deviation entry contains:

| Field | Format | Purpose |
|---|---|---|
| ID | `DEV-NNN` (sequential) | Unique identifier for cross-referencing |
| Pattern | `{reference-domain} / {concern}` | Maps to reference file domain for mechanical lookup |
| Standard Recommendation | Free text | What the standard says to do |
| Chosen Alternative | Free text | What this project does instead |
| Rationale | Free text | Why the deviation was chosen |
| Impact Assessment | Free text | What trade-offs this introduces |
| Registered By | Name | Who registered the deviation |
| Date | YYYY-MM-DD | When registered |
| Status | `Active` or `Resolved` | Current state |
| Standard Version | Semver (e.g., `0.1.0`) | Plugin version at registration time |

## Lifecycle

**Create** — Register a deviation when an intentional departure from the standard is made. This can happen during architecture creation (via BMAD architect sidecar), project scaffolding (via `/ns-appfoundry-scaffold`), or manually by a developer.

**Update** — Refine an entry when rationale changes, impact assessment is revised, or additional context is discovered.

**Resolve** — Change status to `Resolved` when the deviation is refactored away and the project now follows the standard. Resolved entries remain in this file for historical traceability.

## Forward-Compatibility

Each entry records the standard version at registration time. When the standard is updated:

- The deviation entry remains readable and valid regardless of standard changes
- Delta analysis can detect when a deviation was registered against an older version
- Delta analysis can flag when the relevant pattern has changed since registration
- No schema migration is needed — the entry format is stable across standard updates

## Entries

<!-- Copy this blank template when registering a new deviation -->
<!--
### DEV-NNN: [Short Title]

| Field | Value |
|---|---|
| **ID** | DEV-NNN |
| **Pattern** | `{domain} / {concern}` |
| **Standard Recommendation** | |
| **Chosen Alternative** | |
| **Rationale** | |
| **Impact Assessment** | |
| **Registered By** | |
| **Date** | YYYY-MM-DD |
| **Status** | Active |
| **Standard Version** | {{STANDARD_VERSION}} |
-->

### DEV-001: SAML Authentication Instead of Entra ID OIDC

| Field | Value |
|---|---|
| **ID** | DEV-001 |
| **Pattern** | `security / authentication-method` |
| **Standard Recommendation** | Use Entra ID OIDC for authentication with JWT token verification middleware |
| **Chosen Alternative** | SAML 2.0 via corporate identity provider |
| **Rationale** | Client organisation mandates SAML for all internal applications per their security policy. Entra ID OIDC is not available in this environment. |
| **Impact Assessment** | Requires additional SAML middleware library. Token format differs from standard JWT flow. Auth middleware follows same structural pattern but with SAML assertion parsing instead of JWT verification. |
| **Registered By** | J. Smith |
| **Date** | 2026-01-15 |
| **Status** | Active |
| **Standard Version** | 0.1.0 |

<!-- Add new entries below this line using the format above -->
