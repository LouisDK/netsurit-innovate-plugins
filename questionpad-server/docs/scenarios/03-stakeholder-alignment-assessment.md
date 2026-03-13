# Scenario: Stakeholder Alignment Assessment

## Title

**Stakeholder Alignment Assessment** — Prove misalignment with data before it derails the project

## Description

Every consultant, project manager, and internal change leader has experienced this: the executive team says "we're aligned," the project kicks off, and three months later it's clear that the CEO meant "growth," the COO meant "efficiency," the CTO meant "technical debt reduction," and the VP of Sales meant "more features for the pipeline." The project is now pulled in four directions, over budget, and behind schedule.

The Stakeholder Alignment Assessment uses QuestionPad to **quantify alignment and misalignment** before any work begins. The core insight: **when you ask the same questions independently to people who think they agree, the differences become visible and undeniable.**

The workflow:

1. **A consultant or project lead** (Operator) defines the initiative and the key alignment questions.
2. **The AI agent creates identical sessions** for each stakeholder group — C-suite, VPs, managers, individual contributors — with the same core questions, plus role-specific deep-dives.
3. **Each stakeholder answers independently** — "What is the #1 goal of this initiative?" "What does success look like in 12 months?" "What would make you personally consider this a failure?"
4. **The agent compares answers across stakeholders** and produces an **Alignment Score** plus a detailed **Alignment Gap Report**: where they agree, where they disagree, and how severe the gaps are.
5. **The consultant presents the report** — not as opinion, but as data. "You said growth. You said efficiency. You said technical debt. Here's the proof. Let's resolve this before we spend $500k."

This is the consulting engagement's most valuable deliverable — often worth more than the entire project plan that follows it.

## Why This Adds Value

| Problem | Current State | With Alignment Assessment |
|---|---|---|
| **Hidden misalignment** | Everyone nods in meetings; real disagreements surface months later | Quantified alignment score from independent input |
| **Wasted project spend** | $500k initiative fails because stakeholders wanted different things | Alignment proven or conflicts resolved before money is spent |
| **Political ambiguity** | Nobody wants to be the one to say "I disagree with the CEO" | Anonymous input removes politics from the equation |
| **Consultant credibility** | Consultant recommends alignment workshop — executives say "we're fine" | Data proves they're not fine. The report is undeniable. |
| **Assessment time** | 8-12 stakeholder interviews × 1 hour each + synthesis = 2-3 weeks | Parallel async collection + AI synthesis = 2-3 days |

**Commercial impact for a consulting firm:**
- Discovery/alignment phase typically billed at $15k-$50k
- This approach delivers the same (better) output in 1/5 the time
- The consultant can either pass savings to client (competitive advantage) or maintain price with dramatically higher margin
- The alignment report becomes the "proof of need" that sells the rest of the engagement

**For internal project leads:**
- Skip the "alignment workshop" that nobody takes seriously
- Present the board/exec team with data: "Here's where we agree and where we don't"
- Get real alignment before committing budget and headcount

## Demo Setup — Step by Step

### Prerequisites

- QuestionPad server running
- MCP client
- For full demo: 4 browser tabs (CEO, COO, CTO, VP Sales)

### Step 1: Create the Assessment Sessions

The consultant defines the initiative and creates sessions. In production, a "Stakeholder Alignment" skill would generate the questions from context. For the demo:

