# Scenario: Negotiation Position Alignment

## Title

**Negotiation Position Alignment** — Unify your team's position before entering the room, with receipts

## Description

Before any significant negotiation — M&A deal, vendor contract, partnership agreement, lease renewal — the lead negotiator needs to understand what each internal stakeholder cares about, what they'll trade, and where their red lines are. Today, this happens through a chaotic series of meetings, emails, and hallway conversations. The lead negotiator walks into the room with an incomplete, assumption-laden picture of their own team's position.

The Negotiation Position Alignment scenario uses the **Facilitator/Contributor pattern** to solve this:

1. **The Operator** (e.g., a legal ops coordinator or executive assistant) starts a conversation with the AI agent and describes the upcoming negotiation.
2. **The AI agent creates a Facilitator session** for the lead negotiator (or negotiation committee) with questions about strategy, priorities, and acceptable outcomes.
3. **The Facilitator answers** — defining the negotiation scope, key terms, and what they want to learn from the team.
4. **The agent interprets Facilitator answers as instructions** and generates tailored Contributor sessions for each internal stakeholder — CFO gets financial cards, CTO gets technical cards, Legal gets risk cards, Operations gets implementation cards.
5. **Stakeholders answer independently** — no groupthink, no HIPPO effect, no "I'll say what the CEO wants to hear."
6. **The agent synthesizes** all positions into a unified briefing: areas of alignment, areas of conflict, suggested negotiation strategy, and red-line boundaries with attribution.
7. **The Facilitator reviews** the synthesis via a new session round: "CFO and CTO disagree on timeline. How do you want to resolve this?" (multiple-choice).
8. **The agent produces the final position document** — a structured negotiation brief with every position attributed, every trade-off explicit, every red line documented.

## Why This Adds Value

| Problem | Current State | With Position Alignment |
|---|---|---|
| **Incomplete picture** | Lead negotiator assumes they know the team's position | Every stakeholder's input is captured structured and complete |
| **Groupthink** | In meetings, people defer to the most senior voice | Independent, private input — can't see each other's answers |
| **No receipts** | "I thought we agreed on X" / "I never said that" | Every answer timestamped, attributed, on the record |
| **Hidden conflicts** | CFO and CTO have incompatible requirements — nobody realizes until the deal is at risk | Agent detects conflicts and surfaces them before the negotiation |
| **Preparation time** | 3-5 meetings × 4-6 people × 1 hour = 12-30 hours of senior time | 30 min per stakeholder (async) + 1 synthesis meeting |
| **Negotiation outcome** | Walking in with assumptions leads to concessions you didn't need to make | Walking in with a unified, data-backed position |

**Dollar impact example:** A commercial lease renewal for a 50-person company. CFO cares about total cost, COO cares about expansion flexibility, HR cares about commute times, CTO cares about network infrastructure. Without alignment, the CEO negotiates on rent alone and agrees to a 5-year lock-in — missing that the COO needed a 3-year break clause for planned growth. That misalignment could cost $200k+ in penalties or lost flexibility.

## Demo Setup — Step by Step

### Prerequisites

- QuestionPad server running
- MCP client (Claude Code or equivalent)
- For full demo: 3 devices/browsers (Facilitator, CFO contributor, CTO contributor)

### Step 1: Operator Initiates — Agent Creates Facilitator Session

The operator tells the agent: "We have a vendor contract negotiation coming up with Acme Corp for our cloud infrastructure. Create a negotiation alignment session."

The agent creates the **Facilitator session**:

