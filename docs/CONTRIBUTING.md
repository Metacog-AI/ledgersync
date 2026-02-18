# Contributing to LedgerSync

Thank you for your interest in contributing to LedgerSync! This project aims to solve the multi-agent context problem for developers using multiple AI coding tools.

---

## 🎯 Prime Directive

```
AGENTS MUST LOG. NO EXCEPTIONS.
```

Every contribution should reinforce this principle. If agents forget to log, the entire system fails.

---

## 🏗️ Project Philosophy

Before contributing, understand our core principles:

1. **File-first**: Zero dependencies. Every agent can read/write files.
2. **Append-only**: History is immutable. Never delete entries.
3. **Reasoning > Actions**: The "why" matters more than "what".
4. **Open protocol**: This is a spec, not just an implementation.

Read [Value Propositions](value_propositions.md) for the full philosophy.

---

## 📦 Project Structure

```
LedgerSync/
├── src/
│   ├── types.ts           # TypeScript interfaces
│   ├── schema/
│   │   └── entry.schema.json  # JSON Schema
│   ├── ledger.ts          # Core operations
│   ├── cli.ts             # CLI commands
│   └── index.ts           # Package exports
│
├── templates/             # Agent integration templates
│   ├── CLAUDE.md
│   ├── .cursorrules
│   └── ANTIGRAVITY.md
│
├── docs/                  # Documentation
│   ├── value_propositions.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md    # You are here
│
└── dist/                  # Built output (gitignored)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Clone the repo
git clone https://github.com/AbuSyed244/metacog-ledgersync.git
cd metacog-ledgersync

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run dev -- init --name "Test"
```

---

## 🔧 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow our coding standards:
- TypeScript strict mode
- ESM imports (`import x from 'node:fs'`)
- Explicit types (no `any`)

### 3. Test Your Changes

```bash
# Build
npm run build

# Test commands
node dist/cli.js init --name "Test"
node dist/cli.js add --summary "Test entry" --intent "Testing"
node dist/cli.js log
node dist/cli.js validate
```

### 4. Update Documentation

If you change:
- CLI commands → Update README.md
- Schema → Update types.ts AND entry.schema.json
- Agent behavior → Update templates/

### 5. Submit PR

- Clear description of what changed
- Reference any issues
- Include test evidence (screenshots of CLI output)

---

## 📋 Contribution Areas

### High Priority

| Area | Description |
|------|-------------|
| **Guardrails** | How to ensure agents ALWAYS log (our biggest risk) |
| **Agent Templates** | Improve instructions for Claude, Cursor, Copilot, others |
| **Schema Evolution** | How to handle schema changes without breaking old entries |
| **Conflict Detection** | Smarter algorithms for detecting agent conflicts |

### Medium Priority

| Area | Description |
|------|-------------|
| **CLI UX** | Better output formatting, colors, progress indicators |
| **Validation** | More helpful error messages |
| **Documentation** | More examples, tutorials, use cases |

### Future

| Area | Description |
|------|-------------|
| **Indexing** | SQLite layer for queries (optional dependency) |
| **Semantic Search** | Vector embeddings for finding related entries |
| **MCP Integration** | Expose ledger as MCP resource |

---

## 🧪 Testing

We use Vitest for testing:

```bash
npm test
```

### Test Categories

1. **Schema Validation**: Malformed entries rejected
2. **CLI Commands**: All commands produce expected output
3. **JSONL Integrity**: Append operations don't corrupt file

---

## 📐 Code Style

### TypeScript

```typescript
// ✅ Good: Explicit imports, types
import fs from 'node:fs';
import type { LedgerEntry } from './types.js';

function appendEntry(root: string, entry: LedgerEntry): void {
  // ...
}

// ❌ Bad: Implicit, any types
import * as fs from 'fs';

function appendEntry(root, entry) {
  // ...
}
```

### JSON Schema

Keep in sync with TypeScript types:

```json
{
  "properties": {
    "id": { "type": "string", "format": "uuid" }
  }
}
```

---

## 🔒 The Guardrails Problem

**Our biggest challenge**: Ensuring agents ALWAYS log.

If an agent forgets, we have:
- Incomplete history
- Broken context chain
- Silent failure (worst kind)

### Ideas We Need Help With

1. **Pre-commit hooks**: Detect new code changes → warn if no new ledger entry
2. **Agent-side enforcement**: Better prompts that make logging automatic
3. **Audit tools**: `ledgersync audit` to detect gaps
4. **Webhooks**: Notify when entry added (for monitoring)

If you have ideas, please open an issue or PR!

---

## 🐛 Reporting Issues

### Bug Reports

Include:
- OS and Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Ledger contents (if relevant, redact sensitive info)

### Feature Requests

Include:
- Use case description
- How it fits with project philosophy
- Proposed implementation (if you have one)

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You

Every contribution helps build the future of multi-agent development. We're building the memory layer for AI coding assistants.

**Together, we're building Jarvis.**
