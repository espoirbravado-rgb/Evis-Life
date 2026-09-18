import type { SandboxIsolationLevel, SandboxResourceLimits } from './sandboxTypes.ts';

export class SandboxPolicy {
  constructor(
    public readonly isolationLevel: SandboxIsolationLevel = 'none',
    public readonly limits: SandboxResourceLimits = {
      maxMemoryMb: 2048,
      networkAllowed: true
    }
  ) {}

  public isNetworkAllowed(): boolean {
    return this.limits.networkAllowed ?? true;
  }
}
