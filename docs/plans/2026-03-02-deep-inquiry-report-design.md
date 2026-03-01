# Deep Inquiry Report — Design

**Date:** 2026-03-02
**Status:** Approved
**Author:** louisdk

---

## Overview

Add self-contained HTML reporting to the `deep-inquiry` plugin. Two surfaces:

1. **Auto-report** — generated at the end of every investigation iteration (Phase 5). Tells the story of that single iteration: hypothesis arc, review log, findings, domain interpretation.
2. **On-demand summary** — a separate `deep-inquiry-reporter` agent the user invokes manually. Reads all iteration data for a topic and produces a richer cross-iteration arc report: timeline, insight gallery, decision log, lessons learned.

Both surfaces share one pre-built template (`assets/report-template.html`). Reports are static HTML files with data baked in — no server, no build step, shareable by copying one file.

---

## Architecture

```
plugins/deep-inquiry/
├── assets/
│   └── report-template.html      ← NEW: shared self-contained template
├── agents/
│   ├── deep-inquiry.md           ← MODIFIED: Phase 5 generates auto-report
│   └── deep-inquiry-reporter.md  ← NEW: on-demand multi-iteration reporter
└── skills/
    └── deep-inquiry-methodology/
        └── SKILL.md              ← MODIFIED: Phase 5 documents report step
```

### Data injection pattern

The agent reads `${CLAUDE_PLUGIN_ROOT}/assets/report-template.html`, prepends a
`<script>window.REPORT_DATA = {...};</script>` block, and writes the result to disk.
The template inspects `REPORT_DATA.type` at render time to choose layout.

### Output locations

```
inquiry/<topic>/iteration_N/report.html   ← auto, per iteration
inquiry/<topic>/report.html              ← on-demand, full arc
```

---

## Report Types

### Iteration report (`type: "iteration"`)

Sections:
- **Header** — topic, domain, investigation mode, date, status badge
- **Hypothesis arc** — three-node flow: Formed → Tested → Concluded (with text in each node)
- **Review log** — bar chart per tier (CRITICAL / METHODOLOGICAL / ENHANCEMENT / STYLE) with action summary (fixed / addressed / documented / ignored); shows review mode (adversarial vs degraded)
- **Key findings** — bulleted findings with evidence references
- **Domain interpretation** — narrative connecting findings to domain context
- **Future directions** — bulleted list
- **Footer** — *Deep Inquiry plugin by Louis de Klerk from Netsurit*

### Summary report (`type: "summary"`)

Sections:
- **Header** — topic, domain, iteration count, date range, overall status
- **Executive summary** — 2-3 sentence conclusion narrative
- **Iteration timeline** — horizontal node timeline; each node clickable to expand hypothesis, outcome, and pivot reasoning inline
- **Insights gallery** — card grid, one card per insight; high-significance insights get a ★ badge; cards show originating iteration
- **Decision log** — chronological list of pivot/done decisions with reasoning
- **Lessons learned** — bulleted list aggregated across all iterations
- **Future directions** — bulleted list aggregated across all iterations
- **Footer** — *Deep Inquiry plugin by Louis de Klerk from Netsurit*

### Visual design

- Single self-contained HTML file (inline CSS + JS, no external dependencies)
- Dark/light theme toggle
- Monospace accents for technical content (evidence, code references)
- Responsive layout
- Printable to PDF from browser

---

## JSON Schema

### Iteration report

