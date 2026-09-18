/**
 * phase15_negative.test.ts — Phase 15: Mandatory Negative Security & Resilience Tests
 *
 * Verifies that dangerous, unauthorized, or invalid operations DO NOT EXECUTE.
 * Every test verifies:
 *  1. The operation failed, was blocked, or was cancelled truthfully.
 *  2. No unauthorized OS process was spawned (zero leaked/zombie processes).
 *  3. Status, exitCode, error, audit, and metrics remain honest.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TerminalRuntime } from '../terminalRuntime.ts';
import { ApprovalManager } from '../security/approvalManager.ts';

describe('Terminal-New Phase 15 (Mandatory Negative Tests)', () => {
  describe('Forbidden Destructive Commands (Zero Process Spawned)', () => {
    it('blocks forbidden root rm (rm -rf /) and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('rm -rf /');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /forbidden|denied/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });

    it('blocks fork bomb pattern and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute(':(){ :|:& };:');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /forbidden|denied|fork bomb/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });

    it('blocks mkfs disk formatting and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('mkfs.ext4 /dev/sda1');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /disk formatting|raw drive|forbidden|denied/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });

    it('blocks dd destructive write to raw drive and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('dd if=/dev/zero of=/dev/sda bs=1M count=10');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /forbidden|denied/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });

    it('blocks shutdown command and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('shutdown -h now');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /forbidden|denied/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });

    it('blocks reboot command and spawns zero processes', async () => {
      const runtime = new TerminalRuntime();
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('reboot');

      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /forbidden|denied/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive);
    });
  });

  describe('Elevation & Approval Boundary Violations', () => {
    it('blocks unauthorized sudo command without spawning', async () => {
      const runtime = new TerminalRuntime();
      // No approval handler provided -> defaults to reject
      const result = await runtime.execute('sudo systemctl stop docker');

      assert.equal(result.status, 'approval_required');
      assert.equal(result.exitCode, 126);
      assert.match(result.stderr, /elevated privileges|approval/i);
      assert.equal(result.processId, undefined);
    });

    it('rejects execution when approval token has expired', async () => {
      const approvalManager = new ApprovalManager({ defaultTtlMs: 20 });
      const req = approvalManager.createRequest('sudo apt-get update', 'Package update');

      // Wait for TTL expiry
      await new Promise(r => setTimeout(r, 40));

      const approved = approvalManager.approve(req.requestId);
      assert.equal(approved, false);
      const consumed = approvalManager.consumeApproval(req.requestId, 'sudo apt-get update');
      assert.equal(consumed, false);
    });

    it('rejects execution when command does not match approval (scope hijacking)', () => {
      const approvalManager = new ApprovalManager();
      const req = approvalManager.createRequest('npm install', 'Safe dependency installation');
      approvalManager.approve(req.requestId);

      // Attempt to execute altered dangerous command
      const consumed = approvalManager.consumeApproval(req.requestId, 'npm install && rm -rf dist');
      assert.equal(consumed, false);
    });

    it('rejects execution when approval is consumed in a different session', () => {
      const approvalManager = new ApprovalManager();
      const req = approvalManager.createRequest('git clean -fd', 'Clean untracked files', {
        sessionId: 'session_original'
      });
      approvalManager.approve(req.requestId);

      const consumed = approvalManager.consumeApproval(req.requestId, 'git clean -fd', {
        sessionId: 'session_rogue'
      });
      assert.equal(consumed, false);
    });
  });

  describe('Secret Leakage & Sanitization Failures', () => {
    it('prevents raw sensitive tokens from appearing in stdout and audit', async () => {
      const runtime = new TerminalRuntime();
      const secret = 'ghp_012345678901234567890123456789012345';
      const result = await runtime.execute(`echo "Token: ${secret}"`);

      assert.ok(!result.stdout.includes(secret), 'Stdout must redact token');
      assert.ok(result.stdout.includes('[REDACTED_SECRET]'));

      const records = runtime.audit.getRecords();
      const latest = records[records.length - 1];
      assert.ok(!latest.command.includes(secret), 'Audit command must redact token');
      assert.ok(latest.command.includes('[REDACTED_SECRET]'));
    });
  });

  describe('Invalid Paths & Malformed Invocations', () => {
    it('fails truthfully on non-existent binary without hanging or crashing', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('command_that_cannot_exist_xyz_99999');

      assert.equal(result.status, 'failed');
      assert.notEqual(result.exitCode, 0);
      assert.match(result.stderr, /not found/i);
    });

    it('fails truthfully when navigating into non-existent cwd', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('pwd', { cwd: '/directory/that/definitely/does/not/exist/999' });

      assert.equal(result.status, 'failed');
      assert.match(result.stderr, /ENOENT|no such file or directory|does not exist/i);
    });

    it('rejects execution truthfully when sandbox is required but unavailable (sandbox unavailable)', async () => {
      const runtime = new TerminalRuntime();
      // Ensure LocalDriver is active (isolationLevel: 'none')
      const initialActive = runtime.processManager.listActive().length;

      const result = await runtime.execute('echo "should not run"', {
        sandbox: { required: true, driver: 'bubblewrap' }
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /sandbox unavailable/i);
      assert.equal(result.processId, undefined);
      assert.equal(runtime.processManager.listActive().length, initialActive, 'Must spawn zero OS processes');
      assert.ok(runtime.metrics.getMetrics().sandboxFailures >= 1, 'Must record sandbox failure metric');
    });
  });

  describe('Timeout and Cancellation Guarantees', () => {
    it('terminates hanging process on timeout and frees OS resources', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('sleep 30', { timeoutMs: 100 });

      assert.equal(result.status, 'timeout');
      assert.equal(result.timedOut, true);
      assert.equal(runtime.processManager.listActive().length, 0);
    });

    it('terminates running process promptly on AbortSignal and marks cancelled', async () => {
      const runtime = new TerminalRuntime();
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 40);

      const result = await runtime.execute('sleep 30', { signal: controller.signal });

      assert.equal(result.status, 'cancelled');
      assert.equal(result.cancelled, true);
      assert.equal(runtime.processManager.listActive().length, 0);
    });
  });
});
