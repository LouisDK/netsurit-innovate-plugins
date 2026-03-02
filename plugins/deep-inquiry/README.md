# Deep Inquiry

Every AI tool can give you an answer. The problem is you can't tell whether the answer is rigorous or hallucinated. Deep Inquiry doesn't just answer questions — it investigates them. It forms explicit hypotheses, tests them using available tools, submits its work to a different AI model for adversarial critique, fixes what the critic finds, and documents every step. The result isn't a chat response — it's an auditable investigation report you can review, challenge, and base decisions on.

## What This Actually Does

1. **Scopes the problem** — You describe what you need investigated. The agent clarifies the domain, available tools, and success criteria. It forms 1-3 explicit hypotheses *before* touching anything.
2. **Investigates** — Depending on the problem type: runs code and profilers (Code mode), constructs structured arguments (Reasoning mode), analyzes documents and data (Evidence mode), or combines these (Mixed mode).
3. **Gets adversarially reviewed** — Submits its complete work to a *different* AI model via OpenRouter. The reviewer categorizes feedback into 4 tiers: Critical (must fix), Methodological (evaluate impact), Enhancement (document only), Style (ignore). The investigator must fix Critical issues but is trained to critically evaluate all feedback — not blindly accept it.
4. **Documents everything** — Every iteration produces a README with hypotheses, methods, findings, review logs, and domain interpretation. Nothing is a black box.
5. **Produces interactive reports** — Self-contained HTML files with hypothesis arcs, review breakdowns, and findings. Dark/light theme, printable to PDF. No server needed.
6. **Iterates or concludes** — Based on a pre-agreed iteration budget, it pivots (tries a different approach), continues, or concludes with a summary report across all iterations.
