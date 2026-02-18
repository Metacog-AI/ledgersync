#!/usr/bin/env node

/**
 * Metacog-LedgerSync CLI
 * Commands: init, log, summary, validate, add
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
    findLedgersyncRoot,
    LEDGERSYNC_DIR,
    LEDGER_FILE,
    CONFIG_FILE,
    readLastN,
    readLedger,
    appendEntry,
    createEntry,
    generateSummary,
    formatSummaryForAgent,
    validateLedger,
    getLedgerPath,
    getConfigPath,
} from './ledger.js';
import {
    PROMISES_FILE,
    readPromises,
    readActivePromises,
    appendPromise,
    createPromise,
    resolvePromise,
    withdrawPromise,
    getPromiseById,
    getPromisesByAgent,
    validatePromises,
    formatPromiseSummary,
    getPromiseSummary,
} from './promises.js';
import {
    REPORTS_FILE,
    readReports,
    appendReport,
    createWorkReport,
    addVerdict,
    getReportsForPromise,
    validateReports,
    formatReportSummary,
    getReportSummary,
} from './reports.js';
import type { LedgerConfig, PromiseType, PromiseStatus, VerdictStatus } from './types.js';

const program = new Command();

program
    .name('ledgersync')
    .description('Shared context ledger for multi-agent development')
    .version('0.1.0');

// ============================================
// INIT COMMAND
// ============================================

program
    .command('init')
    .description('Initialize .ledgersync folder in current directory')
    .option('-n, --name <name>', 'Project name', 'My Project')
    .action((options) => {
        const cwd = process.cwd();
        const ledgersyncDir = path.join(cwd, LEDGERSYNC_DIR);

        if (fs.existsSync(ledgersyncDir)) {
            console.log(chalk.yellow('⚠️  .ledgersync already exists'));
            return;
        }

        // Create directory
        fs.mkdirSync(ledgersyncDir, { recursive: true });

        // Create default config
        const config: LedgerConfig = {
            version: '0.1',
            project: {
                name: options.name,
                description: 'Initialized by ledgersync',
            },
            philosophy: {
                required: [],
                optional: ['../**/*.md'],
            },
            codebases: [],
            ledger: {
                maxEntriesToLoad: 20,
                summarizeAfter: 50,
            },
            constraints: [],
        };

        fs.writeFileSync(
            path.join(ledgersyncDir, CONFIG_FILE),
            stringifyYaml(config),
            'utf-8'
        );

        // Create empty ledger files
        fs.writeFileSync(path.join(ledgersyncDir, LEDGER_FILE), '', 'utf-8');
        fs.writeFileSync(path.join(ledgersyncDir, PROMISES_FILE), '', 'utf-8');
        fs.writeFileSync(path.join(ledgersyncDir, REPORTS_FILE), '', 'utf-8');

        // Copy agent templates to project root
        const templatesDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'templates');
        const templateMap: [string, string][] = [
            ['CLAUDE.md', 'CLAUDE.md'],
            ['CLAUDE.md', 'AGENTS.md'],
            ['.cursorrules', '.cursorrules'],
            ['ANTIGRAVITY.md', 'ANTIGRAVITY.md'],
        ];

        let copiedTemplates: string[] = [];
        if (fs.existsSync(templatesDir)) {
            for (const [src, dest] of templateMap) {
                const srcPath = path.join(templatesDir, src);
                const destPath = path.join(cwd, dest);
                if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
                    fs.copyFileSync(srcPath, destPath);
                    copiedTemplates.push(dest);
                }
            }
        }

        console.log(chalk.green('✅ Initialized .ledgersync/'));
        console.log(chalk.gray(`   Created: ${CONFIG_FILE}, ${LEDGER_FILE}, ${PROMISES_FILE}, ${REPORTS_FILE}`));
        if (copiedTemplates.length > 0) {
            console.log(chalk.green(`✅ Copied agent templates: ${copiedTemplates.join(', ')}`));
        }
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log('  1. Edit .ledgersync/config.yaml to register philosophy docs');
        console.log('  2. Run `ledgersync summary` to get context for agents');
    });

// ============================================
// LOG COMMAND
// ============================================

