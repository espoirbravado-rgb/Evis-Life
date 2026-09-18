import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRuntime } from '../terminalRuntime.ts';
import { TerminalPolicy } from '../terminalPolicy.ts';
import { TerminalEnvironment } from '../terminalEnvironment.ts';
import { ProcessManager } from '../process/processManager.ts';

describe('Terminal-New Phase 1 (Correctness)', () => {
  describe('One-shot Execution & Exit Codes', () => {
    it('executes simple command and captures stdout with status completed', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('echo "phase1 test stdout"');
      assert.equal(result.status, 'completed');
      assert.equal(result.exitCode, 0);
      assert.equal(result.timedOut, false);
      assert.equal(result.stdout.trim(), 'phase1 test stdout');
      assert.equal(result.stderr, '');
    });

    it('captures exit code and stderr on failed command with status failed', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('bash -c "echo error-msg >&2; exit 42"');
      assert.equal(result.status, 'failed');
      assert.equal(result.exitCode, 42);
      assert.equal(result.timedOut, false);
      assert.match(result.stderr, /error-msg/);
    });

    it('handles non-existent binary truthfully', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('non_existent_binary_xyz_123');
      assert.equal(result.status, 'failed');
      assert.notEqual(result.exitCode, 0);
      assert.match(result.stderr, /not found/i);
    });
  });

  describe('Policy & Permission Interception', () => {
    it('denies blocked destructive command without executing it', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('rm -rf /');
      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /explicitly forbidden/);
    });

    it('requires approval for sudo commands and blocks if unapproved', async () => {
      const runtime = new TerminalRuntime();
      // Default approval manager has no handler -> returns false
      const result = await runtime.execute('sudo ls /root');
      assert.equal(result.status, 'approval_required');
      assert.equal(result.exitCode, 126);
      assert.match(result.stderr, /elevated privileges|approval/i);
    });

    it('allows restricted command when approved via approval handler', async () => {
      const runtime = new TerminalRuntime();
      runtime.approvalManager.setApprovalHandler(async (cmd) => {
        return cmd.command.includes('echo privileged');
      });

      // Override restricted patterns for this test to trigger approval cleanly without real sudo
      const customPolicy = new TerminalPolicy({
        ...runtime.policy['config'],
        restrictedPatterns: [/echo\s+privileged/]
      });

      const privilegedRuntime = new TerminalRuntime({ policy: customPolicy });
      privilegedRuntime.approvalManager.setApprovalHandler(async () => true);

      const result = await privilegedRuntime.execute('echo privileged command');
      assert.equal(result.status, 'completed');
      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /privileged command/);
    });

    it('enforces PermissionRules custom deny rule in TerminalRuntime', async () => {
      const runtime = new TerminalRuntime();
      runtime.permissionRules.addRule({
        name: 'block-specific-tool',
        priority: 999,
        action: 'deny',
        commandPrefix: 'special_secret_bin',
        reason: 'Execution of special_secret_bin is prohibited'
      });

      const result = await runtime.execute('special_secret_bin --version');
      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /prohibited/);
    });
  });

  describe('Hermetic Environment & Secret Protection', () => {
    it('filters out sensitive host keys by default', async () => {
      // Temporarily set a dummy secret on host process.env
      process.env.GITHUB_TOKEN = 'ghp_secret_dummy_12345';
      process.env.AWS_SECRET_ACCESS_KEY = 'aws_secret_key_dummy';

      const envManager = new TerminalEnvironment();
      const builtEnv = envManager.buildEnvironment();

      assert.equal(builtEnv.GITHUB_TOKEN, undefined);
      assert.equal(builtEnv.AWS_SECRET_ACCESS_KEY, undefined);

      delete process.env.GITHUB_TOKEN;
      delete process.env.AWS_SECRET_ACCESS_KEY;
    });

    it('enforces non-interactive CI flags', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('echo "CI=$CI,TERM=$TERM,DEBIAN_FRONTEND=$DEBIAN_FRONTEND"');
      assert.equal(result.status, 'completed');
      assert.match(result.stdout, /CI=1/);
      assert.match(result.stdout, /TERM=dumb/);
      assert.match(result.stdout, /DEBIAN_FRONTEND=noninteractive/);
    });

    it('applies custom request environment variables', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('echo "TEST_VAR=$TEST_VAR"', {
        env: { TEST_VAR: 'hello_from_options' }
      });
      assert.equal(result.status, 'completed');
      assert.match(result.stdout, /TEST_VAR=hello_from_options/);
    });
  });

  describe('Process Lifecycle & Manager', () => {
    it('tracks process state accurately from spawn to exit', async () => {
      const manager = new ProcessManager(5);
      const handle = manager.spawn({
        command: 'echo "running process"',
        cwd: process.cwd(),
        env: {}
      });

      assert.ok(handle.id);
      assert.ok(handle.pid);
      assert.ok(['starting', 'running'].includes(handle.state));

      const exitResult = await handle.wait();
      assert.equal(exitResult.exitCode, 0);
      assert.equal(handle.state, 'exited');
      assert.equal(handle.isAlive, false);
      assert.ok(handle.durationMs >= 0);
    });

    it('kills a running process and reports honest status killed', async () => {
      const manager = new ProcessManager(5);
      const handle = manager.spawn({
        command: 'sleep 30',
        cwd: process.cwd(),
        env: {}
      });

      assert.ok(handle.isAlive);
      const killed = handle.kill('SIGTERM');
      assert.equal(killed, true);

      await handle.wait();
      assert.equal(handle.state, 'killed');
      assert.equal(handle.isAlive, false);
    });

    it('enforces maximum concurrent process limit', async () => {
      const manager = new ProcessManager(2); // limit = 2
      const p1 = manager.spawn({ command: 'sleep 5', cwd: process.cwd(), env: {} });
      const p2 = manager.spawn({ command: 'sleep 5', cwd: process.cwd(), env: {} });

      assert.throws(
        () => {
          manager.spawn({ command: 'sleep 5', cwd: process.cwd(), env: {} });
        },
        /Maximum concurrent processes limit reached/
      );

      p1.kill('SIGKILL');
      p2.kill('SIGKILL');
      await Promise.all([p1.wait(), p2.wait()]);
    });
  });

  describe('Timeout and Cancellation Handling', () => {
    it('accurately terminates on timeout and reports status timeout', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('sleep 10', { timeoutMs: 150 });
      assert.equal(result.status, 'timeout');
      assert.equal(result.timedOut, true);
      assert.ok(result.durationMs >= 140);
    });

    it('cancels running command via AbortSignal and reports status cancelled', async () => {
      const runtime = new TerminalRuntime();
      const controller = new AbortController();

      // Trigger abort shortly after start
      setTimeout(() => controller.abort(), 60);

      const result = await runtime.execute('sleep 10', {
        signal: controller.signal,
        agentId: 'agent-audit-001'
      });

      assert.equal(result.status, 'cancelled');
      assert.equal(result.cancelled, true);
      assert.equal(result.agentId, 'agent-audit-001');
      assert.ok(result.durationMs < 2000);
    });
  });

  describe('Byte-Safe Truncation & Secret Redaction', () => {
    it('redacts tokens and passwords dynamically from stdout', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('echo "Token is ghp_012345678901234567890123456789012345"');
      assert.ok(!result.stdout.includes('ghp_012345678901234567890123456789012345'));
      assert.ok(result.stdout.includes('[REDACTED_SECRET]'));
    });

    it('enforces byte limit truncation', async () => {
      const runtime = new TerminalRuntime();
      // Generate 2000 bytes with limit = 100 bytes
      const result = await runtime.execute('python3 -c "print(\'A\' * 2000)"', {
        maxOutputBytes: 100
      });
      assert.equal(result.truncated, true);
      assert.match(result.stdout, /\[output truncated: \d+ bytes omitted\]/);
    });
  });
});
