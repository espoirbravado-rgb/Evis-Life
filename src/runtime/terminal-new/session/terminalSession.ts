import type { SessionId } from '../terminalTypes.ts';
import type { SessionHistoryEntry, SessionSnapshot } from './sessionState.ts';

export class TerminalSession {
  private _cwd: string;
  private _env: Record<string, string>;
  private _history: SessionHistoryEntry[] = [];
  public readonly createdAt: number = Date.now();
  public lastActiveAt: number = Date.now();

  constructor(
    public readonly id: SessionId,
    initialCwd: string = process.cwd(),
    initialEnv: Record<string, string> = {}
  ) {
    this._cwd = initialCwd;
    this._env = { ...initialEnv };
  }

  public get cwd(): string {
    return this._cwd;
  }

  public setCwd(newCwd: string): void {
    this._cwd = newCwd;
    this.touch();
  }

  public getEnv(): Record<string, string> {
    return { ...this._env };
  }

  public setEnvVar(key: string, value: string): void {
    this._env[key] = value;
    this.touch();
  }

  public addHistory(entry: SessionHistoryEntry): void {
    this._history.push(entry);
    this.touch();
  }

  public getHistory(): ReadonlyArray<SessionHistoryEntry> {
    return this._history;
  }

  public touch(): void {
    this.lastActiveAt = Date.now();
  }

  public toSnapshot(): SessionSnapshot {
    return {
      sessionId: this.id,
      cwd: this._cwd,
      env: { ...this._env },
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      historyCount: this._history.length
    };
  }
}