program
    .command('log')
    .description('View recent ledger entries')
    .option('-n, --last <n>', 'Number of entries to show', '10')
    .option('-a, --agent <name>', 'Filter by agent name')
    .option('-f, --file <path>', 'Filter by file touched')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        let entries = readLastN(root, parseInt(options.last, 10));

        if (options.agent) {
            entries = entries.filter(e => e.agent.name === options.agent);
        }

        if (options.file) {
            entries = entries.filter(e =>
                e.artifacts.some(a => a.path.includes(options.file))
            );
        }

        if (entries.length === 0) {
            console.log(chalk.yellow('No entries found.'));
            return;
        }

        if (options.json) {
            console.log(JSON.stringify(entries, null, 2));
            return;
        }

        // Pretty print
        entries.forEach((entry, i) => {
            const agentColor = getAgentColor(entry.agent.name);
            const time = new Date(entry.timestamp).toLocaleString();

            console.log('');
            console.log(chalk.gray(`─────────────────────────────────────────`));
            console.log(`${agentColor(entry.agent.name)} ${chalk.gray('•')} ${chalk.dim(time)}`);
            console.log(chalk.bold(entry.action.summary));
            console.log(chalk.gray(`Intent: ${entry.reasoning.intent}`));

            if (entry.artifacts.length > 0) {
                console.log(chalk.gray('Files:'));
                entry.artifacts.forEach(a => {
                    const icon = a.action === 'created' ? '➕' : a.action === 'modified' ? '📝' : a.action === 'deleted' ? '🗑️' : '👁️';
                    console.log(`  ${icon} ${a.path}`);
                });
            }
        });

        console.log('');
    });

// ============================================
// SUMMARY COMMAND
// ============================================

program
    .command('summary')
    .description('Get context summary for new agent')
    .option('-n, --last <n>', 'Number of entries to summarize', '20')
    .option('--markdown', 'Output as markdown (default)', true)
    .option('--json', 'Output as JSON')
    .option('--copy', 'Copy to clipboard')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const summary = generateSummary(root, parseInt(options.last, 10));

        if (options.json) {
            console.log(JSON.stringify(summary, null, 2));
            return;
        }

        const markdown = formatSummaryForAgent(summary);
        console.log(markdown);

        // TODO: Add clipboard support
    });

// ============================================
// VALIDATE COMMAND
// ============================================

program
    .command('validate')
    .description('Validate ledger schema')
    .action(() => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const { valid, errors } = validateLedger(root);

        if (valid) {
            const entries = readLedger(root);
            console.log(chalk.green(`✅ Ledger is valid (${entries.length} entries)`));
        } else {
            console.log(chalk.red('❌ Validation errors:'));
            errors.forEach(e => console.log(chalk.red(`   • ${e}`)));
            process.exit(1);
        }
    });

// ============================================
// ADD COMMAND (Manual entry)
// ============================================

program
    .command('add')
    .description('Manually add an entry')
    .requiredOption('-s, --summary <text>', 'Action summary')
    .requiredOption('-i, --intent <text>', 'Why you did this')
    .option('-t, --type <type>', 'Action type', 'other')
    .option('-a, --agent <name>', 'Agent name', 'human')
    .option('-f, --files <paths...>', 'Files touched (comma-separated)')
    .option('--tags <tags...>', 'Tags (comma-separated)')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const entry = createEntry(
            { name: options.agent },
            { type: options.type, summary: options.summary },
            { intent: options.intent },
            {
                artifacts: options.files?.map((f: string) => ({ path: f, action: 'modified' as const })) ?? [],
                tags: options.tags,
            }
        );

        appendEntry(root, entry);

        console.log(chalk.green('✅ Entry added'));
        console.log(chalk.gray(`   ID: ${entry.id}`));
    });

// ============================================
// PROMISE COMMANDS
// ============================================

const promiseCommand = program
    .command('promise')
    .description('Manage promises (bilateral commitments)');

// ledgersync promise add
promiseCommand
    .command('add')
    .description('Make a new promise')
    .requiredOption('-t, --type <type>', 'Promise type (will-do, will-not-do, will-maintain, will-provide)')
    .requiredOption('-s, --summary <text>', 'What you are promising')
    .option('--to <agent>', 'Target agent (default: * for any)', '*')
    .option('--agent <name>', 'Your agent name', 'human')
    .option('--scope <scope>', 'Promise scope (session, project, permanent)', 'project')
    .option('--conditions <items...>', 'Conditions for the promise')
    .option('--files <paths...>', 'Related files')
    .option('--tags <tags...>', 'Tags')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validTypes = ['will-do', 'will-not-do', 'will-maintain', 'will-provide'];
        if (!validTypes.includes(options.type)) {
            console.log(chalk.red(`❌ Invalid type. Must be one of: ${validTypes.join(', ')}`));
            process.exit(1);
        }

        const promise = createPromise(
            { agent: options.agent },
            { agent: options.to, scope: options.scope },
            { 
                type: options.type as PromiseType, 
                summary: options.summary,
                conditions: options.conditions,
            },
            options.files ? { artifacts: options.files } : undefined,
            options.tags
        );

        appendPromise(root, promise);

        console.log(chalk.green('✅ Promise created'));
        console.log(chalk.gray(`   ID: ${promise.id}`));
        console.log(chalk.gray(`   ${options.agent} → ${options.to}: ${options.type} "${options.summary}"`));
    });

