import { DefaultTerminalEnvironment } from "./terminalEnvironment";
import { NodeTerminalExecutor } from "./terminalExecutor";
import { TerminalSecurityManager } from "./terminalPolicy";
import type {
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
    const cwd = request.cwd ?? this.defaultCwd;

    let context;

    try {
      context = this.environment.resolve(cwd, request.env);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid Terminal environment.";

      const status = message.includes("does not exist")
        ? "working_directory_not_found"
        : "execution_error";

      const now = new Date().toISOString();

      return {
        status,
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        command: request.command,
        args: request.args ?? [],
        cwd: cwd ?? process.cwd(),
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        errorMessage: message,
      };
    }

    const policy = await this.security.authorize({
      ...request,
      cwd: context.cwd,
    });

    if (policy.decision === "deny") {
      const now = new Date().toISOString();

      return {
        status: "policy_denied",
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        command: request.command,
        args: request.args ?? [],
        cwd: context.cwd,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        errorMessage: policy.reason,
      };
    }

    if (policy.decision === "require_approval") {
      const now = new Date().toISOString();

      return {
        status: "approval_required",
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        command: request.command,
        args: request.args ?? [],
        cwd: context.cwd,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        errorMessage:
          policy.reason ?? "Terminal execution requires user approval.",
      };
    }

    return this.executor.execute(
      {
        ...request,
        cwd: context.cwd,
      },
      context,
    );
  }
}