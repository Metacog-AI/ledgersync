# LedgerSync Entry Types

Entry types provide **semantic structure** for common agent activities. While all entries share the base `LedgerEntry` schema, typed entries include additional fields that make context transfer more reliable.

---

## Why Entry Types?

The current `action.type` field (`create`, `modify`, `analyze`, etc.) describes *what happened*. Entry types describe *the nature of the work session*:

| `action.type` | Entry Type | Distinction |
|---------------|------------|-------------|
| `other` | `handoff` | **Outgoing** agent wrapping up, preparing for next agent |
| `analyze` | `transition` | **Incoming** agent acquiring context, confirming receipt |
| `modify` | `implementation` | Agent is building features |
| `debug` | `bugfix` | Agent is fixing a specific issue |
| `analyze` | `review` | Code review or audit without changes |

Entry types go in a new field: `entryType`.

---

## The Handoff/Transition Pattern

Agent switches involve **two entries**:

```
┌─────────────────────────────────────────────────────────────┐
│  OUTGOING AGENT (e.g., Claude Code)                         │
│                                                             │
│  Writes: entryType = "handoff"                              │
│  - Summarizes completed work                                │
│  - Documents current state                                  │
│  - Lists deferred tasks                                     │
│  - Provides handoffNotes for next agent                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  INCOMING AGENT (e.g., Antigravity)                         │
│                                                             │
│  Writes: entryType = "transition"                           │
│  - Confirms receipt of context                              │
│  - Lists what was read/understood                           │
│  - Signals readiness (or asks clarifying questions)         │
│  - Proposes next steps                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Type 1: `handoff` (Outgoing Agent)

**Purpose**: The **outgoing** agent writes this when ending a session, especially if another agent will continue.

### When to Write
- User says "switching to [other agent]"
- Rate limits hit, session must end
- Natural stopping point, user may return with different agent

### Required Fields

```typescript
interface HandoffEntry extends LedgerEntry {
  entryType: 'handoff';
  
  sessionSummary: {
    // What got done in this session
    completed: string[];
    
    // Current system state (snapshot)
    currentState: {
      [component: string]: string;  // e.g., "database": "Migration V2 deployed"
    };
    
    // What's left for next agent
    deferred: string[];
    blockers: string[];
    
    // Critical context that MUST be preserved
    importantContext: {
      [key: string]: string;  // Key decisions, architecture notes, gotchas
    };
    
    // Free-form notes for next agent
    handoffNotes?: string;
  };
}
```

### Example (Claude Code's actual entry)

```json
{
  "id": "790226e1-ffff-4333-b969-dcb00083c973",
  "timestamp": "2026-01-16T06:20:00+05:30",
  "agent": { "name": "claude-code", "model": "claude-sonnet-4-5-20250929" },
  "session": { "id": "e4a21c81-161d-4b8c-aa97-7161082a5652", "entryIndex": 2 },
  "entryType": "handoff",
  "action": {
    "type": "other",
    "summary": "Session summary: Migration V2 deployed, auth race condition fixed, app stable"
  },
  "reasoning": {
    "intent": "User switching to Antigravity due to rate limits. Writing comprehensive session summary for context continuity."
  },
  "sessionSummary": {
    "completed": [
      "Complete database migration V2",
      "Deploy Edge Function with token tracking",
      "Fix auth race condition",
      "Fix userState.js broken schema query"
    ],
    "currentState": {
      "database": "Migration V2 deployed, 8 tables",
      "edgeFunction": "ai-proxy with token tracking, session management",
      "frontend": "Non-blocking auth, passes metadata correctly"
    },
    "deferred": ["Frontend session UI", "Razorpay integration"],
    "blockers": [],
    "importantContext": {
      "billing": "1 credit = 1 cent, 1 credit per 1000 tokens",
      "sessionLogic": "4hr resume window, get_or_create_session RPC",
      "authFlow": "fetchProfile is non-blocking with 3s timeout"
    },
    "handoffNotes": "App is stable. Next agent should test end-to-end before adding features."
  },
  "tags": ["session-summary", "handoff", "migration-complete"]
}
```

---

## Type 2: `transition` (Incoming Agent)

**Purpose**: The **incoming** agent writes this after reading the ledger and acquiring context.

### When to Write
- First entry in a new session after another agent's handoff
- Resuming work after reading prior context
- Starting work on a codebase with existing ledger history

### Required Fields

```typescript
interface TransitionEntry extends LedgerEntry {
  entryType: 'transition';
  
