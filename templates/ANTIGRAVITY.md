# LedgerSync Integration for Google Antigravity

## CRITICAL: Shared Context Protocol

This project uses **metacog-ledgersync** for shared context across AI agents (Claude Code, Cursor, Antigravity). You MUST follow this protocol to ensure context continuity when the user switches between agents.

---

## The User's Workflow

The user (Abu) works with three AI coding assistants:
1. **Claude Code** - Primary, until rate limits hit
2. **Antigravity** (you) - Secondary
3. **Cursor** - Tertiary

When switching, context is lost. The ledger preserves it.

---

## On Session Start (MANDATORY)

### Step 1: Read Configuration

Read `.ledgersync/config.yaml` to understand:

```yaml
philosophy:
  required:          # MUST read these philosophy docs
    - ./value_propositions.md
    - ./Product planning/README.md

constraints:         # Rules you must follow
  - id: prime-directive
    description: "Never give students direct answers"
    severity: critical
```

### Step 2: Load Philosophy Docs

For each path in `philosophy.required`, read and internalize the document. These define:
- Product values and positioning
- Non-negotiable constraints
- Strategic direction

### Step 3: Read Recent Ledger Entries

Read `.ledgersync/ledger.jsonl` (last 20 entries). For each entry, extract:

| Field | Use |
|-------|-----|
| `agent.name` | Who did this? |
| `action.summary` | What did they do? |
| `reasoning.intent` | WHY did they do it? |
| `artifacts` | What files were touched? |
| `reasoning.uncertainties` | What were they unsure about? |

### Step 4: Read Active Promises

Read `.ledgersync/promises.jsonl` and filter for `status: "active"`:

| Field | Use |
|-------|-----|
| `promiser.agent` | Who committed to this? |
| `promise.summary` | What did they commit to? |
| `promise.type` | will-do, will-not-do, will-maintain, will-provide |
| `context.artifacts` | What files does this affect? |

Active promises tell you what other agents are working on. Avoid conflicts!

### Step 5: Generate Session ID

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
    name: "antigravity";
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
    philosophyRefs?: string[];   // Philosophy docs that influenced you
    constraintsApplied?: string[]; // Constraint IDs applied
    alignmentNotes?: string;     // How this aligns with product philosophy
  };
}
```

### Minimal Valid Entry

```json
{"id":"[uuid]","timestamp":"[iso]","agent":{"name":"antigravity","model":"gemini-2.5-pro"},"session":{"id":"[uuid]","entryIndex":0},"action":{"type":"modify","summary":"Fixed X"},"reasoning":{"intent":"User reported Y"},"tools":[],"artifacts":[{"path":"file.ts","action":"modified"}]}
```

### Complete Example

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "timestamp": "2026-01-16T02:30:00+05:30",
  "agent": {
    "name": "antigravity",
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
    "constraintsApplied": ["prime-directive"],
    "alignmentNotes": "Aligns with infrastructure positioning - clean, modular code for API"
  }
}
```

---

## Entry Types (Semantic Structure)