```typescript
const facilitatorResult = await client.callTool({
  name: 'create_session',
  arguments: {
    title: 'Negotiation Strategy — Acme Corp Cloud Contract',
    description: [
      '**Negotiation Alignment — Facilitator Briefing**\n\n',
      'As the lead negotiator, please define the scope and priorities ',
      'for this negotiation. Your answers will guide the questions we ask ',
      'each stakeholder.\n\n',
      '_Your responses are confidential to the AI facilitator._'
    ].join(''),
    participants: [
      {
        label: 'Lead Negotiator',
        cards: [
          {
            id: 'context',
            type: 'free-text',
            title: 'Describe the negotiation context',
            body: 'What are we negotiating? What is the current state of the relationship? Any history we should know?',
            placeholder: 'E.g., "Renewing our 3-year cloud infrastructure contract with Acme Corp. Current spend is $240k/year. Contract expires in 90 days. We have alternative proposals from two competitors."',
            required: true
          },
          {
            id: 'ideal_outcome',
            type: 'free-text',
            title: 'What is your ideal outcome?',
            placeholder: 'Best-case scenario if everything goes perfectly.',
            required: true
          },
          {
            id: 'walkaway',
            type: 'free-text',
            title: 'What is your walk-away point?',
            body: 'At what point do we abandon this deal and pursue alternatives?',
            required: true
          },
          {
            id: 'key_terms',
            type: 'multi-select',
            title: 'Which terms are on the table? (Select all that apply)',
            options: [
              'Price / annual spend',
              'Contract duration',
              'Service level agreements (SLAs)',
              'Termination / exit clauses',
              'Scope of services',
              'Data ownership / portability',
              'Liability / indemnification',
              'Payment terms',
              'Auto-renewal terms',
              'Support / escalation levels'
            ],
            required: true
          },
          {
            id: 'stakeholders',
            type: 'multi-select',
            title: 'Whose input do we need?',
            body: 'Select the internal stakeholders who should provide their position on this deal.',
            options: [
              'CFO / Finance',
              'CTO / Engineering',
              'Legal / Compliance',
              'Operations / IT',
              'CEO / Executive sponsor',
              'Procurement'
            ],
            required: true
          },
          {
            id: 'deadline',
            type: 'date-picker',
            title: 'When is the negotiation meeting?',
            body: 'We need all stakeholder input before this date.',
            required: true
          },
          {
            id: 'sensitivity',
            type: 'multiple-choice',
            title: 'Should stakeholder responses be anonymous?',
            body: 'Anonymous responses may encourage more honest input, especially on sensitive topics like budget limits.',
            options: ['Named — attribute all responses', 'Anonymous — aggregate only', 'Mixed — names on factual, anonymous on opinions'],
            required: true
          }
        ]
      }
    ]
  }
});

// Agent sends the Facilitator URL to the lead negotiator
// Facilitator answers: key terms = Price, Duration, SLAs, Exit clauses, Data portability
//                      stakeholders = CFO, CTO, Legal
//                      sensitivity = Mixed
```

### Step 2: Agent Reads Facilitator Answers and Generates Contributor Sessions

The agent polls, reads the Facilitator's answers, and interprets them as instructions. Based on "key terms = Price, Duration, SLAs, Exit clauses, Data portability" and "stakeholders = CFO, CTO, Legal", it creates tailored sessions:

