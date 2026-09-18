import type { ChildProcess } from 'node:child_process';
import { ProcessSignals, type PosixSignal } from './processSignals.ts';
import { ProcessTree } from './processTree.ts';
import type { CommandStatus } from '../terminalTypes.ts';

export class ProcessHandle {
  private _status: CommandStatus = 'running';
  private _exitCode: number | null = null;
  private readonly startTime: number = Date.now();
  private endTime: number | null = null;

  constructor(
    public readonly id: string,
    public readonly command: string,
    public readonly child: ChildProcess
  ) {
    child.once('close', (code) => {
      this._exitCode = code;
      this.endTime = Date.now();
      this._status = code === 0 ? 'completed' : 'failed';
    });

    child.once('error', () => {
      this._status = 'failed';
      this.endTime = Date.now();
    });
  }

  public get pid(): number | undefined {
    return this.child.pid;
  }

  public get status(): CommandStatus {
    return this._status;
  }

  public get exitCode(): number | null {
    return this._exitCode;
  }

  public get durationMs(): number {
    return (this.endTime ?? Date.now()) - this.startTime;
  }

  public kill(signal: PosixSignal = 'SIGTERM'): boolean {
    if (!this.child.pid) return false;

    // Try killing the process group first (when spawned detached)
    const killedGroup = ProcessSignals.killProcessGroup(this.child.pid, signal);
    if (!killedGroup) {
      // Kill all descendants recursively
      const descendants = ProcessTree.getAllDescendantPids(this.child.pid);
      for (const descendant of descendants) {
        ProcessSignals.killPid(descendant, signal);
      }
      ProcessSignals.killPid(this.child.pid, signal);
    }

    this._status = 'killed';
    return true;
  }

  public writeInput(data: string): boolean {
    if (this.child.stdin && !this.child.stdin.destroyed && this.child.stdin.writable) {
      this.child.stdin.write(data);
      return true;
    }
    return false;
  }
}
