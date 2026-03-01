# Deep Inquiry Plugin — Design

**Date:** 2026-03-02
**Status:** Approved
**Author:** louisdk

---

## Overview

A generic hypothesis-driven, adversarial-review plugin for Claude Code. Generalises the methodology
from `lcrf-lab-assistant` into a reusable plugin that works across any domain: software, legal
analysis, business strategy, creative writing, or any complex problem that benefits from iterative
investigation and adversarial critique.

---

## Plugin Structure

```
plugins/deep-inquiry/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── deep-inquiry.md          ← standalone agent (batteries included)
└── skills/
    └── deep-inquiry-methodology/
        └── SKILL.md              ← reusable methodology for other agents
```

### `SKILL.md` — Pure methodology

Contains the complete inquiry process: phases, feedback tiers, review prompts, convergence
criteria, and the "good enough" principle. No tool declarations. No OpenRouter specifics.
Designed to be referenced by domain-specific agents via `skills:` frontmatter.

**Long-term use:**
```yaml
# lcrf-lab-assistant (future refactor)
skills: deep-inquiry-methodology, lcrf-research, lcrf-navigator, domain-bridge-vocabulary
```

### `deep-inquiry.md` — Turnkey agent

References the skill and adds:
- `mcp__openrouterai__*` tool declarations
- OpenRouter availability detection and fallback logic
- File structure convention (`inquiry/<topic>/iteration_<N>/`)
- Model: `opus`

---

## Methodology Generalization

### Terminology mapping (from LCRF)

| LCRF-specific | Generic |
|---|---|
| Research question | Inquiry question / problem statement |
| Computational experiment | Investigation |
| LCRF concepts/primitives | Domain concepts (user-supplied at session start) |
| Python environment + venv | Working environment (code, reasoning trace, document analysis, etc.) |
| Connect to LCRF reminder | Connect to domain context reminder |
| LCRF Interpretation README section | Domain Interpretation section |
| Phase 1 skill lookups (lcrf-research, etc.) | Phase 1 domain-scoping questions to user |

### Structural changes

**Phase 1 gains a domain-scoping step.** The first action is to ask the user:
1. What is the domain and its key concepts?
2. What tools/methods are available to test hypotheses? (code execution, step-by-step
   reasoning, document analysis, etc.)

This replaces the LCRF skill lookups and is the only substantive Phase 1 change.

**Phase 3 (Implementation) → "Investigation"** adapts by mode:
- Code execution available → write and run experiments
- Reasoning-only → construct structured logical arguments, trace scenarios
- Document tools available → analyse evidence, surface contradictions

**Feedback tier rename:** `[SCIENTIFIC]` → `[METHODOLOGICAL]`
More accurate across non-science domains (legal rigour, narrative consistency, business logic
validity are all methodological, not scientific in the strict sense).

**Review prompt templates** lose LCRF-specific context boilerplate. Replaced with a slot filled
from the domain description the user provides in Phase 1.

**Documentation template** replaces "LCRF Interpretation" section with "Domain Interpretation"
section, filled in relative to whatever framework the user is working within.

### What stays identical

- 4-tier feedback categorization (CRITICAL / METHODOLOGICAL / ENHANCEMENT / STYLE) and action rules
- Bounded review cycles (1 comprehensive + optional delta validation)
- Critical evaluation of LLM feedback (don't blindly accept)
- Convergence criteria (stop at "scientifically valid", not "perfect")
- Pivot / abandon / done decision logic after each iteration
- "Good enough" principle
- Iteration budget negotiation with user at session start

---

## OpenRouter Integration & Fallback Strategy

Detection happens at the start of Phase 4 (before the first review), not at session start.

### Three-state logic

```
mcp__openrouterai__search_models in toolset?
  NO  → State 1: Not installed
  YES → Probe with lightweight search_models call
          FAILS → State 2: Installed but broken
          SUCCEEDS → State 3: Full adversarial mode
```

### State 1 — Not installed

- Print install instructions (standard OpenRouter MCP JSON config block)
- Offer to continue with self-review with explicit caveat:
  > "I can proceed with self-review, but adversarial quality is reduced — the same model is
  > both author and reviewer. Continue anyway?"

### State 2 — Installed but not working

- Note failure and reason (auth error, timeout, etc.)
- Print degradation notice:
  `⚠️ OpenRouter unavailable (<reason>). Falling back to self-review — adversarial quality is reduced.`
- Continue with same prompt templates and tier categorization, skip model-selection step
- Document review mode used in iteration README

### State 3 — Full adversarial mode

- Model selection via `search_models`
- `chat_completion` for review
- Model recommendations vary by domain type (reasoning-heavy, math/stats, domain expertise)
- Same bounded review protocol as original lcrf-lab-assistant

---

## Marketplace Registration

Add to `.claude-plugin/marketplace.json`:

```json
{
  "name": "deep-inquiry",
  "source": "./plugins/deep-inquiry",
  "description": "Hypothesis-driven adversarial investigation for any domain. Forms theories, tests them, gets adversarial LLM review, and pivots based on evidence.",
  "version": "0.1.0",
  "author": { "name": "louisdk" },
  "category": "productivity"
}
```

---

## Out of Scope (v0.1.0)

- Domain-specific starter templates (legal, coding, business) — future plugins can reference the skill
- Parallel multi-model review in a single round — original agent explicitly forbids this, kept out
- Automatic lcrf-lab-assistant refactor — separate task, after plugin is stable
