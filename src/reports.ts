/**
 * Report operations: read, append, query
 * 
 * Work reports track progress on promises.
 * Key insight: Actors report facts, not judgments.
 * Only humans/witnesses can write verdicts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { v4 as uuidv4 } from 'uuid';
import type { WorkReport, ReporterRole, VerdictStatus } from './types.js';
import { LEDGERSYNC_DIR } from './ledger.js';
import { resolvePromise, getPromiseById } from './promises.js';

// Load JSON schema using createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const reportSchema = require('./schema/report.schema.json');

// ============================================
// CONSTANTS
// ============================================

export const REPORTS_FILE = 'reports.jsonl';

// ============================================
// VALIDATION
// ============================================

import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
const Ajv = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateReport = ajv.compile(reportSchema);

export function isValidReport(report: unknown): report is WorkReport {
    return validateReport(report) as boolean;
}

export function getReportValidationErrors(): string[] {
    return validateReport.errors?.map(e => `${e.instancePath} ${e.message}`) ?? [];
}

// ============================================
// PATH UTILITIES
// ============================================

export function getReportsPath(root: string): string {
    return path.join(root, LEDGERSYNC_DIR, REPORTS_FILE);
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Read all reports from the ledger
 */
export function readReports(root: string): WorkReport[] {
    const reportsPath = getReportsPath(root);

    if (!fs.existsSync(reportsPath)) {
        return [];
    }

    const content = fs.readFileSync(reportsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    return lines.map((line, index) => {
        try {
            return JSON.parse(line) as WorkReport;
        } catch (e) {
            throw new Error(`Invalid JSON on line ${index + 1}: ${(e as Error).message}`);
        }
    });
}

/**
 * Read last N reports
 */
export function readLastNReports(root: string, n: number): WorkReport[] {
    const reports = readReports(root);
    return reports.slice(-n);
}

/**
 * Get a single report by ID
 */
export function getReportById(root: string, id: string): WorkReport | undefined {
    return readReports(root).find(r => r.id === id);
}

/**
 * Get all reports for a specific promise
 */
export function getReportsForPromise(root: string, promiseId: string): WorkReport[] {
    return readReports(root).filter(r => r.promiseId === promiseId);
}

/**
 * Get reports by a specific agent
 */
export function getReportsByAgent(root: string, agentName: string): WorkReport[] {
    return readReports(root).filter(r => r.reporter.agent === agentName);
}

/**
 * Get reports with verdicts only
 */
export function getReportsWithVerdicts(root: string): WorkReport[] {
    return readReports(root).filter(r => r.verdict !== undefined);
}

/**
 * Get the latest report for a promise
 */
export function getLatestReportForPromise(root: string, promiseId: string): WorkReport | undefined {
    const reports = getReportsForPromise(root, promiseId);
    return reports.length > 0 ? reports[reports.length - 1] : undefined;
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Append a new report to the ledger
 */
export function appendReport(root: string, report: WorkReport): void {
    const reportsPath = getReportsPath(root);

    // Validate before writing
    if (!isValidReport(report)) {
        throw new Error(`Invalid report: ${getReportValidationErrors().join(', ')}`);
    }

    // Ensure directory exists
    const dir = path.dirname(reportsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Append with newline
    const line = JSON.stringify(report) + '\n';
    fs.appendFileSync(reportsPath, line, 'utf-8');
}

/**
 * Factory function to create a work report (no verdict)
 */
export function createWorkReport(
    reporter: { agent: string; role: ReporterRole; session?: string },
    promiseId: string,
    report: {
        workCompleted: string;
        remaining?: string[];
        blockers?: string[];
        confidenceInCompletion: number;
    },
    relatedEntries?: string[],
    tags?: string[]
): WorkReport {
    return {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        reporter,
        promiseId,
        report,
        relatedEntries,
        tags,
    };
}

/**
 * Factory function to create a verdict report
 * Only humans or witnesses should call this
 */
export function createVerdictReport(
    reporter: { agent: string; role: 'witness' | 'human'; session?: string },
    promiseId: string,
    verdict: { status: VerdictStatus; reasoning: string },
    workCompleted: string = 'Reviewed promise fulfillment',
    relatedEntries?: string[],
    tags?: string[]
): WorkReport {
    return {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        reporter,
        promiseId,
        report: {
            workCompleted,
            confidenceInCompletion: verdict.status === 'fulfilled' ? 1.0 : 
                                    verdict.status === 'partial' ? 0.5 : 0.0,
        },
        verdict,
        relatedEntries,
        tags,
    };
}

/**
 * Add a verdict to an existing promise and update its status
 * This creates a report AND updates the promise status
 */
export function addVerdict(
    root: string,
    promiseId: string,
    verdictStatus: VerdictStatus,
    reasoning: string,
    reporterAgent: string = 'human'
): { report: WorkReport; promise: ReturnType<typeof getPromiseById> } | null {
    // Verify promise exists
    const promise = getPromiseById(root, promiseId);
    if (!promise) {
        return null;
    }

    // Create verdict report
    const report = createVerdictReport(
        { agent: reporterAgent, role: 'human' },
        promiseId,
        { status: verdictStatus, reasoning }
    );

    // Append report
    appendReport(root, report);

    // Map verdict status to promise status
    const promiseStatus = verdictStatus === 'fulfilled' ? 'fulfilled' :
                          verdictStatus === 'broken' ? 'broken' : 'active';

    // Update promise if verdict is final
    let updatedPromise = promise;
    if (promiseStatus !== 'active') {
        updatedPromise = resolvePromise(root, promiseId, promiseStatus, report.id) ?? promise;
    }

    return { report, promise: updatedPromise };
}

// ============================================
// VALIDATION OPERATIONS
// ============================================

/**
 * Validate all reports in the ledger
 */
export function validateReports(root: string): { valid: boolean; errors: string[] } {
    const reportsPath = getReportsPath(root);

    if (!fs.existsSync(reportsPath)) {
        return { valid: true, errors: [] };
    }

    const content = fs.readFileSync(reportsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const errors: string[] = [];

    lines.forEach((line, index) => {
        try {
            const report = JSON.parse(line);
            if (!isValidReport(report)) {
                errors.push(`Line ${index + 1}: ${getReportValidationErrors().join(', ')}`);
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
 * Get summary statistics for reports
 */
export function getReportSummary(root: string): {
    total: number;
    withVerdicts: number;
    byAgent: Record<string, number>;
    verdictCounts: { fulfilled: number; partial: number; broken: number };
} {
    const reports = readReports(root);
    
    const byAgent: Record<string, number> = {};
    const verdictCounts = { fulfilled: 0, partial: 0, broken: 0 };
    let withVerdicts = 0;

    for (const r of reports) {
        byAgent[r.reporter.agent] = (byAgent[r.reporter.agent] || 0) + 1;
        
        if (r.verdict) {
            withVerdicts++;
            verdictCounts[r.verdict.status]++;
        }
    }

    return {
        total: reports.length,
        withVerdicts,
        byAgent,
        verdictCounts,
    };
}

/**
 * Calculate average confidence for a promise based on reports
 */
export function getAverageConfidenceForPromise(root: string, promiseId: string): number {
    const reports = getReportsForPromise(root, promiseId);
    
    if (reports.length === 0) {
        return 0;
    }

    const total = reports.reduce((sum, r) => sum + r.report.confidenceInCompletion, 0);
    return total / reports.length;
}

/**
 * Format report summary for display
 */
export function formatReportSummary(root: string): string {
    const summary = getReportSummary(root);
    const recent = readLastNReports(root, 5);

    const lines = [
        '## Work Reports',
        '',
        `**Total:** ${summary.total} | **With Verdicts:** ${summary.withVerdicts}`,
        '',
    ];

    if (summary.withVerdicts > 0) {
        lines.push('### Verdicts');
        lines.push(`- Fulfilled: ${summary.verdictCounts.fulfilled}`);
        lines.push(`- Partial: ${summary.verdictCounts.partial}`);
        lines.push(`- Broken: ${summary.verdictCounts.broken}`);
        lines.push('');
    }

    if (recent.length > 0) {
        lines.push('### Recent Reports');
        for (const r of recent) {
            const verdict = r.verdict ? ` → ${r.verdict.status}` : '';
            const confidence = `(${Math.round(r.report.confidenceInCompletion * 100)}%)`;
            lines.push(`- [${r.reporter.agent}] ${r.report.workCompleted} ${confidence}${verdict}`);
        }
    }

    return lines.join('\n');
}
