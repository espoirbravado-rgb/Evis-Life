import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromptDetector } from '../interactive/promptDetector.ts';
import { PromptResponder } from '../interactive/promptResponder.ts';
import { TerminalRuntime } from '../terminalRuntime.ts';

describe('Terminal-New Phase 6 (Interactive Automation)', () => {
  describe('Prompt Detection & Classification', () => {
    it('accurately identifies safe confirmation prompts', () => {
      const detector = new PromptDetector();
      const detected = detector.detect('Do you want to continue? [Y/n]');

      assert.ok(detected);
      assert.equal(detected.category, 'safe_confirmation');
      assert.equal(detected.isDangerous, false);
      assert.equal(detected.requiresApproval, false);
    });

    it('classifies password requests as security_elevation requiring approval', () => {
      const detector = new PromptDetector();
      const detected = detector.detect('[sudo] password for junior:');

      assert.ok(detected);
      assert.equal(detected.category, 'security_elevation');
      assert.equal(detected.isDangerous, true);
      assert.equal(detected.requiresApproval, true);
    });

    it('classifies destructive deletion queries as dangerous', () => {
      const detector = new PromptDetector();
      const detected = detector.detect('WARNING: Are you sure you want to delete database records?');

      assert.ok(detected);
      assert.equal(detected.category, 'destructive_confirmation');
      assert.equal(detected.isDangerous, true);
      assert.equal(detected.requiresApproval, true);
    });

    it('classifies all Section 6.4 dangerous prompts correctly and requires approval', () => {
      const detector = new PromptDetector();
      const dangerousPrompts = [
        'password: ',
        'Enter passphrase: ',
        'Are you sure? (yes/no)',
        'Please confirm deletion of /data/prod',
        'Warning: git push --force will overwrite remote history',
        'Executing git reset --hard will discard uncommitted work',
        'The authenticity of host cannot be established. Are you sure you want to continue connecting (yes/no)?'
      ];

      for (const promptText of dangerousPrompts) {
        const detected = detector.detect(promptText);
        assert.ok(detected, `Prompt "${promptText}" must be detected`);
        assert.equal(detected.isDangerous, true, `Prompt "${promptText}" must be marked dangerous`);
        assert.equal(detected.requiresApproval, true, `Prompt "${promptText}" must require approval`);
      }
    });

    it('classifies safe prompts [y/N] and [Y/n] accurately', () => {
      const detector = new PromptDetector();

      const yN = detector.detect('Proceed with action? [y/N]');
      assert.ok(yN);
      assert.equal(yN.isDangerous, false);
      assert.equal(yN.requiresApproval, false);

      const Yn = detector.detect('Apply defaults? [Y/n]');
      assert.ok(Yn);
      assert.equal(Yn.isDangerous, false);
      assert.equal(Yn.requiresApproval, false);
    });
  });

  describe('Security-First Prompt Responder', () => {
    it('refuses to automatically respond to dangerous or credential prompts', () => {
      const detector = new PromptDetector();
      const prompt = detector.detect('Enter password for user admin:')!;

      const dummyHandle = {
        writeInput: () => {
          assert.fail('Should never invoke writeInput on dangerous prompt');
        }
      } as unknown as import('../process/processHandle.ts').ProcessHandle;

      const result = PromptResponder.handlePrompt(dummyHandle, prompt);
      assert.equal(result.blocked, true);
      assert.equal(result.responded, false);
      assert.match(result.reason!, /requires human approval/i);
    });

    it('safely provides default response for verified safe prompts', () => {
      const detector = new PromptDetector();
      const prompt = detector.detect('Proceed with build? [Y/n]')!;

      let writtenData = '';
      const dummyHandle = {
        writeInput: (data: string) => {
          writtenData = data;
          return true;
        }
      } as unknown as import('../process/processHandle.ts').ProcessHandle;

      const result = PromptResponder.handlePrompt(dummyHandle, prompt);
      assert.equal(result.blocked, false);
      assert.equal(result.responded, true);
      assert.equal(result.responseSent, 'y\n');
      assert.equal(writtenData, 'y\n');
    });
  });

  describe('End-to-End Interactive Execution in Runtime', () => {
    it('detects safe prompt during execution and responds automatically', async () => {
      const runtime = new TerminalRuntime();
      let promptEventFired = false;

      runtime.events.on('prompt_detected', () => {
        promptEventFired = true;
      });

      const script = 'echo "Install dependencies? [Y/n]: "; read ans; echo "User decided: $ans"';
      const result = await runtime.execute(script, { interactive: true });

      assert.equal(result.status, 'completed');
      assert.equal(promptEventFired, true);
      assert.match(result.stdout, /User decided: y/);
    });
  });
});
