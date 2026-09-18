export type PromptCategory =
  | 'destructive_confirmation'
  | 'security_elevation'
  | 'safe_confirmation'
  | 'selection';

export interface PromptRule {
  name: string;
  category: PromptCategory;
  pattern: RegExp;
  isDangerous: boolean;
  requiresApproval: boolean;
  safeResponse?: string;
}

export const DEFAULT_PROMPT_RULES: PromptRule[] = [
  {
    name: 'password-prompt',
    category: 'security_elevation',
    pattern: /\b(password|passphrase|credential)s?\s*(for\s+[^:]+)?\s*:/i,
    isDangerous: true,
    requiresApproval: true
  },
  {
    name: 'destructive-confirmation',
    category: 'destructive_confirmation',
    pattern: /\b(are you sure|confirm\s+(deletion|overwrite)|permanently delete|remove all|erase)\b/i,
    isDangerous: true,
    requiresApproval: true
  },
  {
    name: 'git-destructive-prompt',
    category: 'destructive_confirmation',
    pattern: /\b(force\s+push|git\s+push\s+--force|discard local changes|hard\s+reset|git\s+reset\s+--hard)\b/i,
    isDangerous: true,
    requiresApproval: true
  },
  {
    name: 'ssh-host-key-verification',
    category: 'security_elevation',
    pattern: /are you sure you want to continue connecting \(yes\/no(\/\[fingerprint\])?\)\?/i,
    isDangerous: true,
    requiresApproval: true
  },
  {
    name: 'generic-safe-confirmation-yes-no',
    category: 'safe_confirmation',
    pattern: /\[Y\/n\]/i,
    isDangerous: false,
    requiresApproval: false,
    safeResponse: 'y\n'
  },
  {
    name: 'generic-safe-confirmation-no-yes',
    category: 'safe_confirmation',
    pattern: /\[y\/N\]/i,
    isDangerous: false,
    requiresApproval: false,
    safeResponse: 'n\n'
  },
  {
    name: 'continue-non-destructive',
    category: 'safe_confirmation',
    pattern: /Do you want to continue\?\s*\[Y\/n\]/i,
    isDangerous: false,
    requiresApproval: false,
    safeResponse: 'y\n'
  }
];
