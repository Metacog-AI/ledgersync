# LedgerSync

> **Shared memory for your AI coding assistants.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

You use Claude Code. You hit rate limits. You switch to Cursor. 

**Cursor asks:** "What are we working on?"

You explain everything again. Context lost. Decisions undone. Time wasted.

## The Solution

A shared ledger that all your AI coding tools read and write:

```
.ledgersync/
├── config.yaml    # Philosophy docs, constraints
└── ledger.jsonl   # Append-only decision log
```

**Claude writes:** "Added OAuth2 with PKCE because user needs SPA support"  
**Cursor reads:** "Got it. I'll add refresh token rotation next."

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g metacog-ledgersync

# Initialize in your project
cd /your/project
ledgersync init --name "My Project"

# View what other agents did
ledgersync log --last 10

# Get summary to paste to new agent
ledgersync summary
```

---

## 📋 Prime Directive

```
AGENTS MUST LOG. NO EXCEPTIONS.
```

Every AI response that changes code MUST append to the ledger. The system fails silently if agents forget.

---

## 🏗️ How It Works

```
     YOU (Human)
         │
         │ "Add auth"
         ▼
    ┌─────────┐
    │  CLAUDE │──▶ Reads ledger (empty)
    │         │    Adds OAuth
    └────┬────┘    Writes entry ✍️
         │
         │ (Rate limit, switch)
         ▼
    ┌─────────┐
    │ CURSOR  │──▶ Reads ledger
    │         │    Sees Claude's OAuth work + WHY
    └────┬────┘    Adds refresh tokens
         │         Writes entry ✍️
         │
         ▼
    ┌─────────┐
    │ANTIGRAV │──▶ Reads ledger
    │  ITY    │    Full context preserved
    └─────────┘
```

---

## 📝 Entry Schema

```typescript
{
  id: "uuid",
  timestamp: "2026-01-16T02:00:00Z",
  agent: { name: "claude-code", model: "claude-sonnet-4-20250514" },
  
  // WHAT happened
  action: { type: "modify", summary: "Added PKCE flow" },
  artifacts: [{ path: "src/auth.ts", action: "modified" }],
  
  // WHY it happened (most valuable!)
  reasoning: {
    intent: "User needs OAuth for SPA clients",
    considerations: ["Rejected implicit flow - deprecated"],
    uncertainties: ["Unclear if refresh tokens needed"]
  }
}
```

---

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `ledgersync init` | Initialize `.ledgersync/` folder |
| `ledgersync log` | View recent entries |
| `ledgersync summary` | Get context for new agent |
| `ledgersync validate` | Check ledger integrity |
| `ledgersync add` | Manually add entry |
| `ledgersync promise add` | Create a bilateral promise |
| `ledgersync promise list` | View active promises |
| `ledgersync report add` | File a work report |
| `ledgersync status` | Overview of promises and reports |

---

## 🤖 Agent Setup

Copy templates to your project:

### Claude Code
```bash
cat node_modules/metacog-ledgersync/templates/CLAUDE.md >> CLAUDE.md
```

### Cursor
```bash
cat node_modules/metacog-ledgersync/templates/.cursorrules >> .cursorrules
```

### OpenAI Codex
```bash
cat node_modules/metacog-ledgersync/templates/CLAUDE.md >> AGENTS.md
```

### Antigravity
Reference `templates/ANTIGRAVITY.md` in your prompts.

---

## 📁 Project Structure

```
your-project/
├── .ledgersync/                 # Shared brain
│   ├── config.yaml           # Philosophy + constraints
│   └── ledger.jsonl          # Decision log
├── CLAUDE.md                 # + LedgerSync rules
├── .cursorrules              # + LedgerSync rules
└── src/                      # Your code
```

---

## 🎯 Philosophy

1. **File-first**: Zero dependencies. Every agent can read/write files.
2. **Append-only**: History is immutable. Never delete entries.
3. **Reasoning > Actions**: The "why" matters more than "what".
4. **Agents can disagree**: Override is okay, but document why.
5. **Human is authority**: AI suggests, you decide.

---

## 📚 Documentation

- [Value Propositions](docs/value_propositions.md) - Philosophy and vision
- [Architecture](docs/ARCHITECTURE.md) - How it works
- [Contributing](docs/CONTRIBUTING.md) - How to contribute

---

## 🔬 Research

LedgerSync is the subject of active academic research on multi-agent coordination:

**IJCAI-ECAI 2026 Demos Track** (submitted): *"LedgerSync: Enabling the Senior Engineer's Instinct Within AI Coding Agents"*

---

## License

MIT © Abu Syed
