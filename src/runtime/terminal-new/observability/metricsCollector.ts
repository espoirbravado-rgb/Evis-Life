/**
 * metricsCollector.ts — Phase 10: Quantitative Runtime Metrics
 *
 * Collects runtime performance and reliability metrics:
 *  - Commands (success, failure, timeout, cancellation)
 *  - Security (approvals required, granted, denied)
 *  - Execution (background jobs, PTY sessions, active processes)
 *  - Diagnostics (output truncations, sandbox failures, average duration)
 *
 * Avoids turning metrics into business logic.
 */

import type { CommandStatus } from '../terminalTypes.ts';

export interface TerminalMetrics {
  totalCommandsExecuted: number;
  successfulCommands: number;
  failedCommands: number;
  timeouts: number;
  cancellations: number;
  approvalsRequired: number;
  approvalsGranted: number;
  approvalsDenied: number;
  backgroundJobsStarted: number;
  activeProcesses: number;
  ptySessionsStarted: number;
  totalDurationMs: number;
  averageExecutionDurationMs: number;
  outputTruncations: number;
  sandboxFailures: number;
}

export class MetricsCollector {
  private totalCommands: number = 0;
  private successful: number = 0;
  private failed: number = 0;
  private timeouts: number = 0;
  private cancellations: number = 0;
  private approvalsRequired: number = 0;
  private approvalsGranted: number = 0;
  private approvalsDenied: number = 0;
  private backgroundJobs: number = 0;
  private activeProcessesCount: number = 0;
  private ptySessions: number = 0;
  private totalDuration: number = 0;
  private truncations: number = 0;
  private sandboxFailuresCount: number = 0;

  public recordCommand(
    optionsOrDuration:
      | number
      | {
          durationMs: number;
          status: CommandStatus | 'denied' | string;
          timedOut?: boolean;
          truncated?: boolean;
        },
    maybeSuccess?: boolean
  ): void {
    if (typeof optionsOrDuration === 'number') {
      const durationMs = optionsOrDuration;
      const success = maybeSuccess ?? true;
      this.totalCommands++;
      this.totalDuration += durationMs;
      if (success) {
        this.successful++;
      } else {
        this.failed++;
      }
      return;
    }

    const options = optionsOrDuration;
    this.totalCommands++;
    this.totalDuration += options.durationMs;

    if (options.status === 'completed') {
      this.successful++;
    } else if (options.status === 'timed_out' || options.timedOut) {
      this.timeouts++;
    } else if (options.status === 'cancelled') {
      this.cancellations++;
    } else {
      this.failed++;
    }

    if (options.truncated) {
      this.truncations++;
    }
  }

  public recordApproval(decision: 'required' | 'granted' | 'denied'): void {
    if (decision === 'required') {
      this.approvalsRequired++;
    } else if (decision === 'granted') {
      this.approvalsGranted++;
    } else if (decision === 'denied') {
      this.approvalsDenied++;
    }
  }

  public recordBackgroundJob(): void {
    this.backgroundJobs++;
  }

  public recordPtySession(): void {
    this.ptySessions++;
  }

  public recordSandboxFailure(): void {
    this.sandboxFailuresCount++;
  }

  public setActiveProcesses(count: number): void {
    this.activeProcessesCount = Math.max(0, count);
  }

  public getMetrics(): TerminalMetrics {
    return {
      totalCommandsExecuted: this.totalCommands,
      successfulCommands: this.successful,
      failedCommands: this.failed,
      timeouts: this.timeouts,
      cancellations: this.cancellations,
      approvalsRequired: this.approvalsRequired,
      approvalsGranted: this.approvalsGranted,
      approvalsDenied: this.approvalsDenied,
      backgroundJobsStarted: this.backgroundJobs,
      activeProcesses: this.activeProcessesCount,
      ptySessionsStarted: this.ptySessions,
      totalDurationMs: this.totalDuration,
      averageExecutionDurationMs: this.totalCommands > 0 ? this.totalDuration / this.totalCommands : 0,
      outputTruncations: this.truncations,
      sandboxFailures: this.sandboxFailuresCount,
    };
  }

  public reset(): void {
    this.totalCommands = 0;
    this.successful = 0;
    this.failed = 0;
    this.timeouts = 0;
    this.cancellations = 0;
    this.approvalsRequired = 0;
    this.approvalsGranted = 0;
    this.approvalsDenied = 0;
    this.backgroundJobs = 0;
    this.activeProcessesCount = 0;
    this.ptySessions = 0;
    this.totalDuration = 0;
    this.truncations = 0;
    this.sandboxFailuresCount = 0;
  }
}
