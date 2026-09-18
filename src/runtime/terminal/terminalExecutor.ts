
import { spawn } from "node:child_process";

import type {
  TerminalExecutionContext,
  TerminalExecutionResult,
  TerminalExecutor,
  TerminalExecutorOptions,
  TerminalRequest,
  TerminalResultStatus,
} from "./terminalTypes";

export class TerminalProcessExecutor implements TerminalExecutor {
  private readonly options: Required<TerminalExecutorOptions>;

  constructor(options: TerminalExecutorOptions = {}) {
    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      defaultMaxOutputBytes: options.defaultMaxOutputBytes ?? 1_000_000,
      killSignal: options.killSignal ?? "SIGTERM",
    };
  }

  execute(
    request: TerminalRequest,
    context: TerminalExecutionContext,
  ): Promise<TerminalExecutionResult> {
    return new Promise((resolve) => {
      const startedAt = new Date();
      const startedTime = Date.now();

      const command = request.command.trim();
      const args = request.args ?? [];
      const cwd = context.cwd;

      const timeoutMs = Math.max(
        1,
        request.timeoutMs ?? this.options.defaultTimeoutMs,
      );

      const maxOutputBytes = Math.max(
        0,
        request.maxOutputBytes ?? this.options.defaultMaxOutputBytes,
      );

      const shell =
        request.executionMode === "shell"
          ? true
          : request.shell ?? false;

      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let truncated = false;
      let settled = false;
      let timedOut = false;
      let cancelled = false;
      let childPid: number | undefined;

      let timeout: NodeJS.Timeout | undefined;

      const finish = (
        status: TerminalResultStatus,
        exitCode: number | null,
        signal: string | null,
        errorCode?: string,
        errorMessage?: string,
      ) => {
        if (settled) return;
        settled = true;

        if (timeout) {
          clearTimeout(timeout);
        }

        request.signal?.removeEventListener(
          "abort",
          onAbort,
        );

        resolve({
          status,
          exitCode,
          signal,
          stdout,
          stderr,
          command,
          args: [...args],
          cwd,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedTime,
          pid: childPid,
          errorCode,
          errorMessage,
          truncated,
        });
      };

      const appendOutput = (
        chunk: Buffer,
        stream: "stdout" | "stderr",
      ) => {
        const remaining = maxOutputBytes - outputBytes;

        if (remaining <= 0) {
          truncated = true;
          return;
        }

        const accepted = chunk.subarray(
          0,
          Math.min(chunk.length, remaining),
        );

        outputBytes += accepted.length;

        const text = accepted.toString("utf8");

        if (stream === "stdout") {
          stdout += text;
        } else {
          stderr += text;
        }

        if (accepted.length < chunk.length) {
          truncated = true;
        }
      };

      const killChild = () => {
        if (!child || child.killed) return;

        try {
          child.kill(this.options.killSignal);
        } catch {
          // The process may already have exited.
        }
      };

      const onAbort = () => {
        if (settled) return;

        cancelled = true;
        killChild();

        finish(
          "cancelled",
          null,
          null,
          "ABORT_ERR",
          "Execution was cancelled.",
        );
      };

      if (request.signal?.aborted) {
        finish(
          "cancelled",
          null,
          null,
          "ABORT_ERR",
          "Execution was cancelled before it started.",
        );
        return;
      }

      let child: ReturnType<typeof spawn>;

      try {
        child = spawn(command, args, {
          cwd,
          env: context.env,
          shell,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });

        childPid = child.pid;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        finish(
          "execution_error",
          null,
          null,
          "SPAWN_ERROR",
          message,
        );

        return;
      }

      request.signal?.addEventListener(
        "abort",
        onAbort,
        { once: true },
      );

      timeout = setTimeout(() => {
        if (settled) return;

        timedOut = true;
        killChild();

        finish(
          "timeout",
          null,
          null,
          "ETIMEDOUT",
          `Execution exceeded ${timeoutMs} ms.`,
        );
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        appendOutput(chunk, "stdout");
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        appendOutput(chunk, "stderr");
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (settled) return;

        if (error.code === "ENOENT") {
          finish(
            "command_not_found",
            null,
            null,
            error.code,
            error.message,
          );
          return;
        }

        if (error.code === "EACCES" || error.code === "EPERM") {
          finish(
            "permission_denied",
            null,
            null,
            error.code,
            error.message,
          );
          return;
        }

        finish(
          "execution_error",
          null,
          null,
          error.code,
          error.message,
        );
      });

      child.on("close", (exitCode, signal) => {
        if (settled) return;

        if (cancelled) {
          finish("cancelled", exitCode, signal);
          return;
        }

        if (timedOut) {
          finish("timeout", exitCode, signal);
          return;
        }

        if (truncated) {
          finish(
            "output_limit",
            exitCode,
            signal,
            "OUTPUT_LIMIT",
            "Process output exceeded the configured byte limit.",
          );
          return;
        }

        if (exitCode === 0) {
          finish("success", exitCode, signal);
          return;
        }

        finish(
          "non_zero_exit",
          exitCode,
          signal,
        );
      });

      if (request.stdin !== undefined) {
        child.stdin?.end(request.stdin);
      } else {
        child.stdin?.end();
      }
    });
  }
}

