/**
 * Promise operations: read, append, resolve, query
 * 
 * Promises enable bilateral commitments between agents.
 * They are stored in promises.jsonl, separate from the action ledger.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { v4 as uuidv4 } from 'uuid';
import type { PromiseEntry, PromiseType, PromiseStatus, PromiseScope } from './types.js';
import { LEDGERSYNC_DIR } from './ledger.js';

// Load JSON schema using createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const promiseSchema = require('./schema/promise.schema.json');

// ============================================
// CONSTANTS
// ============================================

export const PROMISES_FILE = 'promises.jsonl';

// ============================================
// VALIDATION
// ============================================

import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
const Ajv = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validatePromise = ajv.compile(promiseSchema);

export function isValidPromise(promise: unknown): promise is PromiseEntry {
    return validatePromise(promise) as boolean;
}

export function getPromiseValidationErrors(): string[] {
    return validatePromise.errors?.map(e => `${e.instancePath} ${e.message}`) ?? [];
}

// ============================================
// PATH UTILITIES
// ============================================

export function getPromisesPath(root: string): string {
    return path.join(root, LEDGERSYNC_DIR, PROMISES_FILE);
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Read all promises from the ledger
 */
export function readPromises(root: string): PromiseEntry[] {
    const promisesPath = getPromisesPath(root);

    if (!fs.existsSync(promisesPath)) {
        return [];
    }

    const content = fs.readFileSync(promisesPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    return lines.map((line, index) => {
        try {
            return JSON.parse(line) as PromiseEntry;
        } catch (e) {
            throw new Error(`Invalid JSON on line ${index + 1}: ${(e as Error).message}`);
        }
    });
}

/**
 * Read only active promises
 */
export function readActivePromises(root: string): PromiseEntry[] {
    return readPromises(root).filter(p => p.status === 'active');
}

/**
 * Read last N promises
 */
export function readLastNPromises(root: string, n: number): PromiseEntry[] {
    const promises = readPromises(root);
    return promises.slice(-n);
}

/**
 * Get a single promise by ID
 */
export function getPromiseById(root: string, id: string): PromiseEntry | undefined {
    return readPromises(root).find(p => p.id === id);
}

/**
 * Get promises made BY an agent (agent is the promiser)
 */
export function getPromisesByAgent(root: string, agentName: string): PromiseEntry[] {
    return readPromises(root).filter(p => p.promiser.agent === agentName);
}

/**
 * Get promises made TO an agent (agent is the promisee)
 */
export function getPromisesForAgent(root: string, agentName: string): PromiseEntry[] {
    return readPromises(root).filter(p => 
        p.promisee.agent === agentName || p.promisee.agent === '*'
    );
}

/**
 * Get promises related to a specific file
 */
export function getPromisesForFile(root: string, filePath: string): PromiseEntry[] {
    return readPromises(root).filter(p => 
        p.context?.artifacts?.some(a => a.includes(filePath))
    );
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Append a new promise to the ledger
 */
export function appendPromise(root: string, promise: PromiseEntry): void {
    const promisesPath = getPromisesPath(root);

    // Validate before writing
    if (!isValidPromise(promise)) {
        throw new Error(`Invalid promise: ${getPromiseValidationErrors().join(', ')}`);
    }

    // Ensure directory exists
    const dir = path.dirname(promisesPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Append with newline
    const line = JSON.stringify(promise) + '\n';
    fs.appendFileSync(promisesPath, line, 'utf-8');
}

/**
 * Factory function to create a new promise
 */
export function createPromise(
    promiser: { agent: string; session?: string },
    promisee: { agent: string; scope?: PromiseScope },
    promise: { type: PromiseType; summary: string; description?: string; conditions?: string[] },
    context?: PromiseEntry['context'],
    tags?: string[]
): PromiseEntry {
    return {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        promiser,
        promisee,
        promise,
        context,
        status: 'active',
        tags,
    };
}

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Resolve a promise (update its status)
 * 
 * Note: This rewrites the file because JSONL doesn't support in-place updates.
 * For large ledgers, consider a more efficient approach.
 */
export function resolvePromise(
    root: string,
    promiseId: string,
    status: PromiseStatus,
    resolvedBy?: string
): PromiseEntry | null {
    const promises = readPromises(root);
    const index = promises.findIndex(p => p.id === promiseId);

    if (index === -1) {
        return null;
    }

    // Update the promise
    promises[index] = {
        ...promises[index],
        status,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
    };

    // Rewrite the file
    const promisesPath = getPromisesPath(root);
    const content = promises.map(p => JSON.stringify(p)).join('\n') + '\n';
    fs.writeFileSync(promisesPath, content, 'utf-8');

    return promises[index];
}

/**
 * Supersede a promise with another
 */
export function supersedePromise(
    root: string,
    oldPromiseId: string,
    newPromiseId: string
): PromiseEntry | null {
    const promises = readPromises(root);
    const index = promises.findIndex(p => p.id === oldPromiseId);

    if (index === -1) {
        return null;
    }

    // Update the old promise
    promises[index] = {
        ...promises[index],
        status: 'superseded',
        supersededBy: newPromiseId,
        resolvedAt: new Date().toISOString(),
    };

    // Rewrite the file
    const promisesPath = getPromisesPath(root);
    const content = promises.map(p => JSON.stringify(p)).join('\n') + '\n';
    fs.writeFileSync(promisesPath, content, 'utf-8');

    return promises[index];
}

/**
 * Withdraw a promise
 */
export function withdrawPromise(
    root: string,
    promiseId: string
): PromiseEntry | null {
    return resolvePromise(root, promiseId, 'withdrawn');
}

// ============================================
// VALIDATION OPERATIONS
// ============================================

/**
 * Validate all promises in the ledger
 */
export function validatePromises(root: string): { valid: boolean; errors: string[] } {
    const promisesPath = getPromisesPath(root);

    if (!fs.existsSync(promisesPath)) {
        return { valid: true, errors: [] };
    }

    const content = fs.readFileSync(promisesPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const errors: string[] = [];

    lines.forEach((line, index) => {
        try {
            const promise = JSON.parse(line);
            if (!isValidPromise(promise)) {
                errors.push(`Line ${index + 1}: ${getPromiseValidationErrors().join(', ')}`);
            }
        } catch (e) {
            errors.push(`Line ${index + 1}: Invalid JSON - ${(e as Error).message}`);
        }
    });

    return { valid: errors.length === 0, errors };
}

// ============================================
// SUMMARY OPERATIONS
// ============================================

/**
 * Get summary statistics for promises
 */
export function getPromiseSummary(root: string): {
    total: number;
    active: number;
    fulfilled: number;
    broken: number;
    withdrawn: number;
    superseded: number;
    byAgent: Record<string, number>;
} {
    const promises = readPromises(root);
    
    const byStatus = {
        active: 0,
        fulfilled: 0,
        broken: 0,
        withdrawn: 0,
        superseded: 0,
    };

    const byAgent: Record<string, number> = {};

    for (const p of promises) {
        byStatus[p.status]++;
        byAgent[p.promiser.agent] = (byAgent[p.promiser.agent] || 0) + 1;
    }

    return {
        total: promises.length,
        ...byStatus,
        byAgent,
    };
}

/**
 * Format promise summary for display
 */
export function formatPromiseSummary(root: string): string {
    const summary = getPromiseSummary(root);
    const active = readActivePromises(root);

    const lines = [
        '## Promise Status',
        '',
        `**Total:** ${summary.total} | **Active:** ${summary.active} | **Fulfilled:** ${summary.fulfilled} | **Broken:** ${summary.broken}`,
        '',
    ];

    if (active.length > 0) {
        lines.push('### Active Promises');
        for (const p of active.slice(-10)) {
            const confidence = p.context?.relatedEntries?.length ? '📎' : '';
            lines.push(`- [${p.promiser.agent}] ${p.promise.type}: "${p.promise.summary}" ${confidence}`);
        }
        lines.push('');
    }

    if (Object.keys(summary.byAgent).length > 0) {
        lines.push('### Promises by Agent');
        for (const [agent, count] of Object.entries(summary.byAgent)) {
            lines.push(`- ${agent}: ${count}`);
        }
    }

    return lines.join('\n');
}
