# LedgerSync Architecture

> A deep dive into how LedgerSync works under the hood.

---

## System Overview

LedgerSync uses a **layered architecture** inspired by promise theory. Each layer builds on the one below:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEDGERSYNC LAYER MODEL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 6: RESULTS         → Outcomes and consequences                       │
│  Layer 5: DECISIONS       → Human/witness verdicts on promises              │
│  Layer 4: ACTIONS         → ledger.jsonl (what agents did)                  │
│  Layer 3: REPORTS         → reports.jsonl (progress on promises)            │
│  Layer 2: PROMISES        → promises.jsonl (bilateral commitments)          │
│  Layer 1: DATA TRACES     → Philosophy refs, grounding, provenance          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            YOUR PROJECT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        .ledgersync/                                  │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ config.yaml  │  │ ledger.jsonl │  │promises.jsonl│               │   │
│  │  │              │  │              │  │              │               │   │
│  │  │ - philosophy │  │ Actions &    │  │ Bilateral    │               │   │
│  │  │ - constraints│  │ reasoning    │  │ commitments  │               │   │
│  │  │ - codebases  │  │              │  │              │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                      │   │
│  │  ┌──────────────┐                                                   │   │
│  │  │reports.jsonl │  Work reports and verdicts                        │   │
│  │  └──────────────┘                                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Claude Code │  │   Cursor    │  │ Antigravity │  │   Human     │        │
│  │   READ ◀────┼──┼─────────────┼──┼─────────────┼──┼─────────────│        │
│  │  WRITE ────▶│  │  READ/WRITE │  │  READ/WRITE │  │  (via CLI)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
.ledgersync/
├── config.yaml           # Configuration
│   ├── philosophy        # Docs agents must read
│   ├── constraints       # Rules agents must follow
│   └── codebases         # Registered code folders
│
├── ledger.jsonl          # Actions log (JSONL format)
│   └── What agents did and why
│   └── Append-only, never modified
│
├── promises.jsonl        # Promise graph (JSONL format)
│   └── Bilateral commitments between agents
│   └── Pre-action intentions
│
├── reports.jsonl         # Work reports (JSONL format)
│   └── Progress reports on promises
│   └── Verdicts from humans/witnesses
│
└── .cache/               # (Future) Computed data
    ├── index.sqlite      # Structured queries
    └── reputation.json   # Trust scores
```

---

## Data Flow

### 1. Agent Session Start

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION START                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Read config.yaml                                        │
│     └─▶ Load philosophy.required docs                       │
│     └─▶ Load constraints                                    │
│                                                             │
│  2. Read ledger.jsonl (tail -20)                            │
│     └─▶ Parse last 20 entries                               │
│     └─▶ Build context summary                               │
│                                                             │
│  3. Generate session ID                                     │
│     └─▶ UUID for this conversation                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. During Work

```
┌─────────────────────────────────────────────────────────────┐
│                     DURING WORK                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Before modifying file F:                                   │
│     1. Scan ledger for recent entries touching F            │
│     2. If found:                                            │
│        └─▶ Read reasoning.intent                            │
│        └─▶ Check for conflict                               │
│        └─▶ Warn user if conflict exists                     │
│                                                             │
│  Check constraints:                                         │
│     1. Get current codebase from file path                  │
│     2. Find applicable constraints                          │
│     3. If action violates critical constraint:              │
│        └─▶ STOP and ask user                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. After Response

```
┌─────────────────────────────────────────────────────────────┐
│                   AFTER RESPONSE                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Construct LedgerEntry                                   │
│     ├─▶ Generate UUID                                       │
│     ├─▶ Capture timestamp                                   │
│     ├─▶ Record action + reasoning                           │
│     ├─▶ List artifacts touched                              │
│     └─▶ Include grounding references                        │
│                                                             │
│  2. Validate against schema                                 │
│     └─▶ Reject if invalid                                   │
│                                                             │
│  3. Append to ledger.jsonl                                  │
│     └─▶ Single line, no pretty print                        │
│     └─▶ File lock if concurrent                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Entry Schema (TypeScript)

```typescript
interface LedgerEntry {
  // === IDENTITY ===
  id: string;                    // UUID v4
  timestamp: string;             // ISO 8601

