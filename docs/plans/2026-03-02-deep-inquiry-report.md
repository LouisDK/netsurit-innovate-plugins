# Deep Inquiry Report Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add self-contained HTML reporting to the deep-inquiry plugin — a per-iteration auto-report (generated at Phase 5) and an on-demand multi-iteration summary report via a new `deep-inquiry-reporter` agent.

**Architecture:** A single `assets/report-template.html` (pre-built, self-contained, no external dependencies) is populated by the agent prepending `<script>window.REPORT_DATA = {...};</script>` and writing the result to disk. Two JSON shapes (`type: "iteration"` and `type: "summary"`) share one template which branches on `REPORT_DATA.type` at render time. The reporter agent reads finished markdown files to construct the summary JSON.

**Tech Stack:** Vanilla HTML/CSS/JS (no frameworks, no build step), Playwright MCP for preview, Python http.server for local serving

**Reference files to read before starting:**
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/questionpad/assets/app.html` — existing self-contained HTML asset pattern
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/questionpad/agents/feedback-collector.md` — agent frontmatter conventions
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/agents/deep-inquiry.md` — agent to modify
- `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md` — skill to modify
- `/home/louisdk/experiment/netsurit-innovate-plugins/docs/plans/2026-03-02-deep-inquiry-report-design.md` — the approved design

---

## Task 1: Create `report-template.html`

**Files:**
- Create: `plugins/deep-inquiry/assets/report-template.html`

This is the core artifact — a fully self-contained HTML file with inline CSS and JS. No external dependencies. Renders either an iteration report or a summary report depending on `window.REPORT_DATA.type`.

**Step 1: Create the file**

Create `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/report-template.html` with exactly this content:

```html
<!DOCTYPE html>
<html data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deep Inquiry Report</title>
  <style>
    :root {
      --bg: #0f1117; --bg2: #1a1d27; --fg: #e2e8f0; --fg-muted: #94a3b8;
      --accent: #6366f1; --border: #2d3148; --card: #1e2235;
      --confirmed: #22c55e; --refuted: #ef4444; --pivoted: #f97316; --inconclusive: #94a3b8;
      --critical: #ef4444; --methodological: #f97316; --enhancement: #6366f1; --style-tier: #64748b;
    }
    [data-theme="light"] {
      --bg: #f8fafc; --bg2: #ffffff; --fg: #0f172a; --fg-muted: #64748b;
      --accent: #4f46e5; --border: #e2e8f0; --card: #ffffff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; }
    h2 { font-size: 0.8rem; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
    h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
    .header { border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .header-meta { color: var(--fg-muted); font-size: 0.875rem; margin-top: 0.25rem; }
    .status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .status-Done, .status-Complete { background: #14532d; color: #86efac; }
    .status-Abandoned, .status-Failed { background: #431407; color: #fdba74; }
    .status-InProgress, .status-Active { background: #1e3a5f; color: #93c5fd; }
    .section { margin-bottom: 2.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1.25rem; }
    .theme-toggle { background: none; border: 1px solid var(--border); color: var(--fg-muted); border-radius: 0.375rem; padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem; white-space: nowrap; flex-shrink: 0; }
    ul { padding-left: 1.25rem; }
    ul li { margin-bottom: 0.3rem; font-size: 0.9rem; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    footer { border-top: 1px solid var(--border); margin-top: 3rem; padding-top: 1.5rem; text-align: center; color: var(--fg-muted); font-size: 0.8rem; font-style: italic; }
    @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } .arc-flow { flex-direction: column !important; } }
    @media print { .theme-toggle { display: none; } body { background: white; color: black; } }

    /* Hypothesis arc */
    .arc-flow { display: flex; align-items: stretch; }
    .arc-node { flex: 1; background: var(--card); border: 1px solid var(--border); padding: 1rem; }
    .arc-node:first-child { border-radius: 0.5rem 0 0 0.5rem; }
    .arc-node:last-child { border-radius: 0 0.5rem 0.5rem 0; }
    .arc-node + .arc-node { border-left: none; }
    .arc-arrow { display: flex; align-items: center; padding: 0 0.3rem; color: var(--fg-muted); flex-shrink: 0; }
    .arc-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); margin-bottom: 0.4rem; }
    .arc-text { font-size: 0.875rem; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.35rem; vertical-align: middle; }
    .dot-confirmed { background: var(--confirmed); }
    .dot-refuted { background: var(--refuted); }
    .dot-pivoted { background: var(--pivoted); }
    .dot-inconclusive { background: var(--inconclusive); }
    .hypothesis-item + .hypothesis-item { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }

    /* Review log */
    .review-mode-badge { font-size: 0.75rem; color: var(--fg-muted); margin-bottom: 1rem; }
    .tier-row { margin-bottom: 1.25rem; }
    .tier-header { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
    .tier-label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
    .tier-count { font-size: 0.75rem; color: var(--fg-muted); }
    .tier-bar-bg { background: var(--bg2); border-radius: 4px; height: 6px; }
    .tier-bar { height: 6px; border-radius: 4px; min-width: 0; transition: width 0.5s ease; }
    .bar-critical { background: var(--critical); }
    .bar-methodological { background: var(--methodological); }
    .bar-enhancement { background: var(--enhancement); }
    .bar-style { background: var(--style-tier); }
    .tier-items { margin-top: 0.6rem; }
    .tier-item { font-size: 0.8rem; color: var(--fg-muted); padding: 0.35rem 0; border-bottom: 1px solid var(--border); display: flex; gap: 0.5rem; align-items: flex-start; }
    .tier-item:last-child { border-bottom: none; }
    .action-pill { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 9999px; white-space: nowrap; flex-shrink: 0; margin-top: 0.1rem; }
    .action-fixed { background: #14532d; color: #86efac; }
    .action-addressed { background: #365314; color: #bef264; }
    .action-documented { background: #1e1b4b; color: #a5b4fc; }
    .action-ignored { background: #1e293b; color: #94a3b8; }

    /* Findings */
    .finding-item { padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
    .finding-item:last-child { border-bottom: none; }
    .finding-evidence { font-size: 0.75rem; color: var(--fg-muted); font-family: monospace; margin-top: 0.3rem; }

    /* Timeline */
    .timeline { position: relative; padding-bottom: 0.5rem; }
    .timeline-track { position: absolute; top: 1.25rem; left: 5%; right: 5%; height: 2px; background: var(--border); }
    .timeline-nodes { display: flex; justify-content: space-around; position: relative; padding-bottom: 0.5rem; }
    .timeline-node { text-align: center; cursor: pointer; flex: 1; }
    .timeline-node:hover .timeline-label { color: var(--accent); }
    .timeline-dot { width: 16px; height: 16px; border-radius: 50%; margin: 0 auto 0.5rem; border: 2px solid var(--border); position: relative; z-index: 1; }
    .tdot-Done, .tdot-Success, .tdot-Complete { background: var(--confirmed); border-color: var(--confirmed); }
    .tdot-Partial { background: var(--pivoted); border-color: var(--pivoted); }
    .tdot-Abandoned, .tdot-Failed { background: var(--refuted); border-color: var(--refuted); }
    .timeline-label { font-size: 0.75rem; font-weight: 600; }
    .timeline-sublabel { font-size: 0.7rem; color: var(--fg-muted); }
    .timeline-detail { display: none; background: var(--card); border: 1px solid var(--accent); border-radius: 0.5rem; padding: 1rem; margin-top: 0.75rem; text-align: left; font-size: 0.875rem; }
    .timeline-detail.open { display: block; }

    /* Insight gallery */
    .insight-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .insight-card { background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; }
    .insight-card.high { border-left: 3px solid var(--accent); }
    .insight-meta { font-size: 0.7rem; color: var(--fg-muted); display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .star { color: #fbbf24; }
    .insight-detail { font-size: 0.8rem; color: var(--fg-muted); margin-top: 0.4rem; }

    /* Decision log */
    .decision-item { padding: 0.75rem 0; border-bottom: 1px solid var(--border); display: flex; gap: 1rem; align-items: flex-start; }
    .decision-item:last-child { border-bottom: none; }
    .decision-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 9999px; white-space: nowrap; flex-shrink: 0; margin-top: 0.15rem; }
    .badge-Pivot { background: #431407; color: #fdba74; }
    .badge-Done, .badge-Complete { background: #14532d; color: #86efac; }
    .badge-Pause { background: #1e3a5f; color: #93c5fd; }
    .badge-Abandon { background: #27272a; color: #a1a1aa; }
    .decision-text { font-size: 0.875rem; font-weight: 600; }
    .decision-reasoning { font-size: 0.8rem; color: var(--fg-muted); margin-top: 0.2rem; }
  </style>
</head>
<body>
<div class="container" id="app">
  <p style="color:var(--fg-muted);font-size:0.9rem;">Waiting for report data…</p>
</div>
<script>
function el(tag, attrs) {
  const e = document.createElement(tag);
  const children = Array.prototype.slice.call(arguments, 2);
  for (const k in (attrs || {})) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c == null) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function statusBadge(s) {
  return el('span', { class: 'status-badge status-' + s.replace(/\s/g, '') }, s);
}

function themeToggle() {
  const btn = el('button', { class: 'theme-toggle' }, '☀ Light');
  btn.onclick = function() {
    const html = document.documentElement;
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
    btn.textContent = isLight ? '☀ Light' : '☾ Dark';
  };
  return btn;
}

function pageFooter() {
  return el('footer', {}, 'Deep Inquiry plugin by Louis de Klerk from Netsurit');
}

/* ── Iteration renderers ── */

function renderHypothesisArc(hypotheses) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Hypothesis Arc'));
  for (let i = 0; i < hypotheses.length; i++) {
    const h = hypotheses[i];
    const flow = el('div', { class: 'arc-flow' });
    const formed = el('div', { class: 'arc-node' },
      el('div', { class: 'arc-label' }, 'Formed'),
      el('div', { class: 'arc-text' }, h.text)
    );
    const tested = el('div', { class: 'arc-node' },
      el('div', { class: 'arc-label' }, 'Tested'),
      el('div', { class: 'arc-text' }, h.tested)
    );
    const outcomeEl = el('div', { class: 'arc-text' });
    outcomeEl.appendChild(el('span', { class: 'status-dot dot-' + h.status }));
    outcomeEl.appendChild(document.createTextNode(h.outcome));
    const concluded = el('div', { class: 'arc-node' },
      el('div', { class: 'arc-label' }, 'Concluded'),
      outcomeEl
    );
    flow.appendChild(formed);
    flow.appendChild(el('div', { class: 'arc-arrow' }, '→'));
    flow.appendChild(tested);
    flow.appendChild(el('div', { class: 'arc-arrow' }, '→'));
    flow.appendChild(concluded);
    const wrapper = el('div', { class: 'hypothesis-item' });
    wrapper.appendChild(flow);
    section.appendChild(wrapper);
  }
  return section;
}

function renderReviewLog(reviewLog) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Review Log'));
  const card = el('div', { class: 'card' });
  const modeText = reviewLog.mode === 'adversarial'
    ? 'Adversarial review via OpenRouter — Models: ' + reviewLog.models.join(', ')
    : '⚠ Degraded self-review (OpenRouter unavailable)';
  card.appendChild(el('div', { class: 'review-mode-badge' }, modeText));
  const tiers = [
    { key: 'critical',       label: 'Critical',       barClass: 'bar-critical' },
    { key: 'methodological', label: 'Methodological', barClass: 'bar-methodological' },
    { key: 'enhancement',    label: 'Enhancement',    barClass: 'bar-enhancement' },
    { key: 'style',          label: 'Style',          barClass: 'bar-style' }
  ];
  const maxCount = Math.max(1, tiers.reduce(function(m, t) {
    return Math.max(m, (reviewLog.tiers[t.key] || []).length);
  }, 0));
  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti];
    const items = reviewLog.tiers[tier.key] || [];
    const row = el('div', { class: 'tier-row' });
    row.appendChild(el('div', { class: 'tier-header' },
      el('span', { class: 'tier-label' }, tier.label),
      el('span', { class: 'tier-count' }, items.length + ' item' + (items.length !== 1 ? 's' : ''))
    ));
    const barBg = el('div', { class: 'tier-bar-bg' });
    const bar = el('div', { class: 'tier-bar ' + tier.barClass });
    bar.style.width = items.length === 0 ? '0%' : Math.round((items.length / maxCount) * 100) + '%';
    barBg.appendChild(bar);
    row.appendChild(barBg);
    if (items.length > 0) {
      const list = el('div', { class: 'tier-items' });
      for (let ii = 0; ii < items.length; ii++) {
        const item = items[ii];
        const itemEl = el('div', { class: 'tier-item' },
          el('span', { class: 'action-pill action-' + item.action }, item.action)
        );
        const textEl = el('span', {});
        textEl.appendChild(document.createTextNode(item.issue));
        if (item.detail) {
          textEl.appendChild(el('div', { style: 'font-size:0.75rem;margin-top:0.15rem;' }, '→ ' + item.detail));
        }
        itemEl.appendChild(textEl);
        list.appendChild(itemEl);
      }
      row.appendChild(list);
    }
    card.appendChild(row);
  }
  section.appendChild(card);
  return section;
}

function renderFindings(findings) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Key Findings'));
  const card = el('div', { class: 'card' });
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const item = el('div', { class: 'finding-item' },
      el('h3', {}, f.heading),
      el('p', { style: 'font-size:0.875rem;' }, f.detail)
    );
    if (f.evidence) item.appendChild(el('div', { class: 'finding-evidence' }, 'Evidence: ' + f.evidence));
    card.appendChild(item);
  }
  section.appendChild(card);
  return section;
}

function renderIteration(data) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const headerLeft = el('div', {});
  const topLine = el('div', { style: 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;' },
    el('h1', {}, data.meta.topic + ' — Iteration ' + data.meta.iterationNumber),
    statusBadge(data.meta.status)
  );
  headerLeft.appendChild(topLine);
  if (data.meta.title) {
    headerLeft.appendChild(el('p', { style: 'margin-top:0.25rem;font-size:0.95rem;color:var(--fg-muted);' }, data.meta.title));
  }
  headerLeft.appendChild(el('div', { class: 'header-meta' },
    data.meta.domain + ' · ' + data.meta.mode + ' mode · ' + data.meta.date
  ));
  app.appendChild(el('div', { class: 'header' }, headerLeft, themeToggle()));
  app.appendChild(renderHypothesisArc(data.hypotheses));
  app.appendChild(renderReviewLog(data.reviewLog));
  app.appendChild(renderFindings(data.findings));
  const twoCol = el('div', { class: 'two-col section' });
  if (data.domainInterpretation) {
    const s = el('div', {}, el('h2', {}, 'Domain Interpretation'), el('div', { class: 'card' }, data.domainInterpretation));
    twoCol.appendChild(s);
  }
  if (data.futureDirections && data.futureDirections.length) {
    const card = el('div', { class: 'card' });
    const ul = el('ul', {});
    for (let i = 0; i < data.futureDirections.length; i++) ul.appendChild(el('li', {}, data.futureDirections[i]));
    card.appendChild(ul);
    twoCol.appendChild(el('div', {}, el('h2', {}, 'Future Directions'), card));
  }
  if (twoCol.children.length) app.appendChild(twoCol);
  app.appendChild(pageFooter());
}

/* ── Summary renderers ── */

function renderTimeline(iterations) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Iteration Timeline'));
  const timeline = el('div', { class: 'timeline' });
  timeline.appendChild(el('div', { class: 'timeline-track' }));
  const nodesRow = el('div', { class: 'timeline-nodes' });
  const details = [];
  for (let i = 0; i < iterations.length; i++) {
    const iter = iterations[i];
    const dotClass = 'tdot-' + (iter.status || iter.outcome || 'Partial');
    const node = el('div', { class: 'timeline-node' },
      el('div', { class: 'timeline-dot ' + dotClass }),
      el('div', { class: 'timeline-label' }, 'It. ' + iter.number),
      el('div', { class: 'timeline-sublabel' }, iter.outcome || iter.status || '')
    );
    const detail = el('div', { class: 'timeline-detail' });
    detail.appendChild(el('strong', {}, iter.title || ('Iteration ' + iter.number)));
    if (iter.goal) detail.appendChild(el('p', { style: 'margin-top:0.4rem;' }, 'Goal: ' + iter.goal));
    if (iter.pivotReason) {
      detail.appendChild(el('p', { style: 'margin-top:0.4rem;color:var(--fg-muted);font-size:0.8rem;' }, 'Pivot reason: ' + iter.pivotReason));
    }
    (function(d) {
      node.onclick = function() {
        const isOpen = d.classList.contains('open');
        for (let j = 0; j < details.length; j++) details[j].classList.remove('open');
        if (!isOpen) d.classList.add('open');
      };
    }(detail));
    nodesRow.appendChild(node);
    details.push(detail);
  }
  timeline.appendChild(nodesRow);
  for (let i = 0; i < details.length; i++) timeline.appendChild(details[i]);
  section.appendChild(timeline);
  return section;
}

function renderInsightGallery(insights) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Insights'));
  const grid = el('div', { class: 'insight-grid' });
  for (let i = 0; i < insights.length; i++) {
    const ins = insights[i];
    const card = el('div', { class: 'insight-card' + (ins.significance === 'high' ? ' high' : '') });
    const meta = el('div', { class: 'insight-meta' }, el('span', {}, 'Iteration ' + ins.iteration));
    if (ins.significance === 'high') meta.appendChild(el('span', { class: 'star' }, '★'));
    card.appendChild(meta);
    card.appendChild(el('h3', {}, ins.heading));
    if (ins.detail) card.appendChild(el('div', { class: 'insight-detail' }, ins.detail));
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

function renderDecisionLog(decisionLog) {
  const section = el('div', { class: 'section' });
  section.appendChild(el('h2', {}, 'Decision Log'));
  const card = el('div', { class: 'card' });
  for (let i = 0; i < decisionLog.length; i++) {
    const entry = decisionLog[i];
    const textEl = el('div', {},
      el('div', { class: 'decision-text' }, 'After Iteration ' + entry.afterIteration)
    );
    if (entry.reasoning) textEl.appendChild(el('div', { class: 'decision-reasoning' }, entry.reasoning));
    card.appendChild(el('div', { class: 'decision-item' },
      el('span', { class: 'decision-badge badge-' + entry.decision }, entry.decision),
      textEl
    ));
  }
  section.appendChild(card);
  return section;
}

function renderSummary(data) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const headerLeft = el('div', {});
  const topLine = el('div', { style: 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;' },
    el('h1', {}, data.meta.topic),
    statusBadge(data.meta.status)
  );
  headerLeft.appendChild(topLine);
  headerLeft.appendChild(el('div', { class: 'header-meta' },
    data.meta.domain + ' · ' + data.meta.iterations.length + ' iterations · ' +
    data.meta.dateRange.from + ' → ' + data.meta.dateRange.to
  ));
  if (data.meta.overallGoal) {
    headerLeft.appendChild(el('p', { style: 'margin-top:0.3rem;font-size:0.875rem;color:var(--fg-muted);' }, data.meta.overallGoal));
  }
  app.appendChild(el('div', { class: 'header' }, headerLeft, themeToggle()));
  if (data.conclusion) {
    app.appendChild(el('div', { class: 'section' },
      el('h2', {}, 'Conclusion'),
      el('div', { class: 'card', style: 'font-size:1rem;line-height:1.7;' }, data.conclusion)
    ));
  }
  app.appendChild(renderTimeline(data.iterations));
  if (data.insights && data.insights.length) app.appendChild(renderInsightGallery(data.insights));
  if (data.decisionLog && data.decisionLog.length) app.appendChild(renderDecisionLog(data.decisionLog));
  const twoCol = el('div', { class: 'two-col section' });
  if (data.lessonsLearned && data.lessonsLearned.length) {
    const card = el('div', { class: 'card' });
    const ul = el('ul', {});
    for (let i = 0; i < data.lessonsLearned.length; i++) ul.appendChild(el('li', {}, data.lessonsLearned[i]));
    card.appendChild(ul);
    twoCol.appendChild(el('div', {}, el('h2', {}, 'Lessons Learned'), card));
  }
  if (data.futureDirections && data.futureDirections.length) {
    const card = el('div', { class: 'card' });
    const ul = el('ul', {});
    for (let i = 0; i < data.futureDirections.length; i++) ul.appendChild(el('li', {}, data.futureDirections[i]));
    card.appendChild(ul);
    twoCol.appendChild(el('div', {}, el('h2', {}, 'Future Directions'), card));
  }
  if (twoCol.children.length) app.appendChild(twoCol);
  app.appendChild(pageFooter());
}

/* ── Entry point ── */
window.loadReportData = function() {
  var data = window.REPORT_DATA;
  if (!data) return;
  if (data.type === 'iteration') renderIteration(data);
  else if (data.type === 'summary') renderSummary(data);
  else document.getElementById('app').textContent = 'Unknown report type: ' + data.type;
};

if (window.REPORT_DATA) window.loadReportData();
</script>
</body>
</html>
```

**Step 2: Verify file exists and has reasonable content**

```bash
wc -l /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/report-template.html
```
Expected: 200+ lines

```bash
grep -c "renderIteration\|renderSummary\|renderTimeline\|renderHypothesisArc\|renderReviewLog\|renderInsightGallery\|renderDecisionLog" \
  /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/report-template.html
```
Expected: 7 (all render functions present)

```bash
grep "Louis de Klerk" /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/report-template.html
```
Expected: one match (footer attribution)

**Step 3: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/assets/report-template.html
git commit -m "feat(deep-inquiry): add self-contained HTML report template"
```

---

## Task 2: Create Test Fixtures

**Files:**
- Create: `plugins/deep-inquiry/assets/test-iteration.html`
- Create: `plugins/deep-inquiry/assets/test-summary.html`

These are standalone verification files — the template with sample data baked in. They confirm both report types render correctly and serve as living examples.

**Step 1: Create iteration test fixture**

Create `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-iteration.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Test: Iteration Report</title></head>
<body>
<script>
window.REPORT_DATA = {
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
      "text": "Auth slowness caused by N+1 DB queries in tax calculation",
      "tested": "Ran query profiler across 1000 checkout requests",
      "outcome": "Confirmed — 47% of all queries were redundant FK lookups",
      "status": "confirmed"
    },
    {
      "text": "Connection pool exhaustion is a secondary factor",
      "tested": "Monitored pool wait time under load",
      "outcome": "Refuted — pool wait time averaged 2ms, negligible",
      "status": "refuted"
    }
  ],
  "findings": [
    {
      "heading": "N+1 pattern confirmed in ORM layer",
      "detail": "Each checkout line item triggers a separate SELECT for its tax_rate relationship. 18 line items = 19 queries per request.",
      "evidence": "profiler output: avg 847ms in DB calls, 803ms attributable to tax_rate lookups"
    },
    {
      "heading": "Fix is straightforward",
      "detail": "Adding select_related('tax_rate') to the checkout queryset eliminates the N+1. Tested in staging: p99 drops from 3.1s to 0.4s.",
      "evidence": "staging benchmark: 1000 requests, p50 280ms, p99 390ms after fix"
    }
  ],
  "reviewLog": {
    "mode": "adversarial",
    "models": ["openai/gpt-5.2"],
    "tiers": {
      "critical": [
        { "issue": "Profiler not accounting for connection pool overhead in baseline", "action": "fixed", "detail": "Added pool timing to baseline measurement; results unchanged" }
      ],
      "methodological": [
        { "issue": "Sample size of 100 may not be representative of production distribution", "action": "addressed", "detail": "Increased to 1000 requests; results consistent within 3%" }
      ],
      "enhancement": [
        { "issue": "Could benchmark Redis cache as alternative to eager loading", "action": "documented", "detail": "Added to future directions" },
        { "issue": "Could profile across different line item counts (1, 5, 18, 50)", "action": "documented", "detail": "Good for confirming linear scaling assumption" }
      ],
      "style": []
    }
  },
  "domainInterpretation": "The N+1 pattern is a classic Django ORM pitfall when accessing related models in a loop. The tax_rate ForeignKey is loaded lazily by default, generating one query per access. This is expected ORM behaviour but becomes a bottleneck at scale.",
  "futureDirections": [
    "Implement select_related('tax_rate') in checkout queryset",
    "Add query count assertion to checkout tests to prevent regression",
    "Benchmark Redis cache layer as a complementary optimisation",
    "Profile across varying line item counts to confirm linear scaling"
  ]
};
</script>
<script src="report-template.html"></script>
</body>
</html>
```

Wait — the test fixture cannot `src` the template (it's not a JS file). Instead, use an iframe or duplicate the template script. The cleanest approach: copy just the `<script>` block from the template into the test fixture after the data. Since we want a single self-contained test file, inline the template body.

Simpler approach: make the test fixtures full standalone HTML files that duplicate the template. Instead, write a small node script that verifies the JSON data is valid:

**Revised Step 1: Create a test data JSON file instead**

Create `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-iteration.json`:

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
      "text": "Auth slowness caused by N+1 DB queries in tax calculation",
      "tested": "Ran query profiler across 1000 checkout requests",
      "outcome": "Confirmed — 47% of all queries were redundant FK lookups",
      "status": "confirmed"
    },
    {
      "text": "Connection pool exhaustion is a secondary factor",
      "tested": "Monitored pool wait time under load",
      "outcome": "Refuted — pool wait time averaged 2ms, negligible",
      "status": "refuted"
    }
  ],
  "findings": [
    {
      "heading": "N+1 pattern confirmed in ORM layer",
      "detail": "Each checkout line item triggers a separate SELECT for its tax_rate relationship.",
      "evidence": "profiler: avg 847ms DB calls, 803ms attributable to tax_rate lookups"
    }
  ],
  "reviewLog": {
    "mode": "adversarial",
    "models": ["openai/gpt-5.2"],
    "tiers": {
      "critical": [{ "issue": "Profiler not accounting for pool overhead", "action": "fixed", "detail": "Added pool timing; results unchanged" }],
      "methodological": [{ "issue": "Sample size of 100 may not be representative", "action": "addressed", "detail": "Increased to 1000; consistent within 3%" }],
      "enhancement": [{ "issue": "Could benchmark Redis cache as alternative", "action": "documented", "detail": "Added to future directions" }],
      "style": []
    }
  },
  "domainInterpretation": "The N+1 pattern is a classic Django ORM pitfall when accessing related models in a loop.",
  "futureDirections": ["Implement select_related('tax_rate')", "Add query count assertion to tests"]
}
```

Create `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-summary.json`:

```json
{
  "type": "summary",
  "meta": {
    "topic": "auth-performance",
    "domain": "Software",
    "overallGoal": "Find root cause of 3s checkout latency and validate fix",
    "status": "Complete",
    "dateRange": { "from": "2026-02-28", "to": "2026-03-02" }
  },
  "conclusion": "N+1 ORM queries confirmed as the root cause of 3s checkout latency. Adding select_related('tax_rate') reduces p99 from 3.1s to 0.4s. Fix is safe to deploy; regression test added.",
  "iterations": [
    {
      "number": 1,
      "title": "Flame graph profiling",
      "goal": "Identify slow code paths using py-spy flame graph",
      "outcome": "Partial",
      "pivotReason": "Flame graph showed DB time but couldn't isolate query-level patterns",
      "status": "Abandoned"
    },
    {
      "number": 2,
      "title": "Query-level profiling with django-debug-toolbar",
      "goal": "Count and identify individual DB queries per request",
      "outcome": "Success",
      "pivotReason": null,
      "status": "Done"
    }
  ],
  "insights": [
    {
      "iteration": 2,
      "heading": "47% of queries are redundant tax_rate lookups",
      "detail": "Each of 18 line items triggers a separate SELECT. Eliminating this reduces p99 by 87%.",
      "significance": "high"
    },
    {
      "iteration": 1,
      "heading": "Flame graphs are insufficient for ORM query diagnosis",
      "detail": "py-spy shows cumulative DB time but not individual query counts or sources.",
      "significance": "medium"
    }
  ],
  "decisionLog": [
    {
      "afterIteration": 1,
      "decision": "Pivot",
      "reasoning": "Flame graph confirmed DB is the bottleneck but couldn't pinpoint the query pattern. Needed query-level tooling."
    },
    {
      "afterIteration": 2,
      "decision": "Done",
      "reasoning": "Root cause identified, fix validated in staging, regression test written."
    }
  ],
  "lessonsLearned": [
    "Flame graphs are a poor tool for Django ORM query diagnosis; use django-debug-toolbar or silk",
    "Always add query count assertions after fixing N+1 bugs to prevent regression"
  ],
  "futureDirections": [
    "Monitor query count per request in production APM",
    "Benchmark Redis cache layer as complementary optimisation",
    "Audit other endpoints for similar N+1 patterns"
  ]
}
```

**Step 2: Validate JSON is parseable**

```bash
python3 -c "import json; json.load(open('/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-iteration.json')); print('iteration: OK')"
python3 -c "import json; json.load(open('/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-summary.json')); print('summary: OK')"
```
Expected: `iteration: OK` and `summary: OK`

**Step 3: Verify required schema fields are present**

```bash
python3 -c "
import json
d = json.load(open('/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-iteration.json'))
assert d['type'] == 'iteration'
assert 'meta' in d and 'hypotheses' in d and 'findings' in d and 'reviewLog' in d
assert all(k in d['reviewLog']['tiers'] for k in ['critical','methodological','enhancement','style'])
print('iteration schema: OK')
d = json.load(open('/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/assets/test-data-summary.json'))
assert d['type'] == 'summary'
assert 'iterations' in d and 'insights' in d and 'decisionLog' in d
print('summary schema: OK')
"
```
Expected: both lines print `OK`

**Step 4: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/assets/test-data-iteration.json plugins/deep-inquiry/assets/test-data-summary.json
git commit -m "feat(deep-inquiry): add report test fixtures"
```

---

## Task 3: Create `deep-inquiry-reporter` Agent

**Files:**
- Create: `plugins/deep-inquiry/agents/deep-inquiry-reporter.md`

**Step 1: Create the agent file**

Create `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/agents/deep-inquiry-reporter.md`:

````markdown
---
name: deep-inquiry-reporter
description: |
  Generates a rich multi-iteration summary report for a deep inquiry topic.

  Trigger this agent when you want a visual overview of a completed or in-progress
  inquiry series: how hypotheses evolved, what pivots were made, key insights across
  iterations, and overall conclusions.

  Reads all iteration READMEs under `inquiry/<topic>/`, constructs the summary JSON,
  and writes a self-contained `inquiry/<topic>/report.html` that opens immediately
  in the browser.

  <example>
  <input>Generate a summary report for the auth-performance inquiry.</input>
  <output>Reads all iteration READMEs, extracts hypotheses/findings/decisions, writes inquiry/auth-performance/report.html, opens it in the browser.</output>
  <commentary>The reporter reads finished markdown artifacts and synthesises them into a visual arc report — no re-running the investigation.</commentary>
  </example>
model: inherit
color: violet
tools:
  - Read
  - Write
  - Glob
  - Bash
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_evaluate
  - mcp__plugin_playwright_playwright__browser_close
---

# Deep Inquiry Reporter

You generate a visual summary report for a completed or in-progress inquiry topic.

## Workflow

### Step 1: Identify the topic

List available topics:
```bash
ls inquiry/
```

If the user has not specified a topic, ask them to pick from the list.

### Step 2: Read topic-level README

Read `inquiry/<topic>/readme.md` to get:
- Overall goal
- Status (Active / Complete / On Hold)
- List of iterations and their outcomes

### Step 3: Read all iteration READMEs

Use Glob to find all iteration READMEs:
```bash
# pattern: inquiry/<topic>/iteration_*/README.md
```

Read each one and extract:
- **Iteration number and title** (from `# Iteration N: Title` heading)
- **Date and status** (from frontmatter table)
- **Goal** (from Overview section)
- **Hypotheses** (from Investigation Design section) — text, how tested, outcome, status (confirmed/refuted/pivoted/inconclusive)
- **Key findings** (from Key Findings section) — heading, detail, evidence
- **Review log** (from LLM Review Process section) — mode, models, all tier items with actions
- **Domain interpretation** (from Domain Interpretation section)
- **Pivot reason** (from Decision Log or iteration README context — why did we move to next iteration?)
- **Lessons learned** (from Notes section)
- **Future directions** (from Notes section)

### Step 4: Construct summary JSON

Build the `type: "summary"` JSON object:

```json
{
  "type": "summary",
  "meta": {
    "topic": "<topic>",
    "domain": "<from first iteration>",
    "overallGoal": "<from topic readme>",
    "status": "<from topic readme>",
    "dateRange": {
      "from": "<date of iteration 1>",
      "to": "<date of last iteration>"
    }
  },
  "conclusion": "<synthesised 1-3 sentence conclusion from all findings>",
  "iterations": [
    {
      "number": 1,
      "title": "<title>",
      "goal": "<goal>",
      "outcome": "<Success|Partial|Failed>",
      "pivotReason": "<why moved to next iteration, or null if final>",
      "status": "<Done|Abandoned>"
    }
  ],
  "insights": [
    {
      "iteration": 1,
      "heading": "<key finding heading>",
      "detail": "<detail>",
      "significance": "high|medium"
    }
  ],
  "decisionLog": [
    {
      "afterIteration": 1,
      "decision": "Pivot|Done|Pause|Abandon",
      "reasoning": "<why>"
    }
  ],
  "lessonsLearned": ["<aggregated across all iterations>"],
  "futureDirections": ["<aggregated across all iterations>"]
}
```

**Significance heuristic:** Mark insights as `high` if they directly answer the overall goal or caused a major pivot. Mark as `medium` otherwise.

**Conclusion synthesis:** Write 1-3 sentences summarising what was found across all iterations. If the inquiry is still active, write what has been found so far.

### Step 5: Generate the report HTML

Read `${CLAUDE_PLUGIN_ROOT}/assets/report-template.html` as a string.

Write `inquiry/<topic>/report.html`:
- First line: `<script>window.REPORT_DATA = <JSON.stringify(summaryData, null, 2)>;</script>`
- Remaining lines: the full contents of `report-template.html`

### Step 6: Open in browser

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 -m http.server 18924 &
SERVER_PID=$!
```

Navigate to:
```
http://localhost:18924/../../inquiry/<topic>/report.html
```

Wait for user to acknowledge they have seen the report, then:
```bash
kill $SERVER_PID
```
Close the browser.

**If Playwright is unavailable:** Tell the user the report was written to `inquiry/<topic>/report.html` and they can open it directly in any browser.

### Step 7: Report back

Tell the user:
- Where the report was written (`inquiry/<topic>/report.html`)
- How many iterations were summarised
- The one-sentence conclusion from the report
````

**Step 2: Verify frontmatter**

```bash
head -12 /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/agents/deep-inquiry-reporter.md
```
Expected: `name: deep-inquiry-reporter`, `model: inherit`, `color: violet`, tools list present.

**Step 3: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/agents/deep-inquiry-reporter.md
git commit -m "feat(deep-inquiry): add deep-inquiry-reporter agent for on-demand summary reports"
```

---

## Task 4: Update `deep-inquiry` Agent — Phase 5 Report Step

**Files:**
- Modify: `plugins/deep-inquiry/agents/deep-inquiry.md`

The agent needs a new "Generate Iteration Report" section added after the File Structure Convention section.

**Step 1: Read the current agent file**

Read `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/agents/deep-inquiry.md` to find the exact text of the last section before the Investigation Mode Guidance table.

**Step 2: Add the Phase 5 report generation section**

Append the following section before the "## Investigation Mode Guidance" heading:

```markdown
---

## Phase 5: Generating the Iteration Report

At the end of Phase 5 (after finalising the iteration README), generate a self-contained
HTML report for this iteration.

### Step 1: Construct iteration JSON

Build the `type: "iteration"` JSON from this iteration's data:

```json
{
  "type": "iteration",
  "meta": {
    "topic": "<topic-slug>",
    "domain": "<domain from session variables>",
    "mode": "<Code|Reasoning|Evidence|Mixed>",
    "date": "<today YYYY-MM-DD>",
    "status": "<Done|Abandoned|InProgress>",
    "iterationNumber": <N>,
    "title": "<iteration title from README heading>"
  },
  "hypotheses": [
    {
      "text": "<hypothesis text>",
      "tested": "<how it was tested>",
      "outcome": "<what was found>",
      "status": "confirmed|refuted|pivoted|inconclusive"
    }
  ],
  "findings": [
    { "heading": "<heading>", "detail": "<detail>", "evidence": "<evidence reference or null>" }
  ],
  "reviewLog": {
    "mode": "adversarial|degraded",
    "models": ["<model IDs used>"],
    "tiers": {
      "critical":       [{ "issue": "<issue>", "action": "fixed|addressed|documented|ignored", "detail": "<what was done>" }],
      "methodological": [...],
      "enhancement":    [...],
      "style":          [...]
    }
  },
  "domainInterpretation": "<domain interpretation text>",
  "futureDirections": ["<future direction 1>", ...]
}
```

### Step 2: Write the report file

Read `${CLAUDE_PLUGIN_ROOT}/assets/report-template.html` as a string.

Write `inquiry/<topic>/iteration_<N>/report.html`:
- Prepend: `<script>window.REPORT_DATA = <JSON>;</script>\n`
- Append: full contents of `report-template.html`

### Step 3: Open in browser for immediate preview

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 -m http.server 18924 &
```

Navigate to `http://localhost:18924/../../inquiry/<topic>/iteration_<N>/report.html`.

Tell the user: *"Iteration report written to `inquiry/<topic>/iteration_<N>/report.html`. For a full multi-iteration summary, invoke `@deep-inquiry-reporter`."*

Close browser after user acknowledges.

**If Playwright is unavailable:** Skip opening; just tell the user the file path.
```

**Step 3: Verify the section was added**

```bash
grep -c "Phase 5: Generating" /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/agents/deep-inquiry.md
```
Expected: `1`

**Step 4: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/agents/deep-inquiry.md
git commit -m "feat(deep-inquiry): add Phase 5 report generation step to agent"
```

---

## Task 5: Update `deep-inquiry-methodology` Skill — Phase 5 Bullet

**Files:**
- Modify: `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md`

**Step 1: Read the skill file**

Read `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md` and find the Phase 5 section ("## Phase 5: Documentation & Results").

**Step 2: Add report generation bullet**

Find the line `### Iteration README Template` within Phase 5. Before it, add:

```markdown
### Generate Iteration Report

After finalising the iteration README, generate a self-contained HTML report:
- Construct the `type: "iteration"` JSON from this iteration's hypotheses, findings, review log, domain interpretation, and future directions
- Write `inquiry/<topic>/iteration_<N>/report.html` using the agent's report generation instructions
- This report is shareable — it has no external dependencies and opens in any browser

For a multi-iteration summary report spanning all iterations, invoke `@deep-inquiry-reporter`.

```

**Step 3: Verify the bullet was added**

```bash
grep -c "Generate Iteration Report" /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
```
Expected: `1`

**Step 4: Commit**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
git commit -m "feat(deep-inquiry): document report generation in methodology skill Phase 5"
```

---

## Task 6: Update README

**Files:**
- Modify: `plugins/deep-inquiry/README.md`

**Step 1: Read the README**

Read `/home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/README.md`.

**Step 2: Add a Reports section**

Find the `## Output Structure` section. After its closing content (before the next `##` heading), add:

```markdown
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
```

**Step 3: Verify**

```bash
grep -c "deep-inquiry-reporter" /home/louisdk/experiment/netsurit-innovate-plugins/plugins/deep-inquiry/README.md
```
Expected: at least `1`

**Step 4: Commit and push**

```bash
cd /home/louisdk/experiment/netsurit-innovate-plugins
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): document HTML reporting in README"
git push origin master
```
