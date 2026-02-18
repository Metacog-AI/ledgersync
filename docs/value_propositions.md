# LedgerSync: Value Propositions

> **"To build Jarvis, you need memory and context management."**

---

## One-Line Positioning

**LedgerSync is shared memory for your AI coding assistants.**

When you switch from Claude Code to Cursor to Antigravity, context is lost. LedgerSync preserves it.

---

## The Vision: Towards Jarvis

The dream: A single AI assistant that knows everything about your codebase, your decisions, your philosophy. Jarvis.

**The reality today:**
- No single AI coding tool is best at everything
- Rate limits force tool-switching
- Each tool has unique strengths (debugging, generation, refactoring)

**The gap:**
- Each tool maintains isolated memory
- When you switch, the new tool asks "what are we working on?"
- You repeat yourself. Context is lost. Decisions are undone.

**LedgerSync bridges this gap** until Jarvis arrives.

---

## Core Philosophy

### 1. File-First Architecture
> The simplest thing that works.

Every AI agent can read and write files. No databases. No servers. No dependencies.

```
.metacog/
├── config.yaml    # Configuration
└── ledger.jsonl   # Append-only log
```

### 2. Append-Only Ledger
> History is immutable. Decisions are permanent.

Like git commits, ledger entries are never deleted or modified. You can always trace back to understand "why was this code written this way?"

### 3. Reasoning Over Actions
> The "why" is more valuable than the "what".

A diff tells you what changed. The ledger tells you WHY it changed. Future agents (and humans) need the reasoning, not just the output.

### 4. Agents Can Disagree
> The ledger is a record, not a constraint.

Agent B can override Agent A's decision. But it must document why. The human resolves conflicts. The ledger just keeps the record.

### 5. Philosophy Grounding
> Decisions flow from product values.

Agents don't just log actions. They reference philosophy docs that influenced their decisions. This ensures continuity of vision, not just code.

---

## Target Users

### Primary: Multi-Tool Developers
Developers who use 2+ AI coding assistants:
- **Claude Code** → **Cursor** → **Copilot** → **Antigravity**
- Switch due to rate limits, feature differences, or preference
- Frustrated by context loss

### Secondary: Teams with AI Coding Standards
Teams that want:
- Audit trail of AI-generated code
- Consistency across different AI tools
- Philosophy enforcement (constraints)

### Future: Multi-Agent Systems
When multiple agents work simultaneously:
- Coordination without collision
- Shared understanding of in-progress work
- Conflict detection and resolution

---

## What Makes LedgerSync Different

| Feature | Other Solutions | LedgerSync |
|---------|-----------------|------------|
| Storage | Cloud/database | Local files (`.metacog/`) |
| Dependencies | Server, API keys | Zero dependencies |
| Agent support | Single vendor | Cross-vendor (Claude, Cursor, Antigravity, any) |
| Schema | Unstructured | Typed schema with validation |
| Philosophy layer | None | First-class concept |

---

## The Bitter Lesson Defense

> "Will general agents make this obsolete?"

Sutton's bitter lesson: General methods win. Won't a general coding agent just remember everything itself?

**Why LedgerSync survives:**

1. **Cross-vendor problem**: General agents from Anthropic don't share memory with agents from Google. LedgerSync is the bridge.

2. **Local-first**: Your context stays on your machine. No cloud sync dependence. Works offline.

3. **Open protocol**: Anyone can implement it. It's a spec, not a product.

4. **Composable**: Whether you use 1 agent or 5, the ledger works the same.

When Jarvis arrives, LedgerSync becomes its local memory format.

---

## Why Not Just Git? (The Promise Graph Answer)

> "Can't I just write detailed git commit messages?"

Git with detailed commits gets you **70% of the way**. But promises fill the remaining gaps:

| Git + Detailed Commits | LedgerSync + Promise Graphs |
|------------------------|---------------------------|
| Post-facto record | **Pre-action commitments** |
| No bilateral structure | **Agent A promises to Agent B** |
| No accountability | **Tracked promise-keeping** |
| No coordination signal | **Interlocking promises** |

### The Pre-Commit Gap

```
Claude (uncommitted): Modified auth.ts for OAuth
    ↓ (Switch agents before committing)
Cursor: "Let me modify auth.ts for Firebase..."
```

Git can't help. The reasoning isn't committed yet.
**LedgerSync**: Promise was logged immediately.

### Multi-Turn Sessions

Git collapses 5-turn conversations into one commit.
**LedgerSync**: 5 entries + 1 promise tracking the evolution.

### Structured Coordination

Git messages are text. Agents parse with regex/LLMs.
**LedgerSync**: Typed JSON. Agents query without hallucination.

### The Real Differentiator: Promise Graphs

Promises transform LedgerSync from "logging tool" to "coordination protocol":

- **Bilateral commitments**: Agent A → Agent B
- **Pre-action intentions**: Know what agents WILL do
- **Accountability**: Track fulfillment over time
- **Trust signals**: Reputation from promise-keeping

This is something git fundamentally cannot provide.

---

## Non-Negotiables

| Constraint | Rationale |
|------------|-----------|
| **File-based only** | Zero dependencies, universal compatibility |
| **Append-only ledger** | History must be immutable |
| **Agents MUST log** | The system fails if agents forget |
| **Human is authority** | AI suggests, human decides |
| **Open source forever** | This is infrastructure, not a product |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Context retained across switch | >80% of relevant decisions |
| Time to onboard new agent | <30 seconds (read ledger) |
| Schema violations | 0 (validation enforced) |
| Adoption | Used by 100+ developers |
| Contributing agents | Claude, Cursor, Antigravity, Copilot |

---

## Roadmap Philosophy

### Phase 1: File-Based MVP ✅
- JSONL ledger
- CLI tool
- Agent templates

### Phase 2: Dogfooding & Refinement
- Use while building real projects
- Identify friction points
- Refine schema based on usage

### Phase 3: Memory Architecture
- SQLite index for queries
- Semantic search (optional)
- Summarization for old entries

### Phase 4: Multi-Agent Coordination
- Real-time conflict detection
- Parallel agent support
- Distributed ledger (optional)

---

**Maintained by:** Abu Syed  
**License:** MIT  
**Philosophy:** Open infrastructure for the age of AI coding
