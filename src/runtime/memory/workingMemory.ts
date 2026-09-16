/**
 * EVIS WORKING MEMORY & NAVIGATION SUBSYSTEM
 * Conforming to starterContent/Working_Memory.md, directive_1.md and GEMINI.md
 *
 * Core Responsibility:
 * Maintain the navigable tree of tasks, breadcrumbs, references, and checkpoints.
 *
 * MECHANICAL INVARIANTS:
 * 1. A subtask CANNOT be instantiated without a valid parentId and returnTarget.
 * 2. Every entry into a subtask must have a verified exit and return path.
 * 3. Context reconstruction guarantees the agent never loses its origin or trajectory.
 */

import {
  ITaskNode,
  ICheckpoint,
  IReferenceEdge,
  IWorkingContext,
  IWorkingMemoryState,
  ReferenceRelation,
} from '../types/memory';

export class WorkingMemory {
  private tasks: Map<string, ITaskNode> = new Map();
  private checkpoints: Map<string, ICheckpoint> = new Map();
  private referenceEdges: IReferenceEdge[] = [];
  private navigationStack: string[] = []; // Stack of active task IDs
  private taskCounter = 0;
  private checkpointCounter = 0;

  constructor(public readonly projectId: string = 'project:evis') {}

  // ---------------------------------------------------------------------------
  // 1. ROOT TASK CREATION
  // ---------------------------------------------------------------------------
  public createRootTask(objective: string): ITaskNode {
    const trimmedObjective = objective.trim();
    if (!trimmedObjective) {
      throw new Error('WorkingMemory: Root task objective cannot be empty.');
    }

    this.taskCounter++;
    const taskId = `task:T${String(this.taskCounter).padStart(3, '0')}`;
    const now = Date.now();

    const rootTask: ITaskNode = {
      id: taskId,
      objective: trimmedObjective,
      status: 'in_progress',
      parentId: null,
      originId: taskId,
      returnTarget: null,
      references: [],
      checkpoints: [],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, rootTask);
    this.navigationStack = [taskId];

    this.addReference(this.projectId, 'contains', taskId);
    return rootTask;
  }

  // ---------------------------------------------------------------------------
  // 2. SUBTASK CREATION (MECHANICAL INVARIANT ENFORCEMENT)
  // ---------------------------------------------------------------------------
  public createSubTask(params: {
    parentId: string;
    objective: string;
    returnTarget: string;
    nextAction?: string;
  }): ITaskNode {
    // INVARIANT 1: Objective cannot be empty
    const trimmedObjective = (params.objective || '').trim();
    if (!trimmedObjective) {
      throw new Error(
        'Mechanical Invariant Violation: Subtask objective cannot be empty.'
      );
    }

    // INVARIANT 2: parentId is mandatory
    if (!params.parentId || !params.parentId.trim()) {
      throw new Error(
        'Mechanical Invariant Violation: Subtask cannot be created without an explicit parentId.'
      );
    }

    // INVARIANT 3: Parent task must exist in the Working Memory
    const parentTask = this.tasks.get(params.parentId);
    if (!parentTask) {
      throw new Error(
        `Mechanical Invariant Violation: Parent task '${params.parentId}' does not exist in Working Memory.`
      );
    }

    // INVARIANT 4: returnTarget is mandatory (Must know where to return)
    if (!params.returnTarget || !params.returnTarget.trim()) {
      throw new Error(
        'Mechanical Invariant Violation: Subtask cannot be created without an explicit returnTarget.'
      );
    }

    // INVARIANT 5: returnTarget must be a known node in the task tree or parent
    if (!this.tasks.has(params.returnTarget) && params.returnTarget !== params.parentId) {
      throw new Error(
        `Mechanical Invariant Violation: returnTarget '${params.returnTarget}' must exist in Working Memory.`
      );
    }

    this.taskCounter++;
    const taskId = `task:T${String(this.taskCounter).padStart(3, '0')}`;
    const now = Date.now();

    const subTask: ITaskNode = {
      id: taskId,
      objective: trimmedObjective,
      status: 'in_progress',
      parentId: params.parentId,
      originId: parentTask.originId,
      returnTarget: params.returnTarget,
      nextAction: params.nextAction,
      references: [],
      checkpoints: [],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, subTask);
    this.navigationStack.push(taskId);

    // Record graph relationships
    this.addReference(params.parentId, 'contains', taskId);
    this.addReference(taskId, 'depends_on', params.parentId);

    return subTask;
  }

