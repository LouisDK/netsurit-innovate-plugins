# Scenario: Adaptive Client Tax Organizer

## Title

**Adaptive Client Tax Organizer** — AI-driven intake that asks only the questions each client needs

## Description

Every tax season, CPA firms and enrolled agents send clients a tax organizer — traditionally a 20-30 page PDF covering every possible situation. Clients are overwhelmed, skip sections, answer incorrectly, or don't return it at all. The preparer then spends 30-60 minutes on the phone chasing missing information.

The Adaptive Client Tax Organizer replaces this with a QuestionPad session that:

1. **Starts with a short, friendly set of screening questions** (8-10 cards)
2. **Branches dynamically** based on answers — a client with no crypto, no rental property, and no business gets 12 total cards. A client with an S-Corp, crypto trades, and a home office gets 30+ cards, each relevant to their situation.
3. **Supports multiple respondents per client** — the business owner answers income/business questions, the bookkeeper answers expense/payroll questions, the spouse answers their own employment/income questions. All on the same session URL or separate role URLs.
4. **Collects documents alongside answers** — "Upload your W-2" (file-upload card) right next to "How many W-2s do you expect?" (slider card). No separate email with attachments.
5. **Produces a structured intake document** the preparer can use immediately — no interpretation needed.

The AI agent (powered by a "Tax Intake" skill) orchestrates the entire flow:
- Creates the session with screening questions
- Monitors answers via polling or webhooks
- Uses `update_session` to add relevant follow-up cards based on screening answers
- Closes the session and synthesizes a preparer-ready intake summary

## Why This Adds Value

| Stakeholder | Current Pain | With Tax Organizer |
|---|---|---|
| **Client** | 30-page PDF, confusing, takes 2+ hours | 10-15 minutes, only relevant questions, mobile-friendly |
| **Preparer** | 30-60 min phone call per client × 200 clients = 100-200 hours | Structured intake arrives complete, 5-min review |
| **Firm** | Bottleneck at intake delays entire tax season | Intake sent in January, most complete by early February |
| **Bookkeeper** | Separate email thread with preparer for business docs | Answers their specific cards on the same session |

**Revenue impact for a 200-client practice:**
- 200 clients × 45 min saved per client = 150 hours saved
- At $150/hour effective rate = **$22,500 in recovered capacity per tax season**
- Plus: faster turnaround → happier clients → better retention → more referrals

## Demo Setup — Step by Step

### Prerequisites

- QuestionPad server running (local or hosted instance)
- An MCP client (Claude Code, or any MCP-compatible agent)
- For the full demo: a second device (phone/tablet) to play the "client" role

### Step 1: Create the Screening Session

The agent creates the initial intake session with screening questions. In a production setup, a "Tax Intake" skill would drive this. For the demo, we issue the MCP call directly.

```typescript
const result = await client.callTool({
  name: 'create_session',
  arguments: {
    title: '2025 Tax Organizer — Johnson Family',
    description: [
      '**Welcome to your 2025 tax organizer!**\n\n',
      'This will take about 10-15 minutes. Answer what you can — ',
      'skip what you\'re unsure about and add a comment.\n\n',
      'Your preparer: **Sarah Chen, CPA** | Ref: TX-2025-0147'
    ].join(''),
    participants: [
      {
        label: 'Primary Taxpayer',
        cards: [
          {
            id: 'filing_status',
            type: 'multiple-choice',
            title: 'What is your filing status for 2025?',
            options: [
              'Single',
              'Married Filing Jointly',
              'Married Filing Separately',
              'Head of Household',
              'Qualifying Surviving Spouse'
            ],
            required: true
          },
          {
            id: 'dependents_changed',
            type: 'yes-no',
            title: 'Did your number of dependents change in 2025?',
            body: 'New baby, child aged out, new dependent, etc.',
            required: true
          },
          {
            id: 'w2_count',
            type: 'slider',
            title: 'How many W-2s will you receive for 2025?',
            body: 'Count each employer separately. Enter 0 if none.',
            min: 0,
            max: 10,
            step: 1,
            required: true
          },
          {
            id: 'has_self_employment',
            type: 'yes-no',
            title: 'Did you have any self-employment or freelance income?',
            body: '1099-NEC, side business, gig work, consulting, etc.',
            required: true
          },
          {
            id: 'has_investments',
            type: 'yes-no',
            title: 'Did you sell any stocks, bonds, or other investments?',
            required: true
          },
          {
            id: 'has_crypto',
            type: 'yes-no',
            title: 'Did you buy, sell, or trade any cryptocurrency?',
            required: true
          },
          {
            id: 'has_rental',
            type: 'yes-no',
            title: 'Do you own any rental properties?',
            required: true
          },
          {
            id: 'has_home_office',
            type: 'yes-no',
            title: 'Did you use part of your home exclusively for business?',
            required: true
          },
          {
            id: 'major_life_events',
            type: 'multi-select',
            title: 'Did any of these happen in 2025? (Select all that apply)',
            options: [
              'Got married or divorced',
              'Bought or sold a home',
              'Had a baby or adopted a child',
              'Started a new business',
              'Retired',
              'Moved to a different state',
              'Received an inheritance',
              'None of the above'
            ],
            required: true
          },
          {
            id: 'anything_else',
            type: 'free-text',
            title: 'Anything else your tax preparer should know?',
            placeholder: 'Unusual income, major expenses, questions you have...',
            required: false
          }
        ]
      }
    ]
  }
});

// Response:
// {
//   agentId: "agent-abc123",
//   sessions: [
//     { label: "Primary Taxpayer", guid: "guid-primary", url: "https://questionpad.example.com/session/guid-primary" }
//   ]
// }
```

