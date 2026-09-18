import type { SessionId } from '../terminalTypes.ts';

export type PermissionAction = 'allow' | 'deny' | 'require_approval';

export interface SecurityRule {
  name: string;
  priority: number; // Higher number = evaluated earlier
  action: PermissionAction;
  reason: string;
  pattern?: RegExp;
  commandPrefix?: string;
  cwdPattern?: RegExp;
  sessionId?: SessionId;
}

export const DEFAULT_SECURITY_RULES: SecurityRule[] = [
  // Highest Priority: Explicit Deny
  {
    name: 'destructive-root-rm',
    priority: 1000,
    action: 'deny',
    pattern: /\brm\s+(-[rfRF]+\s+)?(\/|\/\*)/,
    reason: 'Destructive deletion of root filesystem'
  },
  {
    name: 'fork-bomb',
    priority: 1000,
    action: 'deny',
    pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/,
    reason: 'Fork bomb attack'
  },
  {
    name: 'format-drive',
    priority: 1000,
    action: 'deny',
    pattern: /\bmkfs(\.\w+)?\b|\bdd\s+if=\/dev\/(zero|urandom)/,
    reason: 'Disk formatting or raw drive write operation'
  },
  {
    name: 'system-shutdown',
    priority: 1000,
    action: 'deny',
    pattern: /\b(shutdown|reboot|poweroff|init\s+0)\b/,
    reason: 'System halt or reboot command'
  },

  // Medium Priority: Elevation & Approval
  {
    name: 'sudo-privilege',
    priority: 500,
    action: 'require_approval',
    pattern: /\bsudo\b|\bsu\b/,
    reason: 'Superuser elevation required'
  },
  {
    name: 'perm-escalation-chmod-777',
    priority: 500,
    action: 'require_approval',
    pattern: /\bchmod\s+(-[rR]+\s+)?777\b/,
    reason: 'Permissive permission change (777)'
  }
];

export class PermissionRules {
  private rules: SecurityRule[];

  constructor(rules: SecurityRule[] = DEFAULT_SECURITY_RULES) {
    // Sort descending by priority so higher priority rules evaluate first
    this.rules = [...rules].sort((a, b) => b.priority - a.priority);
  }

  public addRule(rule: SecurityRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  public evaluate(command: string, context: { cwd?: string; sessionId?: SessionId } = {}): {
    action: PermissionAction;
    reason?: string;
    matchedRule?: string;
  } {
    const trimmed = command.trim();

    for (const rule of this.rules) {
      // Check session restriction if specified
      if (rule.sessionId && rule.sessionId !== context.sessionId) {
        continue;
      }

      // Check cwd restriction if specified
      if (rule.cwdPattern && context.cwd && !rule.cwdPattern.test(context.cwd)) {
        continue;
      }

      // Check pattern match
      if (rule.pattern && rule.pattern.test(trimmed)) {
        return {
          action: rule.action,
          reason: rule.reason,
          matchedRule: rule.name
        };
      }

      // Check prefix match
      if (rule.commandPrefix && trimmed.startsWith(rule.commandPrefix)) {
        return {
          action: rule.action,
          reason: rule.reason,
          matchedRule: rule.name
        };
      }
    }

    return { action: 'allow' };
  }
}
