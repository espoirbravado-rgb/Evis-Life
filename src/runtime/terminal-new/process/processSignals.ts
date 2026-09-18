export type PosixSignal = 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGHUP' | 'SIGQUIT';

export class ProcessSignals {
  public static killPid(pid: number, signal: PosixSignal = 'SIGTERM'): boolean {
    try {
      // Send signal to process group if negative, or directly to pid
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }

  public static killProcessGroup(pgid: number, signal: PosixSignal = 'SIGTERM'): boolean {
    try {
      process.kill(-Math.abs(pgid), signal);
      return true;
    } catch {
      return false;
    }
  }
}