  transition: {
    // Who are you receiving from?
    fromAgent: string;           // e.g., "claude-code"
    fromSessionId: string;       // Their session ID
    fromEntryId: string;         // Their last (handoff) entry ID
    
    // What did you inherit?
    contextAcquired: {
      entriesRead: number;           // How many ledger entries read
      philosophyDocsRead: string[];  // Which philosophy docs consumed
      filesIndexed: string[];        // Key files you examined
    };
    
    // Your understanding of state (confirms receipt)
    inheritedState: {
      completed: string[];       // What's already done (from handoff)
      deferred: string[];        // What's deferred (from handoff)
      blockers: string[];        // Known blockers
    };
    
    // Your assessment
    readiness: {
      confident: boolean;            // Ready to continue work?
      clarificationsNeeded: string[];  // Questions for the user
      proposedNextSteps: string[];     // What you'd do next
    };
  };
}
```

### Example (Antigravity's actual entry, corrected)

```json
{
  "id": "d4af2025-21c6-475f-a2a0-fc6c0f11fd77",
  "timestamp": "2026-01-16T12:02:00+05:30",
  "agent": { "name": "antigravity", "model": "gemini-2.5-pro" },
  "session": { "id": "dc1e9640-09bb-44dc-9495-69faa997c23f", "entryIndex": 0 },
  "entryType": "transition",
  "action": {
    "type": "analyze",
    "summary": "Session transition: indexed GATE-DA App, confirmed Migration V2 complete"
  },
  "reasoning": {
    "intent": "Acquire full context from Claude Code's handoff before continuing work.",
    "confidence": 0.95
  },
  "transition": {
    "fromAgent": "claude-code",
    "fromSessionId": "e4a21c81-161d-4b8c-aa97-7161082a5652",
    "fromEntryId": "790226e1-ffff-4333-b969-dcb00083c973",
    "contextAcquired": {
      "entriesRead": 4,
      "philosophyDocsRead": ["./Product planning/README.md", "./value_propositions.md"],
      "filesIndexed": ["GATE-DA App/DEPLOYMENT_GUIDE_V2.md", "GATE-DA App/README.md"]
    },
    "inheritedState": {
      "completed": ["Migration V2", "Auth race condition fix", "Token tracking"],
      "deferred": ["Frontend session UI", "Razorpay integration"],
      "blockers": []
    },
    "readiness": {
      "confident": true,
      "clarificationsNeeded": [],
      "proposedNextSteps": ["Frontend session UI", "End-to-end testing", "Razorpay"]
    }
  },
  "tools": [{ "name": "view_file" }, { "name": "list_dir" }],
  "artifacts": [
    { "path": ".ledgersync/ledger.jsonl", "action": "read" },
    { "path": "GATE-DA App/DEPLOYMENT_GUIDE_V2.md", "action": "read" }
  ],
  "tags": ["transition", "context-sync"]
}
```

---

## Type 3: `implementation`

**Purpose**: Feature work. Building something new.

### When to Use
- Creating new files
- Adding new functionality
- Implementing a planned feature

### Additional Fields

```typescript
interface ImplementationEntry extends LedgerEntry {
  entryType: 'implementation';
  
  implementation: {
    feature: string;              // What feature is being built
    designDecisions: string[];    // Key design choices made
    testsAdded: string[];         // Test files created/modified
    docsUpdated: string[];        // Documentation updated
    breakingChanges: string[];    // Any breaking changes introduced
  };
}
```

---

## Type 4: `bugfix`

**Purpose**: Fixing a specific issue.

### Additional Fields

```typescript
interface BugfixEntry extends LedgerEntry {
  entryType: 'bugfix';
  
  bugfix: {
    symptom: string;              // What the user observed
    rootCause: string;            // What was actually wrong
    fix: string;                  // How you fixed it
    regressionRisk: string;       // What could break from this fix
    verificationSteps: string[];  // How to verify the fix works
  };
}
```

---

## Type 5: `review`

**Purpose**: Code review, analysis, or audit without changes.

### Additional Fields

```typescript
interface ReviewEntry extends LedgerEntry {
  entryType: 'review';
  
  review: {
    scope: string[];              // Files/areas reviewed
    findings: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      location: string;
      issue: string;
      recommendation: string;
    }>;
    overallAssessment: string;
  };
}
```

---

## Schema Updates Required

### 1. Update `types.ts`

Add `entryType` field and type-specific interfaces.

### 2. Update `entry.schema.json`

Add conditional schemas based on `entryType`.

### 3. Update agent templates

Add examples of typed entries.

---

## Migration Path

- **Existing entries**: `entryType` is optional. Old entries without it are valid.
- **New entries**: Agents SHOULD use `entryType` when it fits.
- **Validation**: CLI warns if entry matches a type's criteria but lacks the type field.

---

## Agent Instructions

### On Session Start After Handoff

If the ledger has a `handoff` entry from another agent:
1. Create a `transition` entry
2. Confirm what you inherited
3. Signal readiness before proceeding

### On Session End

When wrapping up (especially if user might continue with another agent):
1. Create a `handoff` entry
2. Summarize completed/deferred work
3. Document critical context in `importantContext`

### During Work

Use appropriate types:
- Building features → `implementation`
- Fixing bugs → `bugfix`
- Reviewing code → `review`
- Regular work → Standard `LedgerEntry` (no `entryType`)
