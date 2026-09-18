export interface TerminalMetrics {
  totalCommandsExecuted: number;
  totalErrors: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

export class MetricsCollector {
  private totalCommands: number = 0;
  private totalErrors: number = 0;
  private totalDurationMs: number = 0;

  public recordCommand(durationMs: number, success: boolean): void {
    this.totalCommands++;
    this.totalDurationMs += durationMs;
    if (!success) {
      this.totalErrors++;
    }
  }

  public getMetrics(): TerminalMetrics {
    return {
      totalCommandsExecuted: this.totalCommands,
      totalErrors: this.totalErrors,
      totalDurationMs: this.totalDurationMs,
      averageDurationMs: this.totalCommands > 0 ? this.totalDurationMs / this.totalCommands : 0
    };
  }

  public reset(): void {
    this.totalCommands = 0;
    this.totalErrors = 0;
    this.totalDurationMs = 0;
  }
}