```typescript
// Agent processes facilitator answers and creates contributor sessions
const contributorResult = await client.callTool({
  name: 'create_session',
  arguments: {
    agentId: facilitatorResult.agentId,
    title: 'Acme Corp Cloud Contract — Your Input Needed',
    description: [
      '**Confidential Stakeholder Input**\n\n',
      'We are preparing for the Acme Corp cloud contract negotiation. ',
      'Your honest input will help the negotiation team represent your ',
      'interests effectively.\n\n',
      '**Deadline:** March 20, 2026\n',
      '_Your responses on opinion questions are anonymous._'
    ].join(''),
    participants: [
      {
        label: 'CFO / Finance',
        cards: [
          {
            id: 'info_finance',
            type: 'info',
            title: 'Financial Position',
            body: '_Current contract: $240,000/year with Acme Corp. Two competitor quotes received._'
          },
          {
            id: 'max_annual_spend',
            type: 'currency',
            title: 'What is the maximum acceptable annual spend?',
            body: 'Consider budget constraints, ROI requirements, and alternative costs.',
            currency: 'USD',
            min: 0,
            max: 1000000,
            required: true
          },
          {
            id: 'target_annual_spend',
            type: 'currency',
            title: 'What annual spend should we target in negotiation?',
            body: 'Our opening position — what we ask for.',
            currency: 'USD',
            min: 0,
            max: 1000000,
            required: true
          },
          {
            id: 'contract_duration_pref',
            type: 'multiple-choice',
            title: 'Preferred contract duration?',
            options: ['1 year (maximum flexibility)', '2 years (balanced)', '3 years (deeper discount)', '5 years (best pricing, highest lock-in)'],
            required: true
          },
          {
            id: 'payment_terms',
            type: 'multiple-choice',
            title: 'Preferred payment terms?',
            options: ['Monthly', 'Quarterly', 'Annual upfront (if discount offered)', 'Flexible — use as leverage'],
            required: true
          },
          {
            id: 'switching_cost',
            type: 'currency',
            title: 'Estimated cost to switch to an alternative vendor',
            body: 'Include migration, downtime, retraining, integration work.',
            currency: 'USD',
            min: 0,
            max: 5000000,
            required: true
          },
          {
            id: 'finance_redlines',
            type: 'free-text',
            title: 'What are your absolute red lines?',
            body: 'Terms or conditions that would make this deal unacceptable from a financial perspective.',
            required: true
          }
        ]
      },
      {
        label: 'CTO / Engineering',
        cards: [
          {
            id: 'info_tech',
            type: 'info',
            title: 'Technical Assessment',
            body: '_Please assess Acme Corp\'s technical offering against our needs._'
          },
          {
            id: 'sla_uptime_min',
            type: 'multiple-choice',
            title: 'Minimum acceptable uptime SLA?',
            options: ['99.5% (43.8 hrs downtime/year)', '99.9% (8.76 hrs/year)', '99.95% (4.38 hrs/year)', '99.99% (52.6 min/year)'],
            required: true
          },
          {
            id: 'sla_response_time',
            type: 'multiple-choice',
            title: 'Required severity-1 incident response time?',
            options: ['15 minutes', '30 minutes', '1 hour', '4 hours'],
            required: true
          },
          {
            id: 'data_portability',
            type: 'rating',
            title: 'How critical is data portability / export capability?',
            body: '1 = nice to have, 5 = absolute deal-breaker',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'vendor_lock_in_concern',
            type: 'rating',
            title: 'How concerned are you about vendor lock-in?',
            body: '1 = not concerned, 5 = very concerned',
            min: 1,
            max: 5,
            required: true
          },
          {
            id: 'tech_must_haves',
            type: 'multi-select',
            title: 'Technical must-haves in the contract (select all)',
            options: [
              'Data export in standard formats',
              'API access for all our data',
              'SOC 2 Type II certification',
              'GDPR compliance',
              'Custom SLA for critical workloads',
              'Dedicated support engineer',
              'Staging / sandbox environment included'
            ],
            required: true
          },
          {
            id: 'migration_timeline',
            type: 'multiple-choice',
            title: 'If we switched vendors, how long would migration take?',
            options: ['1-2 months', '3-6 months', '6-12 months', '12+ months — effectively impossible'],
            required: true
          },
          {
            id: 'tech_redlines',
            type: 'free-text',
            title: 'What are your absolute red lines?',
            body: 'Technical requirements that are non-negotiable.',
            required: true
          }
        ]
      },
      {
        label: 'Legal / Compliance',
        cards: [
          {
            id: 'info_legal',
            type: 'info',
            title: 'Legal & Compliance Assessment',
            body: '_Please assess the contractual and compliance dimensions of this deal._'
          },
          {
            id: 'exit_clause',
            type: 'multiple-choice',
            title: 'What termination clause do we need?',
            options: [
              'Termination for convenience with 30-day notice',
              'Termination for convenience with 90-day notice',
              'Termination for cause only',
              'Mutual termination with 60-day notice + early termination fee'
            ],
            required: true
          },
          {
            id: 'liability_cap',
            type: 'multiple-choice',
            title: 'Acceptable liability cap for the vendor?',
            options: [
              'Unlimited liability',
              'Cap at 12 months of fees',
              'Cap at 24 months of fees',
              'Negotiate based on risk category'
            ],
            required: true
          },
          {
            id: 'data_provisions',
            type: 'multi-select',
            title: 'Required data protection provisions (select all)',
            options: [
              'Data processing agreement (DPA)',
              'Data residency requirements (US only)',
              'Breach notification within 24 hours',
              'Right to audit',
              'Data deletion on termination',
              'Encryption at rest and in transit'
            ],
            required: true
          },
          {
            id: 'auto_renewal',
            type: 'multiple-choice',
            title: 'Position on auto-renewal clauses?',
            options: [
              'Reject — manual renewal only',
              'Accept with 90+ day opt-out window',
              'Accept with 60-day opt-out window',
              'No strong preference'
            ],
            required: true
          },
          {
            id: 'legal_redlines',
            type: 'free-text',
            title: 'What are your absolute red lines?',
            body: 'Legal or compliance terms that would make this deal unacceptable.',
            required: true
          }
        ]
      }
    ]
  }
});

// Agent distributes URLs:
// - CFO gets the "CFO / Finance" URL
// - CTO gets the "CTO / Engineering" URL
// - Legal counsel gets the "Legal / Compliance" URL
// Each answers independently on their own time
```

