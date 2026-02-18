/**
 * Metacog-LedgerSync Schema Types
 * Version: 0.2.0
 */

// ============================================
// CORE ENTRY SCHEMA
// ============================================

export interface LedgerEntry {
    // === IDENTITY ===
    id: string;                    // UUID v4
    timestamp: string;             // ISO 8601

    // === AGENT INFO ===
    agent: AgentInfo;

    // === SESSION CONTEXT ===
    session: SessionInfo;

    // === ENTRY TYPE (Optional - for semantic structure) ===
    entryType?: EntryType;

    // === THE CORE: WHAT HAPPENED ===
    action: ActionInfo;

    // === REASONING (The "Why") ===
    reasoning: ReasoningInfo;

    // === TOOLS & ARTIFACTS ===
    tools: ToolCall[];
    artifacts: ArtifactChange[];

    // === USER INTERACTION ===
    userPrompt?: string;

    // === METADATA ===
    tags?: string[];
    relatedEntries?: string[];

    // === PHILOSOPHY GROUNDING ===
    grounding?: GroundingInfo;

    // === TYPE-SPECIFIC DATA ===
    sessionSummary?: SessionSummary;  // For 'handoff' entries
    transition?: TransitionInfo;       // For 'transition' entries
    implementation?: ImplementationInfo; // For 'implementation' entries
    bugfix?: BugfixInfo;               // For 'bugfix' entries
    review?: ReviewInfo;               // For 'review' entries
}

export type EntryType =
    | 'handoff'        // Outgoing agent wrapping up
    | 'transition'     // Incoming agent acquiring context
    | 'implementation' // Feature work
    | 'bugfix'         // Fixing specific issue
    | 'review';        // Code audit without changes

export interface AgentInfo {
    name: 'claude-code' | 'cursor' | 'antigravity' | 'human' | string;
    model?: string;
    version?: string;
}

export interface SessionInfo {
    id: string;
    entryIndex: number;
    parentEntryId?: string;
}

export interface ActionInfo {
    type: ActionType;
    summary: string;            // Max 200 chars
    description?: string;
}

export type ActionType =
    | 'create'
    | 'modify'
    | 'delete'
    | 'analyze'
    | 'plan'
    | 'debug'
    | 'refactor'
    | 'other';

export interface ReasoningInfo {
    intent: string;
    considerations?: string[];
    assumptions?: string[];
    uncertainties?: string[];
    confidence?: number;        // 0.0 - 1.0
}

export interface ToolCall {
    name: string;
    parameters?: Record<string, unknown>;
}

export interface ArtifactChange {
    path: string;               // Relative from project root
    action: 'created' | 'modified' | 'deleted' | 'read';
    linesChanged?: number;
    summary?: string;
}

export interface GroundingInfo {
    philosophyRefs?: string[];      // Paths to philosophy docs consulted
    constraintsApplied?: string[];  // Which constraints influenced this action
    alignmentNotes?: string;        // How this aligns with product philosophy
}

// ============================================
// TYPED ENTRY DATA
// ============================================

/**
 * SessionSummary - Used by outgoing agent in 'handoff' entries
 * Captures state for the next agent to inherit
 */
export interface SessionSummary {
    completed: string[];
    currentState: Record<string, string>;
    deferred: string[];
    blockers: string[];
    importantContext: Record<string, string>;
    handoffNotes?: string;
}

/**
 * TransitionInfo - Used by incoming agent in 'transition' entries
 * Confirms receipt of context from prior agent
 */
export interface TransitionInfo {
    fromAgent: string;
    fromSessionId: string;
    fromEntryId: string;
    contextAcquired: {
        entriesRead: number;
        philosophyDocsRead: string[];
        filesIndexed: string[];
    };
    inheritedState: {
        completed: string[];
        deferred: string[];
        blockers: string[];
    };
    readiness: {
        confident: boolean;
        clarificationsNeeded: string[];
        proposedNextSteps: string[];
    };
}

/**
 * ImplementationInfo - Used for feature work
 */
