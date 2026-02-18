# LedgerSync Promise Protocol

## Overview

Promises are **bilateral commitments** between agents. Instead of just logging what you did, you explicitly commit to what you WILL do. This enables:

- **Pre-action coordination**: Other agents know your intentions before you act
- **Conflict prevention**: Agents see each other's commitments and avoid collisions
- **Accountability**: Track promise fulfillment over time
- **Trust signals**: Build reputation through consistent promise-keeping

---

## Core Concepts

### The Difference: Actions vs Promises

| Ledger Entry (Action) | Promise |
|-----------------------|---------|
| "I added OAuth PKCE" | "I WILL add OAuth PKCE" |
| Post-facto | Pre-action |
| Unilateral | Bilateral (promiser → promisee) |
| Records what happened | Commits to what will happen |

### Promise Types

| Type | When to Use | Example |
|------|-------------|---------|
| `will-do` | Committing to perform an action | "I will add refresh token rotation" |
| `will-not-do` | Committing to avoid an action | "I will not use deprecated implicit flow" |
| `will-maintain` | Committing to keep something stable | "I will maintain backward compatibility" |
| `will-provide` | Committing to make something available | "I will provide auth tokens to downstream services" |

### Promise Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  ACTIVE  │────▶│  REPORT  │────▶│ RESOLVED │
└──────────┘     └──────────┘     └──────────┘
     │                                  │
     │           ┌──────────┐           │
     └──────────▶│WITHDRAWN │           │
                 └──────────┘           │
                                        ▼
                              ┌──────────────────┐
                              │fulfilled│broken │
                              └──────────────────┘
