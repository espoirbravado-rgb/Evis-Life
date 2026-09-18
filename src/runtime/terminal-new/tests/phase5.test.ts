import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRuntime } from '../terminalRuntime.ts';

describe('Terminal-New Phase 5 (PTY & Pseudo-terminal)', () => {
  it('confirms genuine PTY availability on the host platform', () => {
    const runtime = new TerminalRuntime();
    assert.equal(runtime.isPtyAvailable(), true);
  });

  it('spawns a real TTY process where isatty(1) is true', async () => {
    const runtime = new TerminalRuntime();

    const outputChunks: string[] = [];
    const pty = runtime.spawnPty('bash', ['-c', '"echo TTY_CHECK:; [ -t 1 ] && echo IS_REAL_TTY || echo NOT_TTY"']);

    pty.onData((data) => {
      outputChunks.push(data);
    });

    const exitCode = await new Promise<number>((resolve) => {
      pty.onExit((code) => resolve(code));
    });

    assert.equal(exitCode, 0);
    const combined = outputChunks.join('');
    assert.match(combined, /IS_REAL_TTY/);
  });

  it('supports bidirectional interactive I/O through pseudo-terminal master/slave', async () => {
    const runtime = new TerminalRuntime();

    const outputChunks: string[] = [];
    const pty = runtime.spawnPty('bash', ['-c', '"read -p \\"prompt_req: \\" val; echo \\"received: \\$val\\""']);

    pty.onData((chunk) => {
      outputChunks.push(chunk);
      if (chunk.includes('prompt_req:')) {
        pty.write('interactive_agent_input\n');
      }
    });

    const exitCode = await new Promise<number>((resolve) => {
      pty.onExit((code) => resolve(code));
    });

    assert.equal(exitCode, 0);
    const combined = outputChunks.join('');
    assert.match(combined, /received: interactive_agent_input/);
  });

  it('sets and updates terminal dimensions (cols and rows)', async () => {
    const runtime = new TerminalRuntime();

    const outputChunks: string[] = [];
    const pty = runtime.spawnPty('stty', ['size'], {
      cols: 120,
      rows: 45
    });

    assert.equal(pty.cols, 120);
    assert.equal(pty.rows, 45);

    pty.onData((chunk) => {
      outputChunks.push(chunk);
    });

    const exitCode = await new Promise<number>((resolve) => {
      pty.onExit((code) => resolve(code));
    });

    assert.equal(exitCode, 0);
    const combined = outputChunks.join('').trim();
    // stty size outputs "rows cols"
    assert.match(combined, /45\s+120/);
  });

  it('terminates PTY process cleanly on kill', async () => {
    const runtime = new TerminalRuntime();

    const pty = runtime.spawnPty('sleep', ['50']);
    assert.ok(pty.pid > 0);

    // Give it a short moment to start
    await new Promise(r => setTimeout(r, 30));

    const exitPromise = new Promise<number>((resolve) => {
      pty.onExit((code) => resolve(code));
    });

    pty.kill('SIGTERM');
    const exitCode = await exitPromise;
    assert.notEqual(exitCode, 0);
  });

  it('rejects destructive commands in spawnPty via policy and permission rules', () => {
    const runtime = new TerminalRuntime();
    assert.throws(
      () => {
        runtime.spawnPty('rm', ['-rf', '/']);
      },
      /PTY execution denied/
    );
  });

  it('records PTY session in MetricsCollector upon spawn', () => {
    const runtime = new TerminalRuntime();
    const initial = runtime.metrics.getMetrics().ptySessionsStarted;

    const pty = runtime.spawnPty('echo', ['hello']);
    const updated = runtime.metrics.getMetrics().ptySessionsStarted;

    assert.equal(updated, initial + 1);
    pty.kill('SIGKILL');
  });

  it('filters sensitive host environment variables from PTY', async () => {
    process.env.TEST_PTY_SECRET_TOKEN = 'secret_pty_token_123';
    const runtime = new TerminalRuntime();

    const outputChunks: string[] = [];
    const pty = runtime.spawnPty('bash', ['-c', '"echo TOKEN=$TEST_PTY_SECRET_TOKEN"']);

    pty.onData((data) => outputChunks.push(data));

    await new Promise<number>((resolve) => {
      pty.onExit((code) => resolve(code));
    });

    delete process.env.TEST_PTY_SECRET_TOKEN;
    const combined = outputChunks.join('');
    assert.ok(!combined.includes('secret_pty_token_123'), 'Secrets must not leak into PTY');
  });

  describe('PTY Security Gates', () => {
    it('spawnPty() throws when require_approval is active and no approvalToken is provided', async () => {
      const runtime = new TerminalRuntime();

      // `requireApproval: true` in options triggers the policy `require_approval` action.
      // Without a valid approvalToken the call must throw before spawning any process.
      assert.throws(
        () => runtime.spawnPty('bash', ['-c', 'echo hi'], { requireApproval: true }),
        /approval required/i,
        'spawnPty must throw when require_approval is active without a valid token'
      );
    });

    it('spawnPty() throws when sandbox.required is true and bubblewrap is unavailable', async () => {
      const runtime = new TerminalRuntime();

      // The default SandboxManager uses LocalDriver (isolationLevel: 'none').
      // Requiring bubblewrap isolation must fail closed.
      assert.throws(
        () => runtime.spawnPty('bash', ['-c', 'echo hi'], { sandbox: { required: true, driver: 'bubblewrap' } }),
        /sandbox unavailable/i,
        'spawnPty must throw when bubblewrap isolation is required but unavailable'
      );
    });

    it('spawnPty() succeeds when a valid pre-approved token is supplied for require_approval', async () => {
      const runtime = new TerminalRuntime();

      // Use the runtime's own ApprovalManager (public field) so the token is valid
      // inside the same spawnPty() call.
      // fullCmd is constructed as: command + ' ' + args.join(' ')
      // spawnPty('printf', ['pty_ok']) → fullCmd = 'printf pty_ok'
      const req = runtime.approvalManager.createRequest('printf pty_ok', 'Test pre-approval');
      runtime.approvalManager.approve(req.requestId);

      // spawnPty with requireApproval + valid token should not throw
      const outputChunks: string[] = [];
      let didThrow = false;
      let ptyHandle: any;
      try {
        ptyHandle = runtime.spawnPty('printf', ['pty_ok'], {
          requireApproval: true,
          approvalToken: req.requestId
        });
      } catch {
        didThrow = true;
      }

      assert.equal(didThrow, false, 'spawnPty must not throw when a valid approvalToken is provided');

      if (ptyHandle) {
        ptyHandle.onData((d: string) => outputChunks.push(d));
        await new Promise<number>((resolve) => ptyHandle.onExit((code: number) => resolve(code)));
        const combined = outputChunks.join('');
        assert.match(combined, /pty_ok/, 'PTY output must include expected text');
      }
    });

  });
});