// ledgersync promise list
promiseCommand
    .command('list')
    .description('List promises')
    .option('-n, --last <n>', 'Number of promises to show', '10')
    .option('-a, --agent <name>', 'Filter by promiser agent')
    .option('-s, --status <status>', 'Filter by status (active, fulfilled, broken, withdrawn, superseded)')
    .option('--active', 'Show only active promises')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        let promises = options.active ? readActivePromises(root) : readPromises(root);

        if (options.agent) {
            promises = promises.filter(p => p.promiser.agent === options.agent);
        }

        if (options.status) {
            promises = promises.filter(p => p.status === options.status);
        }

        promises = promises.slice(-parseInt(options.last, 10));

        if (promises.length === 0) {
            console.log(chalk.yellow('No promises found.'));
            return;
        }

        if (options.json) {
            console.log(JSON.stringify(promises, null, 2));
            return;
        }

        // Pretty print
        promises.forEach((p) => {
            const statusColor = getStatusColor(p.status);
            const time = new Date(p.timestamp).toLocaleString();

            console.log('');
            console.log(chalk.gray(`─────────────────────────────────────────`));
            console.log(`${chalk.bold(p.promise.type)} ${statusColor(`[${p.status}]`)}`);
            console.log(`${getAgentColor(p.promiser.agent)(p.promiser.agent)} → ${p.promisee.agent}`);
            console.log(chalk.white(`"${p.promise.summary}"`));
            console.log(chalk.dim(`ID: ${p.id.slice(0, 8)}... | ${time}`));

            if (p.promise.conditions?.length) {
                console.log(chalk.gray('Conditions:'));
                p.promise.conditions.forEach(c => console.log(`  • ${c}`));
            }
        });
        console.log('');
    });

// ledgersync promise resolve
promiseCommand
    .command('resolve <promise-id>')
    .description('Resolve a promise (fulfill, break, or withdraw)')
    .requiredOption('-s, --status <status>', 'New status (fulfilled, broken, withdrawn)')
    .action((promiseId, options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validStatuses = ['fulfilled', 'broken', 'withdrawn'];
        if (!validStatuses.includes(options.status)) {
            console.log(chalk.red(`❌ Invalid status. Must be one of: ${validStatuses.join(', ')}`));
            process.exit(1);
        }

        // Find promise by full or partial ID
        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`❌ Promise not found: ${promiseId}`));
            process.exit(1);
        }

        const updated = resolvePromise(root, promise.id, options.status as PromiseStatus);

        if (updated) {
            console.log(chalk.green(`✅ Promise resolved: ${options.status}`));
            console.log(chalk.gray(`   ${updated.promise.summary}`));
        } else {
            console.log(chalk.red('❌ Failed to resolve promise'));
        }
    });

// ledgersync promise withdraw
promiseCommand
    .command('withdraw <promise-id>')
    .description('Withdraw a promise')
    .action((promiseId) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        // Find promise by full or partial ID
        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`❌ Promise not found: ${promiseId}`));
            process.exit(1);
        }

        const updated = withdrawPromise(root, promise.id);

        if (updated) {
            console.log(chalk.green('✅ Promise withdrawn'));
            console.log(chalk.gray(`   ${updated.promise.summary}`));
        } else {
            console.log(chalk.red('❌ Failed to withdraw promise'));
        }
    });

// ============================================
// REPORT COMMANDS
// ============================================

const reportCommand = program
    .command('report')
    .description('Manage work reports on promises');

