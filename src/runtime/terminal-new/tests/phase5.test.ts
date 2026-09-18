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
});
