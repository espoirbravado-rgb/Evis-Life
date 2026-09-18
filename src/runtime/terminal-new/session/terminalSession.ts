import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { SessionId } from '../terminalTypes.ts';
import type { SessionHistoryEntry, SessionSnapshot, SessionStatus } from './sessionState.ts';

export interface TerminalSessionOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export class TerminalSession {
  private _cwd: string;
  private _previousCwd?: string;
  private _env: Map<string, string> = new Map();
  private _aliases: Map<string, string> = new Map();
  private _history: SessionHistoryEntry[] = [];
  private _activeProcessIds: Set<string> = new Set();
  private _status: SessionStatus = 'active';

  public readonly shell: string;
  public shellPid?: number;
  public readonly createdAt: number = Date.now();
  public lastActiveAt: number = Date.now();

  constructor(
    public readonly id: SessionId,
    options: TerminalSessionOptions | string = {}
  ) {
    const opts: TerminalSessionOptions = typeof options === 'string' ? { cwd: options } : options;
    this._cwd = opts.cwd ? resolve(opts.cwd) : process.cwd();
    this.shell = opts.shell ?? '/bin/bash';

    if (opts.env) {
      for (const [k, v] of Object.entries(opts.env)) {
        this._env.set(k, v);
      }
    }
  }

  public get cwd(): string {
    return this._cwd;
  }

  public get previousCwd(): string | undefined {
    return this._previousCwd;
  }

  public get status(): SessionStatus {
    return this._status;
  }

  public setCwd(newCwd: string): void {
    const resolved = this.resolvePath(newCwd);
    this._previousCwd = this._cwd;
    this._cwd = resolved;
    this.touch();
  }

  /**
   * Resolves paths within the session context:
   * - '~' expands to user's home directory
   * - '-' expands to previous working directory
   * - Relative paths resolve against current session CWD
   */
  public resolvePath(targetPath: string): string {
    const trimmed = targetPath.trim();
    if (trimmed === '~' || trimmed.startsWith('~/')) {
      return resolve(homedir(), trimmed.slice(2));
    }
    if (trimmed === '-') {
      return this._previousCwd ?? this._cwd;
    }
    return resolve(this._cwd, trimmed);
  }

  public getEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of this._env.entries()) {
      result[k] = v;
    }
    return result;
  }

  public setEnvVar(key: string, value: string): void {
    this._env.set(key, value);
    this.touch();
  }

  public removeEnvVar(key: string): void {
    this._env.delete(key);
    this.touch();
  }

  public setAlias(name: string, command: string): void {
    this._aliases.set(name, command);
    this.touch();
  }

  public getAlias(name: string): string | undefined {
    return this._aliases.get(name);
  }

  public removeAlias(name: string): void {
    this._aliases.delete(name);
    this.touch();
  }

  public getAliases(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of this._aliases.entries()) {
      result[k] = v;
    }
    return result;
  }

  public addHistory(entry: SessionHistoryEntry): void {
    this._history.push(entry);
    this.touch();
  }

  public getHistory(): ReadonlyArray<SessionHistoryEntry> {
    return this._history;
  }

  public attachProcess(processId: string): void {
    this._activeProcessIds.add(processId);
    this.touch();
  }

  public detachProcess(processId: string): void {
    this._activeProcessIds.delete(processId);
    this.touch();
  }

  public getActiveProcessIds(): string[] {
    return Array.from(this._activeProcessIds);
  }

  public touch(): void {
    this.lastActiveAt = Date.now();
  }

  public setStatus(status: SessionStatus): void {
    this._status = status;
    this.touch();
  }

  public close(): void {
    this._status = 'closed';
    this.touch();
  }

  public toSnapshot(): SessionSnapshot {
    return {
      sessionId: this.id,
      status: this._status,
      cwd: this._cwd,
      previousCwd: this._previousCwd,
      shell: this.shell,
      shellPid: this.shellPid,
      environmentMetadata: {
        variableCount: this._env.size,
        keys: Array.from(this._env.keys())
      },
      activeProcessIds: Array.from(this._activeProcessIds),
      historyCount: this._history.length,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt
    };
  }
}
