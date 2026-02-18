#!/usr/bin/env node

/**
 * Metacog-LedgerSync CLI
 * Shared memory and grounding for AI coding agents.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const LEDGERSYNC_MARKER = '# --- LedgerSync Integration ---';

function getTemplatesDir(): string {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
}

function readConfig(root: string): LedgerConfig {
    const configPath = getConfigPath(root);
    const content = fs.readFileSync(configPath, 'utf-8');
    return parseYaml(content) as LedgerConfig;
}

function writeConfig(root: string, config: LedgerConfig): void {
    const configPath = getConfigPath(root);
    fs.writeFileSync(configPath, stringifyYaml(config), 'utf-8');
}

const program = new Command();

program
    .name('ledgersync')
    .description('Shared memory and grounding for AI coding agents')
    .version('0.2.0');

// ============================================
// INIT COMMAND
// ============================================

program
    .command('init')
    .description('Initialize LedgerSync in your project')
    .option('-n, --name <name>', 'Project name', 'My Project')
    .action((options) => {
        const cwd = process.cwd();
        const ledgersyncDir = path.join(cwd, LEDGERSYNC_DIR);

        if (fs.existsSync(ledgersyncDir)) {
            console.log(chalk.yellow('Warning: .ledgersync/ already exists in this directory.'));
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
                optional: [],
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

        // Create empty ledger file
        fs.writeFileSync(path.join(ledgersyncDir, LEDGER_FILE), '', 'utf-8');

        console.log('');
        console.log(chalk.green('Initialized .ledgersync/'));
        console.log('');
        console.log('Let\'s get started with LedgerSync.');
        console.log('LedgerSync gives your AI agents two things:');
        console.log('');
        console.log(chalk.cyan('  Shared Memory'));
        console.log('    Agents log every decision and why they made it.');
        console.log('    Switch between IDEs and coding agents — no context is lost.');
        console.log('');
        console.log(chalk.cyan('  Grounding'));
        console.log('    Register docs that define your product\'s DNA.');
        console.log('    Agents read these before writing a single line of code.');
        console.log('');
        console.log('    For example:');
        console.log('');
        console.log(chalk.white('      philosophy.md'));
        console.log(chalk.dim('        Why your product exists and what it stands for.'));
        console.log(chalk.dim('        "We\'re building a social platform with strict bot filtering'));
        console.log(chalk.dim('         to let the true voice of people come through."'));
        console.log('');
        console.log(chalk.white('      design.md'));
        console.log(chalk.dim('        The feel, aesthetic, and deterministic design rules.'));
        console.log(chalk.dim('        "The app should feel breathable and calm. Scrolling should'));
        console.log(chalk.dim('         feel like a stroll in the park — smooth, purposeful animations."'));
        console.log('');
        console.log(chalk.white('      user_research.md'));
        console.log(chalk.dim('        Who you\'re building for, backed by data.'));
        console.log(chalk.dim('        "Our users are Gen-Z, fed up with algorithmic clutter.'));
        console.log(chalk.dim('         58% prefer muted tones. 73% leave apps that autoplay."'));
        console.log('');
        console.log(chalk.dim('    This list is not exhaustive — you can add however many core'));
        console.log(chalk.dim('    directive docs to ground your agents in your product.'));
        console.log(chalk.dim('    Register docs:  ledgersync ground add ./docs/philosophy.md'));
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log('  1. Run ' + chalk.white('ledgersync integrate <agents>') + ' to connect your AI tools/IDE');
        console.log('     (claude-code, copilot, cursor, codex)');
        console.log('  2. Run ' + chalk.white('ledgersync ground add <path>') + ' to register grounding docs');
        console.log('  3. Edit ' + chalk.white('.ledgersync/config.yaml') + ' to configure your project:');
        console.log(chalk.dim('     - project name and description'));
        console.log(chalk.dim('     - constraints agents must follow (with severity levels)'));
        console.log(chalk.dim('     - codebases and ledger settings'));
        console.log('  4. Start coding — your agents will log to .ledgersync/ledger.jsonl');
        console.log('');
        console.log(chalk.dim('Try it:  ledgersync add -s "Project started" -i "Initial setup"'));
        console.log(chalk.dim('         ledgersync log'));
        console.log('');
    });

// ============================================
// INTEGRATE COMMAND
// ============================================

program
    .command('integrate [agents...]')
    .description('Connect your AI tools/IDE (claude-code, copilot, cursor, codex)')
    .option('--all', 'Integrate all supported tools')
    .action((agents: string[], options: { all?: boolean }) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        // All available integrations: [key, templateFile, destinationFile, displayName]
        const allIntegrations: [string, string, string, string][] = [
            ['claude-code', 'CLAUDE.md', 'CLAUDE.md', 'Claude Code'],
            ['codex',       'CLAUDE.md', 'AGENTS.md', 'Codex / Jules / universal agents'],
            ['copilot',     'CLAUDE.md', '.github/copilot-instructions.md', 'GitHub Copilot'],
            ['cursor',      '.cursorrules', '.cursorrules', 'Cursor'],
        ];

        const validKeys = allIntegrations.map(i => i[0]);

        // --all flag: integrate everything
        if (options.all) {
            agents = [...validKeys];
        }

        // If no agents specified, show usage
        if (agents.length === 0) {
            console.log('');
            console.log('Specify which tools to integrate:');
            console.log('');
            for (const [key, , dest, name] of allIntegrations) {
                console.log(`  ${chalk.white(key.padEnd(14))} ${chalk.dim(name)} ${chalk.dim(`(${dest})`)}`);
            }
            console.log('');
            console.log(chalk.dim('Usage:  ledgersync integrate claude-code cursor'));
            console.log(chalk.dim('        ledgersync integrate copilot'));
            console.log(chalk.dim('        ledgersync integrate claude-code copilot cursor codex'));
            console.log('');
            return;
        }

        // Validate agent names
        const invalid = agents.filter(a => !validKeys.includes(a));
        if (invalid.length > 0) {
            console.log(chalk.red(`Unknown agent${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`));
            console.log(chalk.dim(`Available: ${validKeys.join(', ')}`));
            process.exit(1);
        }

        const cwd = process.cwd();
        const templatesDir = getTemplatesDir();

        if (!fs.existsSync(templatesDir)) {
            console.log(chalk.red('Templates not found. Reinstall metacog-ledgersync.'));
            process.exit(1);
        }

        // Filter to only requested integrations
        const integrations = allIntegrations.filter(([key]) => agents.includes(key));

        console.log('');
        console.log(chalk.cyan('Integrating LedgerSync...'));
        console.log(chalk.dim('Adding agent instructions so your AI tools read and write to the shared ledger.'));
        console.log('');

        for (const [, src, dest, toolName] of integrations) {
            const srcPath = path.join(templatesDir, src);
            const destPath = path.join(cwd, dest);

            if (!fs.existsSync(srcPath)) continue;

            // Ensure parent directory exists (e.g. .github/ for copilot)
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            if (!fs.existsSync(destPath)) {
                // File doesn't exist — create from template
                fs.copyFileSync(srcPath, destPath);
                console.log(`  ${chalk.green('+')} ${dest} — created (${toolName})`);
            } else {
                // File exists — check if LedgerSync block is already there
                const existing = fs.readFileSync(destPath, 'utf-8');
                if (existing.includes(LEDGERSYNC_MARKER)) {
                    console.log(`  ${chalk.dim('=')} ${dest} — already integrated (${toolName})`);
                } else {
                    // Append LedgerSync block
                    const template = fs.readFileSync(srcPath, 'utf-8');
                    const block = `\n\n${LEDGERSYNC_MARKER}\n\n${template}`;
                    fs.appendFileSync(destPath, block, 'utf-8');
                    console.log(`  ${chalk.yellow('~')} ${dest} — appended LedgerSync block (${toolName})`);
                }
            }
        }

        console.log('');
        console.log('Your agents will now read and write to the shared ledger.');
        console.log(chalk.dim('Each agent logs decisions to .ledgersync/ledger.jsonl'));
        console.log(chalk.dim('and reads grounding docs before making changes.'));
        console.log('');
    });

// ============================================
// GROUND COMMAND
// ============================================

const groundCommand = program
    .command('ground')
    .description('Manage grounding docs — your product\'s DNA that agents read before coding');

// ledgersync ground add <path>
groundCommand
    .command('add <docPath>')
    .description('Register a doc as required reading for all agents')
    .action((docPath) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const cwd = process.cwd();
        const resolvedPath = path.resolve(cwd, docPath);
        const relativePath = path.relative(cwd, resolvedPath);

        if (!fs.existsSync(resolvedPath)) {
            console.log(chalk.red(`File not found: ${docPath}`));
            console.log(chalk.dim('Create the file first, then register it.'));
            process.exit(1);
        }

        const config = readConfig(root);

        // Normalize to forward slashes for cross-platform consistency
        const normalizedPath = relativePath.split(path.sep).join('/');

        if (config.philosophy.required.includes(normalizedPath)) {
            console.log(chalk.yellow(`Already registered: ${normalizedPath}`));
            return;
        }

        config.philosophy.required.push(normalizedPath);
        writeConfig(root, config);

        console.log('');
        console.log(chalk.green(`Registered: ${normalizedPath}`));
        console.log(chalk.dim('All agents will now read this doc before starting work.'));
        console.log('');
    });

// ledgersync ground list
groundCommand
    .command('list')
    .description('Show all registered grounding docs')
    .action(() => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const config = readConfig(root);
        const cwd = process.cwd();

        console.log('');
        if (config.philosophy.required.length === 0) {
            console.log(chalk.dim('No grounding docs registered.'));
            console.log('');
            console.log('Grounding docs are files that define your product\'s DNA.');
            console.log('Agents read these before writing any code, so their decisions');
            console.log('align with your product vision — not just generic best practices.');
            console.log('');
            console.log(chalk.dim('Register one:  ledgersync ground add ./docs/philosophy.md'));
        } else {
            console.log(chalk.cyan('Grounding docs (required reading for all agents):'));
            console.log('');
            for (const doc of config.philosophy.required) {
                const fullPath = path.resolve(cwd, doc);
                const exists = fs.existsSync(fullPath);
                if (exists) {
                    console.log(`  ${chalk.green('*')} ${doc}`);
                } else {
                    console.log(`  ${chalk.red('!')} ${doc} ${chalk.red('(file not found)')}`);
                }
            }
        }
        console.log('');
    });

// ledgersync ground remove <path>
groundCommand
    .command('remove <docPath>')
    .description('Unregister a grounding doc')
    .action((docPath) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const cwd = process.cwd();
        const resolvedPath = path.resolve(cwd, docPath);
        const normalizedPath = path.relative(cwd, resolvedPath).split(path.sep).join('/');

        const config = readConfig(root);
        const index = config.philosophy.required.indexOf(normalizedPath);

        if (index === -1) {
            // Try matching the raw input too
            const rawIndex = config.philosophy.required.indexOf(docPath);
            if (rawIndex === -1) {
                console.log(chalk.yellow(`Not registered: ${docPath}`));
                return;
            }
            config.philosophy.required.splice(rawIndex, 1);
        } else {
            config.philosophy.required.splice(index, 1);
        }

        writeConfig(root, config);

        console.log('');
        console.log(chalk.green(`Removed: ${docPath}`));
        console.log(chalk.dim('Agents will no longer read this doc before starting work.'));
        console.log('');
    });

// ============================================
// LOG COMMAND
// ============================================

program
    .command('log')
    .description('See what your agents have been doing')
    .option('-n, --last <n>', 'Number of entries to show', '10')
    .option('-a, --agent <name>', 'Filter by agent name')
    .option('-f, --file <path>', 'Filter by file touched')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
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
            console.log(chalk.dim('No entries yet. Your agents will log here as they work.'));
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
            console.log(`${agentColor(entry.agent.name)} ${chalk.gray('·')} ${chalk.dim(time)}`);
            console.log(chalk.bold(entry.action.summary));
            console.log(chalk.gray(`Intent: ${entry.reasoning.intent}`));

            if (entry.artifacts.length > 0) {
                console.log(chalk.gray('Files:'));
                entry.artifacts.forEach(a => {
                    const icon = a.action === 'created' ? '+' : a.action === 'modified' ? '~' : a.action === 'deleted' ? '-' : '.';
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
    .description('Get context to hand off to a new agent')
    .option('-n, --last <n>', 'Number of entries to summarize', '20')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const summary = generateSummary(root, parseInt(options.last, 10));

        if (options.json) {
            console.log(JSON.stringify(summary, null, 2));
            return;
        }

        const markdown = formatSummaryForAgent(summary);
        console.log(markdown);
    });

// ============================================
// VALIDATE COMMAND
// ============================================

program
    .command('validate')
    .description('Check that everything is set up correctly')
    .action(() => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const cwd = process.cwd();
        let issues = 0;

        console.log('');
        console.log(chalk.cyan('LedgerSync Health Check'));
        console.log('');

        // Check core files
        const configPath = getConfigPath(root);
        const ledgerPath = getLedgerPath(root);

        if (fs.existsSync(configPath)) {
            console.log(`  ${chalk.green('*')} config.yaml`);
        } else {
            console.log(`  ${chalk.red('!')} config.yaml — missing`);
            issues++;
        }

        if (fs.existsSync(ledgerPath)) {
            const entries = readLedger(root);
            console.log(`  ${chalk.green('*')} ledger.jsonl (${entries.length} entries)`);
        } else {
            console.log(`  ${chalk.red('!')} ledger.jsonl — missing`);
            issues++;
        }

        // Validate ledger schema
        const { valid, errors } = validateLedger(root);
        if (!valid) {
            errors.forEach(e => {
                console.log(`    ${chalk.red(e)}`);
                issues++;
            });
        }

        // Check grounding docs
        console.log('');
        console.log(chalk.cyan('Grounding docs:'));
        const config = readConfig(root);
        if (config.philosophy.required.length === 0) {
            console.log(chalk.dim('  No grounding docs registered.'));
        } else {
            for (const doc of config.philosophy.required) {
                const fullPath = path.resolve(cwd, doc);
                if (fs.existsSync(fullPath)) {
                    console.log(`  ${chalk.green('*')} ${doc}`);
                } else {
                    console.log(`  ${chalk.red('!')} ${doc} — file not found`);
                    issues++;
                }
            }
        }

        // Check agent integration
        console.log('');
        console.log(chalk.cyan('Agent integration:'));
        const agentFiles: [string, string][] = [
            ['CLAUDE.md', 'Claude Code'],
            ['AGENTS.md', 'Codex / Jules'],
            ['.github/copilot-instructions.md', 'GitHub Copilot'],
            ['.cursorrules', 'Cursor'],
        ];

        for (const [file, tool] of agentFiles) {
            const filePath = path.join(cwd, file);
            if (!fs.existsSync(filePath)) {
                console.log(`  ${chalk.dim('-')} ${file} — not found (${tool})`);
            } else {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.includes('ledgersync') || content.includes('LedgerSync') || content.includes(LEDGERSYNC_MARKER)) {
                    console.log(`  ${chalk.green('*')} ${file} — integrated (${tool})`);
                } else {
                    console.log(`  ${chalk.yellow('~')} ${file} — exists but no LedgerSync block (${tool})`);
                    issues++;
                }
            }
        }

        console.log('');
        if (issues === 0) {
            console.log(chalk.green('Everything looks good.'));
        } else {
            console.log(chalk.yellow(`${issues} issue${issues === 1 ? '' : 's'} found.`));
            if (issues > 0) {
                console.log(chalk.dim('Run `ledgersync integrate` to fix agent integration.'));
            }
        }
        console.log('');
    });

// ============================================
// ADD COMMAND (Manual entry)
// ============================================

program
    .command('add')
    .description('Manually log a decision to the ledger')
    .requiredOption('-s, --summary <text>', 'What you did')
    .requiredOption('-i, --intent <text>', 'Why you did it')
    .option('-t, --type <type>', 'Action type (create, modify, delete, analyze, plan, debug, refactor)', 'other')
    .option('-a, --agent <name>', 'Agent name', 'human')
    .option('-f, --files <paths...>', 'Files touched')
    .option('--tags <tags...>', 'Tags')
    .action((options) => {
        const root = findLedgersyncRoot();

        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
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

        console.log(chalk.green('Logged.'));
        console.log(chalk.dim(`  ID: ${entry.id}`));
    });

// ============================================
// PROMISE COMMANDS (v0.2 — hidden for now)
// ============================================

/*
const promiseCommand = program
    .command('promise')
    .description('Manage promises (bilateral commitments)');

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
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validTypes = ['will-do', 'will-not-do', 'will-maintain', 'will-provide'];
        if (!validTypes.includes(options.type)) {
            console.log(chalk.red(`Invalid type. Must be one of: ${validTypes.join(', ')}`));
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

        console.log(chalk.green('Promise created'));
        console.log(chalk.gray(`   ID: ${promise.id}`));
        console.log(chalk.gray(`   ${options.agent} -> ${options.to}: ${options.type} "${options.summary}"`));
    });

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
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
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

        promises.forEach((p) => {
            const statusColor = getStatusColor(p.status);
            const time = new Date(p.timestamp).toLocaleString();

            console.log('');
            console.log(chalk.gray(`---`));
            console.log(`${chalk.bold(p.promise.type)} ${statusColor(`[${p.status}]`)}`);
            console.log(`${getAgentColor(p.promiser.agent)(p.promiser.agent)} -> ${p.promisee.agent}`);
            console.log(chalk.white(`"${p.promise.summary}"`));
            console.log(chalk.dim(`ID: ${p.id.slice(0, 8)}... | ${time}`));

            if (p.promise.conditions?.length) {
                console.log(chalk.gray('Conditions:'));
                p.promise.conditions.forEach(c => console.log(`  - ${c}`));
            }
        });
        console.log('');
    });

promiseCommand
    .command('resolve <promise-id>')
    .description('Resolve a promise (fulfill, break, or withdraw)')
    .requiredOption('-s, --status <status>', 'New status (fulfilled, broken, withdrawn)')
    .action((promiseId, options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validStatuses = ['fulfilled', 'broken', 'withdrawn'];
        if (!validStatuses.includes(options.status)) {
            console.log(chalk.red(`Invalid status. Must be one of: ${validStatuses.join(', ')}`));
            process.exit(1);
        }

        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`Promise not found: ${promiseId}`));
            process.exit(1);
        }

        const updated = resolvePromise(root, promise.id, options.status as PromiseStatus);

        if (updated) {
            console.log(chalk.green(`Promise resolved: ${options.status}`));
            console.log(chalk.gray(`   ${updated.promise.summary}`));
        } else {
            console.log(chalk.red('Failed to resolve promise'));
        }
    });

promiseCommand
    .command('withdraw <promise-id>')
    .description('Withdraw a promise')
    .action((promiseId) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`Promise not found: ${promiseId}`));
            process.exit(1);
        }

        const updated = withdrawPromise(root, promise.id);

        if (updated) {
            console.log(chalk.green('Promise withdrawn'));
            console.log(chalk.gray(`   ${updated.promise.summary}`));
        } else {
            console.log(chalk.red('Failed to withdraw promise'));
        }
    });

// --- Report commands (also v0.2) ---

const reportCommand = program
    .command('report')
    .description('Manage work reports on promises');

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
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const promises = readPromises(root);
        const promise = promises.find(p => p.id === options.promise || p.id.startsWith(options.promise));

        if (!promise) {
            console.log(chalk.red(`Promise not found: ${options.promise}`));
            process.exit(1);
        }

        const confidence = parseFloat(options.confidence);
        if (isNaN(confidence) || confidence < 0 || confidence > 1) {
            console.log(chalk.red('Confidence must be a number between 0.0 and 1.0'));
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

        console.log(chalk.green('Work report added'));
        console.log(chalk.gray(`   ID: ${report.id}`));
        console.log(chalk.gray(`   Promise: ${promise.promise.summary}`));
        console.log(chalk.gray(`   Confidence: ${Math.round(confidence * 100)}%`));
    });

reportCommand
    .command('verdict <promise-id>')
    .description('Add a verdict on a promise (humans/witnesses only)')
    .requiredOption('-s, --status <status>', 'Verdict (fulfilled, partial, broken)')
    .requiredOption('-r, --reason <text>', 'Reasoning for verdict')
    .option('-a, --agent <name>', 'Reporter name', 'human')
    .action((promiseId, options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
            process.exit(1);
        }

        const validStatuses = ['fulfilled', 'partial', 'broken'];
        if (!validStatuses.includes(options.status)) {
            console.log(chalk.red(`Invalid verdict. Must be one of: ${validStatuses.join(', ')}`));
            process.exit(1);
        }

        const promises = readPromises(root);
        const promise = promises.find(p => p.id === promiseId || p.id.startsWith(promiseId));

        if (!promise) {
            console.log(chalk.red(`Promise not found: ${promiseId}`));
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
            console.log(chalk.green(`Verdict added: ${options.status}`));
            console.log(chalk.gray(`   Promise: ${promise.promise.summary}`));
            console.log(chalk.gray(`   Reason: ${options.reason}`));

            if (result.promise && result.promise.status !== 'active') {
                console.log(chalk.cyan(`   Promise status updated to: ${result.promise.status}`));
            }
        } else {
            console.log(chalk.red('Failed to add verdict'));
        }
    });

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
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
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

        reports.forEach((r) => {
            const time = new Date(r.timestamp).toLocaleString();
            const confidence = Math.round(r.report.confidenceInCompletion * 100);

            console.log('');
            console.log(chalk.gray(`---`));
            console.log(`${getAgentColor(r.reporter.agent)(r.reporter.agent)} ${chalk.dim(`(${r.reporter.role})`)}`);
            console.log(chalk.white(r.report.workCompleted));
            console.log(chalk.cyan(`Confidence: ${confidence}%`));

            if (r.report.remaining?.length) {
                console.log(chalk.yellow('Remaining:'));
                r.report.remaining.forEach(item => console.log(`  - ${item}`));
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

const statusCommand = program
    .command('status')
    .description('Overview of promises and reports')
    .option('--json', 'Output as JSON')
    .action((options) => {
        const root = findLedgersyncRoot();
        if (!root) {
            console.log(chalk.red('No .ledgersync/ folder found. Run `ledgersync init` first.'));
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
        console.log(chalk.bold('LEDGERSYNC STATUS'));
        console.log('');

        console.log(chalk.cyan('Promises'));
        console.log(`   Total: ${promiseSummary.total}`);
        console.log(`   ${chalk.green('Active:')} ${promiseSummary.active}`);
        console.log(`   ${chalk.blue('Fulfilled:')} ${promiseSummary.fulfilled}`);
        console.log(`   ${chalk.red('Broken:')} ${promiseSummary.broken}`);
        console.log(`   ${chalk.gray('Withdrawn:')} ${promiseSummary.withdrawn}`);
        console.log('');

        if (activePromises.length > 0) {
            console.log(chalk.cyan('Active Promises'));
            activePromises.slice(-5).forEach(p => {
                const agentColor = getAgentColor(p.promiser.agent);
                console.log(`   ${agentColor(p.promiser.agent)} -> ${p.promisee.agent}`);
                console.log(`   "${p.promise.summary}"`);
                console.log(`   ${chalk.dim(`ID: ${p.id.slice(0, 8)}...`)}`);
                console.log('');
            });
        }

        console.log(chalk.cyan('Reports'));
        console.log(`   Total: ${reportSummary.total}`);
        console.log(`   With Verdicts: ${reportSummary.withVerdicts}`);
        if (reportSummary.withVerdicts > 0) {
            console.log(`   ${chalk.green('Fulfilled:')} ${reportSummary.verdictCounts.fulfilled}`);
            console.log(`   ${chalk.yellow('Partial:')} ${reportSummary.verdictCounts.partial}`);
            console.log(`   ${chalk.red('Broken:')} ${reportSummary.verdictCounts.broken}`);
        }
        console.log('');
    });
*/

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