```typescript
const result = await client.callTool({
  name: 'create_session',
  arguments: {
    title: 'Project Phoenix — Stakeholder Alignment Assessment',
    description: [
      '**Confidential Assessment**\n\n',
      'We are evaluating alignment across the leadership team for Project Phoenix ',
      '(the proposed digital transformation initiative). Your responses are collected ',
      'independently to ensure honest, uninfluenced input.\n\n',
      '_All opinion-based responses are anonymous. Factual responses are attributed._\n\n',
      '**Time required:** 10-15 minutes\n',
      '**Deadline:** March 15, 2026'
    ].join(''),
    participants: [
      {
        label: 'CEO',
        cards: [
          // === CORE ALIGNMENT QUESTIONS (identical across all roles) ===
          {
            id: 'info_core',
            type: 'info',
            title: 'Core Alignment Questions',
            body: '_These questions are asked identically to all stakeholders. Your answers will be compared to reveal alignment and gaps._'
          },
          {
            id: 'primary_goal',
            type: 'free-text',
            title: 'In one sentence: what is the #1 goal of Project Phoenix?',
            body: 'Don\'t hedge — pick the single most important objective.',
            placeholder: 'E.g., "Reduce customer churn by 40% through better digital experience"',
            required: true
          },
          {
            id: 'success_12mo',
            type: 'free-text',
            title: 'What does success look like in 12 months?',
            body: 'Be specific — measurable outcomes, not aspirations.',
            placeholder: 'E.g., "New platform live with 80% of customers migrated, NPS up 15 points"',
            required: true
          },
          {
            id: 'failure_definition',
            type: 'free-text',
            title: 'What would make you personally consider this project a failure?',
            body: 'What outcome would make you regret approving this initiative?',
            required: true
          },
          {
            id: 'priority_ranking',
            type: 'ranking',
            title: 'Rank these project dimensions by importance',
            items: [
              'Revenue growth / new revenue streams',
              'Cost reduction / operational efficiency',
              'Customer experience improvement',
              'Technical modernization / debt reduction',
              'Competitive positioning',
              'Employee productivity / satisfaction'
            ],
            required: true
          },
          {
            id: 'budget_comfort',
            type: 'slider',
            title: 'Comfortable investment level for this initiative',
            body: 'Slide to the maximum budget you\'d approve without hesitation.',
            min: 100000,
            max: 2000000,
            step: 50000,
            required: true
          },
          {
            id: 'timeline_expectation',
            type: 'multiple-choice',
            title: 'Expected timeline to see meaningful results?',
            options: [
              '3 months — quick wins or it\'s failing',
              '6 months — reasonable ramp with visible progress',
              '12 months — complex transformation needs time',
              '18+ months — this is a multi-year journey'
            ],
            required: true
          },
          {
            id: 'risk_tolerance',
            type: 'rating',
            title: 'Your risk tolerance for this initiative',
            body: '1 = conservative (proven approaches only), 5 = aggressive (willing to bet on innovation)',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'biggest_risk',
            type: 'free-text',
            title: 'What is the single biggest risk to this project\'s success?',
            required: true
          },
          {
            id: 'dealbreaker',
            type: 'free-text',
            title: 'Is there anything that would make you withdraw support for this project?',
            required: false
          },

          // === ROLE-SPECIFIC DEEP DIVE ===
          {
            id: 'info_role',
            type: 'info',
            title: 'CEO-Specific Questions',
            body: '_These questions are tailored to your role._'
          },
          {
            id: 'board_pressure',
            type: 'rating',
            title: 'How much board pressure is there for this initiative?',
            body: '1 = no pressure, 5 = the board is demanding it',
            min: 1,
            max: 5
          },
          {
            id: 'market_urgency',
            type: 'multiple-choice',
            title: 'How urgent is this competitively?',
            options: [
              'Critical — competitors are already ahead',
              'Important — we need to move within 6 months',
              'Strategic — important but not time-pressured',
              'Exploratory — still evaluating if this is the right move'
            ]
          },
          {
            id: 'executive_sponsor',
            type: 'multiple-choice',
            title: 'Who should be the day-to-day executive sponsor?',
            options: ['COO', 'CTO', 'VP Product', 'A new hire / dedicated program lead', 'I\'ll sponsor it personally']
          }
        ]
      },
      {
        label: 'COO',
        cards: [
          // === SAME CORE QUESTIONS (ids match for cross-comparison) ===
          {
            id: 'info_core',
            type: 'info',
            title: 'Core Alignment Questions',
            body: '_These questions are asked identically to all stakeholders. Your answers will be compared to reveal alignment and gaps._'
          },
          {
            id: 'primary_goal',
            type: 'free-text',
            title: 'In one sentence: what is the #1 goal of Project Phoenix?',
            body: 'Don\'t hedge — pick the single most important objective.',
            required: true
          },
          {
            id: 'success_12mo',
            type: 'free-text',
            title: 'What does success look like in 12 months?',
            required: true
          },
          {
            id: 'failure_definition',
            type: 'free-text',
            title: 'What would make you personally consider this project a failure?',
            required: true
          },
          {
            id: 'priority_ranking',
            type: 'ranking',
            title: 'Rank these project dimensions by importance',
            items: [
              'Revenue growth / new revenue streams',
              'Cost reduction / operational efficiency',
              'Customer experience improvement',
              'Technical modernization / debt reduction',
              'Competitive positioning',
              'Employee productivity / satisfaction'
            ],
            required: true
          },
          {
            id: 'budget_comfort',
            type: 'slider',
            title: 'Comfortable investment level for this initiative',
            min: 100000,
            max: 2000000,
            step: 50000,
            required: true
          },
          {
            id: 'timeline_expectation',
            type: 'multiple-choice',
            title: 'Expected timeline to see meaningful results?',
            options: [
              '3 months — quick wins or it\'s failing',
              '6 months — reasonable ramp with visible progress',
              '12 months — complex transformation needs time',
              '18+ months — this is a multi-year journey'
            ],
            required: true
          },
          {
            id: 'risk_tolerance',
            type: 'rating',
            title: 'Your risk tolerance for this initiative',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'biggest_risk',
            type: 'free-text',
            title: 'What is the single biggest risk to this project\'s success?',
            required: true
          },
          {
            id: 'dealbreaker',
            type: 'free-text',
            title: 'Is there anything that would make you withdraw support for this project?',
            required: false
          },

          // === COO-SPECIFIC ===
          {
            id: 'info_role',
            type: 'info',
            title: 'COO-Specific Questions',
            body: '_These questions are tailored to your role._'
          },
          {
            id: 'operational_impact',
            type: 'rating',
            title: 'Expected disruption to current operations during implementation?',
            body: '1 = minimal disruption, 5 = major operational risk',
            min: 1,
            max: 5
          },
          {
            id: 'team_capacity',
            type: 'multiple-choice',
            title: 'Does the current team have capacity to support this?',
            options: [
              'Yes — we can absorb this',
              'Partially — need 1-2 additional hires',
              'No — significant hiring or reallocation needed',
              'Unknown — need to assess'
            ]
          },
          {
            id: 'process_changes',
            type: 'free-text',
            title: 'What operational processes will need to change?',
            placeholder: 'List the processes most impacted by this initiative.'
          }
        ]
      },
      {
        label: 'CTO',
        cards: [
          // === SAME CORE QUESTIONS ===
          {
            id: 'info_core',
            type: 'info',
            title: 'Core Alignment Questions',
            body: '_These questions are asked identically to all stakeholders. Your answers will be compared to reveal alignment and gaps._'
          },
          {
            id: 'primary_goal',
            type: 'free-text',
            title: 'In one sentence: what is the #1 goal of Project Phoenix?',
            body: 'Don\'t hedge — pick the single most important objective.',
            required: true
          },
          {
            id: 'success_12mo',
            type: 'free-text',
            title: 'What does success look like in 12 months?',
            required: true
          },
          {
            id: 'failure_definition',
            type: 'free-text',
            title: 'What would make you personally consider this project a failure?',
            required: true
          },
          {
            id: 'priority_ranking',
            type: 'ranking',
            title: 'Rank these project dimensions by importance',
            items: [
              'Revenue growth / new revenue streams',
              'Cost reduction / operational efficiency',
              'Customer experience improvement',
              'Technical modernization / debt reduction',
              'Competitive positioning',
              'Employee productivity / satisfaction'
            ],
            required: true
          },
          {
            id: 'budget_comfort',
            type: 'slider',
            title: 'Comfortable investment level for this initiative',
            min: 100000,
            max: 2000000,
            step: 50000,
            required: true
          },
          {
            id: 'timeline_expectation',
            type: 'multiple-choice',
            title: 'Expected timeline to see meaningful results?',
            options: [
              '3 months — quick wins or it\'s failing',
              '6 months — reasonable ramp with visible progress',
              '12 months — complex transformation needs time',
              '18+ months — this is a multi-year journey'
            ],
            required: true
          },
          {
            id: 'risk_tolerance',
            type: 'rating',
            title: 'Your risk tolerance for this initiative',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'biggest_risk',
            type: 'free-text',
            title: 'What is the single biggest risk to this project\'s success?',
            required: true
          },
          {
            id: 'dealbreaker',
            type: 'free-text',
            title: 'Is there anything that would make you withdraw support for this project?',
            required: false
          },

          // === CTO-SPECIFIC ===
          {
            id: 'info_role',
            type: 'info',
            title: 'CTO-Specific Questions',
            body: '_These questions are tailored to your role._'
          },
          {
            id: 'tech_debt_severity',
            type: 'rating',
            title: 'How much does current tech debt threaten this initiative?',
            body: '1 = clean foundation, 5 = debt will actively sabotage the project',
            min: 1,
            max: 5
          },
          {
            id: 'build_vs_buy',
            type: 'multiple-choice',
            title: 'Build vs. buy preference for this initiative?',
            options: [
              'Build custom — our requirements are unique',
              'Buy / SaaS — faster time to value',
              'Hybrid — buy the platform, build the differentiators',
              'Too early to decide'
            ]
          },
          {
            id: 'tech_team_readiness',
            type: 'rating',
            title: 'Rate the engineering team\'s readiness for this initiative',
            body: '1 = significant skill gaps, 5 = fully capable',
            min: 1,
            max: 5
          }
        ]
      },
      {
        label: 'VP Sales',
        cards: [
          // === SAME CORE QUESTIONS ===
          {
            id: 'info_core',
            type: 'info',
            title: 'Core Alignment Questions',
            body: '_These questions are asked identically to all stakeholders. Your answers will be compared to reveal alignment and gaps._'
          },
          {
            id: 'primary_goal',
            type: 'free-text',
            title: 'In one sentence: what is the #1 goal of Project Phoenix?',
            body: 'Don\'t hedge — pick the single most important objective.',
            required: true
          },
          {
            id: 'success_12mo',
            type: 'free-text',
            title: 'What does success look like in 12 months?',
            required: true
          },
          {
            id: 'failure_definition',
            type: 'free-text',
            title: 'What would make you personally consider this project a failure?',
            required: true
          },
          {
            id: 'priority_ranking',
            type: 'ranking',
            title: 'Rank these project dimensions by importance',
            items: [
              'Revenue growth / new revenue streams',
              'Cost reduction / operational efficiency',
              'Customer experience improvement',
              'Technical modernization / debt reduction',
              'Competitive positioning',
              'Employee productivity / satisfaction'
            ],
            required: true
          },
          {
            id: 'budget_comfort',
            type: 'slider',
            title: 'Comfortable investment level for this initiative',
            min: 100000,
            max: 2000000,
            step: 50000,
            required: true
          },
          {
            id: 'timeline_expectation',
            type: 'multiple-choice',
            title: 'Expected timeline to see meaningful results?',
            options: [
              '3 months — quick wins or it\'s failing',
              '6 months — reasonable ramp with visible progress',
              '12 months — complex transformation needs time',
              '18+ months — this is a multi-year journey'
            ],
            required: true
          },
          {
            id: 'risk_tolerance',
            type: 'rating',
            title: 'Your risk tolerance for this initiative',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'biggest_risk',
            type: 'free-text',
            title: 'What is the single biggest risk to this project\'s success?',
            required: true
          },
          {
            id: 'dealbreaker',
            type: 'free-text',
            title: 'Is there anything that would make you withdraw support for this project?',
            required: false
          },

          // === VP SALES-SPECIFIC ===
          {
            id: 'info_role',
            type: 'info',
            title: 'VP Sales-Specific Questions',
            body: '_These questions are tailored to your role._'
          },
          {
            id: 'pipeline_impact',
            type: 'multiple-choice',
            title: 'How will this initiative affect the sales pipeline?',
            options: [
              'Directly enables new revenue — I can sell this',
              'Indirectly helps — better retention reduces churn drag',
              'Neutral — doesn\'t affect pipeline either way',
              'Short-term negative — disruption during rollout'
            ]
          },
          {
            id: 'customer_requests',
            type: 'rating',
            title: 'How often do customers / prospects ask for what this initiative delivers?',
            body: '1 = never comes up, 5 = losing deals over it',
            min: 1,
            max: 5
          },
          {
            id: 'competitive_gap',
            type: 'free-text',
            title: 'Which specific competitors are ahead of us in this area?',
            placeholder: 'Name competitors and what they offer that we don\'t.'
          }
        ]
      }
    ]
  }
});
```

