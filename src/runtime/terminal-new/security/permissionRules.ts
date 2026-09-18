export interface SecurityRule {
  name: string;
  pattern: RegExp;
  action: 'block' | 'ask_approval';
  reason: string;
}

export const DEFAULT_SECURITY_RULES: SecurityRule[] = [
  {
    name: 'destructive-root-rm',
    pattern: /\brm\s+(-[rfRF]+\s+)?(\/|\/\*)/,
    action: 'block',
    reason: 'Destructive deletion of root filesystem'
  },
  {
    name: 'fork-bomb',
    pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/,
    action: 'block',
    reason: 'Fork bomb attack'
  },
  {
    name: 'format-drive',
    pattern: /\bmkfs(\.\w+)?\b/,
    action: 'block',
    reason: 'Disk formatting operation'
  },
  {
    name: 'sudo-privilege',
    pattern: /\bsudo\b|\bsu\b/,
    action: 'ask_approval',
    reason: 'Superuser elevation required'
  }
];

export class PermissionRules {
  constructor(private rules: SecurityRule[] = DEFAULT_SECURITY_RULES) {}

  public evaluate(command: string): { allowed: boolean; needsApproval: boolean; reason?: string } {
    for (const rule of this.rules) {
      if (rule.pattern.test(command)) {
        if (rule.action === 'block') {
          return { allowed: false, needsApproval: false, reason: rule.reason };
        }
        if (rule.action === 'ask_approval') {
          return { allowed: true, needsApproval: true, reason: rule.reason };
        }
      }
    }

    return { allowed: true, needsApproval: false };
  }
}
