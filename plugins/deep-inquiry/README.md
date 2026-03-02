# Deep Inquiry

Every AI tool can give you an answer. The problem is you can't tell whether the answer is rigorous or hallucinated. Deep Inquiry doesn't just answer questions — it investigates them. It forms explicit hypotheses, tests them using available tools, submits its work to a different AI model for adversarial critique, fixes what the critic finds, and documents every step. The result isn't a chat response — it's an auditable investigation report you can review, challenge, and base decisions on.

## What This Actually Does

1. **Scopes the problem** — You describe what you need investigated. The agent clarifies the domain, available tools, and success criteria. It forms 1-3 explicit hypotheses *before* touching anything.
2. **Investigates** — Depending on the problem type: runs code and profilers (Code mode), constructs structured arguments (Reasoning mode), analyzes documents and data (Evidence mode), or combines these (Mixed mode).
3. **Gets adversarially reviewed** — Submits its complete work to a *different* AI model via OpenRouter. The reviewer categorizes feedback into 4 tiers: Critical (must fix), Methodological (evaluate impact), Enhancement (document only), Style (ignore). The investigator must fix Critical issues but is trained to critically evaluate all feedback — not blindly accept it.
4. **Documents everything** — Every iteration produces a README with hypotheses, methods, findings, review logs, and domain interpretation. Nothing is a black box.
5. **Produces interactive reports** — Self-contained HTML files with hypothesis arcs, review breakdowns, and findings. Dark/light theme, printable to PDF. No server needed.
6. **Iterates or concludes** — Based on a pre-agreed iteration budget, it pivots (tries a different approach), continues, or concludes with a summary report across all iterations.

---

## Scenarios by Capability Tier

What Deep Inquiry can do depends on what tools Claude Code has access to. Here are real scenarios across three tiers, from minimal setup to a rich tool ecosystem.

### Tier 1: Minimal Setup (Claude Code + OpenRouter)

These work with just LLM reasoning over training data, local files, and bash. No web search, no special MCP servers. You get structured adversarial analysis — stronger than asking Claude directly, but limited to what the model already knows.

#### "Should we rewrite our monolith into microservices?"

- **Mode:** Reasoning
- **Data:** Your codebase (local files), your team size and growth projections (you describe them)
- **What it does:** Forms hypotheses like "Monolith will hit deployment bottleneck at 15 engineers" and "Microservices will increase operational cost by 3x for a team of 5." Adversarial reviewer stress-tests the assumptions. Report delivers argued positions, counterarguments addressed, recommendation with explicit caveats.
- **Why better than just asking Claude:** Adversarial review catches reasoning gaps, hypothesis structure prevents hand-waving, report is reviewable by your CTO.

#### "Review this vendor contract for hidden risks"

- **Mode:** Evidence
- **Data:** Paste or provide the contract document
- **What it does:** Hypothesizes specific risk categories — IP assignment, liability caps, termination clauses, auto-renewal traps. Systematically analyzes each clause. Adversarial reviewer checks for missed risks and misinterpretations. Report catalogs findings by severity.
- **Caveat:** Not legal advice. This is a structured first-pass that helps you know what questions to bring to your lawyer.

#### "We're choosing between three database technologies for our new service"

- **Mode:** Reasoning
- **Data:** Your requirements (you describe them), LLM knowledge of the technologies
- **What it does:** Forms hypotheses about which technology best fits each requirement. Constructs structured arguments. Adversarial reviewer challenges assumptions about scalability, operational complexity, and team expertise fit. Report presents a decision matrix with argued positions.

### Tier 2: With Web Search MCP

Web search changes the game: the agent can verify claims against current information, check pricing, and read live documentation. Claims are verified, not just reasoned about. This is the difference between "I think Kubernetes pricing works like this" and "here's what the current pricing page says."

#### "Evaluate whether we should adopt Kubernetes or stay on ECS"

- **Mode:** Mixed (Reasoning + Evidence)
- **Data:** LLM knowledge + live documentation lookup + your infrastructure context
- **What it does:** Researches current pricing, checks latest feature announcements, verifies version compatibility against actual docs. Adversarial reviewer catches stale assumptions. Much stronger than Tier 1 because claims about cost and compatibility are verified against real sources.

#### "Our competitor just launched a feature that threatens our core product. What are our options?"

- **Mode:** Mixed (Reasoning + Evidence)
- **Data:** Web search for competitor announcements, your product context (you describe it)
- **What it does:** Investigates the competitive threat with actual current data. Forms hypotheses about impact severity and response strategies. Adversarial reviewer challenges optimistic assumptions — the part of you that wants to believe it's not a big deal.