**Demo action:** Open the session URL on your phone. Enter name "Mike Johnson". Answer the screening questions. For a rich demo, answer:
- Filing status: Married Filing Jointly
- Dependents changed: Yes
- W-2 count: 2
- Self-employment: Yes
- Investments: Yes
- Crypto: No
- Rental: No
- Home office: Yes
- Life events: "Bought or sold a home"

### Step 2: Agent Processes Screening Answers and Generates Follow-Up Cards

The agent polls for answers, sees the screening responses, and generates a tailored follow-up card set. This is where the adaptive magic happens.

```typescript
// Agent polls and sees Mike's answers
const sessions = await client.callTool({
  name: 'get_sessions',
  arguments: { agentId: 'agent-abc123' }
});

// Agent logic (in the skill): analyze answers and build follow-up cards
// Mike said: self-employment=yes, investments=yes, home_office=yes, bought/sold home
// So we add cards for those topics. We do NOT add crypto or rental cards.

await client.callTool({
  name: 'update_session',
  arguments: {
    agentId: 'agent-abc123',
    guid: 'guid-primary',
    cards: [
      // Keep all original screening cards (preserves answers)
      // ... (all 10 original cards with same IDs) ...

      // === NEW: Dependents Detail (triggered by dependents_changed=yes) ===
      {
        id: 'info_dependents',
        type: 'info',
        title: 'Section: Dependent Changes',
        body: '_You indicated your dependents changed. Please provide details._'
      },
      {
        id: 'new_dependents',
        type: 'free-text',
        title: 'Describe the dependent changes',
        body: 'For each new dependent: full name, date of birth, SSN, relationship.\nFor removed dependents: name and reason.',
        required: true
      },

      // === NEW: Self-Employment (triggered by has_self_employment=yes) ===
      {
        id: 'info_self_employment',
        type: 'info',
        title: 'Section: Self-Employment Income',
        body: '_You indicated self-employment income. A few questions about your business._'
      },
      {
        id: 'se_business_type',
        type: 'multiple-choice',
        title: 'What type of self-employment?',
        options: ['Sole Proprietorship / Schedule C', 'S-Corporation', 'Partnership / LLC', 'Multiple entities'],
        required: true
      },
      {
        id: 'se_gross_income',
        type: 'currency',
        title: 'Estimated gross self-employment income for 2025',
        currency: 'USD',
        min: 0,
        max: 10000000,
        required: true
      },
      {
        id: 'se_estimated_payments',
        type: 'yes-no',
        title: 'Did you make quarterly estimated tax payments?',
        required: true
      },
      {
        id: 'se_docs',
        type: 'file-upload',
        title: 'Upload 1099-NEC / 1099-K forms received',
        body: 'Upload all 1099 forms related to your self-employment income.',
        accept: ['.pdf', '.jpg', '.png'],
        maxFiles: 10,
        maxSizeMb: 10
      },

      // === NEW: Investments (triggered by has_investments=yes) ===
      {
        id: 'info_investments',
        type: 'info',
        title: 'Section: Investment Income',
        body: '_You indicated investment sales. We\'ll need your brokerage statements._'
      },
      {
        id: 'inv_brokerage_count',
        type: 'slider',
        title: 'How many brokerage accounts had sales?',
        min: 1,
        max: 10,
        step: 1,
        required: true
      },
      {
        id: 'inv_1099b',
        type: 'file-upload',
        title: 'Upload 1099-B / Consolidated brokerage statements',
        accept: ['.pdf'],
        maxFiles: 10,
        maxSizeMb: 20
      },
      {
        id: 'inv_large_gains',
        type: 'yes-no',
        title: 'Do you expect capital gains over $50,000?',
        body: 'This helps us plan for potential estimated tax adjustments.'
      },

      // === NEW: Home Office (triggered by has_home_office=yes) ===
      {
        id: 'info_home_office',
        type: 'info',
        title: 'Section: Home Office Deduction',
        body: '_You indicated a home office. We need a few measurements._'
      },
      {
        id: 'ho_sqft_office',
        type: 'slider',
        title: 'Square footage of your home office',
        min: 50,
        max: 1000,
        step: 10,
        required: true
      },
      {
        id: 'ho_sqft_home',
        type: 'slider',
        title: 'Total square footage of your home',
        min: 500,
        max: 10000,
        step: 50,
        required: true
      },
      {
        id: 'ho_method',
        type: 'multiple-choice',
        title: 'Which home office deduction method do you prefer?',
        body: '**Simplified:** $5/sq ft, max 300 sq ft ($1,500 max). No tracking expenses.\n**Actual:** Deduct proportional share of mortgage, utilities, insurance. More paperwork but often higher deduction.',
        options: ['Simplified method', 'Actual expense method', 'Not sure — let my preparer decide'],
        required: true
      },

      // === NEW: Home Sale (triggered by life event "Bought or sold a home") ===
      {
        id: 'info_home_sale',
        type: 'info',
        title: 'Section: Home Purchase / Sale',
        body: '_You indicated a home transaction in 2025._'
      },
      {
        id: 'home_transaction_type',
        type: 'multiple-choice',
        title: 'What type of home transaction?',
        options: ['Purchased a home', 'Sold a home', 'Both — sold one and purchased another'],
        required: true
      },
      {
        id: 'home_closing_docs',
        type: 'file-upload',
        title: 'Upload closing disclosure / settlement statement (HUD-1)',
        accept: ['.pdf'],
        maxFiles: 5,
        maxSizeMb: 15
      },

      // === Standard deductions for everyone ===
      {
        id: 'info_deductions',
        type: 'info',
        title: 'Section: Common Deductions',
        body: '_Almost done! A few questions about potential deductions._'
      },
      {
        id: 'charitable_total',
        type: 'currency',
        title: 'Total charitable donations in 2025',
        body: 'Cash and non-cash combined. Include church tithes, nonprofit donations, etc.',
        currency: 'USD',
        min: 0,
        max: 1000000
      },
      {
        id: 'medical_significant',
        type: 'yes-no',
        title: 'Did you have significant medical expenses not covered by insurance?',
        body: 'Medical expenses must exceed 7.5% of AGI to be deductible. Only answer yes if total out-of-pocket was substantial.'
      },
      {
        id: 'student_loans',
        type: 'yes-no',
        title: 'Did you pay student loan interest in 2025?'
      },

      // === Final confirmation ===
      {
        id: 'info_final',
        type: 'info',
        title: 'Almost Done!',
        body: '_Please review your answers above, then confirm below._'
      },
      {
        id: 'attestation',
        type: 'signature',
        title: 'I confirm this information is accurate to the best of my knowledge',
        body: 'By typing your full name below, you confirm the information provided is complete and accurate. Your preparer may follow up with additional questions.',
        requireFullName: true
      }
    ]
  }
});
```