  // ---------------------------------------------------------------------------
  // 3. TASK COMPLETION & BACKTRACKING
  // ---------------------------------------------------------------------------
  public completeTask(
    taskId: string,
    resultSummary: string
  ): {
    completedTask: ITaskNode;
    returnTargetTask: ITaskNode | null;
  } {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`WorkingMemory: Task '${taskId}' not found.`);
    }

    const trimmedSummary = (resultSummary || '').trim();
    if (!trimmedSummary) {
      throw new Error(
        'WorkingMemory: Result summary is required to complete a task.'
      );
    }

    const now = Date.now();
    task.status = 'completed';
    task.resultSummary = trimmedSummary;
    task.updatedAt = now;

    // Pop from navigation stack if on top
    const stackTopIndex = this.navigationStack.lastIndexOf(taskId);
    if (stackTopIndex !== -1) {
      this.navigationStack.splice(stackTopIndex, 1);
    }

    let returnTargetTask: ITaskNode | null = null;
    if (task.returnTarget) {
      returnTargetTask = this.tasks.get(task.returnTarget) || null;
    }

    return { completedTask: task, returnTargetTask };
  }

  // ---------------------------------------------------------------------------
  // 4. CHECKPOINT CREATION
  // ---------------------------------------------------------------------------
  public createCheckpoint(params: {
    taskId: string;
    stateSummary: string;
    modifiedFiles?: string[];
    decisions?: string[];
    nextAction: string;
  }): ICheckpoint {
    const task = this.tasks.get(params.taskId);
    if (!task) {
      throw new Error(`WorkingMemory: Task '${params.taskId}' not found.`);
    }

    this.checkpointCounter++;
    const checkpointId = `checkpoint:C${String(this.checkpointCounter).padStart(3, '0')}`;

    const checkpoint: ICheckpoint = {
      id: checkpointId,
      taskId: params.taskId,
      stateSummary: params.stateSummary,
      modifiedFiles: params.modifiedFiles || [],
      decisions: params.decisions || [],
      nextAction: params.nextAction,
      returnTarget: task.returnTarget || task.parentId || task.id,
      timestamp: Date.now(),
    };

    this.checkpoints.set(checkpointId, checkpoint);
    task.checkpoints.push(checkpointId);
    task.nextAction = params.nextAction;
    task.updatedAt = checkpoint.timestamp;

    this.addReference(params.taskId, 'verified_by', checkpointId);
    return checkpoint;
  }

  // ---------------------------------------------------------------------------
  // 5. PAUSE & RESUME
  // ---------------------------------------------------------------------------
  public pauseTask(taskId: string): ITaskNode {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`WorkingMemory: Task '${taskId}' not found.`);
    }
    task.status = 'paused';
    task.updatedAt = Date.now();
    return task;
  }

  public resumeTask(taskId: string): ITaskNode {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`WorkingMemory: Task '${taskId}' not found.`);
    }
    task.status = 'in_progress';
    task.updatedAt = Date.now();
    if (!this.navigationStack.includes(taskId)) {
      this.navigationStack.push(taskId);
    }
    return task;
  }

  // ---------------------------------------------------------------------------
  // 6. REFERENCE GRAPH MANAGEMENT
  // ---------------------------------------------------------------------------
  public addReference(
    sourceId: string,
    relation: ReferenceRelation,
    targetId: string,
    metadata?: Record<string, unknown>
  ): IReferenceEdge {
    const edge: IReferenceEdge = {
      sourceId,
      relation,
      targetId,
      metadata,
      createdAt: Date.now(),
    };
    this.referenceEdges.push(edge);

    // Link reference to task if source is a task
    const sourceTask = this.tasks.get(sourceId);
    if (sourceTask && !sourceTask.references.includes(targetId)) {
      sourceTask.references.push(targetId);
    }

    return edge;
  }

  // ---------------------------------------------------------------------------
  // 7. NAVIGATION & CONTEXT RECONSTRUCTION
  // ---------------------------------------------------------------------------
  public getActiveTask(): ITaskNode | null {
    if (this.navigationStack.length === 0) return null;
    const activeId = this.navigationStack[this.navigationStack.length - 1];
    return this.tasks.get(activeId) || null;
  }

  public getNavigationPath(): string[] {
    return [...this.navigationStack];
  }

  public getTask(taskId: string): ITaskNode | null {
    return this.tasks.get(taskId) || null;
  }

  public getAllTasks(): ITaskNode[] {
    return Array.from(this.tasks.values());
  }

  public reconstructContext(taskId: string): IWorkingContext {
    const currentTask = this.tasks.get(taskId);
    if (!currentTask) {
      throw new Error(`WorkingMemory: Cannot reconstruct context for unknown task '${taskId}'.`);
    }

    const parentTask = currentTask.parentId
      ? this.tasks.get(currentTask.parentId) || null
      : null;

    const originTask =
      this.tasks.get(currentTask.originId) || currentTask;

    const activeReferences = this.referenceEdges.filter(
      (e) => e.sourceId === taskId || e.targetId === taskId
    );

    const recentCheckpoints = currentTask.checkpoints
      .map((cId) => this.checkpoints.get(cId))
      .filter((c): c is ICheckpoint => c !== undefined);

    return {
      currentTask,
      parentTask,
      originTask,
      breadcrumbs: [...this.navigationStack],
      activeReferences,
      recentCheckpoints,
      nextAction: currentTask.nextAction,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. PERSISTENCE & SERIALIZATION (PHYSICAL GROUNDING ON DISK)
  // ---------------------------------------------------------------------------
  public exportState(): IWorkingMemoryState {
    return {
      projectId: this.projectId,
      taskCounter: this.taskCounter,
      checkpointCounter: this.checkpointCounter,
      navigationStack: [...this.navigationStack],
      tasks: Array.from(this.tasks.values()),
      checkpoints: Array.from(this.checkpoints.values()),
      referenceEdges: [...this.referenceEdges],
      updatedAt: Date.now(),
    };
  }

  public importState(state: IWorkingMemoryState): void {
    if (!state) return;
    this.taskCounter = state.taskCounter || 0;
    this.checkpointCounter = state.checkpointCounter || 0;
    this.navigationStack = [...(state.navigationStack || [])];
    this.tasks = new Map((state.tasks || []).map((t) => [t.id, t]));
    this.checkpoints = new Map((state.checkpoints || []).map((c) => [c.id, c]));
    this.referenceEdges = [...(state.referenceEdges || [])];
  }

  public serialize(): string {
    return JSON.stringify(this.exportState(), null, 2);
  }

  public static deserialize(jsonStr: string): WorkingMemory {
    const parsed: IWorkingMemoryState = JSON.parse(jsonStr);
    const wm = new WorkingMemory(parsed.projectId || 'project:evis');
    wm.importState(parsed);
    return wm;
  }

  /**
   * Persists the working memory navigation tree directly to disk in Node environment.
   */
  public async saveToFile(filePath: string): Promise<void> {
    if (typeof window === 'undefined') {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, this.serialize(), 'utf-8');
    }
  }

  /**
   * Loads a working memory navigation tree from disk in Node environment.
   */
  public static async loadFromFile(filePath: string): Promise<WorkingMemory | null> {
    if (typeof window === 'undefined') {
      const fs = await import('node:fs');
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return WorkingMemory.deserialize(content);
    }
    return null;
  }
}