export interface ImplementationInfo {
    feature: string;
    designDecisions: string[];
    testsAdded: string[];
    docsUpdated: string[];
    breakingChanges: string[];
}

/**
 * BugfixInfo - Used for bug fixes
 */
export interface BugfixInfo {
    symptom: string;
    rootCause: string;
    fix: string;
    regressionRisk: string;
    verificationSteps: string[];
}

/**
 * ReviewInfo - Used for code reviews/audits
 */
export interface ReviewInfo {
    scope: string[];
    findings: ReviewFinding[];
    overallAssessment: string;
}

export interface ReviewFinding {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location: string;
    issue: string;
    recommendation: string;
}

// ============================================
// CONFIG SCHEMA
// ============================================

export interface LedgerConfig {
    version: string;
    project: ProjectInfo;
    philosophy: PhilosophyConfig;
    codebases: CodebaseConfig[];
    ledger: LedgerSettings;
    constraints: Constraint[];
}

export interface ProjectInfo {
    name: string;
    description?: string;
}

export interface PhilosophyConfig {
    required: string[];         // Always load these docs
    optional?: string[];        // Load if relevant (glob patterns)
}

export interface CodebaseConfig {
    path: string;
    name: string;
}

export interface LedgerSettings {
    maxEntriesToLoad: number;
    summarizeAfter: number;
}

export interface Constraint {
    id: string;
    description: string;
    appliesTo: string[];        // Codebase names or '*' for all
    severity: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================
// UTILITY TYPES
// ============================================

export interface LedgerSummary {
    totalEntries: number;
    lastUpdated: string;
    recentAgents: string[];
    recentFiles: string[];
    keyDecisions: string[];
}

// ============================================
// TYPE GUARDS
// ============================================

export function isHandoffEntry(entry: LedgerEntry): entry is LedgerEntry & { entryType: 'handoff'; sessionSummary: SessionSummary } {
    return entry.entryType === 'handoff' && entry.sessionSummary !== undefined;
}

export function isTransitionEntry(entry: LedgerEntry): entry is LedgerEntry & { entryType: 'transition'; transition: TransitionInfo } {
    return entry.entryType === 'transition' && entry.transition !== undefined;
}

export function isImplementationEntry(entry: LedgerEntry): entry is LedgerEntry & { entryType: 'implementation'; implementation: ImplementationInfo } {
    return entry.entryType === 'implementation' && entry.implementation !== undefined;
}

export function isBugfixEntry(entry: LedgerEntry): entry is LedgerEntry & { entryType: 'bugfix'; bugfix: BugfixInfo } {
    return entry.entryType === 'bugfix' && entry.bugfix !== undefined;
}

export function isReviewEntry(entry: LedgerEntry): entry is LedgerEntry & { entryType: 'review'; review: ReviewInfo } {
    return entry.entryType === 'review' && entry.review !== undefined;
}

// ============================================
// PROMISE GRAPH TYPES
// ============================================

/**
 * Promise types define what kind of commitment an agent is making
 */
export type PromiseType =
    | 'will-do'        // I will perform action X
    | 'will-not-do'    // I will NOT do X (constraint)
    | 'will-maintain'  // I will keep X in state Y
    | 'will-provide';  // I will make X available for consumption

/**
 * Promise status tracks the lifecycle of a commitment
 */
export type PromiseStatus =
    | 'active'         // Not yet resolved
    | 'fulfilled'      // Completed successfully
    | 'broken'         // Failed to deliver
    | 'withdrawn'      // Agent withdrew before completion
    | 'superseded';    // Replaced by another promise

/**
 * Scope defines how long a promise is valid
 */
export type PromiseScope =
    | 'session'        // Valid only for current session
    | 'project'        // Valid for this project
    | 'permanent';     // Valid until explicitly resolved

/**
 * PromiseEntry - A bilateral commitment from one agent to another
 * 
 * Promises are stored in promises.jsonl, separate from the action ledger.
 * They enable coordination by making commitments explicit and trackable.
 */
export interface PromiseEntry {
    // === IDENTITY ===
    id: string;                    // UUID v4
    timestamp: string;             // ISO 8601

