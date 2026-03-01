# Deep Inquiry

Hypothesis-driven adversarial investigation for any domain. Forms theories, tests them with
available tools, subjects findings to adversarial LLM peer review via OpenRouter, and pivots
based on evidence.

Works for: software architecture, performance debugging, legal analysis, business strategy,
creative work, empirical research — any complex problem that benefits from iterative, rigorous
investigation.

---

## What It Does

Deep Inquiry applies a structured scientific method to any inquiry:

1. **Scope the domain** — you describe the field and what counts as a valid test
2. **Form hypotheses** — explicit claims to test or refute before any investigation begins
3. **Investigate** — code experiments, step-by-step logical arguments, or evidence analysis depending on what the problem calls for
4. **Adversarial review** — an external LLM (via OpenRouter) critiques the work using a strict 4-tier feedback system; the agent evaluates each suggestion critically and doesn't blindly accept it
5. **Pivot or conclude** — if findings point in a new direction, the agent starts a new iteration with a clear rationale; otherwise it documents conclusions and stops
6. **Reproducible record** — every iteration is documented in `inquiry/<topic>/iteration_N/README.md`

---

## Contents

| Artifact | Path | Use |
|---|---|---|
| Agent | `agents/deep-inquiry.md` | Standalone turnkey investigator — invoke with `@deep-inquiry` |
| Skill | `skills/deep-inquiry-methodology/SKILL.md` | Methodology only — add to any agent's `skills:` frontmatter |

---

## Quickstart

### Standalone agent

Just describe your problem:

```
@deep-inquiry I think our auth service is slow because of N+1 queries. Can you investigate?
```

The agent will ask you to confirm the iteration budget, then run the full investigation.

### Embed in a domain-specific agent

Add the skill to any existing agent's frontmatter to inherit the full methodology:

```yaml
---
name: my-domain-agent
skills:
  - deep-inquiry-methodology
  - my-domain-knowledge
---
```

---

## The Adversarial Review Loop

The core of Deep Inquiry is its LLM peer review — the same discipline used in scientific
peer review, applied to any investigation.

Every piece of feedback from the external reviewer is categorised before acting on it:

| Tier | Meaning | Action |
|---|---|---|
| **[CRITICAL]** | Bug, wrong logic, factual error, invalid reasoning | Fix immediately |
| **[METHODOLOGICAL]** | Flaw in approach that affects validity | Evaluate impact; fix if high |
| **[ENHANCEMENT]** | "You could also..." | Document only, never implement |
| **[STYLE]** | Formatting, naming, structure | Ignore unless trivial |

The agent critically evaluates each suggestion (doesn't blindly accept), documents disagreements,
and stops reviewing once no CRITICAL issues remain — not when the work is "perfect".

---

## OpenRouter Requirement

Adversarial review requires the [OpenRouter MCP](https://openrouter.ai) to call external models.

**If not installed**, the agent will print setup instructions and offer to continue in degraded
self-review mode.

**If installed but broken**, the agent falls back to self-review automatically with a visible
warning that adversarial quality is reduced.

### Installing OpenRouter MCP

Add to `~/.claude/settings.json` under `"mcpServers"`:

```json
"openrouterai": {
  "command": "npx",
  "args": ["-y", "openrouter-mcp"],
  "env": {
    "OPENROUTER_API_KEY": "your-api-key-here"
  }
}
```

Get an API key at [openrouter.ai/keys](https://openrouter.ai/keys), then restart Claude Code.

---

## Output Structure

All investigation work is written to the current working directory:

```
inquiry/
  <topic-slug>/
    readme.md               ← tracks all iterations and overall findings
    iteration_1/
      README.md             ← hypotheses, method, findings, review log
      <work files>          ← code, arguments, evidence analysis
    iteration_2/
      ...
```

---

## Reports

Every iteration automatically produces a self-contained HTML report at the end of Phase 5:

```
inquiry/<topic>/iteration_N/report.html
```

Open it in any browser — no server needed. Shows the hypothesis arc, review log with tier
breakdown, key findings, domain interpretation, and future directions.

For a richer summary across all iterations, invoke the reporter agent:

```
@deep-inquiry-reporter
```

This reads all finished iteration data and produces `inquiry/<topic>/report.html` — a full
arc view with iteration timeline, insight gallery, decision log, and lessons learned.

Both report types share the same template and include a dark/light theme toggle. They are
printable to PDF from the browser.

---

## Examples

### Performance debugging (Code mode)

```
@deep-inquiry Our checkout endpoint takes 3s. I suspect it's the tax calculation
hitting the DB on every line item. Investigate with 2 iterations.
```

The agent writes and runs profiling code, gets adversarial review of the methodology,
documents findings in `inquiry/checkout-perf/`.

### Architecture decision (Reasoning mode)

```
@deep-inquiry Should we split our monolith now or wait? Context: 4-person team,
B2B SaaS, ~50 customers, planning Series A in 12 months.
```

The agent constructs competing structured arguments, gets adversarial review of the
reasoning, and produces a documented recommendation with explicit assumptions.

### Contract review (Evidence mode)

```
@deep-inquiry Review this SaaS agreement clause: [paste clause]. Flag any risks
around data ownership and exit rights.
```

The agent forms hypotheses about risk areas, analyses the text systematically, and
documents findings with the reasoning behind each concern.

---

## Relationship to `lcrf-lab-assistant`

Deep Inquiry is the generalised form of the `lcrf-lab-assistant` agent. The LCRF agent
can be refactored to inherit the shared methodology:

```yaml
# lcrf-lab-assistant (future)
skills:
  - deep-inquiry-methodology   ← full investigation process
  - lcrf-research              ← LCRF domain knowledge
  - lcrf-navigator
  - domain-bridge-vocabulary
```