### Tier 3: Rich MCP Ecosystem (Databases, APIs, Playwright)

This is where Deep Inquiry becomes genuinely powerful — it can work with your actual data, not just reason about it. Connect database MCPs, browser automation, internal APIs, and the investigation reaches into your real systems.

#### "Why is our checkout conversion rate dropping?"

- **Mode:** Mixed (Code + Evidence)
- **Data:** Database queries against your analytics, Playwright to walk the actual checkout flow, web search for industry benchmarks
- **What it does:** Forms hypotheses (page load time? form friction? pricing display?), tests them against real data, screenshots the actual user experience, compares to competitors. Adversarial reviewer challenges causal claims — correlation between a deploy date and a drop isn't proof.

#### "Should we expand into the DACH market?"

- **Mode:** Mixed (Reasoning + Evidence)
- **Data:** Web search for market data, your internal metrics via database MCP, competitor analysis via Playwright
- **What it does:** Investigates market size, regulatory requirements, competitive landscape, and localization costs. Each claim backed by a source. Adversarial reviewer challenges market assumptions and growth projections — the numbers that feel right but might not survive scrutiny.

---

## What This Is and Isn't

### What Deep Inquiry IS

- **A structured reasoning framework that makes AI conclusions auditable.** Every hypothesis, every piece of evidence, every reviewer objection — documented and traceable. You don't have to trust the answer; you can read the work.
- **A methodology enforcer.** Hypothesis-driven, adversarially tested, documented at every step. It imposes the discipline that "just asking Claude" lacks.
- **A report generator that produces reviewable artifacts, not chat messages.** The output is a standalone document you can hand to your CTO, attach to a decision record, or revisit six months later. It survives beyond the conversation that created it.
- **As powerful as the tools you give it.** Local files, web search, databases, APIs — each tool you connect raises the ceiling on what it can investigate. Without tools, it reasons over training data. With tools, it reasons over your reality.

### What Deep Inquiry IS NOT

- **A search engine or data collector.** It reasons over data you provide or that it can access through configured tools. It doesn't crawl the web unprompted or maintain a knowledge base between sessions.
- **A replacement for domain experts.** It's a rigorous first-pass that helps experts focus their time. A Deep Inquiry report on your contract risks tells your lawyer where to look — it doesn't replace your lawyer.
- **An oracle.** It can be wrong. The adversarial review catches some errors, but the real value is that you can *see the reasoning* and judge for yourself. A wrong answer with visible logic is more useful than a right answer you can't verify.
- **Magic.** Without web search, it's reasoning over training data. With web search, it can verify claims. With database access, it can query your actual numbers. The quality ceiling rises with the tools you connect.

### Where It Excels

- **Problems where the bottleneck is *structured thinking*, not data collection.** If you already have the information but need it analyzed rigorously — architecture decisions, strategy evaluations, risk assessments — this is the sweet spot.
- **Decisions where you need to show your work.** Board presentations, architecture reviews, compliance documentation. The report *is* the deliverable.
- **Situations where a second opinion matters but hiring a consultant takes weeks.** Deep Inquiry won't replace a six-month engagement, but it can give you a structured analysis by tomorrow morning.
- **Codebase investigations where the evidence is in local files.** Performance issues, dependency risks, architecture reviews — the agent reads the code, forms hypotheses, and tests them against what's actually there.

### Where It Struggles

- **Problems requiring proprietary data you haven't connected via MCP.** It can't query your database if you haven't given it database access. It can't read your Confluence if there's no Confluence MCP. The gap between potential and performance is usually a missing tool connection.
- **Real-time market data without web search configured.** Training data has a cutoff. Without web search, claims about current pricing, market conditions, or recent events are educated guesses at best.
- **Anything requiring human interviews, surveys, or physical-world observation.** It can analyze interview transcripts you provide, but it can't conduct the interviews. It reasons over information, not experiences.
- **Domains where LLM training data is thin or outdated.** Niche industries, very recent technical developments, proprietary frameworks with limited public documentation. The adversarial reviewer will flag low-confidence areas, but thin training data means thin analysis.

---

## Getting Started

### Quickstart

```
@deep-inquiry I think our auth service is slow because of N+1 queries. Can you investigate?
```

The agent will ask you to confirm an iteration budget (how many investigate-review cycles to run), then execute the full methodology: scoping, hypothesis formation, investigation, adversarial review, and reporting.

### Embedding in Domain-Specific Agents

Deep Inquiry works as a skill inside other Claude Code agents. Use the `skills:` frontmatter to combine it with domain knowledge:

