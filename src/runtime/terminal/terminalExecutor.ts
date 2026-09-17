import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import type {
  TerminalExecutionContext,
  TerminalExecutionResult,
  TerminalExecutor,
  TerminalExecutorOptions,
  TerminalRequest,
} from "./terminalTypes";

const TERMINATION_GRACE_MS = 300;

export class NodeTerminalExecutor implements TerminalExecutor {
  private readonly options: Required<TerminalExecutorOptions>;

  constructor(options: TerminalExecutorOptions = {}) {
    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs ?? 120_000,
      defaultMaxOutputBytes: options.defaultMaxOutputBytes ?? 1_048_576,
      killSignal: options.killSignal ?? "SIGTERM",
    };
  }

  execute(
    request: TerminalRequest,
    context: TerminalExecutionContext,
  ): Promise<TerminalExecutionResult> {
    const command = request.command.trim();
    const args = request.args ?? [];
    const shell = request.shell ?? request.executionMode === "shell";
    const timeoutMs = request.timeoutMs ?? this.options.defaultTimeoutMs;
    const maxOutputBytes =
      request.maxOutputBytes ?? this.options.defaultMaxOutputBytes;

    if (!command) {
      return Promise.resolve(this.immediateResult(
        request, context.cwd, "execution_error", "Command cannot be empty.",
      ));
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      return Promise.resolve(this.immediateResult(
        request, context.cwd, "execution_error", "Invalid timeoutMs.",
      ));
    }
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
      return Promise.resolve(this.immediateResult(
        request, context.cwd, "execution_error", "Invalid maxOutputBytes.",
      ));
    }

    const startedAt = new Date().toISOString();
    const startedTime = Date.now();

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let timedOut = false;
      let cancelled = false;
      let truncated = false;
      let settled = false;
      let terminationRequested = false;
      let timer: NodeJS.Timeout | undefined;
      let terminationTimer: NodeJS.Timeout | undefined;
      let pendingClose:
        | { exitCode: number | null; signal: NodeJS.Signals | null }
        | undefined;
      const stdoutDecoder = new StringDecoder("utf8");
      const stderrDecoder = new StringDecoder("utf8");
      let child: ChildProcess | undefined;

      const finish = (
        status: TerminalExecutionResult["status"],
        exitCode: number | null,
        signal: string | null,
        error?: { code?: string; message?: string },
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (terminationTimer) clearTimeout(terminationTimer);
        request.signal?.removeEventListener("abort", onAbort);
        stdout += stdoutDecoder.end();
        stderr += stderrDecoder.end();
        resolve({
          status, exitCode, signal, stdout, stderr, command, args,
          cwd: context.cwd, startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedTime,
          pid: child?.pid, errorCode: error?.code,
          errorMessage: error?.message, truncated,
        });
      };

      const signalProcessTree = (signal: NodeJS.Signals) => {
        if (!child?.pid) return;
        if (process.platform !== "win32") {
          try {
            process.kill(-child.pid, signal);
            return;
          } catch {
            // Group may have exited; try the leader directly.
          }
        }
        try {
          child.kill(signal);
        } catch {
          // close/error handling will report the outcome.
        }
      };

      const terminate = () => {
        if (!child?.pid || settled || terminationRequested) return;
        terminationRequested = true;
        signalProcessTree(this.options.killSignal);

        if (process.platform !== "win32") {
          terminationTimer = setTimeout(() => {
            signalProcessTree("SIGKILL");
            if (pendingClose) {
              finish(
                timedOut ? "timeout" : cancelled ? "cancelled" : "output_limit",
                pendingClose.exitCode,
                pendingClose.signal,
              );
            }
          }, TERMINATION_GRACE_MS);
        }
      };

      const onAbort = () => {
        if (settled) return;
        cancelled = true;
        terminate();
      };

      const collectOutput = (chunk: Buffer, target: "stdout" | "stderr") => {
        if (settled) return;
        const remaining = maxOutputBytes - outputBytes;
        if (remaining <= 0) {
          truncated = true;
          terminate();
          return;
        }
        const accepted = chunk.subarray(0, remaining);
        outputBytes += accepted.byteLength;
        if (target === "stdout") stdout += stdoutDecoder.write(accepted);
        else stderr += stderrDecoder.write(accepted);
        if (chunk.byteLength > remaining) {
          truncated = true;
          terminate();
        }
      };

      try {
        child = spawn(command, args, {
          cwd: context.cwd,
          env: context.env,
          shell,
          detached: process.platform !== "win32",
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        finish(
          err.code === "EACCES" ? "permission_denied" : "execution_error",
          null, null, { code: err.code, message: err.message },
        );
        return;
      }

      child.stdout?.on("data", (chunk: Buffer) => collectOutput(chunk, "stdout"));
      child.stderr?.on("data", (chunk: Buffer) => collectOutput(chunk, "stderr"));

      child.on("error", (error: NodeJS.ErrnoException) => {
        // A kill-related error must not cancel a pending process-tree escalation.
        if (terminationRequested) return;
        if (error.code === "ENOENT") {
          finish("command_not_found", null, null, {
            code: error.code, message: error.message,
          });
          return;
        }
        if (error.code === "EACCES") {
          finish("permission_denied", null, null, {
            code: error.code, message: error.message,
          });
          return;
        }
        if (error.name === "AbortError" || cancelled) {
          finish("cancelled", null, null, {
            code: error.code, message: error.message,
          });
          return;
        }
        finish("execution_error", null, null, {
          code: error.code, message: error.message,
        });
      });

      child.on("close", (exitCode, signal) => {
        if (terminationRequested && process.platform !== "win32") {
          pendingClose = { exitCode, signal };
          return;
        }
        if (timedOut) {
          finish("timeout", exitCode, signal);
          return;
        }
        if (cancelled) {
          finish("cancelled", exitCode, signal);
          return;
        }
        if (truncated) {
          finish("output_limit", exitCode, signal);
          return;
        }
        finish(
          exitCode === 0 ? "success" : "non_zero_exit",
          exitCode, signal,
        );
      });

      if (request.stdin !== undefined && child.stdin) child.stdin.end(request.stdin);
      else child.stdin?.end();

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) return;
          timedOut = true;
          terminate();
        }, timeoutMs);
      }

      if (request.signal) {
        if (request.signal.aborted) onAbort();
        else request.signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  private immediateResult(
    request: TerminalRequest,
    cwd: string,
    status: TerminalExecutionResult["status"],
    errorMessage: string,
  ): TerminalExecutionResult {
    const now = new Date().toISOString();
    return {
      status, exitCode: null, signal: null, stdout: "", stderr: "",
      command: request.command, args: request.args ?? [], cwd,
      startedAt: now, finishedAt: now, durationMs: 0, errorMessage,
    };
  }
}
