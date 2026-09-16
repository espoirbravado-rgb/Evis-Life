/**
 * EVIS WORKING MEMORY & REFERENCE WORKSPACE CONTRACTS
 * Conforming to starterContent/Working_Memory.md and GEMINI.md
 *
 * Core Principle:
 * The agent must not depend on remembering where something is.
 * The workspace must remember the relationships between things.
 *
 * Mechanical Invariants:
 * 1. A subtask CANNOT be instantiated without an explicit parentId and returnTarget.
 * 2. Navigation is structured as a stack/graph allowing guaranteed backtracking.
 */

// -----------------------------------------------------------------------------
// 1. STABLE REFERENCE IDENTIFIERS
// -----------------------------------------------------------------------------
export type ReferencePrefix =
  | 'project'
  | 'task'
  | 'file'
  | 'requirement'
  | 'decision'
  | 'checkpoint'
  | 'resource'
  | 'source'
  | 'claim';

export type ReferenceId = `${ReferencePrefix}:${string}`;

// -----------------------------------------------------------------------------
// 2. REFERENCE RELATIONSHIPS
// -----------------------------------------------------------------------------
export type ReferenceRelation =
  | 'contains'
  | 'references'
  | 'depends_on'
  | 'requires'
  | 'implements'
  | 'modifies'
  | 'creates'
  | 'reads'
  | 'blocks'
  | 'blocked_by'
  | 'follows'
  | 'next'
  | 'previous'
  | 'derived_from'
  | 'verified_by'
  | 'related_to';

export interface IReferenceEdge {
  sourceId: string;
  relation: ReferenceRelation;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

// -----------------------------------------------------------------------------
// 3. TASK NODES & HIERARCHY
// -----------------------------------------------------------------------------
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'paused';

export interface ITaskNode {
  readonly id: string;           // e.g. "task:T001"
  readonly objective: string;    // What the task must achieve (purpose)
  status: TaskStatus;
  readonly parentId: string | null;  // NULL only for root task; MANDATORY for subtasks
  readonly originId: string;         // Root goal/task ID
  readonly returnTarget: string | null; // Where to return when task completes
  nextAction?: string;
  references: string[];          // Associated reference IDs (e.g. file:src/app.js)
  checkpoints: string[];         // Associated checkpoint IDs
  resultSummary?: string;
  createdAt: number;
  updatedAt: number;
}

// -----------------------------------------------------------------------------
// 4. CHECKPOINTS (STATE SNAPSHOTS FOR SAFE PAUSE/RESUME & BACKTRACKING)
// -----------------------------------------------------------------------------
export interface ICheckpoint {
  readonly id: string;           // e.g. "checkpoint:C001"
  readonly taskId: string;
  readonly stateSummary: string;
  readonly modifiedFiles: string[];
  readonly decisions: string[];
  readonly nextAction: string;
  readonly returnTarget: string;
  readonly timestamp: number;
}

// -----------------------------------------------------------------------------
// 5. WORKING CONTEXT (RECONSTRUCTED PORTION FOR MODEL ATTENTION)
// -----------------------------------------------------------------------------
export interface IWorkingContext {
  currentTask: ITaskNode;
  parentTask: ITaskNode | null;
  originTask: ITaskNode;
  breadcrumbs: string[];         // e.g. ["task:T001", "task:T003", "task:T007"]
  activeReferences: IReferenceEdge[];
  recentCheckpoints: ICheckpoint[];
  nextAction?: string;
}

// -----------------------------------------------------------------------------
// 6. PERSISTENT WORKING MEMORY STATE (FOR SAVING TO DISK & RESUMING)
// -----------------------------------------------------------------------------
export interface IWorkingMemoryState {
  projectId: string;
  taskCounter: number;
  checkpointCounter: number;
  navigationStack: string[];
  tasks: ITaskNode[];
  checkpoints: ICheckpoint[];
  referenceEdges: IReferenceEdge[];
  updatedAt: number;
}
