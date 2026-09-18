import type { ChildProcess } from 'node:child_process';
import { ProcessSignals, type PosixSignal } from './processSignals.ts';
import { ProcessTree } from './processTree.ts';
import { OutputBuffer } from '../streaming/outputBuffer.ts';
import { SecretRedactor } from '../security/secretRedactor.ts';
import { OutputParser } from '../parser/outputParser.ts';
import type { BackgroundJobLogs, ProcessHandleSnapshot, ProcessState, SessionId, TaskId } from '../terminalTypes.ts';

export interface ProcessHandleOptions {
  cwd?: string;
  sessionId?: SessionId;
  taskId?: TaskId;
  maxLogBytes?: number;
}

export class ProcessHandle {
  private _state: ProcessState = 'starting';
  private _exitCode: number | null = null;
  private _signal: NodeJS.Signals | null = null;
  private _error?: Error;
  private readonly _startedAt: number = Date.now();
  private _finishedAt: number | null = null;
  private _targetStateOnClose?: 'killed' | 'timeout' | 'cancelled';

  private readonly stdoutBuffer: OutputBuffer;
  private readonly stderrBuffer: OutputBuffer;

  public readonly cwd: string;
  public readonly sessionId?: SessionId;
  public readonly taskId?: TaskId;

  private exitPromise: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
  private resolveExit!: (value: { exitCode: number | null; signal: NodeJS.Signals | null }) => void;

  constructor(
    public readonly id: string,
    public readonly command: string,
    public readonly child: ChildProcess,
    options: ProcessHandleOptions = {}
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.sessionId = options.sessionId;
    this.taskId = options.taskId;

    const logBytes = options.maxLogBytes ?? 1024 * 1024; // 1MB default log buffer
    this.stdoutBuffer = new OutputBuffer(logBytes);
    this.stderrBuffer = new OutputBuffer(logBytes);

    this.exitPromise = new Promise(resolve => {
      this.resolveExit = resolve;
    });

    if (child.pid) {
      this._state = 'running';
    } else {
      child.once('spawn', () => {
        if (this._state === 'starting') {
          this._state = 'running';
        }
      });
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer.append(chunk.toString('utf-8'));
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      this.stderrBuffer.append(chunk.toString('utf-8'));
    });

    child.once('exit', (code, signal) => {
      this._exitCode = code;
      this._signal = signal;
    });

    child.once('close', (code, signal) => {
      this._exitCode = code;
      this._signal = signal;
      this._finishedAt = Date.now();

      if (this._targetStateOnClose) {
        this._state = this._targetStateOnClose;
      } else if (this._state === 'stopping') {
        this._state = 'killed';
      } else if (code === 0) {
        this._state = 'exited';
      } else {
        this._state = 'failed';
      }

      this.resolveExit({ exitCode: code, signal });
    });

    child.once('error', (err) => {
      this._error = err;
      this._finishedAt = Date.now();
      this._state = 'failed';
      this.resolveExit({ exitCode: 1, signal: null });
    });
  }

  public get pid(): number | undefined {
    return this.child.pid;
  }

  public get state(): ProcessState {
    return this._state;
  }

  public get exitCode(): number | null {
    return this._exitCode;
  }

  public get signal(): NodeJS.Signals | null {
    return this._signal;
  }

  public get error(): Error | undefined {
    return this._error;
  }

  public get startedAt(): number {
    return this._startedAt;
  }

  public get finishedAt(): number | null {
    return this._finishedAt;
  }

  public get durationMs(): number {
    return (this._finishedAt ?? Date.now()) - this._startedAt;
  }

  public get isAlive(): boolean {
    if (!this.child.pid) return false;
    if (['exited', 'failed', 'killed', 'timeout', 'cancelled'].includes(this._state)) return false;
    return ProcessSignals.isAlive(this.child.pid);
  }

  public wait(): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
    return this.exitPromise;
  }

  public sendSignal(sig: PosixSignal = 'SIGTERM'): boolean {
    if (!this.child.pid || !this.isAlive) return false;
    return ProcessSignals.killPid(this.child.pid, sig);
  }

  public kill(sig: PosixSignal = 'SIGTERM'): boolean {
    if (!this.child.pid || !this.isAlive) return false;

    this._state = 'stopping';
    if (!this._targetStateOnClose) {
      this._targetStateOnClose = 'killed';
    }

    // 1. Try sending signal to the process group
    const killedGroup = ProcessSignals.killProcessGroup(this.child.pid, sig);
    if (!killedGroup) {
      // 2. Terminate the entire process tree
      ProcessTree.killTree(this.child.pid, sig);
    }

    return true;
  }

  public markTimeout(): boolean {
    if (!this.child.pid || !this.isAlive) return false;
    this._targetStateOnClose = 'timeout';
    return this.kill('SIGKILL');
  }

  public markCancelled(): boolean {
    if (!this.child.pid || !this.isAlive) return false;
    this._targetStateOnClose = 'cancelled';
    return this.kill('SIGTERM');
  }

  public writeInput(data: string): boolean {
    if (this.child.stdin && !this.child.stdin.destroyed && this.child.stdin.writable) {
      this.child.stdin.write(data);
      return true;
    }
    return false;
  }

  public getLogs(): BackgroundJobLogs {
    return {
      stdout: SecretRedactor.redact(OutputParser.clean(this.stdoutBuffer.toString())),
      stderr: SecretRedactor.redact(OutputParser.clean(this.stderrBuffer.toString())),
      truncated: this.stdoutBuffer.truncated || this.stderrBuffer.truncated
    };
  }

  public toSnapshot(): ProcessHandleSnapshot {
    return {
      id: this.id,
      command: this.command,
      pid: this.child.pid,
      state: this._state,
      exitCode: this._exitCode,
      signal: this._signal,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      durationMs: this.durationMs,
      cwd: this.cwd,
      sessionId: this.sessionId,
      taskId: this.taskId
    };
  }
}
