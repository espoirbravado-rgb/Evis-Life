import { randomBytes, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type {
  TerminalApprovalGrant,
  TerminalApprovalRequest,
  TerminalPolicyEvaluation,
  TerminalPolicyOptions,
  TerminalRequest,
} from "./terminalTypes";

interface PendingApproval {
  request: TerminalApprovalRequest;
  fingerprint: string;
}

interface StoredGrant {
  token: string;
  fingerprint: string;
  expiresAtMs: number;
}

const DEFAULT_DANGEROUS_PATTERNS = [
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
];

export class TerminalSecurityManager {
  private readonly options: Required<
    Omit<TerminalPolicyOptions, "approvalTtlMs">
  > & { approvalTtlMs: number };

  private readonly pending = new Map<string, PendingApproval>();
  private readonly grants = new Map<string, StoredGrant>();

  constructor(options: TerminalPolicyOptions = {}) {
    this.options = {
      allowShell: options.allowShell ?? true,
      requireApprovalForShell:
        options.requireApprovalForShell ?? true,
      requireApprovalForPatterns:
        options.requireApprovalForPatterns ??
        DEFAULT_DANGEROUS_PATTERNS,
      allowedWorkingDirectories:
        options.allowedWorkingDirectories ?? [],
      approvalTtlMs: options.approvalTtlMs ?? 5 * 60_000,
    };
  }

  async authorize(
    request: TerminalRequest,
    canonicalCwd: string,
  ): Promise<TerminalPolicyEvaluation> {
    const command = request.command.trim();
    const args = request.args ?? [];
    const shell = request.shell ?? request.executionMode === "shell";

    if (!command) {
      return { decision: "deny", reason: "Terminal command cannot be empty." };
    }

    if (!this.isWorkingDirectoryAllowed(canonicalCwd)) {
      return {
        decision: "deny",
        reason: `Working directory is outside the allowed Terminal scope: ${canonicalCwd}`,
      };
    }

    if (shell && !this.options.allowShell) {
      return {
        decision: "deny",
        reason: "Shell execution is disabled by Terminal Security.",
      };
    }

    const needsApproval =
      (Boolean(shell) && this.options.requireApprovalForShell) ||
      this.options.requireApprovalForPatterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test([command, ...args].join(" "));
      });

    if (!needsApproval) {
      return { decision: "allow" };
    }

    const fingerprint = this.fingerprint(request, canonicalCwd, shell);
    const token = request.authorization?.approvalToken;

    if (token) {
      const grant = this.grants.get(token);

      if (!grant) {
        return {
          decision: "deny",
          reason: "Approval token is invalid, expired, or already consumed.",
        };
      }

      // Consume before execution; concurrent reuse cannot succeed.
      this.grants.delete(token);

      if (grant.expiresAtMs <= Date.now()) {
        return {
          decision: "deny",
          reason: "Approval token has expired.",
        };
      }

      if (grant.fingerprint !== fingerprint) {
        return {
          decision: "deny",
          reason: "Approval token does not match this exact command and context.",
        };
      }

      return { decision: "allow", reason: "Explicit approval validated." };
    }

    const now = Date.now();
    const approvalRequest: TerminalApprovalRequest = {
      id: randomUUID(),
      command,
      args: [...args],
      cwd: canonicalCwd,
      shell,
      reason: shell
        ? "Shell execution requires explicit user approval."
        : "Command matches a Terminal Security rule requiring approval.",
      actorId: request.authorization?.actorId,
      sessionId: request.authorization?.sessionId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.options.approvalTtlMs).toISOString(),
    };

    this.pending.set(approvalRequest.id, {
      request: approvalRequest,
      fingerprint,
    });

    return {
      decision: "require_approval",
      reason: approvalRequest.reason,
      approvalRequest,
    };
  }

  approve(requestId: string): TerminalApprovalGrant {
    this.cleanExpired();

    const pending = this.pending.get(requestId);
    if (!pending) {
      throw new Error("Approval request is missing, expired, or already resolved.");
    }

    this.pending.delete(requestId);

    const token = randomBytes(32).toString("hex");
    const expiresAtMs = Date.now() + this.options.approvalTtlMs;
    const expiresAt = new Date(expiresAtMs).toISOString();

    this.grants.set(token, {
      token,
      fingerprint: pending.fingerprint,
      expiresAtMs,
    });

    return { requestId, approvalToken: token, expiresAt };
  }

  reject(requestId: string): boolean {
    return this.pending.delete(requestId);
  }

  getPendingRequest(requestId: string): TerminalApprovalRequest | undefined {
    this.cleanExpired();
    return this.pending.get(requestId)?.request;
  }

  private fingerprint(
    request: TerminalRequest,
    cwd: string,
    shell: boolean | string,
  ): string {
    return JSON.stringify({
      command: request.command.trim(),
      args: request.args ?? [],
      cwd,
      shell,
      actorId: request.authorization?.actorId ?? null,
      sessionId: request.authorization?.sessionId ?? null,
    });
  }

  private cleanExpired(): void {
    const now = Date.now();

    for (const [id, item] of this.pending) {
      if (Date.parse(item.request.expiresAt) <= now) {
        this.pending.delete(id);
      }
    }

    for (const [token, grant] of this.grants) {
      if (grant.expiresAtMs <= now) {
        this.grants.delete(token);
      }
    }
  }

  private isWorkingDirectoryAllowed(cwd: string): boolean {
    const roots = this.options.allowedWorkingDirectories;

    if (roots.length === 0) {
      return isAbsolute(cwd);
    }

    return roots.some((configuredRoot) => {
      try {
        const root = realpathSync(resolve(configuredRoot));
        const target = realpathSync(cwd);
        const rel = relative(root, target);

        return (
          rel === "" ||
          (!rel.startsWith(`..${sep}`) &&
            rel !== ".." &&
            !isAbsolute(rel))
        );
      } catch {
        return false;
      }
    });
  }
}