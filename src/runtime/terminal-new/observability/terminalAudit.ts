/**
 * terminalAudit.ts — Phase 10: Observability & Security Audit Trail
 *
 * Implements a comprehensive audit log for the terminal runtime.
 * Expands audit records to capture full context (session, task, actor, sandbox, approval, exit/signal)
 * WITHOUT storing sensitive output or secrets in the audit log.
 */

import type { SessionId, TaskId, CommandStatus } from '../terminalTypes.ts';

export interface AuditRecord {
  eventId: string;
  actorId?: string;
  agentId?: string;
  taskId?: TaskId;
  sessionId?: SessionId;
  processId?: number | null;
  command: string;
  cwd: string;
  decision?: string;
  approval?: {
    required: boolean;
    approved?: boolean;
    requestId?: string;
  };
  sandbox?: {
    driver: string;
    isolated: boolean;
  };
  exitCode: number | null;
  signal?: string | null;
  durationMs: number;
  status: CommandStatus | 'denied' | string;
  timestamp: number;
}

export interface AuditFilter {
  sessionId?: SessionId;
  taskId?: TaskId;
  status?: string;
  since?: number;
}

export class TerminalAudit {
  private records: AuditRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords: number = 10000) {
    this.maxRecords = maxRecords;
  }

  public logExecution(
    entry: {
      command: string;
      cwd?: string;
      durationMs: number;
      exitCode: number | null;
      status: CommandStatus | 'denied' | string;
      actorId?: string;
      agentId?: string;
      taskId?: TaskId;
      sessionId?: SessionId;
      processId?: number | null;
      decision?: string;
      approval?: {
        required: boolean;
        approved?: boolean;
        requestId?: string;
      };
      sandbox?: {
        driver: string;
        isolated: boolean;
      };
      signal?: string | null;
    },
    maybeCwd?: string
  ): AuditRecord {
    const cwd = entry.cwd ?? maybeCwd ?? process.cwd();
    const record: AuditRecord = {
      eventId: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...entry,
      cwd,
    };

    this.records.push(record);

    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }

    return record;
  }

  public getRecords(filter: AuditFilter = {}): ReadonlyArray<AuditRecord> {
    let result = this.records;

    if (filter.sessionId) {
      result = result.filter((r) => r.sessionId === filter.sessionId);
    }
    if (filter.taskId) {
      result = result.filter((r) => r.taskId === filter.taskId);
    }
    if (filter.status) {
      result = result.filter((r) => r.status === filter.status);
    }
    if (filter.since !== undefined) {
      result = result.filter((r) => r.timestamp >= filter.since!);
    }

    return result;
  }

  public clear(): void {
    this.records = [];
  }
}
