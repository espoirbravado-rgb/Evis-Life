import type { ProcessHandle } from '../process/processHandle.ts';
import type { DetectedPrompt } from './promptDetector.ts';

export class PromptResponder {
  public static handlePrompt(handle: ProcessHandle, prompt: DetectedPrompt): boolean {
    if (prompt.rule.isPassword) {
      // Do not auto-fill passwords without user permission
      return false;
    }

    if (prompt.rule.defaultResponse) {
      return handle.writeInput(prompt.rule.defaultResponse);
    }

    return false;
  }
}