    // === PROMISER (who is making the commitment) ===
    promiser: {
        agent: string;             // "claude-code" | "cursor" | "human" | etc
        session?: string;          // Session ID if relevant
    };

    // === PROMISEE (who the commitment is to) ===
    promisee: {
        agent: string;             // Target agent, or "*" for any future agent
        scope?: PromiseScope;      // How long this promise is valid
    };

    // === THE PROMISE ===
    promise: {
        type: PromiseType;
        summary: string;           // What is being promised (max 200 chars)
        description?: string;      // Longer explanation if needed
        conditions?: string[];     // Prerequisites or conditions
    };

    // === CONTEXT ===
    context?: {
        relatedEntries?: string[]; // Ledger entry IDs this relates to
        artifacts?: string[];      // Files this affects
        constraintRefs?: string[]; // Constraints this supports
        userPrompt?: string;       // Original user request
    };

    // === STATUS ===
    status: PromiseStatus;
    resolvedBy?: string;           // Report ID that resolved this
    resolvedAt?: string;           // ISO 8601 timestamp of resolution
    supersededBy?: string;         // Promise ID if superseded

    // === METADATA ===
    tags?: string[];
}

/**
 * Reporter role in a work report
 */
export type ReporterRole =
    | 'actor'          // The agent that did the work
    | 'witness'        // Another agent observing
    | 'human';         // Human reviewer

/**
 * Verdict status for promise fulfillment
 */
export type VerdictStatus =
    | 'fulfilled'      // Promise was kept
    | 'partial'        // Partially fulfilled
    | 'broken';        // Promise was not kept

/**
 * WorkReport - Progress report on a promise
 * 
 * Actors report what they did (not self-grades).
 * Witnesses or humans can add verdicts.
 * 
 * Key insight: Agents report facts, not judgments.
 * "I completed X, Y remains" not "I did a good job".
 */
export interface WorkReport {
    // === IDENTITY ===
    id: string;                    // UUID v4
    timestamp: string;             // ISO 8601

    // === REPORTER ===
    reporter: {
        agent: string;             // Who is reporting
        role: ReporterRole;        // Actor, witness, or human
        session?: string;          // Session ID if relevant
    };

    // === SUBJECT ===
    promiseId: string;             // Which promise this reports on

    // === THE REPORT (facts, not judgments) ===
    report: {
        workCompleted: string;     // What was done
        remaining?: string[];      // What's left to do
        blockers?: string[];       // What's blocking completion
        confidenceInCompletion: number;  // 0.0-1.0: How complete is this?
    };

    // === VERDICT (only humans/witnesses can write) ===
    verdict?: {
        status: VerdictStatus;
        reasoning: string;         // Why this verdict
    };

    // === CONTEXT ===
    relatedEntries?: string[];     // Ledger entries that did the work
    tags?: string[];
}

// ============================================
// PROMISE TYPE GUARDS
// ============================================

export function isPromiseEntry(obj: unknown): obj is PromiseEntry {
    if (typeof obj !== 'object' || obj === null) return false;
    const entry = obj as Record<string, unknown>;
    return (
        typeof entry.id === 'string' &&
        typeof entry.timestamp === 'string' &&
        typeof entry.promiser === 'object' &&
        typeof entry.promisee === 'object' &&
        typeof entry.promise === 'object' &&
        typeof entry.status === 'string'
    );
}

export function isWorkReport(obj: unknown): obj is WorkReport {
    if (typeof obj !== 'object' || obj === null) return false;
    const report = obj as Record<string, unknown>;
    return (
        typeof report.id === 'string' &&
        typeof report.timestamp === 'string' &&
        typeof report.reporter === 'object' &&
        typeof report.promiseId === 'string' &&
        typeof report.report === 'object'
    );
}

export function isActivePromise(promise: PromiseEntry): boolean {
    return promise.status === 'active';
}

export function isFulfilledPromise(promise: PromiseEntry): boolean {
    return promise.status === 'fulfilled';
}