```json
{
  "type": "iteration",
  "meta": {
    "topic": "auth-performance",
    "domain": "Software",
    "mode": "Code",
    "date": "2026-03-02",
    "status": "Done",
    "iterationNumber": 2,
    "title": "Profiler-based N+1 detection"
  },
  "hypotheses": [
    {
      "text": "Auth slowness caused by N+1 DB queries",
      "tested": "Ran profiler across 100 checkout requests",
      "outcome": "Confirmed — 47% of calls were redundant FK lookups",
      "status": "confirmed"
    }
  ],
  "findings": [
    { "heading": "N+1 confirmed", "detail": "...", "evidence": "profiler output line 23" }
  ],
  "reviewLog": {
    "mode": "adversarial",
    "models": ["openai/gpt-5.2"],
    "tiers": {
      "critical":       [{ "issue": "...", "action": "fixed",      "detail": "..." }],
      "methodological": [{ "issue": "...", "action": "addressed",  "detail": "..." }],
      "enhancement":    [{ "issue": "...", "action": "documented", "detail": "..." }],
      "style":          [{ "issue": "...", "action": "ignored",    "detail": "..." }]
    }
  },
  "domainInterpretation": "...",
  "futureDirections": ["Try eager loading", "Benchmark with Redis cache"]
}
```

`hypothesis.status` values: `confirmed | refuted | pivoted | inconclusive`
`tier item.action` values: `fixed | addressed | documented | ignored`

### Summary report

```json
{
  "type": "summary",
  "meta": {
    "topic": "auth-performance",
    "domain": "Software",
    "overallGoal": "Find root cause of 3s checkout latency",
    "status": "Complete",
    "dateRange": { "from": "2026-02-28", "to": "2026-03-02" }
  },
  "conclusion": "N+1 queries confirmed as root cause. Fix reduces p99 from 3.1s to 0.4s.",
  "iterations": [
    {
      "number": 1, "title": "...", "goal": "...",
      "outcome": "Partial", "pivotReason": "Profiler too coarse-grained", "status": "Abandoned"
    },
    {
      "number": 2, "title": "...", "goal": "...",
      "outcome": "Success", "pivotReason": null, "status": "Done"
    }
  ],
  "insights": [
    { "iteration": 2, "heading": "47% redundant FK lookups", "detail": "...", "significance": "high" },
    { "iteration": 1, "heading": "Flame graph insufficient", "detail": "...", "significance": "medium" }
  ],
  "decisionLog": [
    { "afterIteration": 1, "decision": "Pivot", "reasoning": "Needed query-level profiler" },
    { "afterIteration": 2, "decision": "Done",  "reasoning": "Question answered" }
  ],
  "lessonsLearned": ["Flame graphs miss ORM query patterns"],
  "futureDirections": ["Benchmark eager loading", "Monitor in production"]
}
```

---

## Integration

### Phase 5 change (deep-inquiry agent + skill)

After finalising the iteration README, the agent:

1. Constructs the `type: "iteration"` JSON from the iteration's data (hypotheses, review log, findings, domain interpretation, future directions — all already in the README)
2. Reads `${CLAUDE_PLUGIN_ROOT}/assets/report-template.html`
3. Writes `inquiry/<topic>/iteration_N/report.html` — template with `<script>window.REPORT_DATA = {...};</script>` prepended
4. Opens via Playwright for immediate viewing, then closes

The skill's Phase 5 documentation gains one bullet describing this step.

### deep-inquiry-reporter agent

- **Trigger:** User invokes `@deep-inquiry-reporter` (or the deep-inquiry agent surfaces it as an option at the end of an investigation)
- **Model:** `inherit`
- **Tools:** Read, Write, Glob, Bash, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_evaluate, mcp__plugin_playwright_playwright__browser_close

**Workflow:**
1. Lists `inquiry/` subdirectories; asks user which topic to report on
2. Reads every `iteration_N/README.md` under that topic
3. Reads topic-level `readme.md` for overall goal and status
4. Constructs `type: "summary"` JSON by parsing structured README content
5. Reads `${CLAUDE_PLUGIN_ROOT}/assets/report-template.html`
6. Writes `inquiry/<topic>/report.html`
7. Opens in Playwright, closes after user acknowledges

---

## Footer

Both report types display this footer:

> *Deep Inquiry plugin by Louis de Klerk from Netsurit*

---

## Out of Scope (v0.1.0)

- Cross-topic summary (multiple topics in one report)
- Export to PDF via Playwright print (can be done manually via browser)
- Chart animations beyond CSS transitions
- Embedded work file diffs or code snippets