```

---

## When to Make Promises

### DO Make Promises When:

1. **Starting multi-step work**
   ```
   User: "Add authentication"
   You: [Make promise] "will-do: Add OAuth2 with PKCE flow"
   Then: Begin implementation
   ```

2. **Taking on deferred work from another agent**
   ```
   [Read ledger: Claude deferred "refresh tokens"]
   You: [Make promise] "will-do: Add refresh token rotation"
   ```

3. **Committing to constraints**
   ```
   You: [Make promise] "will-not-do: Modify the public API without versioning"
   ```

### DON'T Make Promises When:

- Quick, single-file edits
- Reading/analyzing without changes
- Exploratory work where outcome is uncertain

---

## Making a Promise

### Promise Entry Format

```json
{
  "id": "[UUID]",
  "timestamp": "[ISO 8601]",
  "promiser": {
    "agent": "cursor",
    "session": "[session-id]"
  },
  "promisee": {
    "agent": "*",
    "scope": "project"
  },
  "promise": {
    "type": "will-do",
    "summary": "Add refresh token rotation to OAuth flow",
    "conditions": ["After basic PKCE flow is confirmed working"]
  },
  "context": {
    "artifacts": ["src/auth/oauth.ts", "src/auth/tokens.ts"],
    "relatedEntries": ["[ledger-entry-id-of-oauth-work]"]
  },
  "status": "active"
}
```

### Key Fields

| Field | Required | Description |
|-------|----------|-------------|
| `promiser.agent` | Yes | Your agent name |
| `promisee.agent` | Yes | Target agent, or `*` for any future agent |
| `promisee.scope` | No | `session`, `project`, or `permanent` |
| `promise.type` | Yes | One of the four promise types |
| `promise.summary` | Yes | What you're committing to (max 200 chars) |
| `promise.conditions` | No | Prerequisites before this can be fulfilled |
| `context.artifacts` | No | Files this promise affects |
| `status` | Yes | Always `active` when creating |

---

## Reporting Progress

After doing work on a promise, write a **Work Report**. Reports are facts, not self-grades.

### Work Report Format

```json
{
  "id": "[UUID]",
  "timestamp": "[ISO 8601]",
  "reporter": {
    "agent": "cursor",
    "role": "actor"
  },
  "promiseId": "[promise-id]",
  "report": {
    "workCompleted": "Added basic PKCE flow with code verifier/challenge",
    "remaining": ["Refresh token rotation", "Error handling"],
    "blockers": [],
    "confidenceInCompletion": 0.6
  }
}
```

### Reporter Roles

| Role | Who | Can Write Verdicts? |
|------|-----|---------------------|
| `actor` | Agent that did the work | No |
| `witness` | Another agent observing | Yes |
| `human` | Human reviewer | Yes |

### Key Insight: Actors Report, Witnesses Judge

- **Actors** report facts: "I did X, Y remains"
- **Witnesses/Humans** write verdicts: "This is fulfilled/partial/broken"

Why? Agents are biased about their own work. Let observers judge.

---

## Resolving Promises

Promises are resolved when:

1. **Human/Witness adds verdict** → Status auto-updates
2. **Agent explicitly resolves** → When work is clearly complete
3. **Agent withdraws** → When circumstances change

### Verdict Status

| Status | Meaning | Promise Status After |
|--------|---------|---------------------|
| `fulfilled` | Promise fully kept | `fulfilled` |
| `partial` | Partially done | stays `active` |
| `broken` | Promise not kept | `broken` |

---

## Example Flow

### Scenario: Claude starts OAuth, Cursor continues

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. [Promise] will-do: "Add OAuth2 with PKCE flow"          │
│                                                             │
│  2. [Work on src/auth/oauth.ts]                             │
│                                                             │
│  3. [Ledger] "Added PKCE code verifier/challenge"           │
│                                                             │
│  4. [Report] workCompleted: "Basic PKCE flow"               │
│              remaining: ["Refresh tokens"]                   │
│              confidence: 0.6                                 │
│                                                             │
│  5. [Rate limit - session ends]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CURSOR                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. [Read promises.jsonl] See Claude's active promise       │
│                                                             │
│  2. [Promise] will-do: "Add refresh token rotation"         │
│     (context: relatedEntries = Claude's promise)            │
│                                                             │
│  3. [Work on src/auth/tokens.ts]                            │
│                                                             │
│  4. [Report] workCompleted: "Added refresh rotation"        │
│              confidence: 1.0                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  HUMAN                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Verdict] Claude's promise: fulfilled                       │
│            reasoning: "OAuth complete after Cursor's work"   │
│                                                             │
│  [Verdict] Cursor's promise: fulfilled                       │
│            reasoning: "Refresh tokens working"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## CLI Commands

```bash
# Make a promise
ledgersync promise add --type will-do --summary "Add OAuth PKCE" --to "*"

# List active promises
ledgersync promise list --active

# Add work report
ledgersync report add --promise <id> --work "Added PKCE flow" --confidence 0.6

# Add verdict (human)
ledgersync report verdict <promise-id> --status fulfilled --reason "OAuth complete"

# View overall status
ledgersync status
```

---

## Integration with Ledger Entries

Promises and ledger entries work together:

```
promises.jsonl          ledger.jsonl            reports.jsonl
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  Promise    │───────▶│   Entry     │───────▶│   Report    │
│  (intent)   │        │  (action)   │        │ (progress)  │
└─────────────┘        └─────────────┘        └─────────────┘
       │                      │                      │
       └──────────────────────┴──────────────────────┘
                    All link via IDs
```

- **Promise** references artifacts it will affect
- **Ledger entry** references promise it fulfills (in `relatedEntries`)
- **Report** references promise and ledger entries

---

## Key Principles

1. **Promises are pre-action**: Make them BEFORE doing work
2. **Actors don't self-grade**: Report facts, let others judge
3. **Bilateral structure**: Every promise has a promiser AND promisee
4. **Status is immutable once resolved**: Don't change fulfilled → broken
5. **Human is final authority**: Humans resolve ambiguous verdicts

---

## Files

```
.ledgersync/
├── ledger.jsonl      # Actions (what happened)
├── promises.jsonl    # Promises (what will happen)
├── reports.jsonl     # Reports (progress on promises)
└── config.yaml       # Configuration
```
