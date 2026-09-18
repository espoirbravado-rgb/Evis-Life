import type { CommandExecutionOptions, PolicyDecision } from './terminalTypes.ts';

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
    'dd if=/dev/urandom',
    'shutdown',
    'reboot',
    'init 0',
    '> /dev/sda'
  ],
  restrictedPatterns: [
    /(^|\s)sudo(\s|$)/,
    /(^|\s)su(\s|$)/,
    /(^|\s)chmod\s+(-R\s+)?777/,
    /(^|\s)chown\s+-R/
  ],
  maxConcurrentProcesses: 10
};

export class TerminalPolicy {
  constructor(private readonly config: TerminalPolicyConfig = DEFAULT_TERMINAL_POLICY) {}

  public evaluate(command: string, options: CommandExecutionOptions = {}): PolicyDecision {
    const trimmed = command.trim();

    // 1. Check blocked commands
    for (const blocked of this.config.blockedCommands) {
      if (trimmed === blocked || trimmed.startsWith(`${blocked} `)) {
        return {
          action: 'deny',
          reason: `Command blocked by policy: "${blocked}" is explicitly forbidden.`
        };
      }
    }

    // 2. Check background execution policy
    if (options.background && !this.config.allowBackground) {
      return {
        action: 'deny',
        reason: 'Background execution is disabled by policy.'
      };
    }

    // 3. Check elevation & restricted patterns
    const isRestricted = this.config.restrictedPatterns.some(pattern => pattern.test(trimmed));
    if (isRestricted) {
      if (options.allowElevated) {
        return {
          action: 'allow',
          effectiveTimeoutMs: this.getEffectiveTimeout(options.timeoutMs),
          maxOutputBytes: this.getEffectiveMaxOutput(options.maxOutputBytes)
        };
      }
      return {
        action: 'require_approval',
        reason: 'Command requires elevated privileges or affects critical system permissions.'
      };
    }

    // 4. Check explicit requireApproval flag
    if (options.requireApproval) {
      return {
        action: 'require_approval',
        reason: 'Execution explicitly requires human approval.'
      };
    }

    // 5. Default allow
    return {
      action: 'allow',
      effectiveTimeoutMs: this.getEffectiveTimeout(options.timeoutMs),
      maxOutputBytes: this.getEffectiveMaxOutput(options.maxOutputBytes)
    };
  }

  public getEffectiveTimeout(requestedTimeout?: number): number {
    if (!requestedTimeout || requestedTimeout <= 0) {
      return this.config.defaultTimeoutMs;
    }
    return Math.min(requestedTimeout, this.config.maxTimeoutMs);
  }

  public getEffectiveMaxOutput(requestedMaxBytes?: number): number {
    if (!requestedMaxBytes || requestedMaxBytes <= 0) {
      return this.config.maxOutputBytes;
    }
    return Math.min(requestedMaxBytes, this.config.maxOutputBytes);
  }

  public getMaxConcurrentProcesses(): number {
    return this.config.maxConcurrentProcesses;
  }
}
