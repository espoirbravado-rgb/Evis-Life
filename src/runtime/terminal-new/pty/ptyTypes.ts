import type { SessionId } from '../terminalTypes.ts';

export interface PtyDimensions {
  cols: number;
  rows: number;
}

export interface PtySpawnOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  sessionId?: SessionId;
  taskId?: string;
  agentId?: string;
  approvalToken?: string;
  /** When true, policy will return require_approval even for non-restricted commands. */
  requireApproval?: boolean;
  /** When true, allows commands that match restricted patterns without requiring approval. */
  allowElevated?: boolean;
  sandbox?: {
    required?: boolean;
    driver?: 'bubblewrap' | 'local';
  };
}

export interface IPtyInstance {
  readonly pid: number;
  readonly cols: number;
  readonly rows: number;
  readonly isPty: true;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitCode: number, signal?: string) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}