**Demo action:** Open each URL in a different browser/device. Answer as each stakeholder with deliberately interesting conflicts:
- **CFO:** Target $200k, max $260k, prefers 3-year for discount, red line: no annual increases >5%
- **CTO:** Wants 99.95% SLA, data portability is 5/5, lock-in concern 4/5, migration would take 6-12 months, red line: must have data export and API access
- **Legal:** Wants termination for convenience with 90 days, rejects auto-renewal, requires all data provisions

### Step 3: Agent Synthesizes Positions and Reports to Facilitator

The agent collects all answers and produces a synthesis, then sends it to the Facilitator for review:

```typescript
// Agent creates a synthesis review session for the Facilitator
await client.callTool({
  name: 'create_session',
  arguments: {
    agentId: facilitatorResult.agentId,
    title: 'Negotiation Synthesis — Acme Corp (Review Required)',
    description: [
      '## Position Synthesis\n\n',
      '### Areas of Alignment\n',
      '- **Exit clauses:** All parties want strong termination rights\n',
      '- **Data protection:** Universal agreement on DPA, encryption, and breach notification\n',
      '- **Data portability:** CTO rates 5/5 critical; Legal requires deletion on termination\n\n',
      '### Areas of Conflict\n',
      '- **Duration vs. Flexibility:** CFO wants 3-year lock-in for discount ($48k savings). ',
      'CTO says migration takes 6-12 months (de facto lock-in anyway). ',
      'BUT Legal wants termination for convenience — which conflicts with a discount-for-commitment deal.\n',
      '- **SLA Cost:** CTO wants 99.95% uptime. This tier typically costs 15-20% more. ',
      'CFO\'s target spend ($200k) may not accommodate this.\n\n',
      '### Negotiation Leverage\n',
      '- CFO estimates switching cost at $180k — Acme likely knows this\n',
      '- CTO says migration is 6-12 months — we have limited credible alternatives\n',
      '- Two competitor quotes exist — use as leverage even if switching is hard\n\n',
      '### Red Lines (Non-Negotiable)\n',
      '- CFO: Annual increases capped at 5%\n',
      '- CTO: Data export + API access must be in contract\n',
      '- Legal: Breach notification within 24 hours, right to audit\n\n',
      '**Please review and resolve the conflicts below.**'
    ].join(''),
    participants: [
      {
        label: 'Lead Negotiator Review',
        cards: [
          {
            id: 'duration_resolution',
            type: 'multiple-choice',
            title: 'How should we resolve the Duration vs. Flexibility conflict?',
            body: '**CFO** wants 3-year for ~$48k savings. **Legal** wants termination for convenience. **CTO** notes migration takes 6-12 months anyway.',
            options: [
              '3-year with termination for convenience after year 1 (compromise)',
              '2-year with option to extend at locked rate',
              '1-year with auto-renewal and 90-day opt-out (Legal preferred)',
              'Let me talk to CFO and Legal directly before deciding'
            ],
            required: true
          },
          {
            id: 'sla_budget_resolution',
            type: 'multiple-choice',
            title: 'SLA tier vs. budget — how to resolve?',
            body: '**CTO** wants 99.95% (~$276k/year at market rates). **CFO** targets $200k, max $260k.',
            options: [
              'Negotiate 99.95% within $260k ceiling — make it a key ask',
              'Accept 99.9% to stay within budget — negotiate SLA credits as consolation',
              'Tiered SLA — 99.95% for production workloads, 99.5% for dev/staging',
              'Ask CTO to reassess — is 99.9% actually sufficient?'
            ],
            required: true
          },
          {
            id: 'strategy_approval',
            type: 'approve-reject',
            title: 'Do you approve the synthesized red lines as our non-negotiable position?',
            body: '**Red Lines:**\n- Annual increases ≤5%\n- Data export + API access contractually guaranteed\n- Breach notification ≤24 hours\n- Right to audit'
          },
          {
            id: 'opening_position',
            type: 'free-text',
            title: 'Any adjustments to our opening position?',
            body: 'Based on this synthesis, what should we lead with? Any strategic notes for the negotiation?',
            required: false
          }
        ]
      }
    ]
  }
});
```