**Demo action:** Open each URL in a separate tab. Answer with deliberate misalignment:
- **CEO:** Goal = "become the market leader in digital customer experience." Budget = $1.5M. Timeline = 12 months. Priority #1 = Revenue growth. Risk tolerance = 4/5.
- **COO:** Goal = "streamline operations to reduce cost per transaction by 30%." Budget = $600k. Timeline = 6 months. Priority #1 = Cost reduction. Risk tolerance = 2/5.
- **CTO:** Goal = "replace the legacy monolith so we can ship features 10x faster." Budget = $1.2M. Timeline = 18+ months. Priority #1 = Technical modernization. Risk tolerance = 3/5.
- **VP Sales:** Goal = "give me 3 features to close the deals stuck in pipeline." Budget = $400k. Timeline = 3 months. Priority #1 = Competitive positioning. Risk tolerance = 5/5.

### Step 2: Agent Produces the Alignment Report

The agent collects all responses and produces a structured analysis. This is the money shot of the demo:

```
══════════════════════════════════════════════════════════════
  STAKEHOLDER ALIGNMENT REPORT — Project Phoenix
  Assessment Date: 2026-03-12 | Confidential
══════════════════════════════════════════════════════════════

  OVERALL ALIGNMENT SCORE: 31 / 100 ■■■□□□□□□□ CRITICAL

══════════════════════════════════════════════════════════════

SECTION 1: PRIMARY GOAL — SEVERE MISALIGNMENT ⛔

  CEO:      "Become the market leader in digital customer experience"
  COO:      "Streamline operations to reduce cost per transaction by 30%"
  CTO:      "Replace the legacy monolith to ship features 10x faster"
  VP Sales: "Give me 3 features to close pipeline deals"

  ANALYSIS: Four stakeholders, four fundamentally different goals.
  The CEO is thinking market position. The COO is thinking cost.
  The CTO is thinking platform. Sales is thinking features.
  These are not compatible priorities under a single initiative
  at any budget level.

──────────────────────────────────────────────────────────────

SECTION 2: BUDGET EXPECTATIONS — WIDE VARIANCE ⚠️

  CEO:      $1,500,000   ████████████████████
  CTO:      $1,200,000   ████████████████
  COO:        $600,000   ████████
  VP Sales:   $400,000   █████

  Range:    $1,100,000 (3.75x between lowest and highest)
  Mean:     $925,000
  Median:   $900,000

  ANALYSIS: VP Sales expects this to be a small, fast feature
  project. CEO expects a transformational investment. These
  cannot both be right.

──────────────────────────────────────────────────────────────

SECTION 3: TIMELINE — NO CONSENSUS ⚠️

  VP Sales: 3 months  ("quick wins or it's failing")
  COO:      6 months  ("reasonable ramp with visible progress")
  CEO:      12 months ("complex transformation needs time")
  CTO:      18+ months ("this is a multi-year journey")

  ANALYSIS: The full range of options selected. VP Sales will
  declare failure before the CTO expects to see first results.
  Without timeline alignment, every progress review will be
  contentious.

──────────────────────────────────────────────────────────────

SECTION 4: PRIORITY RANKING — DIVERGENT ⛔

  Dimension                        CEO  COO  CTO  Sales  StdDev
  ─────────────────────────────────────────────────────────────
  Revenue growth                    1    5    4    2      1.83
  Cost reduction                    5    1    5    6      2.22
  Customer experience               2    3    3    4      0.82 ✓
  Technical modernization           4    6    1    5      2.16
  Competitive positioning           3    4    6    1      2.06
  Employee productivity             6    2    2    3      1.71

  MOST ALIGNED: Customer experience (StdDev 0.82)
               — Everyone ranks it 2nd-4th. Potential common ground.

  MOST DIVERGENT: Cost reduction (StdDev 2.22)
               — COO ranks it #1, CEO and CTO rank it last.

──────────────────────────────────────────────────────────────

SECTION 5: RISK TOLERANCE — MISMATCHED

  VP Sales: 5/5 (aggressive)    ■■■■■
  CEO:      4/5                 ■■■■
  CTO:      3/5                 ■■■
  COO:      2/5 (conservative)  ■■

  ANALYSIS: The COO will resist approaches that Sales and CEO
  consider standard practice. Expect friction on vendor selection,
  architecture decisions, and go-to-market timing.

──────────────────────────────────────────────────────────────

SECTION 6: BIGGEST RISKS IDENTIFIED

  CEO:      "We move too slowly and competitors pull further ahead"
  COO:      "We disrupt operations trying to change too much at once"
  CTO:      "We build on the current broken foundation and it collapses"
  VP Sales: "We spend 12 months building something nobody asked for"

  ANALYSIS: Each stakeholder's biggest fear is the other
  stakeholders' preferred approach. This is a textbook case
  of competing mental models.

══════════════════════════════════════════════════════════════

RECOMMENDATIONS

  1. DO NOT proceed with Project Phoenix as a single initiative.
     The stakeholders are funding, scheduling, and measuring
     four different projects under one name.

  2. CONVENE an alignment session (2-3 hours) with this report
     as the starting artifact. Resolve: Is this a revenue play,
     a cost play, a platform play, or a feature play?

  3. CONSIDER splitting into phased workstreams:
     - Phase 1 (3 mo): Quick-win features for Sales pipeline
       (addresses VP Sales urgency, low budget, immediate ROI)
     - Phase 2 (6 mo): Customer experience improvements
       (the one area of alignment across all stakeholders)
     - Phase 3 (12+ mo): Platform modernization
       (CTO's requirement, enabled by Phase 1-2 buy-in)

  4. ESTABLISH shared success metrics BEFORE budgeting.
     Currently, each stakeholder would measure success differently.

══════════════════════════════════════════════════════════════
```

