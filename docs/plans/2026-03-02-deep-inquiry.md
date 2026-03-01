# Deep Inquiry Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `deep-inquiry` plugin for the team marketplace that packages a generic hypothesis-driven, adversarial-review methodology as both a reusable skill and a standalone agent.

**Architecture:** A plugin containing two artifacts: `deep-inquiry-methodology` (a SKILL that encodes the full investigation process — phases, feedback tiers, review prompts, convergence criteria) and `deep-inquiry` (an AGENT that references the skill and adds OpenRouter MCP integration with a three-state fallback). Other domain-specific agents (e.g. `lcrf-lab-assistant`) can adopt the methodology by adding `deep-inquiry-methodology` to their `skills:` frontmatter.

**Tech Stack:** Claude Code plugin system, OpenRouter MCP (`mcp__openrouterai__*`), Markdown/YAML frontmatter

**Reference files to read before starting:**
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/questionpad/.claude-plugin/plugin.json` — plugin.json format
- `/home/louisdk/experiment/netsurit-innovate-plugins/.claude-plugin/marketplace.json` — marketplace format
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/questionpad/agents/feedback-collector.md` — agent frontmatter conventions
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/questionpad/skills/questionpad/SKILL.md` — skill frontmatter conventions
- `/home/louisdk/experiment/mrwolf/.claude/agents/lcrf-lab-assistant/AGENT.md` — the source we are generalising from

---

## Task 1: Plugin Scaffold

**Files:**
- Create: `plugins/deep-inquiry/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Create the plugin manifest**

Create `plugins/deep-inquiry/.claude-plugin/plugin.json`:

```json
{
  "name": "deep-inquiry",
  "description": "Hypothesis-driven adversarial investigation for any domain. Forms theories, tests them, gets adversarial LLM review via OpenRouter, and pivots based on evidence.",
  "version": "0.1.0",
  "author": {
    "name": "louisdk"
  }
}
```

**Step 2: Register in marketplace**

In `.claude-plugin/marketplace.json`, add to the `"plugins"` array:

```json
{
  "name": "deep-inquiry",
  "source": "./plugins/deep-inquiry",
  "description": "Hypothesis-driven adversarial investigation for any domain. Forms theories, tests them, gets adversarial LLM review via OpenRouter, and pivots based on evidence.",
  "version": "0.1.0",
  "author": { "name": "louisdk" },
  "category": "productivity"
}
```

**Step 3: Verify structure**

Run:
```bash
ls plugins/deep-inquiry/.claude-plugin/
```
Expected: `plugin.json`

**Step 4: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(deep-inquiry): add plugin scaffold and marketplace registration"
```

---

## Task 2: Write `deep-inquiry-methodology` Skill

**Files:**
- Create: `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md`

This is the core artifact. It must contain zero LCRF-specific references. Every domain concept must be generic or user-supplied.

**Step 1: Create the skill file**

Create `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md` with the following content:

````markdown
---
name: deep-inquiry-methodology
description: >
  Generic hypothesis-driven investigation methodology with adversarial LLM review.
  Apply this skill to any complex problem: software architecture, legal analysis,
  business strategy, creative work, or empirical research.
  Covers domain scoping, planning, investigation, adversarial peer review,
  documentation, and iteration decisions.
---

# Deep Inquiry Methodology

## Core Mission

**You are investigating a problem, not building a product.** Your goal is to:
- Form clear hypotheses about the problem
- Test those hypotheses using whatever tools are available
- Subject your work to adversarial critique from external LLMs
- Learn from the process, including failures and pivots
- Produce documented, reproducible findings

## Session Variables

At the start of each session, establish and record these:

- **Domain**: What field is this inquiry in? (e.g. software, law, business strategy, creative writing)
- **Domain concepts**: Key terms, frameworks, or constraints the reviewer should know
- **Investigation mode**: Which of the following applies?
  - *Code mode* — hypotheses can be tested by writing and running code
  - *Reasoning mode* — hypotheses can be tested through structured logical argument
  - *Evidence mode* — hypotheses can be tested by analysing documents or data
  - *Mixed* — combination of the above
- **Iteration budget**: How many iterations are allowed? (default: 1)
- **Review budget**: Reviews per iteration? (default: 1 comprehensive + 1 optional delta)

---

## Phase 1: Problem Understanding & Planning

### 1.1 Domain Scoping

Ask the user:
1. What is the domain and its key concepts?
2. What tools or methods are available to test hypotheses here?
3. What does a valid "test" look like in this domain?

Document the answers as **Session Variables** at the top of the iteration README.

### 1.2 Clarify the Inquiry Question

- What exactly are we trying to find out or solve?
- What are the success criteria? How will we know we have an answer?
- What approaches might work?

### 1.3 Form Initial Hypotheses

State 1–3 explicit hypotheses before any investigation. These are the claims you will try to test or refute.

Example formats:
- "Approach X will outperform Approach Y on metric Z"
- "The root cause of problem P is condition C"
- "Argument A is valid because premise B holds"

### 1.4 Investigation Plan

- Outline the approach(es) to test the hypotheses
- Identify key variables and parameters
- Define what data/results will be collected
- Specify what constitutes "success"

### 1.5 Iteration & Review Budget

Ask the user for the iteration limit and review budget per iteration.
Get explicit confirmation before proceeding.

---

## Phase 2: Setup

### Directory Structure

```
inquiry/
  <topic-slug>/
    readme.md                  ← tracks all iterations
    iteration_1/
      README.md                ← this iteration's design, results, review log
      <work files>
    iteration_2/
      ...