// ledgersync report add
reportCommand
    .command('add')
    .description('Add a work report for a promise')
    .requiredOption('-p, --promise <id>', 'Promise ID to report on')
    .requiredOption('-w, --work <text>', 'What work was completed')
    .option('-c, --confidence <n>', 'Confidence in completion (0.0-1.0)', '0.5')
    .option('-r, --remaining <items...>', 'Remaining work items')
    .option('-b, --blockers <items...>', 'Blockers')
    .option('-a, --agent <name>', 'Reporter agent name', 'human')
    .option('--role <role>', 'Reporter role (actor, witness, human)', 'actor')
    .option('--tags <tags...>', 'Tags')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        // Find promise by full or partial ID
        const promises = readPromises(root);
        const promise = promises.find(p => p.id === options.promise || p.id.startsWith(options.promise));

        if (!promise) {
            console.log(chalk.red(`❌ Promise not found: ${options.promise}`));
            process.exit(1);
        }

        const confidence = parseFloat(options.confidence);
        if (isNaN(confidence) || confidence < 0 || confidence > 1) {
            console.log(chalk.red('❌ Confidence must be a number between 0.0 and 1.0'));
            process.exit(1);
        }

        const report = createWorkReport(
            { agent: options.agent, role: options.role },
            promise.id,
            {
                workCompleted: options.work,
                remaining: options.remaining,
                blockers: options.blockers,
                confidenceInCompletion: confidence,
            },
            undefined,
            options.tags
        );

        appendReport(root, report);

        console.log(chalk.green('✅ Work report added'));
        console.log(chalk.gray(`   ID: ${report.id}`));
        console.log(chalk.gray(`   Promise: ${promise.promise.summary}`));
        console.log(chalk.gray(`   Confidence: ${Math.round(confidence * 100)}%`));
    });

// ledgersync report verdict
reportCommand
    .command('verdict <promise-id>')
    .description('Add a verdict on a promise (humans/witnesses only)')
    .requiredOption('-s, --status <status>', 'Verdict (fulfilled, partial, broken)')
    .requiredOption('-r, --reason <text>', 'Reasoning for verdict')
    .option('-a, --agent <name>', 'Reporter name', 'human')
    .action((promiseId, options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validStatuses = ['fulfilled', 'partial', 'broken'];
        if (!validStatuses.includes(options.status)) {
            console.log(chalk.red(`❌ Invalid verdict. Must be one of: ${validStatuses.join(', ')}`));
            process.exit(1);
        }

        // Find promise by full or partial ID
        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`❌ Promise not found: ${promiseId}`));
            process.exit(1);
        }

        const result = addVerdict(
            root,
            promise.id,
            options.status as VerdictStatus,
            options.reason,
            options.agent
        );

        if (result) {
            console.log(chalk.green(`✅ Verdict added: ${options.status}`));
            console.log(chalk.gray(`   Promise: ${promise.promise.summary}`));
            console.log(chalk.gray(`   Reason: ${options.reason}`));

            if (result.promise && result.promise.status !== 'active') {
                console.log(chalk.cyan(`   Promise status updated to: ${result.promise.status}`));
            }
        } else {
            console.log(chalk.red('❌ Failed to add verdict'));
        }
    });

// ledgersync report list
reportCommand
    .command('list')
    .description('List work reports')
    .option('-n, --last <n>', 'Number of reports to show', '10')
    .option('-p, --promise <id>', 'Filter by promise ID')
    .option('-a, --agent <name>', 'Filter by reporter agent')
    .option('--verdicts', 'Show only reports with verdicts')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        let reports = readReports(root);

        if (options.promise) {
            const promises = readPromises(root);
            const promise = promises.find(p => p.id === options.promise || p.id.startsWith(options.promise));
            if (promise) {
                reports = reports.filter(r => r.promiseId === promise.id);
            }
        }

        if (options.agent) {
            reports = reports.filter(r => r.reporter.agent === options.agent);
        }

        if (options.verdicts) {
            reports = reports.filter(r => r.verdict !== undefined);
        }

        reports = reports.slice(-parseInt(options.last, 10));

        if (reports.length === 0) {
            console.log(chalk.yellow('No reports found.'));
            return;
        }

        if (options.json) {
            console.log(JSON.stringify(reports, null, 2));
            return;
        }

        // Pretty print
        reports.forEach((r) => {
            const time = new Date(r.timestamp).toLocaleString();
            const confidence = Math.round(r.report.confidenceInCompletion * 100);

            console.log('');
            console.log(chalk.gray(`─────────────────────────────────────────`));
            console.log(`${getAgentColor(r.reporter.agent)(r.reporter.agent)} ${chalk.dim(`(${r.reporter.role})`)}`);
            console.log(chalk.white(r.report.workCompleted));
            console.log(chalk.cyan(`Confidence: ${confidence}%`));

            if (r.report.remaining?.length) {
                console.log(chalk.yellow('Remaining:'));
                r.report.remaining.forEach(item => console.log(`  • ${item}`));
            }

            if (r.verdict) {
                const verdictColor = r.verdict.status === 'fulfilled' ? chalk.green :
                                     r.verdict.status === 'broken' ? chalk.red : chalk.yellow;
                console.log(verdictColor(`Verdict: ${r.verdict.status}`));
                console.log(chalk.gray(`  "${r.verdict.reasoning}"`));
            }

            console.log(chalk.dim(`${time}`));
        });
        console.log('');
    });

