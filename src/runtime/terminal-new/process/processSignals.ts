export type PosixSignal = 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGHUP' | 'SIGQUIT';

export class ProcessSignals {
  public static isAlive(pid: number): boolean {
    try {
      // Signal 0 checks process existence without killing it
      process.kill(pid, 0);
      return true;
    } catch (err: unknown) {
      // If EPERM, process exists but belongs to another user (alive)
      // If ESRCH, process does not exist (not alive)
      return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
  }

  public static killPid(pid: number, signal: PosixSignal = 'SIGTERM'): boolean {
    try {
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