```

Create `inquiry/<topic-slug>/` if it does not exist.
Create `inquiry/<topic-slug>/iteration_<N>/` for the current iteration.

### Initial README

Create `inquiry/<topic-slug>/iteration_<N>/README.md` with:
- Date, status (In Progress), overview
- Session variables (domain, mode, hypotheses)
- Investigation plan

Keep this updated throughout the iteration.

---

## Phase 3: Investigation

Adapt to the investigation mode established in Phase 1.

### Code Mode

- Write modular, well-commented code
- Add docstrings explaining the theoretical motivation, not just the mechanics
- Test incrementally: run quick sanity checks before full experiments
- Use deterministic seeds for reproducibility
- Document dependencies

### Reasoning Mode

- Construct a step-by-step logical argument
- State each premise explicitly
- Identify where the argument could fail
- Check for circular reasoning, hidden assumptions, and category errors
- Consider at least one strong counter-argument and address it directly

### Evidence Mode

- Identify the most relevant evidence for and against each hypothesis
- Note the provenance and reliability of each source
- Surface contradictions between sources explicitly
- Distinguish between what the evidence shows and what it implies

### Mixed Mode

Apply the relevant sub-modes. Document which mode applies to each part of the investigation.

---

## Phase 4: Adversarial LLM Review

> **Note:** This phase requires the OpenRouter MCP. The agent handles availability detection
> and fallback. If running in degraded (self-review) mode, that will be noted in the README.

**This is a bounded process, not endless refinement.** The goal is to catch critical flaws,
not achieve perfection.

### 4.1 Select Review Model

Use `mcp__openrouterai__search_models` to find a suitable model.

Domain guidance:
- **Reasoning-heavy problems** (logic, strategy, architecture): `openai/gpt-5.2`, `anthropic/claude-opus-4-6`
- **Math or statistical analysis**: `openai/gpt-5.2`, `google/gemini-2.5-pro-preview`
- **Legal or document analysis**: `anthropic/claude-opus-4-6`, `openai/gpt-5.2`
- **Creative or narrative work**: `anthropic/claude-opus-4-6`, `google/gemini-2.5-pro-preview`
- **Cost-sensitive / simple tasks**: `google/gemini-2.5-flash-preview` (lower quality)

### 4.2 First Review: Comprehensive

**Prompt template:**

```markdown
I'm investigating a problem and need adversarial peer review.

Inquiry question: [specific, focused question]

Domain context: [domain name + 1-2 sentences of key concepts]

Hypotheses being tested: [list]

Approach: [brief method description]

[WORK: code / argument / evidence analysis]

Please provide PRIORITISED feedback focusing ONLY on:

**P0 (CRITICAL)**: Bugs, incorrect logic, factual errors, or reasoning failures that would
invalidate the findings

**P1 (METHODOLOGICAL)**: Flaws in approach that would significantly impact validity or rigour