```yaml
---
name: my-domain-agent
skills:
  - deep-inquiry-methodology
  - my-domain-knowledge
---
```

This lets a domain agent invoke the full investigation methodology without duplicating the prompt.

### OpenRouter Setup

The adversarial review step requires a *different* AI model, accessed through the OpenRouter MCP server. This is what makes the review genuinely adversarial rather than self-review. Cost is minimal — typically $0.01–0.10 per review call.

**Step 1: Get an API key**

Go to [openrouter.ai](https://openrouter.ai), create an account, and generate an API key. Add credits — even $1 is enough for dozens of reviews.

**Step 2: Configure the MCP server**

Add the OpenRouter MCP server to your Claude Code configuration. Choose one:

**Project-level** (`.mcp.json` in your project root — scoped to this project):

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

**Global** (`~/.claude/settings.json` — available in all projects, add under `"mcpServers"`):

```json
"openrouterai": {
  "command": "npx",
  "args": ["@mcpservers/openrouterai"],
  "env": {
    "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
  }
}
```

**Step 3: Restart Claude Code** for the MCP configuration to take effect.

**Verifying it works**

After restarting, ask Claude Code to call the `search_models` tool:

```
Can you call mcp__openrouterai__search_models and search for "anthropic"?
```

If it returns a list of models, the MCP server is working.

**Troubleshooting**

| Symptom | Fix |
|---|---|
| `mcp__openrouterai__search_models` not found | MCP config not loaded — check JSON syntax, restart Claude Code |
| Tool call fails with auth error | API key is invalid or expired — regenerate at openrouter.ai/keys |
| Tool call fails with credits error | Add credits at openrouter.ai/credits |
| Agent says "OpenRouter MCP is not installed" | The `openrouterai` key must match exactly — check for typos |

**Graceful degradation:** If OpenRouter is not installed, the agent prints setup instructions and offers to continue with self-review instead. If installed but broken (auth failure, credits exhausted), it falls back to self-review automatically with a warning. Either way, the investigation proceeds — you just get a weaker review step.

### Worktree Isolation

Investigations are exploratory — the agent creates files, runs experiments, and produces artifacts. This shouldn't happen in your working tree where you have uncommitted changes or active work. Deep Inquiry automatically offers to create a git worktree for isolation.

If you're in the main tree, the agent offers to create a worktree before starting. If you're already in a worktree, it works in-place.

When the investigation concludes, the summary report is copied back to your main tree. The worktree remains available for inspection. To clean up: `@deep-inquiry clean up the <topic> worktree` or use standard git commands (`git worktree remove <path>`).

### Output Structure

```
inquiry/
  <topic-slug>/
    readme.md               <- tracks all iterations and overall findings
    iteration_1/
      README.md             <- hypotheses, method, findings, review log
      report.html           <- auto-generated per-iteration report
      <work files>          <- code, arguments, evidence analysis
    iteration_2/
      ...
    report.html             <- multi-iteration summary report
```

### Reports

Every iteration produces a self-contained HTML report with the full investigation record. When the investigation concludes, a summary report is auto-generated across all iterations.

For on-demand reports at any point during or after an investigation, use `@deep-inquiry-reporter`.

Reports use dark/light theme based on system preference, are printable to PDF, and require no server — just open the HTML file in a browser.

---

## Where This Is Going

Today, Deep Inquiry is a tool you invoke directly. But its architecture — bounded iterations, documented reasoning, adversarial review, structured reports — makes it a natural fit for something bigger: AI agents that need to make complex decisions they can defend.

Consider an AI agent orchestrating a multi-step business process — task lists, approval gates, specialist agents. At some point it hits a decision too complex to just "pick the obvious answer": choosing between database technologies, evaluating vendor proposals, assessing regulatory risk, recommending market entry timing. Instead of hallucinating a choice or escalating every decision to a human (defeating the purpose of automation), it spawns a Deep Inquiry investigation. The investigation runs its full cycle — scoping, hypotheses, evidence gathering, adversarial review, report. Then the orchestrator presents the *report* to a human for approval.

The human reviewer isn't asked "do you trust this AI's judgment?" They're asked "here's the investigation, the hypotheses tested, the adversarial critique, and the recommendation — do you approve?" That's a fundamentally different question. It's the difference between a black-box decision and an auditable one.

This isn't built yet. It requires an orchestration layer that can spawn Deep Inquiry as a subtask and consume its reports programmatically. But the investigation methodology, the report format, and the adversarial review pipeline are all in place today. The gap is integration, not capability.

---

**Author:** Louis de Klerk from Netsurit