## Demo Script (5-Minute Live Demo)

1. **[0:00]** "Your company is about to spend $1M on Project Phoenix. The exec team says they're aligned. Are they? Let's find out."
2. **[0:30]** Show the 4 session URLs. "Same core questions to every stakeholder. Independent. Anonymous on opinions."
3. **[1:00]** Quick-fill two tabs with contrasting answers. "The CEO wants market leadership. The COO wants cost reduction. They think they agree."
4. **[2:00]** Show the alignment report. Pause on the Alignment Score: **31/100 — CRITICAL.** "Thirty-one percent aligned. And they were about to approve the budget."
5. **[2:30]** Show the priority ranking table. "Customer experience is the one area of agreement. That's your starting point."
6. **[3:00]** Show the budget and timeline divergence. "The VP of Sales thinks this is a $400k, 3-month project. The CTO thinks it's $1.2M over 18 months. They cannot both be right."
7. **[3:30]** Show Section 6 — biggest risks. "Each person's biggest fear is the other person's preferred approach. That's why alignment fails: they're solving different problems."
8. **[4:00]** Show the recommendations. "The AI doesn't just report the gap — it recommends a path forward. Split into phases, start with the one thing everyone agrees on, build credibility, then tackle the hard stuff."
9. **[4:30]** "Total time to produce this: 15 minutes per stakeholder, zero meetings. The report that used to take a $50k consulting engagement to produce."

## v2 Features Required

| Feature | Priority | Why |
|---|---|---|
| `ranking` card type | P2 | Priority comparison across stakeholders is the most powerful visual |
| `info` card type | P1 | Section headers, context blocks |
| `currency` card type | P1 | Budget expectations in precise amounts |
| Anonymous mode | P1 | Honest opinions on risk, priorities |
| Save & resume | P0 | Executives won't finish in one sitting |
| Scoring engine | P2 | Auto-calculate alignment score from cross-stakeholder comparison |
| Document generation | P2 | Auto-produce the alignment report PDF |
| Campaigns | P2 | Run alignment assessments across multiple initiatives |
| `signature` card type | P2 | "I confirm these are my honest priorities" — adds weight |

## Variations

### Internal Project Kick-Off
Same framework, run by a project manager instead of a consultant. The "client" is your own exec team.

### Post-Mortem Alignment Check
Run the same assessment 6 months into the project: "Has our alignment changed? Are we still solving the same problem?" Compare pre/post scores.

### Board-Management Alignment
Board members as one group, management team as another. Same questions. "Does the board want what management is building?"

### Customer-Company Alignment
Customers as contributors, product team as a separate group. "What customers want" vs "what we're building." The gap report drives roadmap prioritization.