**Demo action:** On the phone, the form updates automatically (browser polling). Mike now sees his original answers preserved, plus new sections for self-employment, investments, home office, and home sale. He fills these in and uploads documents.

### Step 3: Agent Closes Session and Produces Intake Summary

```typescript
const closed = await client.callTool({
  name: 'close_sessions',
  arguments: { agentId: 'agent-abc123' }
});

// Agent now has all answers + uploaded file URLs
// The skill processes this into a preparer-ready summary:

// Example synthesized output (agent generates this from structured answers):
// ────────────────────────────────────────────
// TAX INTAKE SUMMARY — Johnson Family (TX-2025-0147)
// Prepared for: Sarah Chen, CPA
// Date: 2025-02-03
//
// FILING: Married Filing Jointly
// DEPENDENTS: Changed — new baby (see details)
//
// INCOME SOURCES:
// ✓ W-2 income: 2 employers (docs pending upload)
// ✓ Self-employment: Sole Prop, est. $85,000 gross
//   - Quarterly estimates: Yes
//   - 1099s: 3 files uploaded ✓
// ✓ Investment sales: 2 brokerage accounts
//   - Large gains expected: Yes (>$50k)
//   - 1099-B: 2 files uploaded ✓
// ✗ Crypto: None
// ✗ Rental: None
//
// DEDUCTIONS:
// ✓ Home office: 200 sq ft / 2,400 sq ft home (8.3%)
//   - Method: Actual expense (preparer to decide)
// ✓ Charitable: $12,500
// ✗ Medical: Not significant
// ✓ Student loans: Yes
// ✓ Home purchase: Closing docs uploaded ✓
//
// DOCUMENTS RECEIVED: 6 files
// DOCUMENTS PENDING: W-2s (2 expected)
//
// ATTESTATION: Signed by Michael R. Johnson, 2025-02-03T14:32:00Z
// ────────────────────────────────────────────
```

