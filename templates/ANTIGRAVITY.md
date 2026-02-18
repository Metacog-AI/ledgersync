# --- LedgerSync Integration ---

# LedgerSync Integration

## CRITICAL: Shared Context Protocol

This project uses **LedgerSync** for shared context across AI coding agents. You MUST follow this protocol to ensure context continuity when the user switches between agents.

---

## On Session Start (MANDATORY)

### Step 1: Read Grounding Docs

Read `.ledgersync/config.yaml` and check the `philosophy.required` array. These docs define the product's DNA — read ALL of them before doing any work.

```yaml
philosophy:
  required:
    - ./docs/philosophy.md
    - ./docs/design.md
```

These tell you what the product stands for, how it should feel, and who it's built for. Your decisions must align with them.

### Step 2: Read Recent Ledger Entries

Read `.ledgersync/ledger.jsonl` (last 20 entries). For each entry, extract:

| Field | Use |
|-------|-----|
| `agent.name` | Who did this? |
| `action.summary` | What did they do? |
| `reasoning.intent` | WHY did they do it? |
| `artifacts` | What files were touched? |
| `reasoning.uncertainties` | What were they unsure about? |
| `grounding` | What philosophy docs influenced them? |

### Step 3: Generate Session ID

Create a new UUID for your session. Use it consistently across all entries in this conversation.

---

## After Every Response (MANDATORY)

Append a JSON entry to `.ledgersync/ledger.jsonl`.

### Full Schema

```typescript
interface LedgerEntry {
  // Required
  id: string;                    // UUID v4
  timestamp: string;             // ISO 8601 with timezone
  agent: {
    name: string;                // Your agent name (e.g. "jules", "gemini-cli")
    model: string;               // e.g., "gemini-2.5-pro"
    version?: string;
  };
  session: {
    id: string;                  // Your session UUID
    entryIndex: number;          // 0, 1, 2... per session
  };
  action: {
    type: "create" | "modify" | "delete" | "analyze" | "plan" | "debug" | "refactor" | "other";
    summary: string;             // Max 200 chars - WHAT you did
  };
  reasoning: {
    intent: string;              // WHY you did it (MOST IMPORTANT)
    considerations?: string[];   // Trade-offs considered
    assumptions?: string[];      // Assumptions made
    uncertainties?: string[];    // What you're unsure about
    confidence?: number;         // 0.0-1.0
  };
  tools: Array<{
    name: string;
    parameters?: Record<string, unknown>;
  }>;
  artifacts: Array<{
    path: string;                // Relative from project root
    action: "created" | "modified" | "deleted" | "read";
    linesChanged?: number;
    summary?: string;            // What changed in this file
  }>;

  // Optional
  userPrompt?: string;           // What the user asked for
  tags?: string[];
  relatedEntries?: string[];     // UUIDs of related prior entries
  grounding?: {
    philosophyRefs?: string[];   // Grounding docs that influenced you
    constraintsApplied?: string[]; // Constraint IDs applied
    alignmentNotes?: string;     // How this aligns with product philosophy
  };
}
```

### Minimal Valid Entry

```json
{"id":"[uuid]","timestamp":"[iso]","agent":{"name":"jules","model":"gemini-2.5-pro"},"session":{"id":"[uuid]","entryIndex":0},"action":{"type":"modify","summary":"Fixed X"},"reasoning":{"intent":"User reported Y"},"tools":[],"artifacts":[{"path":"file.ts","action":"modified"}]}
```

