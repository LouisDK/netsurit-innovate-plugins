# Deep Inquiry README Redesign - Design Document

**Date:** 2026-03-02
**Author:** Louis de Klerk (Netsurit)
**Status:** Approved

## Goal

Rewrite the deep-inquiry plugin README from a technical reference into a document that sells what the plugin can do while remaining unflinchingly honest about its limitations. Target audience: technical decision-makers (CTOs, VPs of Engineering, architects) who understand AI but need to see practical ROI.

## Approach: "The Auditable AI Analyst"

Position deep-inquiry as the tool that makes AI reasoning trustworthy enough for real decisions. Lead with the problem (AI conclusions are black boxes), present the solution (structured, adversarial, documented investigation), prove it with scenarios at different capability tiers, be honest about limitations, and close with the agent-integration vision.

## README Structure

### 1. The Hook (1 paragraph)

The trust problem: every AI tool gives answers, but you can't tell if they're rigorous or hallucinated. Deep Inquiry investigates questions with explicit hypotheses, adversarial review by a different AI model, and documented reasoning. The output is an auditable report, not a chat response.

### 2. What This Actually Does (numbered walkthrough)

6-phase process described for decision-makers, not implementers:

1. **Scopes the problem** - clarifies domain, tools, success criteria; forms 1-3 hypotheses before investigation
2. **Investigates** - Code mode (runs profilers, tests), Reasoning mode (structured arguments), Evidence mode (document analysis), or Mixed
3. **Gets adversarially reviewed** - different AI model via OpenRouter critiques the work; 4-tier feedback system (Critical/Methodological/Enhancement/Style); investigator fixes Critical issues but doesn't blindly accept all feedback
4. **Documents everything** - every iteration has a README with hypotheses, methods, findings, review logs
5. **Produces interactive reports** - self-contained HTML, hypothesis arcs, review breakdowns, dark/light theme, printable to PDF
6. **Iterates or concludes** - pre-agreed budget, pivots or concludes with summary report

### 3. Scenarios by Capability Tier

#### Tier 1: Minimal Setup (Claude Code + OpenRouter)

**Scenario 1: "Should we rewrite our monolith into microservices?"**
- Mode: Reasoning
- Data: codebase + team context you provide
- Value: adversarial review catches reasoning gaps, hypothesis structure prevents hand-waving, report is reviewable by CTO

**Scenario 2: "Review this vendor contract for hidden risks"**
- Mode: Evidence
- Data: the contract document
- Value: systematic clause-by-clause analysis, adversarial reviewer catches missed risks
- Caveat: not legal advice; structured first-pass to focus lawyer's time

**Scenario 3: "Choosing between three database technologies"**
- Mode: Reasoning
- Data: your requirements + LLM knowledge
- Value: decision matrix with argued positions, adversarial challenge on assumptions

#### Tier 2: With Web Search MCP

**Scenario 4: "Kubernetes vs. ECS for our infrastructure"**
- Mode: Mixed (Reasoning + Evidence)
- Data: LLM knowledge + live docs + your infra context
- Value: claims verified against current documentation, not just reasoned

**Scenario 5: "Competitor launched a threatening feature - what are our options?"**
- Mode: Mixed (Reasoning + Evidence)
- Data: web search for competitor intel + your product context
- Value: response strategy grounded in actual current data

#### Tier 3: Rich MCP Ecosystem

**Scenario 6: "Why is checkout conversion dropping?"**
- Mode: Mixed (Code + Evidence)
- Data: database queries, Playwright checkout walkthrough, industry benchmarks
- Value: hypotheses tested against real data, causal claims adversarially challenged

**Scenario 7: "Should we expand into the DACH market?"**
- Mode: Mixed (Reasoning + Evidence)
- Data: web search + internal metrics via DB MCP + competitor analysis via Playwright
- Value: market entry recommendation backed by actual sources, adversarially reviewed

### 4. What This Is and Isn't

**IS:**
- Structured reasoning framework making AI conclusions auditable
- Methodology enforcer: hypothesis-driven, adversarially tested, documented
- Report generator producing reviewable artifacts, not chat messages
- As powerful as the tools you give it

**IS NOT:**
- A search engine or data collector (reasons over accessible data)
- A replacement for domain experts (rigorous first-pass to focus expert time)
- An oracle (adversarial review catches some errors; real value is visible reasoning)
- Magic (quality ceiling rises with connected tools)

**Excels at:**
- Problems where bottleneck is structured thinking, not data collection
- Decisions where you need to show your work
- Getting a rigorous second opinion faster than hiring a consultant
- Codebase investigations where evidence is in local files

**Struggles with:**
- Proprietary data not connected via MCP
- Real-time market data without web search
- Human interviews, surveys, physical-world observation
- Niche domains with thin LLM training data

### 5. Getting Started (Setup)

Retain practical setup content from existing README:
- OpenRouter MCP configuration
- Basic invocation examples
- Worktree isolation explanation (brief)
- Reporter usage

### 6. Where This Is Going (Vision)

Deep-inquiry's architecture (bounded iterations, documented reasoning, adversarial review, structured reports) makes it a natural decision engine for AI agent orchestration.

**The pattern:** An orchestrator agent hits a complex decision, spawns a deep-inquiry investigation instead of hallucinating an answer, then presents the report to a human for approval.

**What this changes:** Humans aren't asked "do you trust this AI?" They're asked "here's the investigation, the critique, and the recommendation - do you approve?" Fundamentally different question.

**What's needed:** Orchestration layer that can spawn deep-inquiry as a subtask and consume reports programmatically. The methodology, reports, and adversarial review are in place today. The gap is integration, not capability.

## Scope

- **In scope:** Complete rewrite of `plugins/deep-inquiry/README.md`
- **Possibly in scope:** Light updates to `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md` README section if it has one
- **Out of scope:** Changes to agent code, report templates, or plugin functionality

## Design Principles

1. **Sell through honesty** - technical decision-makers respect transparency
2. **Scenarios over features** - show what it does, not how it's built
3. **Capability tiers** - readers immediately see what's relevant to their setup
4. **Prove, don't claim** - every capability tied to a concrete scenario
5. **Vision grounded in reality** - agent integration section acknowledges what's built vs. aspirational
