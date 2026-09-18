import type { ISandboxDriver, SandboxIsolationLevel } from './sandboxTypes.ts';
import { SandboxPolicy } from './sandboxPolicy.ts';

export class LocalSandboxDriver implements ISandboxDriver {
  public readonly name = 'local';
  public readonly isolationLevel: SandboxIsolationLevel = 'none';

  public async initialize(): Promise<void> {}
  
  public wrapCommand(command: string, _cwd: string): string {
    return command;
  }

  public async cleanup(): Promise<void> {}
}

export class SandboxManager {
  private activeDriver: ISandboxDriver;

  constructor(public readonly policy: SandboxPolicy = new SandboxPolicy()) {
    this.activeDriver = new LocalSandboxDriver();
  }

  public setDriver(driver: ISandboxDriver): void {
    this.activeDriver = driver;
  }

  public getDriver(): ISandboxDriver {
    return this.activeDriver;
  }

  public wrapCommand(command: string, cwd: string): string {
    return this.activeDriver.wrapCommand(command, cwd);
  }
}