// ============================================
// STATUS COMMAND
// ============================================

program
    .command('status')
    .description('Overview of promises and reports')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('❌ No .ledgersync folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const promiseSummary = getPromiseSummary(root);
        const reportSummary = getReportSummary(root);
        const activePromises = readActivePromises(root);

        if (options.json) {
            console.log(JSON.stringify({
                promises: promiseSummary,
                reports: reportSummary,
                activePromises,
            }, null, 2));
            return;
        }

        console.log('');
        console.log(chalk.bold('═══════════════════════════════════════════'));
        console.log(chalk.bold('        LEDGERSYNC PROMISE STATUS'));
        console.log(chalk.bold('═══════════════════════════════════════════'));
        console.log('');

        // Promises overview
        console.log(chalk.cyan('📋 PROMISES'));
        console.log(`   Total: ${promiseSummary.total}`);
        console.log(`   ${chalk.green('● Active:')} ${promiseSummary.active}`);
        console.log(`   ${chalk.blue('● Fulfilled:')} ${promiseSummary.fulfilled}`);
        console.log(`   ${chalk.red('● Broken:')} ${promiseSummary.broken}`);
        console.log(`   ${chalk.gray('● Withdrawn:')} ${promiseSummary.withdrawn}`);
        console.log('');

        // Active promises
        if (activePromises.length > 0) {
            console.log(chalk.cyan('🎯 ACTIVE PROMISES'));
            activePromises.slice(-5).forEach(p => {
                const agentColor = getAgentColor(p.promiser.agent);
                console.log(`   ${agentColor(p.promiser.agent)} → ${p.promisee.agent}`);
                console.log(`   ${chalk.white(`"${p.promise.summary}"`)}`);
                console.log(`   ${chalk.dim(`ID: ${p.id.slice(0, 8)}...`)}`);
                console.log('');
            });
        }

        // Reports overview
        console.log(chalk.cyan('📝 REPORTS'));
        console.log(`   Total: ${reportSummary.total}`);
        console.log(`   With Verdicts: ${reportSummary.withVerdicts}`);
        if (reportSummary.withVerdicts > 0) {
            console.log(`   ${chalk.green('● Fulfilled:')} ${reportSummary.verdictCounts.fulfilled}`);
            console.log(`   ${chalk.yellow('● Partial:')} ${reportSummary.verdictCounts.partial}`);
            console.log(`   ${chalk.red('● Broken:')} ${reportSummary.verdictCounts.broken}`);
        }
        console.log('');

        // Agents
        if (Object.keys(promiseSummary.byAgent).length > 0) {
            console.log(chalk.cyan('🤖 AGENTS'));
            for (const [agent, count] of Object.entries(promiseSummary.byAgent)) {
                const agentColor = getAgentColor(agent);
                console.log(`   ${agentColor(agent)}: ${count} promises`);
            }
            console.log('');
        }

        console.log(chalk.gray('───────────────────────────────────────────'));
        console.log(chalk.dim('Run `ledgersync promise list --active` for details'));
        console.log('');
    });

// ============================================
// HELPERS
// ============================================

function getAgentColor(name: string) {
    switch (name.toLowerCase()) {
        case 'claude-code':
            return chalk.hex('#D97706'); // Orange
        case 'cursor':
            return chalk.hex('#8B5CF6'); // Purple
        case 'antigravity':
            return chalk.hex('#3B82F6'); // Blue
        case 'human':
            return chalk.hex('#10B981'); // Green
        default:
            return chalk.white;
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case 'active':
            return chalk.cyan;
        case 'fulfilled':
            return chalk.green;
        case 'broken':
            return chalk.red;
        case 'withdrawn':
            return chalk.gray;
        case 'superseded':
            return chalk.dim;
        default:
            return chalk.white;
    }
}

// ============================================
// RUN
// ============================================

program.parse();
