export type TerminalExecutionMode = "direct" | "shell";

export type TerminalResultStatus =
  | "success"
  | "non_zero_exit"
  | "timeout"
  | "cancelled"
  | "command_not_found"
  | "permission_denied"
  | "working_directory_not_found"
  | "policy_denied"
  | "approval_required"
  | "output_limit"
  | "execution_error";

export type TerminalPolicyDecision =
  | "allow"
  | "deny"
  | "require_approval";

export interface TerminalRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  shell?: boolean | string;
  timeoutMs?: number;
  signal?: AbortSignal;
  stdin?: string;
  maxOutputBytes?: number;
  executionMode?: TerminalExecutionMode;
  authorization?: TerminalAuthorizationContext;
  metadata?: Record<string, unknown>;
}

export interface TerminalAuthorizationContext {
  actorId?: string;
  sessionId?: string;
  reason?: string;
  trusted?: boolean;
  approvalToken?: string;
  metadata?: Record<string, unknown>;
}

export interface TerminalApprovalRequest {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  shell: boolean | string;
  reason?: string;
  actorId?: string;
  sessionId?: string;
  createdAt: string;
}

export interface TerminalApprovalDecision {
  approved: boolean;
  approvalToken?: string;
  reason?: string;
}

export type TerminalApprovalHandler = (
  request: TerminalApprovalRequest,
) => Promise<TerminalApprovalDecision>;

export interface TerminalPolicyEvaluation {
  decision: TerminalPolicyDecision;
  reason?: string;
  approvalRequest?: TerminalApprovalRequest;
}

export interface TerminalExecutionContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface TerminalExecutionResult {
  status: TerminalResultStatus;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  command: string;
  args: string[];
  cwd: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pid?: number;
  errorCode?: string;
  errorMessage?: string;
  truncated?: boolean;
}

export interface TerminalEnvironmentOptions {
  inheritProcessEnv?: boolean;
  blockedEnvKeys?: string[];
  allowedEnvKeys?: string[];
}

export interface TerminalPolicyOptions {
  allowShell?: boolean;
  requireApprovalForShell?: boolean;
  requireApprovalForPatterns?: RegExp[];
  allowedWorkingDirectories?: string[];
  approvalHandler?: TerminalApprovalHandler;
}

export interface TerminalExecutorOptions {
  defaultTimeoutMs?: number;
  defaultMaxOutputBytes?: number;
  killSignal?: NodeJS.Signals | number;
}

export interface TerminalRuntimeOptions {
  environment?: TerminalEnvironmentOptions;
  policy?: TerminalPolicyOptions;
  executor?: TerminalExecutorOptions;
  defaultCwd?: string;
}

export interface TerminalExecutor {
  execute(
    request: TerminalRequest,
    context: TerminalExecutionContext,
  ): Promise<TerminalExecutionResult>;
}

export interface TerminalEnvironment {
  resolve(
    requestedCwd?: string,
    requestEnv?: Record<string, string | undefined>,
  ): TerminalExecutionContext;
}