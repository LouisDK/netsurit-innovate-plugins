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
- **Isolation mode**: `worktree` or `in-place` — whether the investigation runs in its own worktree
- **Main tree path**: Absolute path to the main working tree (for report copy at conclusion)

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

### 1.6 Isolation Decision

Detect whether you are already inside a git worktree:

```bash
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
```

**If `GIT_DIR` ≠ `GIT_COMMON` → you are in a worktree.** Work in-place. The user already
has isolation. Record `isolation_mode: in-place` in session variables and skip the rest of
this phase.

**If `GIT_DIR` = `GIT_COMMON` → you are in the main tree.** Offer a worktree based on
investigation mode:

| Mode | Framing |
|---|---|
| Code / Mixed | *"This investigation may modify source files. I recommend an isolated worktree so your main tree stays clean. Use a worktree? (yes/no)"* |
| Reasoning / Evidence | *"This investigation only creates markdown files. Want to isolate it in a worktree anyway? (yes/no)"* |

Record the user's choice as `isolation_mode: worktree` or `isolation_mode: in-place`.

Also discover and record the main tree path (needed for report copy):

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
```

Record as session variable `main_tree_path`.

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

### Generate Iteration Report

After finalising the iteration README, generate a self-contained HTML report:
- Construct the `type: "iteration"` JSON from this iteration's hypotheses, findings, review log, domain interpretation, and future directions
- Write `inquiry/<topic>/iteration_<N>/report.html` using the agent's report generation instructions
- This report is shareable — it has no external dependencies and opens in any browser

When the investigation concludes (no more iterations), the agent will automatically generate
a multi-iteration summary report. The `@deep-inquiry-reporter` agent can also be invoked
manually at any time for on-demand reports.

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
| Isolation mode | worktree / in-place |
| Main tree path | /absolute/path |

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
   - ✅ **Done**: Question answered → generate summary report, stop
   - 🔄 **New iteration**: Try alternative approach (if budget allows)
   - ⏸️ **Pause**: Partial results, document what was learned → generate summary report, stop
   - ❌ **Abandon**: Approach not working, document why → generate summary report, stop

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
