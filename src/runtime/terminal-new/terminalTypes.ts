export type ProcessId = number;
export type SessionId = string;
export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed' | 'timeout';

export interface CommandExecutionOptions {
  sessionId?: SessionId;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  interactive?: boolean;
  background?: boolean;
  requireApproval?: boolean;
  allowElevated?: boolean;
}

export interface CommandOutputChunk {
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: CommandStatus;
  timedOut: boolean;
  truncated: boolean;
  error?: Error;
}

export interface ProcessSpawnConfig {
  command: string;
  args?: string[];
  cwd: string;
  env: Record<string, string>;
  detached?: boolean;
  shell?: boolean | string;
}
