import type { SessionId } from '../terminalTypes.ts';

export interface SessionHistoryEntry {
  command: string;
  exitCode: number | null;
  timestamp: number;
  durationMs: number;
}

export interface SessionSnapshot {
  sessionId: SessionId;
  cwd: string;
  env: Record<string, string>;
  createdAt: number;
  lastActiveAt: number;
  historyCount: number;
}