Do NOT suggest:
- Additions beyond answering the inquiry question
- Style or formatting improvements
- Speculative extensions or alternative directions
- Optimisations unless they affect correctness

Focus: Does this work correctly investigate the stated inquiry question?
```

Execute with `mcp__openrouterai__chat_completion`.

### 4.3 Feedback Categorisation (MANDATORY)

Categorise **every suggestion** into one of four tiers:

- **[CRITICAL]** — Bugs, wrong logic, factual errors, invalid reasoning
  - Example: "This statistical test assumes independence but the samples are correlated"
  - Example: "Division by zero when parameter X = 0"
  - Example: "Premise 3 contradicts premise 1"

- **[METHODOLOGICAL]** — Flaws in approach that affect rigour or validity
  - Example: "Should control for confounding variable Y"
  - Example: "This argument form is invalid (affirming the consequent)"
  - Example: "The evidence cited doesn't support the causal claim"

- **[ENHANCEMENT]** — Alternative approaches, optimisations, "you could also..."
  - Example: "Could try approach B for comparison"
  - Example: "Might be faster with vectorisation"
  - Example: "Consider also examining scenario Z"

- **[STYLE]** — Formatting, naming, documentation, architecture
  - Example: "Variable names could be more descriptive"
  - Example: "Argument structure could be clearer"

### 4.4 Action Rules (STRICT)

1. **[CRITICAL]** → Fix immediately in current iteration (MUST be addressed)
2. **[METHODOLOGICAL]** → Evaluate impact:
   - High-impact → address in current iteration
   - Medium-impact → address if time allows
   - Low-impact → document in "Future Directions", don't implement
3. **[ENHANCEMENT]** → Document only in README "Future Directions". Do NOT implement.
4. **[STYLE]** → Ignore unless trivial (<5 minutes, no risk of breaking work)

### 4.5 Second Review: Delta Validation (Optional)

Only conduct if ALL conditions are met:
- ✅ Major changes made (>50% of work modified)
- ✅ Uncertainty whether fixes are correct
- ✅ Review budget not exhausted
- ✅ At least one [CRITICAL] issue was found in the first review

**Delta prompt template:**

```markdown
I previously received feedback on an investigation and made changes.

Original inquiry question: [question]

Feedback received (CRITICAL issues only):
1. [Issue 1]
2. [Issue 2]

Changes implemented:
1. [Change 1 — addresses issue 1]
2. [Change 2 — addresses issue 2]

[MODIFIED sections only]

Please verify:
1. Are these fixes correct?
2. Any remaining CRITICAL issues?

Do NOT provide new enhancement suggestions or style feedback.
```

**NEVER:**
- ❌ Do a full comprehensive re-review (leads to endless iteration)
- ❌ Get a third review on the same iteration
- ❌ Review from multiple models in parallel on the same work

### 4.6 Convergence Criteria (When to Stop)

**STOP reviewing when:**
- ✅ No CRITICAL issues remain (or all fixed)
- ✅ Work produces results or a coherent conclusion
- ✅ Inquiry question is answered
- ✅ Review budget exhausted

**NOT when:**
- ❌ Work is "perfect"
- ❌ All possible improvements have been implemented
- ❌ Reviewer has no more suggestions
- ❌ Every alternative has been explored

### 4.7 Critical Evaluation of Feedback

Do NOT blindly accept feedback. Assess each suggestion:

- **Source credibility**: Which model? Is it reliable for this domain?
- **Relevance**: Does the reviewer understand the domain context?
- **Validity**: Does the suggestion make sense given the problem?
- **Specificity**: Is the feedback actionable or vague?
- **Tier correctness**: Did you categorise it correctly?

Evaluation outcomes:
- ✅ **Adopt**: Agree it is critical/important, will implement
- 🤔 **Consider**: Interesting but not convinced; document for later
- ⚠️ **Question**: Seems wrong or misunderstands context
- ❌ **Reject**: Clearly incorrect or inappropriate

Document your evaluation reasoning in the iteration README.

### 4.8 Handling Model Disagreements

If different review models give contradictory feedback:
1. Document the conflict in the iteration README
2. Analyse reasoning: which argument is stronger?
3. Consider model strengths: is this a domain one model excels in?
4. Test empirically if possible: try both, compare
5. Make a judgement call: you are the investigator; decide based on evidence

---

## Phase 5: Documentation & Results

### Iteration README Template

```markdown
# Iteration N: [Descriptive Title]

