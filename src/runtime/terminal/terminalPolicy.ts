
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  TerminalApprovalHandler,
  TerminalApprovalRequest,
  TerminalPolicyDecision,
  TerminalPolicyEvaluation,
  TerminalPolicyOptions,
  TerminalRequest,
} from "./terminalTypes";

export class TerminalPolicy {
  private readonly options: Required<TerminalPolicyOptions>;
  private readonly approvalHandler?: TerminalApprovalHandler;

  constructor(
    options: TerminalPolicyOptions = {},
    approvalHandler?: TerminalApprovalHandler,
  ) {
    this.options = {
      allowShell: options.allowShell ?? false,
      requireApprovalForShell:
        options.requireApprovalForShell ?? true,
      requireApprovalForPatterns:
        options.requireApprovalForPatterns ?? [],
      allowedWorkingDirectories:
        options.allowedWorkingDirectories ?? [],
      approvalTtlMs: options.approvalTtlMs ?? 5 * 60 * 1000,
    };

    this.approvalHandler = approvalHandler;
  }

  async evaluate(
    request: TerminalRequest,
  ): Promise<TerminalPolicyEvaluation> {
    const command = request.command.trim();
    const args = request.args ?? [];
    const cwd = path.resolve(request.cwd ?? process.cwd());
    const shell = request.shell ?? false;
    const executionMode = request.executionMode ?? "direct";

    if (!command) {
      return this.deny("Empty command.");
    }

    if (
      executionMode === "shell" &&
      !this.options.allowShell
    ) {
      return this.deny("Shell execution is disabled.");
    }

    if (
      !this.isWorkingDirectoryAllowed(cwd)
    ) {
      return this.deny(
        "Working directory is outside the allowed directories.",
      );
    }

    const approvalReason = this.getApprovalReason(
      request,
      command,
      args,
      shell,
      executionMode,
    );

    if (!approvalReason) {
      return {
        decision: "allow",
        reason: "Request satisfies the configured policy.",
      };
    }

    return this.requestApproval(
      request,
      command,
      args,
      cwd,
      shell,
      approvalReason,
    );
  }

  private getApprovalReason(
    request: TerminalRequest,
    command: string,
    args: string[],
    shell: boolean | string,
    executionMode: string,
  ): string | undefined {
    if (
      executionMode === "shell" ||
      shell === true ||
      typeof shell === "string"
    ) {
      if (this.options.requireApprovalForShell) {
        return "Shell execution requires approval.";
      }
    }

    const commandLine = [command, ...args].join(" ");

    for (const pattern of this.options.requireApprovalForPatterns) {
      pattern.lastIndex = 0;

      if (pattern.test(commandLine)) {
        return `Command matches approval rule: ${pattern}`;
      }
    }

    return undefined;
  }

  private isWorkingDirectoryAllowed(cwd: string): boolean {
    const allowedDirectories =
      this.options.allowedWorkingDirectories;

    if (allowedDirectories.length === 0) {
      return true;
    }

    return allowedDirectories.some((directory) => {
      const allowedPath = path.resolve(directory);
      const relativePath = path.relative(allowedPath, cwd);

      return (
        relativePath === "" ||
        (
          relativePath !== ".." &&
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath)
        )
      );
    });
  }

  private async requestApproval(
    request: TerminalRequest,
    command: string,
    args: string[],
    cwd: string,
    shell: boolean | string,
    reason: string,
  ): Promise<TerminalPolicyEvaluation> {
    const now = Date.now();

    const approvalRequest: TerminalApprovalRequest = {
      id: randomUUID(),
      command,
      args: [...args],
      cwd,
      shell,
      execution: {
        env: request.env
          ? { ...request.env }
          : undefined,
        stdin: request.stdin,
        timeoutMs: request.timeoutMs,
        maxOutputBytes: request.maxOutputBytes,
        executionMode: request.executionMode ?? "direct",
      },
      reason,
      actorId: request.authorization?.actorId,
      sessionId: request.authorization?.sessionId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(
        now + this.options.approvalTtlMs,
      ).toISOString(),
    };

    if (!this.approvalHandler) {
      return {
        decision: "require_approval",
        reason,
        approvalRequest,
      };
    }

    const approval = await this.approvalHandler(
      approvalRequest,
    );

    if (!approval.approved) {
      return {
        decision: "require_approval",
        reason: approval.reason ?? reason,
        approvalRequest,
      };
    }

    return {
      decision: "allow",
      reason: "Request approved.",
      approvalRequest,
    };
  }

  private deny(
    reason: string,
  ): TerminalPolicyEvaluation {
    return {
      decision: "deny",
      reason,
    };
  }
}

