import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ProcessHandle } from './processHandle.ts';
import { ProcessRegistry } from './processRegistry.ts';
import type { ProcessSpawnConfig } from '../terminalTypes.ts';

export class ProcessManager {
  private registry: ProcessRegistry = new ProcessRegistry();

  constructor(private readonly maxConcurrent: number = 10) {}

  public spawn(config: ProcessSpawnConfig): ProcessHandle {
    if (this.registry.listActive().length >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent processes limit reached (${this.maxConcurrent})`);
    }

    const child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: config.env,
      detached: config.detached ?? true,
      shell: config.shell ?? '/bin/bash',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const handle = new ProcessHandle(randomUUID(), config.command, child);
    this.registry.register(handle);
    return handle;
  }

  public getRegistry(): ProcessRegistry {
    return this.registry;
  }

  public killProcess(id: string): boolean {
    const handle = this.registry.get(id);
    if (!handle) return false;
    return handle.kill();
  }

  public cleanup(): void {
    this.registry.killAll();
  }
}