**Date:** YYYY-MM-DD
**Status:** [In Progress / Done / Abandoned]
**Domain:** [Domain name]
**Investigation mode:** [Code / Reasoning / Evidence / Mixed]

---

## Session Variables

| Variable | Value |
|---|---|
| Domain concepts | [key terms] |
| Hypotheses | [list] |
| Iteration budget | N |
| Review budget | 1 comprehensive / 2 comprehensive + delta |

## Overview
[What this iteration set out to do]

## Investigation Design
### Hypotheses
[Explicit list]

### Approach
[Description of method]

## Files
| File | Purpose |
|---|---|
| ... | ... |

## Reproducing the Work
[Exact commands or steps to reproduce]

## Key Findings
[Main results with evidence]

## LLM Review Process
### Review Mode
[Full adversarial (OpenRouter) / Degraded (self-review)]

### Models Used
- [Model name]: [Focus area]

### Feedback Categorisation
**[CRITICAL]** (P0):
- [Issue 1] → ✅ Fixed: [how]

**[METHODOLOGICAL]** (P1):
- [Issue 2] → ✅ Addressed: [how]
- [Issue 3] → 📝 Documented for future work: [why not now]

**[ENHANCEMENT]** (P2):
- [Suggestion 4] → 📝 Documented in Future Directions

**[STYLE]** (P3):
- [Suggestion 5] → ❌ Ignored: not critical

### Critical Evaluation
- ⚠️ Disagreed with: [Feedback X] because [reasoning]

## Domain Interpretation
[Map findings back to the domain context supplied at session start]

## Dependencies / Prerequisites
[Tools, libraries, data sources needed]

## Notes
[Caveats, limitations, future directions]
```

### Experiment-Level README Template

Maintain `inquiry/<topic>/readme.md` tracking all iterations:

```markdown
# [Topic Name]

**Overall Goal:** [What this inquiry series investigates]
**Domain:** [Domain]
**Status:** [Active / Complete / On Hold]

---

## Iterations

### Iteration 1: [Title]
- **Date:** YYYY-MM-DD
- **Goal:** [What it attempted]
- **Outcome:** [Success / Partial / Failed]
- **Key Findings:** [1-2 sentence summary]
- **Status:** [Done / Abandoned]

## Overall Findings
[Synthesis across iterations]

## Future Directions
[What remains to explore]
```

---

## Phase 6: Iteration Decision

After completing an iteration:

1. **Check iteration budget**: How many remain?

2. **Evaluate progress**:
   - Was the inquiry question answered?
   - Did a promising alternative approach emerge?
   - Were there fundamental flaws requiring rethinking?

3. **Decision paths**:
   - ✅ **Done**: Question answered, stop
   - 🔄 **New iteration**: Try alternative approach (if budget allows)
   - ⏸️ **Pause**: Partial results, document what was learned
   - ❌ **Abandon**: Approach not working, document why

4. **If creating a new iteration**:
   - Increment iteration number
   - Create `iteration_<N+1>/` directory
   - Write clear motivation: why this approach vs. previous?
   - Update topic-level README
   - Repeat the process

---

## The "Good Enough" Principle

**This is investigation, not production.** Stop when you have:
1. Answered the inquiry question with valid method
2. Fixed all critical flaws
3. Documented the approach and findings
4. Made the work reproducible

**Do NOT continue to:**
- Polish work that already answers the question
- Implement "nice to have" analysis
- Chase perfection in documentation or style

Each additional review round costs time and risks introducing new problems. Stop at "rigorous enough", not "perfect".

---

## Final Reminders

1. **Findings over form**: Results and valid method matter more than elegant presentation
2. **Learn from failure**: Failed iterations have value if documented
3. **Question the reviewer**: Even strong models can be wrong; evaluate critically
4. **Preserve context**: Write READMEs for your future self
5. **Iterate purposefully**: Each iteration tests a hypothesis or explores an alternative
6. **Connect to domain**: Always map findings back to the domain context
7. **Stop at "good enough"**: Aim for rigorous, not perfect
8. **Reviews are bounded**: 1–2 rounds maximum; categorise all feedback; only fix CRITICAL issues
````

**Step 2: Scan for LCRF references**

Run:
```bash
grep -i "lcrf\|layered computational\|seam budget\|contextuality" \
  plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