**Demo action:** Open the Facilitator review session. Read the synthesis — it clearly shows the conflicts and leverage. Make decisions on the resolution cards. The agent now has a complete, conflict-resolved position document.

### Step 4: Agent Produces Final Negotiation Brief

The agent compiles everything into a final document:

```
══════════════════════════════════════════════════════
  NEGOTIATION BRIEF — Acme Corp Cloud Infrastructure
  Prepared: 2026-03-18 | Confidential
══════════════════════════════════════════════════════

NEGOTIATION PARAMETERS
  Target spend:    $200,000/year
  Maximum spend:   $260,000/year
  Switching cost:  $180,000 (CFO estimate)
  Migration time:  6-12 months (CTO estimate)

OPENING POSITION
  Duration:        3-year with convenience termination after Y1
  SLA:             99.95% for production, 99.5% for dev/staging
  Payment:         Quarterly

RED LINES (DO NOT CONCEDE)
  ✗ Annual increases >5%
  ✗ No data export or API access
  ✗ Breach notification >24 hours
  ✗ No right to audit

TRADEABLE ITEMS (USE AS LEVERAGE)
  ✓ Payment terms (monthly → annual upfront for discount)
  ✓ Contract duration (1yr → 3yr for price concession)
  ✓ Auto-renewal (acceptable with 90-day window)
  ✓ Staging environment (nice-to-have, not critical)

INTERNAL CONFLICTS RESOLVED
  Duration: 3-year with Y1 exit (CFO-Legal compromise)
  SLA: Tiered approach (CTO-CFO compromise)

STAKEHOLDER SIGN-OFF
  CFO:    Submitted 2026-03-16 ✓
  CTO:    Submitted 2026-03-17 ✓
  Legal:  Submitted 2026-03-17 ✓
  Lead:   Reviewed & approved 2026-03-18 ✓
══════════════════════════════════════════════════════
```

## Demo Script (5-Minute Live Demo)

1. **[0:00]** "You're about to negotiate a major vendor contract. Your CFO, CTO, and Legal each have different priorities. How do you align them? Usually: 3 meetings over 2 weeks."
2. **[0:30]** Show the Facilitator session. "The lead negotiator defines scope and picks stakeholders."
3. **[1:00]** Show the three Contributor URLs. "Each stakeholder gets tailored questions. The CFO sees budget cards. The CTO sees technical cards. Legal sees compliance cards. They can't see each other's answers."
4. **[1:30]** Quick-fill one set of answers. "Everyone answers on their own time. 15 minutes each."
5. **[2:30]** Show the synthesis. "The AI found two conflicts — duration vs flexibility, and SLA vs budget. It also identified that our switching cost weakens our leverage."
6. **[3:00]** Show the conflict resolution cards. "The lead negotiator resolves each conflict with one click. No meeting needed."
7. **[3:30]** Show the final negotiation brief. "Every position attributed. Every trade-off explicit. Every red line documented."
8. **[4:30]** "Total time: 15 minutes per stakeholder, 10 minutes for the lead. Instead of 20 hours of meetings. And you walk in with receipts — nobody can say 'I never agreed to that.'"

## v2 Features Required

| Feature | Priority | Why |
|---|---|---|
| `currency` card type | P1 | Financial positions need precise amounts |
| `info` card type | P1 | Synthesis display between decision cards |
| `date-picker` card type | P1 | Negotiation deadline |
| Conditional logic | P1 | Follow-up questions based on stakeholder role |
| Anonymous mode | P1 | Opinion cards need anonymity, factual cards need attribution |
| Save & resume | P0 | Senior stakeholders won't finish in one sitting |
| `signature` card type | P2 | Formal sign-off on positions |
| Webhooks | P2 | "All stakeholders submitted" triggers synthesis |
| Document generation | P2 | Auto-produce the negotiation brief PDF |
