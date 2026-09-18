export interface PromptRule {
  name: string;
  pattern: RegExp;
  defaultResponse: string;
  isPassword?: boolean;
}

export const DEFAULT_PROMPT_RULES: PromptRule[] = [
  {
    name: 'yes-no-default-yes',
    pattern: /\[Y\/n\]|\(y\/n\)\s*\?/i,
    defaultResponse: 'y\n'
  },
  {
    name: 'yes-no-default-no',
    pattern: /\[y\/N\]/i,
    defaultResponse: 'n\n'
  },
  {
    name: 'confirmation-continue',
    pattern: /Do you want to continue\?|Are you sure\?/i,
    defaultResponse: 'yes\n'
  },
  {
    name: 'password-prompt',
    pattern: /(password|passphrase)\s*for\s+.*:/i,
    defaultResponse: '',
    isPassword: true
  }
];
