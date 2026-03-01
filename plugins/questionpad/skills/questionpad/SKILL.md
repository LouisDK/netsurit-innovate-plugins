---
name: questionpad
description: >
  The QuestionPad skill documents the request and response JSON data formats
  used by the QuestionPad feedback UI. Reference this skill for questionpad
  data format details, feedback card types, request JSON format, and response
  JSON format. It covers all eight card types, their configuration fields,
  and the shape of each answer object returned after submission.
---

# QuestionPad Data Format Reference

## Overview

QuestionPad is a pre-built, self-contained HTML application for collecting
structured feedback from users through an interactive browser UI. The app
renders a set of typed feedback cards, tracks completion progress, and
produces a JSON response object once the user submits.

The HTML lives at `${CLAUDE_PLUGIN_ROOT}/assets/app.html`. Agents do not
generate or modify this file. Instead, agents compose a **request JSON**
object describing the cards to display, open the app via Playwright, inject
the data, and later read back the **response JSON** from `localStorage`.

## How to Open the App

The workflow has three phases: build, inject, collect.

### 1. Build the Request JSON

Construct a JavaScript object conforming to the request format documented
below. Assign it a unique `id`, a human-readable `title`, and an array of
`cards`.

### 2. Open the App and Inject Data

Playwright blocks `file://` URLs, so serve the app via a local HTTP server:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 -m http.server 18923 &
```

Then navigate Playwright to:

```
browser_navigate  url: http://localhost:18923/assets/app.html
```

After the page loads, inject the request data and trigger rendering with
`browser_evaluate`:

```js
browser_evaluate  function: () => {
  window.REQUEST_DATA = <REQUEST_JSON>;
  window.loadRequestData();
}
```

Replace `<REQUEST_JSON>` with the serialized request object (inline literal
or variable).

### 3. Collect the Response

Poll `localStorage` until `questionpad-submitted` equals `"true"`:

```js
browser_evaluate  function: () => {
  return localStorage.getItem('questionpad-submitted') === 'true'
    ? JSON.parse(localStorage.getItem('questionpad-response'))
    : null;
}
```

When the return value is non-null, the response JSON is ready for
processing.

## Card Types

Eight card types are supported. Every card shares these base fields:

| Field      | Type    | Required | Description                              |
|------------|---------|----------|------------------------------------------|
| `id`       | string  | yes      | Unique identifier within the request     |
| `type`     | string  | yes      | One of the eight type names below        |
| `title`    | string  | yes      | Short heading displayed on the card      |
| `body`     | string  | no       | Markdown description rendered above the control |
| `required` | boolean | no       | If true, user must answer before submitting (default false) |

### Type-specific fields and answer shapes

| Type               | Extra Fields                                                                 | Answer Shape                          |
|--------------------|-----------------------------------------------------------------------------|---------------------------------------|
| `multiple-choice`  | `options`: string[]                                                          | `{ choice: string }`                  |
| `multi-select`     | `options`: string[]                                                          | `{ choices: string[] }`               |
| `yes-no`           | `default`: boolean (initial toggle position)                                 | `{ value: boolean }`                  |
| `approve-reject`   | _(none)_                                                                     | `{ status: "approved" \| "rejected" }`|
| `free-text`        | `placeholder`: string                                                        | `{ text: string }`                    |
| `rating`           | `min`: number (default 1), `max`: number (default 5)                         | `{ rating: number }`                  |
| `slider`           | `min`: number (0), `max`: number (100), `step`: number (1), `default`: number| `{ value: number }`                   |
| `range-slider`     | `min`: number (0), `max`: number (100), `step`: number (1), `defaultMin`: number, `defaultMax`: number | `{ value: [number, number] }` |

## Request JSON Format

A complete request object:

```json
{
  "id": "review-api-design-001",
  "title": "API Design Review",
  "cards": [
    {
      "id": "approach",
      "type": "approve-reject",
      "title": "Overall approach",
      "body": "The service exposes a REST API with versioned endpoints.\n\n- `GET /v1/items`\n- `POST /v1/items`",
      "required": true
    },
    {
      "id": "clarity",
      "type": "rating",
      "title": "Documentation clarity",
      "body": "Rate how clear the endpoint documentation is.",
      "min": 1,
      "max": 10,
      "required": true
    },
    {
      "id": "auth-method",
      "type": "multiple-choice",
      "title": "Preferred auth method",
      "options": ["API key", "OAuth 2.0", "JWT bearer"],
      "required": false
    },
    {
      "id": "improvements",
      "type": "multi-select",
      "title": "Areas needing improvement",
      "options": ["Error handling", "Pagination", "Rate limiting", "Versioning"],
      "required": false
    },
    {
      "id": "breaking-ok",
      "type": "yes-no",
      "title": "Accept breaking changes?",
      "body": "A v2 migration would require client updates.",
      "default": false
    },
    {
      "id": "confidence",
      "type": "slider",
      "title": "Confidence in timeline",
      "min": 0,
      "max": 100,
      "step": 5,
      "default": 50
    },
    {
      "id": "effort-range",
      "type": "range-slider",
      "title": "Estimated effort (story points)",
      "min": 1,
      "max": 40,
      "step": 1,
      "defaultMin": 5,
      "defaultMax": 13
    },
    {
      "id": "notes",
      "type": "free-text",
      "title": "Additional notes",
      "placeholder": "Anything else to mention..."
    }
  ]
}
```

### Rules

- `id` at the top level must be a unique string identifying this request.
- Each card `id` must be unique within the `cards` array.
- `title` at the top level is displayed in the header.
- Cards render in array order.
- The `body` field supports a subset of Markdown: headings, bold, italic,
  inline code, fenced code blocks, unordered/ordered lists, and blockquotes.

## Response JSON Format

After submission, the app stores a response object in
`localStorage` under the key `questionpad-response`. Its shape:

```json
{
  "id": "review-api-design-001",
  "submittedAt": "2026-03-01T14:30:00.000Z",
  "answers": [
    {
      "cardId": "approach",
      "status": "approved",
      "comment": ""
    },
    {
      "cardId": "clarity",
      "rating": 8,
      "comment": "Could use more examples."
    },
    {
      "cardId": "auth-method",
      "choice": "OAuth 2.0",
      "comment": ""
    },
    {
      "cardId": "improvements",
      "choices": ["Error handling", "Pagination"],
      "comment": ""
    },
    {
      "cardId": "breaking-ok",
      "value": false,
      "comment": "Not until Q3."
    },
    {
      "cardId": "confidence",
      "value": 70,
      "comment": ""
    },
    {
      "cardId": "effort-range",
      "value": [5, 13],
      "comment": ""
    },
    {
      "cardId": "notes",
      "text": "Consider adding WebSocket support.",
      "comment": ""
    }
  ],
  "globalComment": "Looks good overall."
}
```

### Response fields

| Field            | Type     | Description                                         |
|------------------|----------|-----------------------------------------------------|
| `id`             | string   | Echoes the request `id`                             |
| `submittedAt`    | string   | ISO 8601 timestamp of submission                    |
| `answers`        | array    | One entry per card, in original card order           |
| `answers[].cardId` | string | Matches the card `id` from the request              |
| `answers[].comment`| string | Per-card optional comment (empty string if unused)  |
| `globalComment`  | string   | Free-text comment from the footer input             |

Each answer entry also contains the type-specific answer fields shown in the
card types table above. Skipped cards appear with an empty answer object
(only `cardId` and `comment`).

## Fallback: Inject via browser_evaluate

If the `file://` navigation fails (e.g., sandbox restrictions), use the
same injection approach after navigating by any available means. The key
requirement is that `window.REQUEST_DATA` is set and
`window.loadRequestData()` is called after the page has loaded:

```js
browser_evaluate  function: () => {
  window.REQUEST_DATA = { /* ... full request object ... */ };
  window.loadRequestData();
}
```

The app displays a "Waiting for data..." message until
`loadRequestData()` is called, so injection can happen at any point after
navigation completes.
