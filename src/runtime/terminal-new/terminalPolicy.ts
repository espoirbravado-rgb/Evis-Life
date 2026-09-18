export interface TerminalPolicyConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  maxOutputBytes: number;
  allowBackground: boolean;
  blockedCommands: string[];
  restrictedPatterns: RegExp[];
  maxConcurrentProcesses: number;
}

export const DEFAULT_TERMINAL_POLICY: TerminalPolicyConfig = {
  defaultTimeoutMs: 30000,
  maxTimeoutMs: 600000,
  maxOutputBytes: 1024 * 1024 * 5, // 5MB
  allowBackground: true,
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    ':(){ :|:& };:',
    'mkfs',
    'dd if=/dev/zero',
    'shutdown',
    'reboot',
    'init 0'
  ],
  restrictedPatterns: [
    /(^|\s)sudo(\s|$)/,
    /(^|\s)su(\s|$)/,
    /(^|\s)chmod\s+-R\s+777/,
    /(^|\s)chown\s+-R/
  ],
  maxConcurrentProcesses: 10
};

export class TerminalPolicy {
  constructor(private readonly config: TerminalPolicyConfig = DEFAULT_TERMINAL_POLICY) {}

  public isCommandBlocked(command: string): boolean {
    const trimmed = command.trim();
    for (const blocked of this.config.blockedCommands) {
      if (trimmed === blocked || trimmed.startsWith(`${blocked} `)) {
        return true;
      }
    }
    return false;
  }

  public isRestricted(command: string): boolean {
    return this.config.restrictedPatterns.some(pattern => pattern.test(command));
  }

  public getEffectiveTimeout(requestedTimeout?: number): number {
    if (!requestedTimeout || requestedTimeout <= 0) {
      return this.config.defaultTimeoutMs;
    }
    return Math.min(requestedTimeout, this.config.maxTimeoutMs);
  }

  public getMaxOutputBytes(): number {
    return this.config.maxOutputBytes;
  }

  public getMaxConcurrentProcesses(): number {
    return this.config.maxConcurrentProcesses;
  }
}