### Complete Example

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "timestamp": "2026-01-16T02:30:00+05:30",
  "agent": {
    "name": "jules",
    "model": "gemini-2.5-pro"
  },
  "session": {
    "id": "sess-xyz789",
    "entryIndex": 1
  },
  "action": {
    "type": "refactor",
    "summary": "Extracted auth logic into separate middleware module"
  },
  "reasoning": {
    "intent": "Improve code organization per user request, prepare for OAuth addition",
    "considerations": [
      "Considered keeping inline but file was already 500+ lines",
      "New module allows easier testing"
    ],
    "assumptions": [
      "User prefers separate files over large monolithic files"
    ],
    "uncertainties": [
      "Not sure if user wants the middleware in /middleware or /lib"
    ],
    "confidence": 0.8
  },
  "tools": [
    { "name": "write_to_file", "parameters": { "path": "src/middleware/auth.ts" } },
    { "name": "replace_file_content", "parameters": { "path": "src/app.ts" } }
  ],
  "artifacts": [
    { "path": "src/middleware/auth.ts", "action": "created", "summary": "New auth middleware module" },
    { "path": "src/app.ts", "action": "modified", "linesChanged": -45, "summary": "Removed auth logic, now imports from middleware" }
  ],
  "userPrompt": "Clean up the auth code, it's getting messy",
  "tags": ["refactor", "auth", "cleanup"],
  "grounding": {
    "philosophyRefs": ["./docs/philosophy.md"],
    "alignmentNotes": "Chose modular architecture — aligns with clean, maintainable codebase principle"
  }
}
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

### Transition Entry Example (When You Start)

```json
{
  "id": "[uuid]",
  "timestamp": "[iso]",
  "agent": { "name": "[your-agent]", "model": "[your-model]" },
  "session": { "id": "[uuid]", "entryIndex": 0 },
  "entryType": "transition",
  "action": { "type": "analyze", "summary": "Session transition from [prior agent]" },
  "reasoning": { "intent": "Acquire context before continuing work" },
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
  },
  "tools": [],
  "artifacts": []
}
```

### Handoff Entry Example (When You End)

```json
{
  "entryType": "handoff",
  "action": { "type": "other", "summary": "Session handoff: [summary of work]" },
  "sessionSummary": {
    "completed": ["What you finished"],
    "currentState": {
      "component": "State description"
    },
    "deferred": ["What's left"],
    "blockers": [],
    "importantContext": {
      "key": "Critical info for next agent"
    },
    "handoffNotes": "Free-form notes for next agent"
  }
}
```

---

## Conflict Detection

### Before Modifying Any File

1. **Scan ledger** for recent entries with that file in `artifacts`
2. **If found** (within last 24 hours or 20 entries):
   - Read their `reasoning.intent`
   - Compare to your planned change
3. **If conflict detected**, warn user:

```
CONFLICT DETECTED

File: `src/auth/middleware.ts`

[Prior agent] modified this 2 hours ago:
- Intent: "Added PKCE verification for OAuth2 SPA clients"
- Confidence: 0.85

My planned change: [your change]

This conflicts because [reason].

Options:
1. Proceed (I'll document the override)
2. Keep their implementation
3. Discuss the approach first
```

### When You Override

If you proceed despite conflict:
1. Add prior entry's ID to `relatedEntries`
2. Document in `reasoning.considerations`: "Overriding [agent]'s decision because [reason]"
3. Explain your rationale clearly

---

## Philosophy Grounding

When making design decisions, reference grounding docs:

```json
"grounding": {
  "philosophyRefs": ["./docs/philosophy.md"],
  "alignmentNotes": "Chose modular architecture because philosophy doc emphasizes maintainability"
}
```

This helps future agents understand not just WHAT you did, but WHY based on product values.

---

## Key Principles

| Principle | Description |
|-----------|-------------|
| **Append-only** | Never modify or delete past ledger entries |
| **Capture WHY** | `reasoning.intent` is the most valuable field for future agents |
| **Grounding-driven** | Read grounding docs, reference them in decisions |
| **Conflicts are okay** | You CAN disagree with prior agents, but document why |
| **Human is authority** | When in doubt, ask the user |
| **Transparency** | Log uncertainties, assumptions, and confidence |

---

## CLI Commands (For Reference)

The user may ask you to run these:

```bash
# View recent entries
ledgersync log --last 10

# Get summary for context
ledgersync summary

# Check setup health
ledgersync validate

# Manually add entry
ledgersync add --summary "..." --intent "..."
```