Use `entryType` to add semantic meaning to entries. See `LedgerSync/templates/ENTRY_TYPES.md` for full spec.

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
  "agent": { "name": "antigravity", "model": "gemini-2.5-pro" },
  "session": { "id": "[uuid]", "entryIndex": 0 },
  "entryType": "transition",
  "action": { "type": "analyze", "summary": "Session transition from [prior agent]" },
  "reasoning": { "intent": "Acquire context before continuing work" },
  "transition": {
    "fromAgent": "claude-code",
    "fromSessionId": "[their-session-id]",
    "fromEntryId": "[their-last-entry-id]",
    "contextAcquired": {
      "entriesRead": 4,
      "philosophyDocsRead": ["./Product planning/README.md"],
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
⚠️ CONFLICT DETECTED

File: `src/auth/middleware.ts`

**Claude Code** modified this 2 hours ago:
- Intent: "Added PKCE verification for OAuth2 SPA clients"
- Confidence: 0.85

**My planned change**: Remove PKCE verification

This conflicts because Claude added it intentionally for security.

Options:
1. Proceed (I'll document the override)
2. Keep Claude's implementation
3. Discuss the approach first
```

### When You Override

If you proceed despite conflict:
1. Add prior entry's ID to `relatedEntries`
2. Document in `reasoning.considerations`: "Overriding [agent]'s decision because [reason]"
3. Explain your rationale clearly

---

## Constraint Handling

Read constraints from `.ledgersync/config.yaml`:

```yaml
constraints:
  - id: prime-directive
    description: "Never give students direct answers"
    appliesTo: ["gate-da-app"]
    severity: critical
```

### Severity Levels

| Level | Action |
|-------|--------|
| `critical` | **STOP**. Never violate. Ask user if action would violate. |
| `high` | Warn user before violating. Document justification. |
| `medium` | Consider carefully. Document if you deviate. |
| `low` | Guideline. Follow when practical. |

### Checking Constraints

Before each action:
1. Get current codebase from path (e.g., "gate-da-app")
2. Find constraints where `appliesTo` includes your codebase or "*"
3. Check if your action would violate any
4. For critical/high: confirm with user before proceeding

---

## Philosophy Grounding

When making design decisions, reference philosophy docs:

```json
"grounding": {
  "philosophyRefs": ["./value_propositions.md"],
  "constraintsApplied": ["infra-positioning"],
  "alignmentNotes": "Chose modular architecture because we're building infrastructure, not a monolithic app"
}
```

This helps future agents understand not just WHAT you did, but WHY based on product values.

---

## Key Principles

| Principle | Description |
|-----------|-------------|
| **Append-only** | Never modify or delete past ledger entries |
| **Capture WHY** | `reasoning.intent` is the most valuable field for future agents |
| **Philosophy-grounded** | Reference product values when making decisions |
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

# Validate ledger integrity
ledgersync validate

# Manually add entry
ledgersync add --summary "..." --intent "..."

# Promise commands
ledgersync promise list --active
ledgersync status
```

---

## Promise Protocol (Bilateral Commitments)

LedgerSync supports **promises** — pre-action commitments between agents.

### When to Make Promises

Make a promise when starting **multi-step work**:

```json
// Append to .ledgersync/promises.jsonl
{
  "id": "[UUID]",
  "timestamp": "[ISO 8601]",
  "promiser": { "agent": "antigravity", "model": "gemini-2.5-pro" },
  "promisee": { "agent": "*", "scope": "project" },
  "promise": {
    "type": "will-do",
    "summary": "Add OAuth2 with PKCE flow"
  },
  "context": {
    "artifacts": ["src/auth/oauth.ts"]
  },
  "status": "active"
}
```

### Promise Types

| Type | Use When |
|------|----------|
| `will-do` | Committing to perform an action |
| `will-not-do` | Committing to avoid something |
| `will-maintain` | Keeping something stable |
| `will-provide` | Making something available |

### After Completing Work: Write a Report

After work on a promise, write a **work report** (facts, not self-grades):

```json
// Append to .ledgersync/reports.jsonl
{
  "id": "[UUID]",
  "timestamp": "[ISO 8601]",
  "reporter": { "agent": "antigravity", "role": "actor" },
  "promiseId": "[promise-id]",
  "report": {
    "workCompleted": "Added basic PKCE flow",
    "remaining": ["Refresh token rotation"],
    "confidenceInCompletion": 0.6
  }
}
```

### Reading Other Agents' Promises

On session start, also read `.ledgersync/promises.jsonl`:

1. Check for **active promises** — work another agent committed to
2. If taking over, make your own promise linking to theirs
3. Avoid conflicting with active promises on same files

### Full Protocol Docs

See `LedgerSync/templates/PROMISES.md` for the complete promise protocol.
