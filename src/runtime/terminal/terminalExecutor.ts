import { spawn } from "node:child_process";
import type {
  TerminalExecutionContext,
  TerminalExecutionResult,
  TerminalExecutor,
  TerminalExecutorOptions,
  TerminalRequest,
} from "./terminalTypes";

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

    const startedAt = new Date();
    const startedTime = Date.now();

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let timedOut = false;
      let cancelled = false;
      let truncated = false;
      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const finish = (
        status: TerminalExecutionResult["status"],
        exitCode: number | null,
        signal: string | null,
        error?: {
          code?: string;
          message?: string;
        },
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timer) {
          clearTimeout(timer);
        }

        const finishedAt = new Date();

        resolve({
          status,
          exitCode,
          signal,
          stdout,
          stderr,
          command,
          args,
          cwd: context.cwd,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Date.now() - startedTime,
          errorCode: error?.code,
          errorMessage: error?.message,
          pid: child.pid,
          truncated,
        });
      };

      const child = spawn(command, args, {
        cwd: context.cwd,
        env: context.env,
        shell,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        killSignal: this.options.killSignal,
      });

      const terminateForLimit = () => {
        truncated = true;
        child.kill(this.options.killSignal);
      };

      const collectOutput = (
        chunk: Buffer,
        target: "stdout" | "stderr",
      ) => {
        if (settled) {
          return;
        }

        const remaining = maxOutputBytes - outputBytes;

        if (remaining <= 0) {
          terminateForLimit();
          return;
        }

        const chunkBytes = chunk.byteLength;

        if (chunkBytes > remaining) {
          const partial = chunk.subarray(0, remaining).toString("utf8");

          if (target === "stdout") {
            stdout += partial;
          } else {
            stderr += partial;
          }

          outputBytes += Buffer.byteLength(partial);
          terminateForLimit();
          return;
        }

        const text = chunk.toString("utf8");

        if (target === "stdout") {
          stdout += text;
        } else {
          stderr += text;
        }

        outputBytes += chunkBytes;
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        collectOutput(chunk, "stdout");
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        collectOutput(chunk, "stderr");
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          finish("command_not_found", null, null, {
            code: error.code,
            message: error.message,
          });
          return;
        }

        if (error.code === "EACCES") {
          finish("permission_denied", null, null, {
            code: error.code,
            message: error.message,
          });
          return;
        }

        if (error.name === "AbortError" || cancelled) {
          finish("cancelled", null, null, {
            code: error.code,
            message: error.message,
          });
          return;
        }

        finish("execution_error", null, null, {
          code: error.code,
          message: error.message,
        });
      });

      child.on("close", (exitCode, signal) => {
        if (settled) {
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

        if (exitCode === 0) {
          finish("success", exitCode, signal);
          return;
        }

        finish("non_zero_exit", exitCode, signal);
      });

      if (request.stdin !== undefined && child.stdin) {
        child.stdin.write(request.stdin);
        child.stdin.end();
      } else {
        child.stdin?.end();
      }

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          child.kill(this.options.killSignal);
        }, timeoutMs);
      }

      if (request.signal) {
        if (request.signal.aborted) {
          cancelled = true;
          child.kill(this.options.killSignal);
        } else {
          request.signal.addEventListener(
            "abort",
            () => {
              cancelled = true;
              child.kill(this.options.killSignal);
            },
            { once: true },
          );
        }
      }
    });
  }
}