  // === AGENT ===
  agent: {
    name: string;                // "claude-code" | "cursor" | "antigravity"
    model?: string;              // "claude-sonnet-4-20250514"
    version?: string;
  };

  // === SESSION ===
  session: {
    id: string;                  // Groups entries in conversation
    entryIndex: number;          // 0, 1, 2... per session
    parentEntryId?: string;      // Reply to specific entry
  };

  // === ACTION ===
  action: {
    type: ActionType;            // create, modify, delete, analyze, etc.
    summary: string;             // Max 200 chars
    description?: string;        // Longer explanation
  };

  // === REASONING (Most valuable!) ===
  reasoning: {
    intent: string;              // WHY - the goal
    considerations?: string[];   // Trade-offs considered
    assumptions?: string[];      // What was assumed
    uncertainties?: string[];    // What's unclear
    confidence?: number;         // 0.0 - 1.0
  };

  // === ARTIFACTS ===
  tools: ToolCall[];             // Tools/commands used
  artifacts: ArtifactChange[];   // Files touched

  // === CONTEXT ===
  userPrompt?: string;           // What user asked for
  tags?: string[];               // Categorization
  relatedEntries?: string[];     // Related entry IDs

  // === GROUNDING ===
  grounding?: {
    philosophyRefs?: string[];   // Philosophy docs consulted
    constraintsApplied?: string[]; // Constraints that applied
    alignmentNotes?: string;     // How this aligns with vision
  };
}
```

---

## Config Schema

```yaml
# .ledgersync/config.yaml

version: "0.1"

project:
  name: "My Project"
  description: "Optional description"

# Philosophy docs - agents read these first
philosophy:
  required:                      # MUST read
    - ./README.md
    - ./docs/PHILOSOPHY.md
  optional:                      # Read if relevant
    - ./docs/**/*.md

# Registered codebases (for constraint targeting)
codebases:
  - path: ./frontend
    name: frontend
  - path: ./backend
    name: backend

# Ledger settings
ledger:
  maxEntriesToLoad: 20           # Default context window
  summarizeAfter: 50             # Auto-summarize older entries

# Constraints - agents check before acting
constraints:
  - id: no-direct-answers
    description: "Never give users direct answers, guide them"
    appliesTo: ["frontend"]
    severity: critical           # critical | high | medium | low

  - id: typescript-strict
    description: "Always use TypeScript strict mode"
    appliesTo: ["*"]             # All codebases
    severity: high
