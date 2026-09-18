import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ProcessHandle } from './processHandle.ts';
import { ProcessRegistry } from './processRegistry.ts';
import type { PosixSignal } from './processSignals.ts';
import type { BackgroundJobLogs, ProcessSpawnConfig } from '../terminalTypes.ts';

export class ProcessManager {
  private registry: ProcessRegistry = new ProcessRegistry();

  constructor(private readonly maxConcurrent: number = 10) {}

  public spawn(config: ProcessSpawnConfig): ProcessHandle {
    const activeCount = this.registry.listActive().length;
    if (activeCount >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent processes limit reached (${this.maxConcurrent})`);
    }

    const child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: config.env,
      detached: config.detached ?? true,
      shell: config.shell ?? '/bin/bash',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const handle = new ProcessHandle(randomUUID(), config.command, child, {
      cwd: config.cwd,
      sessionId: config.sessionId,
      taskId: config.taskId
    });

    this.registry.register(handle);
    return handle;
  }

  public get(id: string): ProcessHandle | undefined {
    return this.registry.get(id);
  }

  public getRegistry(): ProcessRegistry {
    return this.registry;
  }

  public listActive(): ProcessHandle[] {
    return this.registry.listActive();
  }

  public getActiveProcessCount(): number {
    return this.registry.listActive().length;
  }

  public listAll(): ProcessHandle[] {
    return this.registry.listAll();
  }

  public getProcessLogs(id: string): BackgroundJobLogs | undefined {
    const handle = this.registry.get(id);
    if (!handle) return undefined;
    return handle.getLogs();
  }

  public async wait(id: string): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null } | undefined> {
    const handle = this.registry.get(id);
    if (!handle) return undefined;
    return handle.wait();
  }

  public signal(id: string, sig: PosixSignal = 'SIGTERM'): boolean {
    const handle = this.registry.get(id);
    if (!handle) return false;
    return handle.sendSignal(sig);
  }

  public kill(id: string, sig: PosixSignal = 'SIGTERM'): boolean {
    const handle = this.registry.get(id);
    if (!handle) return false;
    return handle.kill(sig);
  }

  public cleanup(): void {
    this.registry.killAll('SIGTERM');
  }
}