### Step 4: (Optional) Adding the Spouse / Bookkeeper

For the "Married Filing Jointly" scenario, the agent creates a follow-up session for the spouse:

```typescript
const spouseSession = await client.callTool({
  name: 'create_session',
  arguments: {
    agentId: 'agent-abc123',  // same agent
    title: '2025 Tax Organizer — Johnson Family (Spouse)',
    description: '**Hi Lisa!** Mike has started your family\'s tax organizer. We just need your income information.',
    participants: [
      {
        label: 'Spouse',
        cards: [
          {
            id: 'spouse_w2_count',
            type: 'slider',
            title: 'How many W-2s will you receive for 2025?',
            min: 0,
            max: 5,
            step: 1,
            required: true
          },
          {
            id: 'spouse_w2_upload',
            type: 'file-upload',
            title: 'Upload your W-2(s)',
            accept: ['.pdf', '.jpg', '.png'],
            maxFiles: 5,
            maxSizeMb: 10
          },
          {
            id: 'spouse_other_income',
            type: 'yes-no',
            title: 'Do you have any income besides W-2 wages?',
            body: 'Self-employment, investments, rental, etc.'
          },
          {
            id: 'spouse_notes',
            type: 'free-text',
            title: 'Anything else Sarah should know about your tax situation?',
            required: false
          }
        ]
      }
    ]
  }
});

// Mike texts Lisa the URL. She opens it on her phone, answers 4 questions, uploads her W-2.
```

## Demo Script (5-Minute Live Demo)

1. **[0:00]** "Imagine you're a CPA firm. Tax season starts. You need information from 200 clients."
2. **[0:30]** Show the `create_session` call. "The AI agent creates a personalized intake for each client."
3. **[1:00]** Open the URL on a phone. "The client gets this link via text/email. Look — it's 10 questions, not 30 pages."
4. **[1:30]** Answer the screening questions live. Check "yes" for self-employment and crypto.
5. **[2:00]** "Now watch what happens." Show the form updating with new sections. "The agent saw the answers and added only the relevant follow-up questions. No crypto questions because we said no. But look — self-employment detail cards appeared."
6. **[3:00]** Upload a sample PDF. "The client uploads their 1099 right here. No separate email."
7. **[3:30]** Submit. Show the agent's synthesized intake summary. "The preparer gets this. Structured, complete, with documents attached. What used to take a 45-minute phone call took the client 10 minutes on their phone."
8. **[4:30]** "Now multiply this by 200 clients. That's 150 hours of preparer time saved. At $150/hour, that's $22,500 in recovered capacity — every single tax season."

## v2 Features Required

| Feature | Priority | Why |
|---|---|---|
| `file-upload` card type | P0 | Can't collect W-2s, 1099s without it |
| Save & resume | P0 | Clients won't finish in one sitting |
| `currency` card type | P1 | Financial amounts need precision |
| `info` card type | P1 | Section headers between question groups |
| `date-picker` card type | P1 | Transaction dates, property dates |
| `signature` card type | P2 | Attestation of accuracy |
| Conditional logic | P1 | Client-side branching without agent round-trip |
| Card sections | P1 | 25+ card sessions need structure |
| Completion screen | P1 | "Thank you, ref #TX-2025-0147, preparer will contact you" |
| Deadline/timer | P1 | "Please complete by February 15" |
| Campaigns | P2 | "Q1 2026 Tax Season" — 200 sessions, portfolio view |