```

---

## Design Decisions

### Why JSONL?

| Option | Pros | Cons |
|--------|------|------|
| JSON array | Easy to parse | Must rewrite entire file on append |
| **JSONL** ✅ | Append-only, streaming | Slightly harder to parse |
| SQLite | Queryable | Dependency, not git-friendly |

JSONL wins: append-only matches our immutability requirement.

### Why No Database?

1. **Zero dependencies**: Every AI agent can read files
2. **Git-friendly**: Ledger can be committed
3. **Portable**: Just copy the folder
4. **Debuggable**: Open in any text editor

### Why Validation?

Without validation, agents write malformed entries. Schema enforcement catches errors early.

```typescript
// Using JSON Schema + AJV
const valid = validateEntry(entry);
if (!valid) throw new Error("Invalid entry");
```

---

## Constraint Enforcement

### Severity Levels

| Level | Agent Behavior |
|-------|----------------|
| `critical` | **STOP**. Ask user before violating. |
| `high` | Warn user. Proceed only with approval. |
| `medium` | Log in entry. Explain deviation. |
| `low` | Guideline. Follow when practical. |

### Matching Algorithm

```typescript
function getApplicableConstraints(filePath: string, config: Config) {
  const codebase = findCodebase(filePath, config.codebases);
  return config.constraints.filter(c => 
    c.appliesTo.includes(codebase.name) || 
    c.appliesTo.includes("*")
  );
}
```

---

## Conflict Detection

### What is a Conflict?

Agent B modifies file F where:
1. Agent A recently modified F
2. Agent B's change has different intent

### Detection Algorithm

```typescript
function detectConflict(file: string, intent: string, ledger: Entry[]) {
  const recentEntries = ledger
    .filter(e => e.artifacts.some(a => a.path === file))
    .slice(-5);
  
  for (const entry of recentEntries) {
    if (entry.reasoning.intent !== intent) {
      return {
        conflict: true,
        priorEntry: entry,
        priorIntent: entry.reasoning.intent
      };
    }
  }
  return { conflict: false };
}
```

### Resolution

Human resolves. Agent documents:

```json
{
  "reasoning": {
    "considerations": [
      "Overriding Claude's OAuth implementation because user wants Firebase Auth instead"
    ]
  },
  "relatedEntries": ["uuid-of-claude-entry"]
}
```

---

---

## Promise Graph Architecture

The promise graph adds a **coordination layer** on top of the action ledger. Inspired by Mark Burgess's promise theory for distributed systems.

### Why Promises?

| Without Promises | With Promises |
|------------------|---------------|
| Agents log what they DID | Agents commit what they WILL do |
| Post-facto record | Pre-action coordination |
| Unilateral | Bilateral (A → B) |
| No accountability | Tracked fulfillment |

### Promise Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          PROMISE LIFECYCLE                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐      │
│   │ PROMISE │───────▶│  WORK   │───────▶│ REPORT  │───────▶│ VERDICT │      │
│   │ (intent)│        │ (action)│        │(progress)│       │(judgment)│      │
│   └─────────┘        └─────────┘        └─────────┘        └─────────┘      │
│        │                  │                  │                  │            │
│        ▼                  ▼                  ▼                  ▼            │
│   promises.jsonl    ledger.jsonl       reports.jsonl      reports.jsonl     │
│                                        (actor report)    (human verdict)    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Promise Entry Schema

```typescript
interface PromiseEntry {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  
  promiser: {
    agent: string;               // Who is making the commitment
    session?: string;
  };
  
  promisee: {
    agent: string;               // Who it's to (* = any)
    scope?: 'session' | 'project' | 'permanent';
  };
  
  promise: {
    type: 'will-do' | 'will-not-do' | 'will-maintain' | 'will-provide';
    summary: string;
    conditions?: string[];
  };
  
  context?: {
    relatedEntries?: string[];   // Linked ledger entries
    artifacts?: string[];        // Files affected
  };
  
  status: 'active' | 'fulfilled' | 'broken' | 'withdrawn' | 'superseded';
}
```

### Work Report Schema

```typescript
interface WorkReport {
  id: string;
  timestamp: string;
  
  reporter: {
    agent: string;
    role: 'actor' | 'witness' | 'human';
  };
  
  promiseId: string;
  
  report: {
    workCompleted: string;       // Facts, not judgments
    remaining?: string[];
    blockers?: string[];
    confidenceInCompletion: number;  // 0.0-1.0
  };
  
  // Only witnesses/humans write verdicts
  verdict?: {
    status: 'fulfilled' | 'partial' | 'broken';
    reasoning: string;
  };
}
```

### Key Design Decision: Actors Don't Self-Grade

Agents report **facts** about their work, not judgments:
- "I completed X, Y remains" ✅
- "I did a good job" ❌

Why? Agents are biased about their own work. Let observers (other agents or humans) judge fulfillment.

---

## Future Architecture (v2)

```
.ledgersync/
├── config.yaml
├── ledger.jsonl           # Raw append-only log
├── promises.jsonl         # Promise graph
├── reports.jsonl          # Work reports
│
├── .cache/                # Auto-generated, gitignored
│   ├── index.sqlite       # Structured queries
│   ├── embeddings.db      # Semantic search
│   ├── reputation.json    # Computed trust scores
│   └── summaries.json     # Compressed old entries
│
└── hooks/                 # Optional automation
    ├── pre-commit         # Validate on commit
    └── post-entry         # Notify on new entry
```

**File-first, index-on-read**: Agents write simple JSONL. CLI builds indexes for queries.
