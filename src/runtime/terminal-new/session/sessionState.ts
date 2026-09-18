import type { SessionId } from '../terminalTypes.ts';

export type SessionStatus = 'active' | 'detached' | 'closed';

export interface SessionHistoryEntry {
  command: string;
  exitCode: number | null;
  timestamp: number;
  durationMs: number;
}

export interface SessionEnvironmentMetadata {
  variableCount: number;
  keys: string[];
}

export interface SessionSnapshot {
  sessionId: SessionId;
  status: SessionStatus;
  cwd: string;
  previousCwd?: string;
  shell: string;
  shellPid?: number;
  environmentMetadata: SessionEnvironmentMetadata;
  activeProcessIds: string[];
  historyCount: number;
  createdAt: number;
  lastActiveAt: number;
}
