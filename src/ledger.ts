/**
 * Core ledger operations: read, append, validate
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { v4 as uuidv4 } from 'uuid';
import type { LedgerEntry, LedgerSummary } from './types.js';

// Load JSON schema using createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const entrySchema = require('./schema/entry.schema.json');

// ============================================
// CONSTANTS
// ============================================

export const LEDGERSYNC_DIR = '.ledgersync';
export const LEDGER_FILE = 'ledger.jsonl';
export const CONFIG_FILE = 'config.yaml';

// ============================================
// VALIDATION
// ============================================

// ESM compatibility for CJS modules
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
const Ajv = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateEntry = ajv.compile(entrySchema);

export function isValidEntry(entry: unknown): entry is LedgerEntry {
    return validateEntry(entry) as boolean;
}

export function getValidationErrors(): string[] {
    return validateEntry.errors?.map(e => `${e.instancePath} ${e.message}`) ?? [];
}

// ============================================
// PATH UTILITIES
// ============================================

export function findLedgersyncRoot(startDir: string = process.cwd()): string | null {
    let current = startDir;

    while (current !== path.parse(current).root) {
        const metacogPath = path.join(current, LEDGERSYNC_DIR);
        if (fs.existsSync(metacogPath)) {
            return current;
        }
        current = path.dirname(current);
    }

    return null;
}

export function getLedgerPath(root: string): string {
    return path.join(root, LEDGERSYNC_DIR, LEDGER_FILE);
}

export function getConfigPath(root: string): string {
    return path.join(root, LEDGERSYNC_DIR, CONFIG_FILE);
}

// ============================================
// READ OPERATIONS
// ============================================

export function readLedger(root: string): LedgerEntry[] {
    const ledgerPath = getLedgerPath(root);

    if (!fs.existsSync(ledgerPath)) {
        return [];
    }

    const content = fs.readFileSync(ledgerPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    return lines.map((line, index) => {
        try {
            return JSON.parse(line) as LedgerEntry;
        } catch (e) {
            throw new Error(`Invalid JSON on line ${index + 1}: ${(e as Error).message}`);
        }
    });
}

export function readLastN(root: string, n: number): LedgerEntry[] {
    const entries = readLedger(root);
    return entries.slice(-n);
}

export function readByAgent(root: string, agentName: string): LedgerEntry[] {
    const entries = readLedger(root);
    return entries.filter(e => e.agent.name === agentName);
}

export function readByFile(root: string, filePath: string): LedgerEntry[] {
    const entries = readLedger(root);
    return entries.filter(e =>
        e.artifacts.some(a => a.path === filePath || a.path.includes(filePath))
    );
}

// ============================================
// WRITE OPERATIONS
// ============================================

export function appendEntry(root: string, entry: LedgerEntry): void {
    const ledgerPath = getLedgerPath(root);

    // Validate before writing
    if (!isValidEntry(entry)) {
        throw new Error(`Invalid entry: ${getValidationErrors().join(', ')}`);
    }

    // Ensure directory exists
    const dir = path.dirname(ledgerPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Append with newline
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(ledgerPath, line, 'utf-8');
}

export function createEntry(
    agent: LedgerEntry['agent'],
    action: LedgerEntry['action'],
    reasoning: LedgerEntry['reasoning'],
    options: Partial<Omit<LedgerEntry, 'id' | 'timestamp' | 'agent' | 'action' | 'reasoning'>> = {}
): LedgerEntry {
    return {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        agent,
        session: options.session ?? { id: uuidv4(), entryIndex: 0 },
        action,
        reasoning,
        tools: options.tools ?? [],
        artifacts: options.artifacts ?? [],
        userPrompt: options.userPrompt,
        tags: options.tags,
        relatedEntries: options.relatedEntries,
        grounding: options.grounding,
    };
}

// ============================================
// SUMMARY OPERATIONS
// ============================================

export function generateSummary(root: string, lastN: number = 20): LedgerSummary {
    const entries = readLastN(root, lastN);

    if (entries.length === 0) {
        return {
            totalEntries: 0,
            lastUpdated: 'Never',
            recentAgents: [],
            recentFiles: [],
            keyDecisions: [],
        };
    }

    const allEntries = readLedger(root);
    const recentAgents = [...new Set(entries.map(e => e.agent.name))];
    const recentFiles = [...new Set(entries.flatMap(e => e.artifacts.map(a => a.path)))];
    const keyDecisions = entries
        .filter(e => e.reasoning.confidence === undefined || e.reasoning.confidence >= 0.7)
        .map(e => `[${e.agent.name}] ${e.action.summary}`)
        .slice(-10);

    return {
        totalEntries: allEntries.length,
        lastUpdated: entries[entries.length - 1].timestamp,
        recentAgents,
        recentFiles: recentFiles.slice(0, 20),
        keyDecisions,
    };
}

export function formatSummaryForAgent(summary: LedgerSummary): string {
    const lines = [
        '## 🧠 Context from Previous Agents',
        '',
        `**Total entries:** ${summary.totalEntries}`,
        `**Last updated:** ${summary.lastUpdated}`,
        '',
        '### Recent Agents',
        summary.recentAgents.map(a => `- ${a}`).join('\n'),
        '',
        '### Recent Files Touched',
        summary.recentFiles.map(f => `- ${f}`).join('\n'),
        '',
        '### Key Decisions',
        summary.keyDecisions.map(d => `- ${d}`).join('\n'),
    ];

    return lines.join('\n');
}

// ============================================
// VALIDATION OPERATIONS
// ============================================

export function validateLedger(root: string): { valid: boolean; errors: string[] } {
    const ledgerPath = getLedgerPath(root);

    if (!fs.existsSync(ledgerPath)) {
        return { valid: true, errors: [] };
    }

    const content = fs.readFileSync(ledgerPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const errors: string[] = [];

    lines.forEach((line, index) => {
        try {
            const entry = JSON.parse(line);
            if (!isValidEntry(entry)) {
                errors.push(`Line ${index + 1}: ${getValidationErrors().join(', ')}`);
            }
        } catch (e) {
            errors.push(`Line ${index + 1}: Invalid JSON - ${(e as Error).message}`);
        }
    });

    return { valid: errors.length === 0, errors };
}