```
Expected: no output (zero matches)

**Step 3: Check frontmatter is valid YAML**

Run:
```bash
head -10 plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
```
Expected: `---` on line 1, `name:` on line 2, `description:` on line 3, closing `---`

**Step 4: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
git commit -m "feat(deep-inquiry): add deep-inquiry-methodology skill"
```

---

## Task 3: Write `deep-inquiry` Agent

**Files:**
- Create: `plugins/deep-inquiry/agents/deep-inquiry.md`

The agent is intentionally thin: it declares tools, handles OpenRouter detection and fallback,
establishes the file structure convention, and defers to the skill for the full methodology.

**Step 1: Create the agent file**

Create `plugins/deep-inquiry/agents/deep-inquiry.md`:

````markdown
---
name: deep-inquiry
description: |
  Hypothesis-driven adversarial investigation agent for any domain.

  Trigger this agent when you need rigorous, iterative analysis of a complex problem
  that benefits from forming and testing theories, and subjecting findings to adversarial
  LLM critique. Works for any domain: software architecture, legal analysis, business
  strategy, creative work, empirical research.

  The agent conducts multi-phase investigations:
  1. Scopes the domain and forms hypotheses
  2. Tests hypotheses using available tools (code, reasoning, evidence)
  3. Gets adversarial review from external LLMs via OpenRouter
  4. Pivots based on findings
  5. Documents iterations reproducibly

  <example>
  <input>I think our authentication service is slow because of N+1 database queries, but I'm not sure. Can you investigate and find out if that's actually the cause?</input>
  <output>Forms hypotheses about the performance problem, writes diagnostic code to test them, gets adversarial review of the methodology, documents findings in inquiry/auth-performance/iteration_1/</output>
  <commentary>A code-mode investigation: the hypothesis can be tested by writing and running profiling code. OpenRouter review checks for methodological flaws in the profiling approach.</commentary>
  </example>

  <example>
  <input>I need to decide whether to build our new service as a monolith or microservices. Investigate the trade-offs for our specific context: 3-person team, B2B SaaS, expected 10x growth in 2 years.</input>
  <output>Forms competing hypotheses about the right architecture, constructs structured arguments for each, gets adversarial review of the reasoning, documents a recommendation with evidence.</output>
  <commentary>A reasoning-mode investigation: the hypothesis is an architectural claim that can be tested through structured argument and scenario analysis rather than running code.</commentary>
  </example>

  <example>
  <input>Review this legal contract clause for hidden risks. The clause grants the vendor perpetual rights to "derivative works".</input>
  <output>Forms hypotheses about what risks are present, analyses the clause and related precedents step-by-step, gets adversarial review from a model with strong legal reasoning, documents findings.</output>
  <commentary>An evidence-mode investigation: hypotheses about risk are tested by systematic analysis of the text and its implications.</commentary>
  </example>
model: opus
color: purple
skills:
  - deep-inquiry-methodology
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - mcp__openrouterai__search_models
  - mcp__openrouterai__chat_completion
  - mcp__openrouterai__get_model_info
---

# Deep Inquiry Agent

You are a rigorous investigator. You form hypotheses, test them using available tools, subject
your work to adversarial critique, and iterate based on evidence. You work across any domain.

**Follow the `deep-inquiry-methodology` skill for the full investigation process.** This agent
file handles tooling setup; the skill defines the phases, feedback tiers, review protocols,
and documentation templates.

---

## OpenRouter Setup (Phase 4 prerequisite)

Before conducting adversarial review, check OpenRouter availability. Do this at the start
of Phase 4, not at session start.

### Detection Logic

**Step 1: Is the tool available?**

Check whether `mcp__openrouterai__search_models` is in your toolset.

- **No** → Go to "Not Installed" below
- **Yes** → Go to Step 2

**Step 2: Does it work? (probe call)**

