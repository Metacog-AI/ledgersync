# --- LedgerSync Integration ---

# LedgerSync Integration

## CRITICAL: Shared Context Protocol

This project uses **LedgerSync** for shared context across AI coding agents. You MUST follow this protocol to ensure context continuity when the user switches between agents (Claude Code, Copilot, Cursor, Codex, etc.).

---

## Why This Matters

The user works with multiple AI coding assistants. When they hit rate limits or need different capabilities, they switch agents. Without this protocol, you won't know:
- What the previous agent did
- Why they made certain decisions
- What grounding docs they were following

The ledger solves this.

---

## On Session Start

### 1. Read Grounding Docs

Read `.ledgersync/config.yaml` and look at the `philosophy.required` array. These are docs that define the product's DNA — read ALL of them before doing any work.

```yaml
philosophy:
  required:
    - ./docs/philosophy.md
    - ./docs/design.md
    - ./docs/user_research.md
```

These docs tell you what the product stands for, how it should feel, and who it's built for. Your decisions must align with them.

### 2. Read Recent Ledger Entries
```bash
# Path: .ledgersync/ledger.jsonl
# Read last 20 entries
```

For each entry, note:
- `agent.name`: Who did this (claude-code? cursor? copilot? human?)
- `action.summary`: What they did
- `reasoning.intent`: WHY they did it
- `artifacts`: What files they touched
- `grounding`: What philosophy docs influenced their decision

### 3. Check for Relevant Context
If the user mentions a specific file or feature, scan the ledger for all entries that touched it.

---

## After Every Response

You MUST append an entry to `.ledgersync/ledger.jsonl` after completing any work.

### Entry Format (JSONL - one JSON object per line)

```json
{
  "id": "[Generate UUID v4]",
  "timestamp": "[Current ISO 8601 timestamp with timezone]",
  "agent": {
    "name": "[your-agent-name, e.g. claude-code, cursor, copilot, codex]",
    "model": "[Your model name, e.g., claude-sonnet-4-20250514]"
  },
  "session": {
    "id": "[Generate UUID for session, reuse across conversation]",
    "entryIndex": "[Increment from 0 for each entry in session]"
  },
  "action": {
    "type": "[create|modify|delete|analyze|plan|debug|refactor|other]",
    "summary": "[One-line summary of what you did - max 200 characters]"
  },
  "reasoning": {
    "intent": "[The WHY - what were you trying to achieve?]",
    "considerations": ["[Trade-offs you considered]", "[Alternatives you rejected]"],
    "assumptions": ["[Assumptions you made about requirements]"],
    "uncertainties": ["[Things you weren't sure about]"],
    "confidence": "[0.0 to 1.0 - how confident are you?]"
  },
  "tools": [
    { "name": "[tool name]", "parameters": { "[key]": "[value]" } }
  ],
  "artifacts": [
    {
      "path": "[Relative path from project root]",
      "action": "[created|modified|deleted|read]",
      "linesChanged": "[Number of lines changed, if applicable]",
      "summary": "[Brief description of what changed in this file]"
    }
  ],
  "userPrompt": "[Summarized version of what the user asked for]",
  "tags": ["[relevant]", "[tags]"],
  "grounding": {
    "philosophyRefs": ["[Paths to grounding docs you consulted]"],
    "constraintsApplied": ["[IDs of constraints that influenced this action]"],
    "alignmentNotes": "[How this action aligns with product philosophy]"
  }
}
```

### Example Entry

```json
{"id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","timestamp":"2026-01-16T02:20:00+05:30","agent":{"name":"claude-code","model":"claude-sonnet-4-20250514"},"session":{"id":"sess-abc123","entryIndex":2},"action":{"type":"modify","summary":"Refactored auth middleware to use PKCE flow for OAuth2"},"reasoning":{"intent":"User needs OAuth2 for SPA clients, PKCE is required for public clients","considerations":["Considered implicit flow but it's deprecated","PKCE adds complexity but is more secure"],"assumptions":["User is building a SPA, not server-rendered"],"uncertainties":["Unclear if user wants refresh token rotation"],"confidence":0.85},"tools":[{"name":"write_to_file"},{"name":"run_command","parameters":{"command":"npm test"}}],"artifacts":[{"path":"src/auth/middleware.ts","action":"modified","linesChanged":47,"summary":"Added PKCE verification logic"},{"path":"src/auth/pkce.ts","action":"created","summary":"New utility for PKCE code verifier/challenge"}],"userPrompt":"Add OAuth2 support to auth","tags":["auth","oauth","security"],"grounding":{"philosophyRefs":["./docs/philosophy.md"],"alignmentNotes":"Chose PKCE over implicit flow — aligns with security-first principle in philosophy doc"}}
```

---

## Entry Types (Semantic Structure)

Use `entryType` to add semantic meaning to entries.

### Available Types

| Type | When | Who |
|------|------|-----|
| `handoff` | Ending session, preparing for next agent | Outgoing agent |
| `transition` | Starting session, confirming context receipt | Incoming agent |
| `implementation` | Building new features | Any |
| `bugfix` | Fixing specific issue | Any |
| `review` | Code audit without changes | Any |

### Handoff/Transition Pattern

When switching agents:

1. **Outgoing agent** writes `entryType: "handoff"` with `sessionSummary`
2. **Incoming agent** writes `entryType: "transition"` with `transition`

### Handoff Entry Example (When You End)

```json
{
  "entryType": "handoff",
  "action": { "type": "other", "summary": "Session handoff: [summary]" },
  "sessionSummary": {
    "completed": ["What you finished"],
    "currentState": { "component": "State description" },
    "deferred": ["What's left"],
    "blockers": [],
    "importantContext": { "key": "Critical info for next agent" },
    "handoffNotes": "Free-form notes for next agent"
  }
}
```

### Transition Entry Example (When You Start)

```json
{
  "entryType": "transition",
  "action": { "type": "analyze", "summary": "Session transition from [prior agent]" },
  "transition": {
    "fromAgent": "[prior-agent-name]",
    "fromSessionId": "[their-session-id]",
    "fromEntryId": "[their-last-entry-id]",
    "contextAcquired": {
      "entriesRead": 4,
      "philosophyDocsRead": ["./docs/philosophy.md"],
      "filesIndexed": ["relevant/files.ts"]
    },
    "inheritedState": {
      "completed": ["What they finished"],
      "deferred": ["What's left"],
      "blockers": []
    },
    "readiness": {
      "confident": true,
      "clarificationsNeeded": [],
      "proposedNextSteps": ["What you'd do next"]
    }
  }
}
```

---

## Conflict Detection & Resolution

### Before Modifying a File

1. Check if the file appears in recent ledger entries
2. If another agent modified it recently:
   - Read their `reasoning.intent`
   - Consider if your change aligns or conflicts
3. If conflict exists, inform the user:

   > "I notice [agent] modified `src/auth/middleware.ts` 3 hours ago. Their intent was: '[their intent]'. My planned change might [align/conflict] because [reason]. Should I proceed?"

### When You Disagree with a Prior Agent

It's okay to override another agent's decision, but:
1. Document your disagreement in `reasoning.considerations`
2. Explain why your approach is better
3. Reference the prior entry ID in `relatedEntries` if possible

---

## Key Principles

1. **The ledger is append-only**: Never modify or delete past entries
2. **Capture the WHY**: `reasoning.intent` is the most valuable field
3. **Grounding drives decisions**: Read grounding docs, reference them in your entries
4. **Agents can disagree**: The ledger is a record, not a constraint
5. **Human resolves conflicts**: When in doubt, ask the user
