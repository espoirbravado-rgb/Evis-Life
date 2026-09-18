import type { CommandResult } from '../terminalTypes.ts';

export interface AuditRecord {
  id: string;
  command: string;
  cwd: string;
  timestamp: number;
  durationMs: number;
  exitCode: number | null;
  status: string;
}

export class TerminalAudit {
  private records: AuditRecord[] = [];

  public logExecution(result: CommandResult, cwd: string): void {
    this.records.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      command: result.command,
      cwd,
      timestamp: Date.now(),
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      status: result.status
    });
  }

  public getRecords(): ReadonlyArray<AuditRecord> {
    return this.records;
  }

  public clear(): void {
    this.records = [];
  }
}
