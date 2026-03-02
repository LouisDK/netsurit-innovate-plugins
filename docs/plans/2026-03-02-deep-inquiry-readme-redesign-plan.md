# Deep Inquiry README Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `plugins/deep-inquiry/README.md` from a technical reference into a decision-maker-oriented document that sells through honesty.

**Architecture:** Single-file rewrite. The existing README is 309 lines of technical reference. The new README follows the "Auditable AI Analyst" structure: hook, mechanics, tiered scenarios, honest limitations, setup, vision.

**Tech Stack:** Markdown only. No code changes.

**Design doc:** `docs/plans/2026-03-02-deep-inquiry-readme-redesign-design.md`

---

### Task 1: Write the Hook and "What This Actually Does" sections

**Files:**
- Modify: `plugins/deep-inquiry/README.md` (full rewrite, lines 1-309)

**Step 1: Replace the entire README with the new document structure**

Write the complete new README. The full content follows.

**Section: Title + Hook**

```markdown
# Deep Inquiry

Every AI tool can give you an answer. The problem is you can't tell whether the answer is rigorous or hallucinated. Deep Inquiry doesn't just answer questions — it investigates them. It forms explicit hypotheses, tests them using available tools, submits its work to a different AI model for adversarial critique, fixes what the critic finds, and documents every step. The result isn't a chat response — it's an auditable investigation report you can review, challenge, and base decisions on.
```

**Section: What This Actually Does**

A 6-step numbered walkthrough written for decision-makers. Each step: bold title, one-sentence description. Cover:

1. Scopes the problem (clarifies domain, forms hypotheses before investigation)
2. Investigates (Code/Reasoning/Evidence/Mixed modes)
3. Gets adversarially reviewed (different AI model via OpenRouter, 4-tier feedback, critical evaluation)
4. Documents everything (iteration READMEs with full audit trail)
5. Produces interactive reports (self-contained HTML, hypothesis arcs, dark/light theme, PDF-printable)
6. Iterates or concludes (pre-agreed budget, pivot/continue/conclude with summary report)

**Step 2: Verify the markdown renders correctly**

Run: `cat plugins/deep-inquiry/README.md | head -60`
Expected: clean markdown, no broken formatting

**Step 3: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): rewrite README hook and mechanics sections"
```

---

### Task 2: Write the Scenarios by Capability Tier section

**Files:**
- Modify: `plugins/deep-inquiry/README.md`

**Step 1: Add the tiered scenarios section after "What This Actually Does"**

Three tiers, each with a brief intro explaining the capability level:

**Tier 1: Minimal Setup (Claude Code + OpenRouter)**
- Scenario 1: Monolith vs microservices decision (Reasoning mode)
- Scenario 2: Vendor contract risk review (Evidence mode)
- Scenario 3: Database technology selection (Reasoning mode)

**Tier 2: With Web Search MCP**
- Brief explanation of what web search adds (claim verification, current pricing, live docs)
- Scenario 4: Kubernetes vs ECS evaluation (Mixed mode)
- Scenario 5: Competitive threat response (Mixed mode)

**Tier 3: Rich MCP Ecosystem (databases, APIs, Playwright)**
- Brief explanation of what full tool access enables (your actual data)
- Scenario 6: Checkout conversion investigation (Mixed: Code + Evidence)
- Scenario 7: DACH market expansion assessment (Mixed: Reasoning + Evidence)

Each scenario should follow the pattern:
- One-line problem statement as the heading (in quotes, conversational)
- Mode tag
- What data the investigation uses
- What the investigation produces / why it's better than just asking
- Honest caveat where applicable (e.g., contract review isn't legal advice)

**Step 2: Verify formatting**

Run: `wc -l plugins/deep-inquiry/README.md`
Expected: document growing, check line count is reasonable

**Step 3: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): add capability-tiered usage scenarios"
```

---

### Task 3: Write the "What This Is and Isn't" section

**Files:**
- Modify: `plugins/deep-inquiry/README.md`

**Step 1: Add the honesty section after scenarios**

Four subsections:

**What Deep Inquiry IS** (4 bullets):
- Structured reasoning framework making AI conclusions auditable
- Methodology enforcer: hypothesis-driven, adversarially tested, documented
- Report generator producing reviewable artifacts, not chat messages
- As powerful as the tools you give it

**What Deep Inquiry IS NOT** (4 bullets):
- A search engine or data collector
- A replacement for domain experts
- An oracle
- Magic

**Where it excels** (4 bullets):
- Structured thinking bottlenecks
- Show-your-work decisions
- Faster rigorous second opinion
- Codebase investigations

**Where it struggles** (4 bullets):
- Unconnected proprietary data
- Real-time data without web search
- Human interviews / physical observation
- Thin training data domains

**Step 2: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): add honest limitations and strengths section"
```

---

### Task 4: Write the Getting Started section

**Files:**
- Modify: `plugins/deep-inquiry/README.md`

**Step 1: Add setup content**

Retain the practical setup material from the existing README but reorganized:

1. **Quickstart** — show the invocation pattern (`@deep-inquiry <your question>`)
2. **Embedding in agents** — the `skills:` frontmatter pattern
3. **OpenRouter setup** — API key, MCP config (project and global), restart, verification, troubleshooting table
4. **Worktree isolation** — brief explanation of automatic isolation, what survives, cleanup
5. **Output structure** — the `inquiry/<topic>/` directory layout
6. **Reports** — iteration reports, summary reports, reporter agent

Keep this section practical and scannable. Use the same content quality as the existing README's setup sections — they're already well-written.

**Step 2: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): add getting started and setup sections"
```

---

### Task 5: Write the Vision section and finalize

**Files:**
- Modify: `plugins/deep-inquiry/README.md`

**Step 1: Add "Where This Is Going" section**

The agent-integration vision:

- Open with the framing: today it's a direct tool; its architecture makes it a natural decision engine for AI agent orchestration
- Describe the pattern: orchestrator hits complex decision → spawns deep-inquiry → presents report to human
- Articulate the shift: humans review investigated recommendations, not raw AI suggestions
- Be honest about what's needed: orchestration layer, programmatic report consumption; methodology and reports exist today, gap is integration

**Step 2: Add footer**

- Author credit: Louis de Klerk from Netsurit
- Remove the `lcrf-lab-assistant` section from the existing README (it's an internal detail that doesn't belong in a decision-maker-facing document)

**Step 3: Full review pass**

Read the entire README end-to-end. Check:
- Flow from section to section
- No broken markdown
- Consistent tone (direct, honest, not salesy)
- No leftover content from the old README that doesn't fit

**Step 4: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): add vision section and finalize README redesign"
```

---

### Task 6: Final review

**Files:**
- Read: `plugins/deep-inquiry/README.md`

**Step 1: Read the complete file**

Verify the full document reads well as a coherent piece.

**Step 2: Check line count and structure**

Run: `grep "^## " plugins/deep-inquiry/README.md`
Expected: section headers in the right order (hook → mechanics → scenarios → honesty → setup → vision)

**Step 3: Verify no stale references**

Run: `grep -i "lcrf" plugins/deep-inquiry/README.md`
Expected: no matches (removed internal reference)
