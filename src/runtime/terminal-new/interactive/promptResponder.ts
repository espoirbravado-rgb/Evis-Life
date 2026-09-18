import type { ProcessHandle } from '../process/processHandle.ts';
import type { DetectedPrompt } from './promptDetector.ts';
import { DEFAULT_PROMPT_RULES } from './interactiveRules.ts';

export interface PromptResolutionResult {
  responded: boolean;
  responseSent?: string;
  blocked: boolean;
  reason?: string;
}

export class PromptResponder {
  /**
   * Evaluates prompt against security policy.
   * NEVER automatically sends input to dangerous or credential prompts.
   */
  public static handlePrompt(handle: ProcessHandle, prompt: DetectedPrompt): PromptResolutionResult {
    // 1. Never silently approve passwords or destructive operations
    if (prompt.isDangerous || prompt.requiresApproval) {
      return {
        responded: false,
        blocked: true,
        reason: `Automated response blocked: prompt "${prompt.ruleName}" requires human approval.`
      };
    }

    // 2. Safe prompt: lookup rule's designated safe default response
    const rule = DEFAULT_PROMPT_RULES.find(r => r.name === prompt.ruleName);
    if (rule?.safeResponse) {
      const written = handle.writeInput(rule.safeResponse);
      return {
        responded: written,
        responseSent: rule.safeResponse,
        blocked: false
      };
    }

    return {
      responded: false,
      blocked: false,
      reason: 'No safe response configured for this prompt.'
    };
  }
}
