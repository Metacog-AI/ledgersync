# LedgerSync

> **Shared memory and grounding for AI coding agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/metacog-ledgersync.svg)](https://www.npmjs.com/package/metacog-ledgersync)

---

## The Problem

You use Claude Code. You hit rate limits. You switch to Cursor.

**Cursor asks:** "What are we working on?"

You explain everything again. Context lost. Decisions undone. Time wasted.

But there's a deeper problem. Even when context is preserved, your agents are making decisions in a vacuum — they don't know what your product stands for, how it should feel, or who you're building for. They write correct code, but not *your* code.

## The Solution

LedgerSync gives your AI agents two things:

**Shared Memory** — Agents log every decision and why they made it. Switch between IDEs and coding agents — no context is lost.

**Grounding** — Register docs that define your product's DNA. Agents read these before writing a single line of code, so their decisions align with your vision — not just generic best practices.

```
.ledgersync/
├── config.yaml    # Grounding docs, constraints, project settings
└── ledger.jsonl   # Append-only decision log
```

**Claude writes:** "Added OAuth2 with PKCE — aligns with security-first principle in philosophy.md"
**Cursor reads:** "Got it. Philosophy says privacy-first. I'll add refresh token rotation with encrypted storage."

---

## Quick Start

```bash
# Install
npm install -g metacog-ledgersync

# Initialize in your project
cd /your/project
ledgersync init --name "My Project"

# Connect your AI tools
ledgersync integrate claude-code cursor copilot

# Register grounding docs
ledgersync ground add ./docs/philosophy.md
```

That's it. Your agents now share context and build with your product's DNA.

---

## Grounding

This is what makes LedgerSync different from a shared notepad.

Register docs that define your product — agents read them before writing any code. Every decision gets measured against your vision, not just technical correctness.

**Examples of grounding docs:**

**philosophy.md** — Why your product exists and what it stands for.
> "We're building a social platform with strict bot filtering to let the true voice of people come through."

**design.md** — The feel, aesthetic, and deterministic design rules.
> "The app should feel breathable and calm. Scrolling should feel like a stroll in the park — smooth, purposeful animations. All buttons: rounded-lg, blue-600."

**user_research.md** — Who you're building for, backed by data.
> "Our users are Gen-Z, fed up with algorithmic clutter. 58% prefer muted tones. 73% leave apps that autoplay."

This list is not exhaustive — you can add however many core directive docs to ground your agents in your product.

```bash
ledgersync ground add ./docs/philosophy.md
ledgersync ground add ./docs/design.md
ledgersync ground add ./docs/user_research.md
ledgersync ground list
```

When an agent makes a decision, it references these docs in the ledger entry:

```json
"grounding": {
  "philosophyRefs": ["./docs/philosophy.md"],
  "alignmentNotes": "Chose privacy-respecting analytics — aligns with no-tracking principle"
}
```

---

## How It Works

```
     YOU (Human)
         |
         |  "Add auth"
         v
    +-----------+
    |  CLAUDE   |-->  Reads grounding docs + ledger (empty)
    |   CODE    |     Adds OAuth with PKCE
    +-----+-----+    Writes entry with reasoning
          |
          |  (Rate limit, switch)
          v
    +-----------+
    |  CURSOR   |-->  Reads grounding docs + ledger
    |           |     Sees Claude's OAuth work + WHY
    +-----+-----+    Adds refresh tokens
          |           Writes entry with reasoning
          |
          v
    +-----------+
    |  COPILOT  |-->  Reads grounding docs + ledger
    |           |     Full context preserved
    +-----------+     Builds on prior decisions
```

Every agent reads the same grounding docs and the same ledger. Decisions compound instead of repeating.

---

## Commands

### Setup

| Command | Description |
|---------|-------------|
| `ledgersync init` | Initialize LedgerSync in your project |
| `ledgersync integrate <agents>` | Connect your AI tools (claude-code, copilot, cursor, codex) |
| `ledgersync integrate --all` | Connect all supported tools |

### Grounding

| Command | Description |
|---------|-------------|
| `ledgersync ground add <path>` | Register a doc as required reading for all agents |
| `ledgersync ground list` | Show registered grounding docs |
| `ledgersync ground remove <path>` | Unregister a grounding doc |

### Daily Use

| Command | Description |
|---------|-------------|
| `ledgersync log` | See what your agents have been doing |
| `ledgersync summary` | Get context to hand off to a new agent |
| `ledgersync add` | Manually log a decision |
| `ledgersync validate` | Check that everything is set up correctly |

---

## Entry Schema — Rich Reasoning Traces

Every ledger entry captures **what** happened, **why**, and how it aligns with your product:

```typescript
{
  id: "uuid",
  timestamp: "2026-01-16T02:00:00Z",
  agent: { name: "claude-code", model: "claude-sonnet-4-20250514" },

  // WHAT happened
  action: { type: "modify", summary: "Added PKCE flow for OAuth2" },
  artifacts: [{ path: "src/auth.ts", action: "modified" }],

  // WHY it happened (most valuable)
  reasoning: {
    intent: "User needs OAuth for SPA clients",
    considerations: ["Rejected implicit flow — deprecated"],
    uncertainties: ["Unclear if refresh tokens needed"],
    confidence: 0.85
  },

  // HOW it aligns with the product
  grounding: {
    philosophyRefs: ["./docs/philosophy.md"],
    alignmentNotes: "PKCE chosen over implicit — security-first principle"
  }
}
```

---

## Configuration

`.ledgersync/config.yaml` controls your project settings:

```yaml
version: "0.1"
project:
  name: "My Project"
  description: "A privacy-first social platform"

philosophy:
  required:                    # Grounding docs — agents MUST read these
    - docs/philosophy.md
    - docs/design.md

codebases: []                  # Multi-codebase support

ledger:
  maxEntriesToLoad: 20         # How many entries agents read on start
  summarizeAfter: 50           # When to suggest summarization

constraints:                   # Rules agents must follow
  - id: no-tracking
    description: "Never add user tracking without explicit consent"
    severity: critical         # critical | high | medium | low
```

---

## Agent Integration

`ledgersync integrate` handles everything automatically:

```bash
# Pick your tools
ledgersync integrate claude-code cursor
ledgersync integrate copilot
ledgersync integrate codex

# Or all at once
ledgersync integrate --all
```

| Agent | File Created |
|-------|-------------|
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursorrules` |
| Codex / Jules | `AGENTS.md` |

If the file already exists (e.g., you have an existing `CLAUDE.md`), LedgerSync appends its integration block instead of overwriting.

---

## Project Structure

```
your-project/
├── .ledgersync/
│   ├── config.yaml          # Grounding docs, constraints, settings
│   └── ledger.jsonl         # Append-only decision log
├── docs/
│   ├── philosophy.md        # Your product's DNA
│   ├── design.md            # Design system and aesthetic
│   └── user_research.md     # Who you're building for
├── CLAUDE.md                # Agent instructions (Claude Code)
├── AGENTS.md                # Agent instructions (Codex / Jules)
├── .cursorrules             # Agent instructions (Cursor)
└── src/                     # Your code
```

---

## Philosophy

1. **File-first**: No servers, no accounts. Every agent can read and write files.
2. **Append-only**: The ledger is immutable. Never delete entries.
3. **Reasoning over actions**: The "why" matters more than the "what".
4. **Grounding drives decisions**: Agents build with your product's DNA, not generic defaults.
5. **Agents can disagree**: Override is okay, but document why.
6. **Human is authority**: AI suggests, you decide.

---

## Research

LedgerSync is the subject of active academic research on multi-agent coordination:

**IJCAI-ECAI 2026 Demos Track** (submitted): *"LedgerSync: Enabling the Senior Engineer's Instinct Within AI Coding Agents"*

---

## License

MIT © Abu Syed
