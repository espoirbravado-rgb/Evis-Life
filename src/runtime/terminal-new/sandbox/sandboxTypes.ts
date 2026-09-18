export type SandboxIsolationLevel = 'none' | 'chroot' | 'docker' | 'microvm';

export interface SandboxResourceLimits {
  maxCpuCores?: number;
  maxMemoryMb?: number;
  diskQuotaMb?: number;
  networkAllowed?: boolean;
}

export interface ISandboxDriver {
  name: string;
  isolationLevel: SandboxIsolationLevel;
  initialize: () => Promise<void>;
  wrapCommand: (command: string, cwd: string) => string;
  cleanup: () => Promise<void>;
}
