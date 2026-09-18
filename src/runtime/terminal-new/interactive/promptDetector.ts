import { DEFAULT_PROMPT_RULES, type PromptRule } from './interactiveRules.ts';

export interface DetectedPrompt {
  rule: PromptRule;
  matchedText: string;
}

export class PromptDetector {
  private rules: PromptRule[];

  constructor(customRules: PromptRule[] = []) {
    this.rules = [...DEFAULT_PROMPT_RULES, ...customRules];
  }

  public detect(text: string): DetectedPrompt | null {
    for (const rule of this.rules) {
      const match = rule.pattern.exec(text);
      if (match) {
        return {
          rule,
          matchedText: match[0]
        };
      }
    }
    return null;
  }
}
