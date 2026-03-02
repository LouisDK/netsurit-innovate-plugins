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

Adversarial review requires the [OpenRouter MCP server](https://github.com/mcpservers/openrouterai)
to call external models. Without it, the agent falls back to self-review (same model as author
and reviewer), which reduces adversarial quality.

**If not installed**, the agent will print setup instructions and offer to continue in degraded
self-review mode.

**If installed but broken**, the agent falls back to self-review automatically with a visible
warning that adversarial quality is reduced.

### Step 1: Get an OpenRouter API key

1. Go to [openrouter.ai](https://openrouter.ai) and create an account
2. Navigate to [openrouter.ai/keys](https://openrouter.ai/keys)
3. Click **Create Key** and copy the key (starts with `sk-or-v1-...`)
4. Add credits at [openrouter.ai/credits](https://openrouter.ai/credits) — a few dollars
   is enough for many investigations (reviews typically cost $0.01–0.10 each depending on
   the model)

### Step 2: Configure the MCP server

Add the OpenRouter MCP server to your Claude Code configuration. You can configure it at
the **project level** (`.mcp.json` in your repo root) or **globally** (`~/.claude/settings.json`).

**Option A: Project-level** (recommended — keeps config with the project)

Create or edit `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "openrouterai": {
      "command": "npx",
      "args": ["@mcpservers/openrouterai"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
      }
    }
  }
}
```

**Option B: Global** (available in all projects)

Add to `~/.claude/settings.json` under `"mcpServers"`:

```json
"openrouterai": {
  "command": "npx",
  "args": ["@mcpservers/openrouterai"],
  "env": {
    "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
  }
}
```

### Step 3: Restart Claude Code

The MCP server is loaded at startup. After adding the configuration, restart Claude Code
for it to take effect.

### Verifying it works

The agent probes OpenRouter at the start of Phase 4 (adversarial review). You can also
verify manually by asking Claude Code:

```
Use the openrouterai search_models tool to search for "claude"
```

If you see a list of models, the MCP server is working.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `mcp__openrouterai__search_models` not found | MCP config not loaded — check JSON syntax, restart Claude Code |
| Tool call fails with auth error | API key is invalid or expired — regenerate at openrouter.ai/keys |
| Tool call fails with credits error | Add credits at openrouter.ai/credits |
| Agent says "OpenRouter MCP is not installed" | The `openrouterai` key must match exactly — check for typos |

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
