/**
 * EVIS RUNTIME — TERMINAL TOOL IMPLEMENTATION (Phase 11)
 *
 * Connects the model / agent execution layer to the Terminal-New runtime.
 * Implements IToolImplementation for toolId 'terminal'.
 *
 * Flow:
 * Model Tool Call ('terminal', { command, cwd? })
 *      ↓
 * ToolExecutor (Permission / Capability check)
 *      ↓
 * TerminalTool.execute()
 *      ↓
 * TerminalRuntime.execute() (Policy, Environment, Sandbox, Audit, Stream)
 *      ↓
 * IToolResult (status, stdout, stderr, durationMs, timestamp)
 *
 * Zero faux-semblant:
 *  - Commands run through real OS process lifecycle
 *  - Sandboxing, secret redaction, and policy enforcement are never bypassed
 */

import type {
  IRuntimeContext,
  IToolCall,
  IToolResult,
  ToolExecutionStatus,
} from '../../types/domain';
import type { IToolImplementation } from '../toolExecutor';
import { TerminalRuntime } from '../../terminal-new/terminalRuntime';
import type { CommandResult } from '../../terminal-new/terminalTypes';

export interface ITerminalToolOptions {
  runtime?: TerminalRuntime;
}

export class TerminalTool implements IToolImplementation {
  readonly toolId = 'terminal';
  private readonly runtime: TerminalRuntime;

  constructor(options: ITerminalToolOptions = {}) {
    this.runtime = options.runtime ?? new TerminalRuntime();
  }

  public getRuntime(): TerminalRuntime {
    return this.runtime;
  }

  async execute(
    call: IToolCall,
    context: IRuntimeContext
  ): Promise<IToolResult> {
    const startTime = Date.now();

    try {
      const args = (call.arguments ?? {}) as Record<string, unknown>;
      const command = typeof args.command === 'string' ? args.command.trim() : '';
      const cwd = typeof args.cwd === 'string' ? args.cwd.trim() : undefined;

      if (!command) {
        return {
          callId: call.id,
          toolId: this.toolId,
          status: 'failed',
          stdout: '',
          stderr: 'Paramètre "command" manquant ou invalide.',
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'A non-empty "command" string is required.',
          },
        };
      }

      const taskId = typeof context.metadata?.taskId === 'string' ? context.metadata.taskId : undefined;

      // Execute via the full TerminalRuntime
      // Only supply explicit cwd if requested; otherwise preserve the session's persistent cwd
      const result: CommandResult = await this.runtime.execute(command, {
        cwd: cwd ?? (this.runtime.sessionManager.hasSession(context.sessionId) ? undefined : context.environment?.workspaceRoot),
        sessionId: context.sessionId,
        taskId,
      });

      let status: ToolExecutionStatus = 'failed';
      if (result.status === 'completed' && result.exitCode === 0) {
        status = 'success';
      } else if (result.status === 'denied') {
        status = 'denied';
      } else {
        status = 'failed';
      }

      const isSuccess = status === 'success';

      return {
        callId: call.id,
        toolId: this.toolId,
        status,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
        data: {
          exitCode: result.exitCode,
          status: result.status,
          timedOut: result.timedOut,
          truncated: result.truncated,
          sessionId: result.sessionId,
        },
        error: isSuccess
          ? undefined
          : {
              code: result.timedOut ? 'EXECUTION_TIMEOUT' : result.status === 'denied' ? 'POLICY_DENIED' : 'COMMAND_FAILED',
              message: result.stderr || `Command exited with status '${result.status}' (code ${result.exitCode})`,
            },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        callId: call.id,
        toolId: this.toolId,
        status: 'failed',
        stdout: '',
        stderr: message,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: {
          code: 'RUNTIME_ERROR',
          message,
        },
      };
    }
  }
}
