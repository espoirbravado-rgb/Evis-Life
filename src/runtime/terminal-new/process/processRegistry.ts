import type { ProcessHandle } from './processHandle.ts';

export class ProcessRegistry {
  private processes: Map<string, ProcessHandle> = new Map();

  public register(handle: ProcessHandle): void {
    this.processes.set(handle.id, handle);
    handle.child.once('close', () => {
      // Keep in registry but marked inactive
    });
  }

  public get(id: string): ProcessHandle | undefined {
    return this.processes.get(id);
  }

  public listActive(): ProcessHandle[] {
    return Array.from(this.processes.values()).filter(p => p.status === 'running');
  }

  public listAll(): ProcessHandle[] {
    return Array.from(this.processes.values());
  }

  public remove(id: string): boolean {
    return this.processes.delete(id);
  }

  public killAll(): void {
    for (const p of this.listActive()) {
      p.kill('SIGTERM');
    }
  }
}