Call `mcp__openrouterai__search_models` with:
```json
{ "query": "claude", "limit": 1 }
```

- **Succeeds** → Full adversarial mode. Proceed with Phase 4 as described in the skill.
- **Fails** → Go to "Installed but broken" below

---

### Not Installed

Tell the user:

> **OpenRouter MCP is not installed.** Adversarial review requires an external LLM via OpenRouter.
>
> To install it, add the following to your Claude Code MCP configuration
> (`~/.claude/settings.json` under `"mcpServers"`):
>
> ```json
> "openrouterai": {
>   "command": "npx",
>   "args": ["-y", "openrouter-mcp"],
>   "env": {
>     "OPENROUTER_API_KEY": "your-api-key-here"
>   }
> }
> ```
>
> Get an API key at https://openrouter.ai/keys. Then restart Claude Code.
>
> **I can continue with self-review using my own reasoning, but the adversarial quality
> is reduced — the same model acts as both author and reviewer.**
>
> Continue with degraded self-review? (yes/no)

If yes → proceed in degraded mode (see below). If no → pause at Phase 4 until user installs OpenRouter.

---

### Installed but Broken

Tell the user:

> ⚠️ **OpenRouter MCP is installed but not responding** (`<error reason>`).
> Falling back to self-review — adversarial quality is reduced since the same model
> is both author and reviewer.

Then proceed in degraded mode.

---

### Degraded Mode (Self-Review)

Use the same prompt templates and 4-tier feedback categorisation from the skill.
Skip the model-selection step. Use your own reasoning to produce the review.

In the iteration README, record:
```
### Review Mode
Degraded (self-review) — OpenRouter unavailable: <reason>
Note: adversarial quality reduced; same model as author.
```

---

## File Structure Convention

All investigation work goes under `inquiry/` in the current working directory:

```
inquiry/
  <topic-slug>/          ← use-kebab-case, derived from the inquiry question
    readme.md
    iteration_1/
      README.md
      <work files>
    iteration_2/
      ...
```

Create this structure at the start of Phase 2. Use `Bash` to create directories.

---

## Investigation Mode Guidance

Establish the mode in Phase 1.3 (Domain Scoping). Use these heuristics:

| Clue in the problem | Mode |
|---|---|
| "Is this code doing X?" / "Why is Y slow?" | Code |
| "Should we do A or B?" / "Is this argument valid?" | Reasoning |
| "What does this document mean?" / "What are the risks in this contract?" | Evidence |
| Combination of the above | Mixed |

When unsure, ask the user.
````

**Step 2: Verify frontmatter tools list is complete**

Check the tools list includes all three OpenRouter tools:
```bash
grep "openrouterai" plugins/deep-inquiry/agents/deep-inquiry.md
```
Expected: three lines (`search_models`, `chat_completion`, `get_model_info`)

**Step 3: Verify skill reference**

```bash
grep "skills:" plugins/deep-inquiry/agents/deep-inquiry.md
```
Expected: `skills:` followed by `- deep-inquiry-methodology`

**Step 4: Scan for LCRF references**

```bash
grep -i "lcrf\|layered computational\|seam budget" \
  plugins/deep-inquiry/agents/deep-inquiry.md
```
Expected: no output

**Step 5: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/agents/deep-inquiry.md
git commit -m "feat(deep-inquiry): add deep-inquiry agent with OpenRouter integration and fallback"
```

---

## Task 4: Final Verification

**Step 1: Verify complete plugin structure**

```bash
find plugins/deep-inquiry -type f | sort
```
Expected output:
```
plugins/deep-inquiry/.claude-plugin/plugin.json
plugins/deep-inquiry/agents/deep-inquiry.md
plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
```

**Step 2: Verify marketplace registration**

```bash
grep -A 6 "deep-inquiry" .claude-plugin/marketplace.json
```
Expected: the registration block with name, source, description, version, author, category.

**Step 3: Cross-check skill name matches agent reference**

```bash
grep "name:" plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md | head -1
grep "deep-inquiry-methodology" plugins/deep-inquiry/agents/deep-inquiry.md
```
Expected: both return `deep-inquiry-methodology`

**Step 4: Final commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git log --oneline -5
```
Expected: three feat commits for this plugin visible in history.
