
import type {
  TerminalEnvironment,
  TerminalExecutionResult,
  TerminalExecutor,
  TerminalPolicy,
  TerminalRequest,
  TerminalResultStatus,
} from "./terminalTypes";

export class TerminalRuntime {
  constructor(
    private readonly policy: {
      evaluate(
        request: TerminalRequest,
      ): Promise<{
        decision: "allow" | "deny" | "require_approval";
        reason?: string;
        approvalRequest?: NonNullable<
          TerminalExecutionResult["approvalRequest"]
        >;
      }>;
    },
    private readonly environment: TerminalEnvironment,
    private readonly executor: TerminalExecutor,
  ) {}

  async execute(
    request: TerminalRequest,
  ): Promise<TerminalExecutionResult> {
    const startedAt = new Date();
    const startedTime = Date.now();

    const policyResult = await this.policy.evaluate(request);

    if (policyResult.decision !== "allow") {
      const status: TerminalResultStatus =
        policyResult.decision === "deny"
          ? "policy_denied"
          : "approval_required";

      return this.createResult(
        request,
        status,
        startedAt,
        startedTime,
        {
          errorCode: status.toUpperCase(),
          errorMessage: policyResult.reason,
          approvalRequest: policyResult.approvalRequest,
        },
      );
    }

    let context;

    try {
      context = this.environment.resolve(
        request.cwd,
        request.env,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const status: TerminalResultStatus =
        message.includes("does not exist")
          ? "working_directory_not_found"
          : message.includes("Permission denied")
            ? "permission_denied"
            : "execution_error";

      return this.createResult(
        request,
        status,
        startedAt,
        startedTime,
        {
          errorCode: status.toUpperCase(),
          errorMessage: message,
        },
      );
    }

    try {
      return await this.executor.execute(
        request,
        context,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return this.createResult(
        request,
        "execution_error",
        startedAt,
        startedTime,
        {
          errorCode: "RUNTIME_EXECUTION_ERROR",
          errorMessage: message,
        },
      );
    }
  }

  private createResult(
    request: TerminalRequest,
    status: TerminalResultStatus,
    startedAt: Date,
    startedTime: number,
    extra: Partial<TerminalExecutionResult> = {},
  ): TerminalExecutionResult {
    return {
      status,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      command: request.command,
      args: [...(request.args ?? [])],
      cwd: request.cwd ?? process.cwd(),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTime,
      ...extra,
    };
  }
}

