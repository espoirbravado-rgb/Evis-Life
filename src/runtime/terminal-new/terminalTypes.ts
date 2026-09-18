export type ProcessId = number;
export type SessionId = string;
export type TaskId = string;
export type ActorId = string;

export type ProcessState =
  | 'created'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'exited'
  | 'failed'
  | 'killed'
  | 'timeout'
  | 'cancelled';

export type CommandStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'timeout'
  | 'cancelled'
  | 'denied'
  | 'approval_required';

export type PolicyAction = 'allow' | 'deny' | 'require_approval';

export interface PolicyDecision {
  action: PolicyAction;
  reason?: string;
  modifiedCommand?: string;
  effectiveTimeoutMs?: number;
  maxOutputBytes?: number;
}

export interface CommandExecutionOptions {
  sessionId?: SessionId;
  taskId?: TaskId;
  agentId?: string;
  actorId?: ActorId;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  interactive?: boolean;
  background?: boolean;
  requireApproval?: boolean;
  allowElevated?: boolean;
  signal?: AbortSignal;
}

export interface CommandOutputChunk {
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: CommandStatus;
  timedOut: boolean;
  cancelled?: boolean;
  truncated: boolean;
  sessionId?: SessionId;
  processId?: ProcessId;
  taskId?: TaskId;
  agentId?: string;
  error?: Error;
}

export interface ProcessSpawnConfig {
  command: string;
  args?: string[];
  cwd: string;
  env: Record<string, string>;
  sessionId?: SessionId;
  taskId?: TaskId;
  detached?: boolean;
  shell?: boolean | string;
}

export interface ProcessHandleSnapshot {
  id: string;
  command: string;
  pid?: number;
  state: ProcessState;
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number;
  cwd: string;
  sessionId?: SessionId;
  taskId?: TaskId;
}

export interface BackgroundJobSnapshot {
  id: string;
  command: string;
  pid?: number;
  state: ProcessState;
  cwd: string;
  sessionId?: SessionId;
  taskId?: TaskId;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number;
  exitCode: number | null;
}

export interface BackgroundJobLogs {
  stdout: string;
  stderr: string;
  truncated: boolean;
}
