import { DefaultTerminalEnvironment } from "./terminalEnvironment";
import { NodeTerminalExecutor } from "./terminalExecutor";
import { TerminalSecurityManager } from "./terminalPolicy";
import type {
  TerminalApprovalGrant,
  TerminalApprovalRequest,
  TerminalExecutionResult,
  TerminalRequest,
  TerminalRuntimeOptions,
} from "./terminalTypes";

export class TerminalRuntime {
  private readonly environment: DefaultTerminalEnvironment;
  private readonly security: TerminalSecurityManager;
  private readonly executor: NodeTerminalExecutor;
  private readonly defaultCwd?: string;

  constructor(options: TerminalRuntimeOptions = {}) {
    this.environment = new DefaultTerminalEnvironment(options.environment);
    this.security = new TerminalSecurityManager(options.policy);
    this.executor = new NodeTerminalExecutor(options.executor);
    this.defaultCwd = options.defaultCwd;
  }

  async execute(request: TerminalRequest): Promise<TerminalExecutionResult> {
    const requestedCwd = request.cwd ?? this.defaultCwd;
    const startedAt = new Date().toISOString();

    let context;

    try {
      context = this.environment.resolve(requestedCwd, request.env);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid Terminal environment.";

      return this.emptyResult(
        request,
        message.includes("does not exist")
          ? "working_directory_not_found"
          : "execution_error",
        message,
        requestedCwd ?? process.cwd(),
        startedAt,
      );
    }

    let policy;

    try {
      policy = await this.security.authorize(
        { ...request, cwd: context.cwd },
        context.cwd,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terminal policy evaluation failed.";

      return this.emptyResult(
        request,
        "execution_error",
        message,
        context.cwd,
        startedAt,
      );
    }

    if (policy.decision === "deny") {
      return {
        ...this.emptyResult(
          request,
          "policy_denied",
          policy.reason ?? "Terminal execution denied by policy.",
          context.cwd,
          startedAt,
        ),
      };
    }

    if (policy.decision === "require_approval") {
      return {
        ...this.emptyResult(
          request,
          "approval_required",
          policy.reason ?? "Terminal execution requires approval.",
          context.cwd,
          startedAt,
        ),
        approvalRequest: policy.approvalRequest,
      };
    }

    return this.executor.execute(
      { ...request, cwd: context.cwd },
      context,
    );
  }

  approve(requestId: string): TerminalApprovalGrant {
    return this.security.approve(requestId);
  }

  reject(requestId: string): boolean {
    return this.security.reject(requestId);
  }

  getPendingApproval(
    requestId: string,
  ): TerminalApprovalRequest | undefined {
    return this.security.getPendingRequest(requestId);
  }

  private emptyResult(
    request: TerminalRequest,
    status: TerminalExecutionResult["status"],
    errorMessage: string,
    cwd: string,
    timestamp: string,
  ): TerminalExecutionResult {
    return {
      status,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      command: request.command,
      args: request.args ?? [],
      cwd,
      startedAt: timestamp,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      errorMessage,
    };
  }
}