import { DEFAULT_PROMPT_RULES, type PromptCategory, type PromptRule } from './interactiveRules.ts';

export interface DetectedPrompt {
  ruleName: string;
  category: PromptCategory;
  matchedText: string;
  isDangerous: boolean;
  requiresApproval: boolean;
  confidence: number;
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
          ruleName: rule.name,
          category: rule.category,
          matchedText: match[0],
          isDangerous: rule.isDangerous,
          requiresApproval: rule.requiresApproval,
          confidence: 0.95
        };
      }
    }
    return null;
  }
}
