import { randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  TerminalApprovalDecision,
  TerminalApprovalHandler,
  TerminalPolicyEvaluation,
  TerminalPolicyOptions,
  TerminalRequest,
} from "./terminalTypes";

export class TerminalSecurityManager {
  private readonly options: Required<
    Omit<TerminalPolicyOptions, "approvalHandler">
  > & {
    approvalHandler?: TerminalApprovalHandler;
  };

  constructor(options: TerminalPolicyOptions = {}) {
    this.options = {
      allowShell: options.allowShell ?? true,
      requireApprovalForShell: options.requireApprovalForShell ?? true,
      requireApprovalForPatterns:
        options.requireApprovalForPatterns ?? [
          /\brm\s+(-[^\s]+\s+)*-[^\s]*r/i,
          /\bsudo\b/i,
          /\bmkfs\b/i,
          /\bdd\s+if=/i,
          /\bshutdown\b/i,
          /\breboot\b/i,
          /\bpoweroff\b/i,
          /\bkill\s+(-9|--signal\s*=?\s*9)\b/i,
          /\bchmod\s+777\b/i,
          /\bchown\b/i,
        ],
      allowedWorkingDirectories:
        options.allowedWorkingDirectories ?? [],
      approvalHandler: options.approvalHandler,
    };
  }

  async authorize(request: TerminalRequest): Promise<TerminalPolicyEvaluation> {
    const command = request.command.trim();
    const args = request.args ?? [];
    const cwd = resolve(request.cwd ?? process.cwd());
    const shell = request.shell ?? request.executionMode === "shell";

    if (!command) {
      return {
        decision: "deny",
        reason: "Terminal command cannot be empty.",
      };
    }

    if (!this.isWorkingDirectoryAllowed(cwd)) {
      return {
        decision: "deny",
        reason: `Working directory is outside the allowed Terminal scope: ${cwd}`,
      };
    }

    if (shell && !this.options.allowShell) {
      return {
        decision: "deny",
        reason: "Shell execution is disabled by Terminal Security.",
      };
    }

    const commandLine = [command, ...args].join(" ");

    if (shell && this.options.requireApprovalForShell) {
      return this.requestApproval(
        request,
        cwd,
        shell,
        "Shell execution requires user approval.",
      );
    }

    const dangerousPattern = this.options.requireApprovalForPatterns.find(
      (pattern) => pattern.test(commandLine),
    );

    if (dangerousPattern) {
      return this.requestApproval(
        request,
        cwd,
        shell,
        "Command matches a Terminal Security rule requiring approval.",
      );
    }

    return {
      decision: "allow",
    };
  }

  private async requestApproval(
    request: TerminalRequest,
    cwd: string,
    shell: boolean | string,
    reason: string,
  ): Promise<TerminalPolicyEvaluation> {
    const approvalRequest = {
      id: randomUUID(),
      command: request.command,
      args: request.args ?? [],
      cwd,
      shell,
      reason,
      actorId: request.authorization?.actorId,
      sessionId: request.authorization?.sessionId,
      createdAt: new Date().toISOString(),
    };

    if (!this.options.approvalHandler) {
      return {
        decision: "require_approval",
        reason,
        approvalRequest,
      };
    }

    const decision: TerminalApprovalDecision =
      await this.options.approvalHandler(approvalRequest);

    if (!decision.approved) {
      return {
        decision: "deny",
        reason: decision.reason ?? "User rejected Terminal execution.",
        approvalRequest,
      };
    }

    return {
      decision: "allow",
      reason: decision.reason ?? "Terminal execution approved.",
      approvalRequest,
    };
  }

  private isWorkingDirectoryAllowed(cwd: string): boolean {
    const allowed = this.options.allowedWorkingDirectories;

    if (allowed.length === 0) {
      return isAbsolute(cwd);
    }

    return allowed.some((directory) => {
      const root = resolve(directory);
      const relativePath = relative(root, cwd);

      return (
        relativePath === "" ||
        (!relativePath.startsWith("..") && !isAbsolute(relativePath))
      );
    });
  }
}