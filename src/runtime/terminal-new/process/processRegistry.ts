import type { ProcessHandle } from './processHandle.ts';
import type { PosixSignal } from './processSignals.ts';
import type { SessionId, TaskId } from '../terminalTypes.ts';

export class ProcessRegistry {
  private processes: Map<string, ProcessHandle> = new Map();
  private pidIndex: Map<number, string> = new Map();
  private sessionIndex: Map<SessionId, Set<string>> = new Map();
  private taskIndex: Map<TaskId, Set<string>> = new Map();
  private completedQueue: string[] = [];

  constructor(private readonly maxRetainedHistory: number = 200) {}

  public register(handle: ProcessHandle): void {
    this.processes.set(handle.id, handle);

    if (handle.pid) {
      this.pidIndex.set(handle.pid, handle.id);
    }

    if (handle.sessionId) {
      let set = this.sessionIndex.get(handle.sessionId);
      if (!set) {
        set = new Set();
        this.sessionIndex.set(handle.sessionId, set);
      }
      set.add(handle.id);
    }

    if (handle.taskId) {
      let set = this.taskIndex.get(handle.taskId);
      if (!set) {
        set = new Set();
        this.taskIndex.set(handle.taskId, set);
      }
      set.add(handle.id);
    }

    handle.child.once('close', () => {
      this.completedQueue.push(handle.id);
      this.pruneIfNeeded();
    });
  }

  public get(id: string): ProcessHandle | undefined {
    return this.processes.get(id);
  }

  public getByPid(pid: number): ProcessHandle | undefined {
    const id = this.pidIndex.get(pid);
    return id ? this.processes.get(id) : undefined;
  }

  public listActive(): ProcessHandle[] {
    return Array.from(this.processes.values()).filter(p => p.isAlive);
  }

  public listAll(): ProcessHandle[] {
    return Array.from(this.processes.values());
  }

  public listBySession(sessionId: SessionId): ProcessHandle[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.processes.get(id)!).filter(Boolean);
  }

  public listByTask(taskId: TaskId): ProcessHandle[] {
    const ids = this.taskIndex.get(taskId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.processes.get(id)!).filter(Boolean);
  }

  public remove(id: string): boolean {
    const handle = this.processes.get(id);
    if (!handle) return false;

    if (handle.pid) {
      this.pidIndex.delete(handle.pid);
    }
    if (handle.sessionId) {
      this.sessionIndex.get(handle.sessionId)?.delete(id);
    }
    if (handle.taskId) {
      this.taskIndex.get(handle.taskId)?.delete(id);
    }

    return this.processes.delete(id);
  }

  public killAll(signal: PosixSignal = 'SIGTERM'): void {
    for (const p of this.listActive()) {
      p.kill(signal);
    }
  }

  private pruneIfNeeded(): void {
    while (this.completedQueue.length > this.maxRetainedHistory) {
      const oldestId = this.completedQueue.shift();
      if (oldestId) {
        const handle = this.processes.get(oldestId);
        if (handle && !handle.isAlive) {
          this.remove(oldestId);
        }
      }
    }
  }
}
