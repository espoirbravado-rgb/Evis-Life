import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRuntime } from '../terminalRuntime.ts';

describe('TerminalRuntime (terminal-new)', () => {
  it('should instantiate successfully with default components', () => {
    const runtime = new TerminalRuntime();
    assert.ok(runtime.processManager);
    assert.ok(runtime.sessionManager);
    assert.ok(runtime.environment);
    assert.ok(runtime.policy);
    assert.ok(runtime.permissionRules);
    assert.ok(runtime.approvalManager);
    assert.ok(runtime.audit);
    assert.ok(runtime.metrics);
  });

  it('should execute a basic echo command and capture stdout', async () => {
    const runtime = new TerminalRuntime();
    const result = await runtime.execute('echo "hello world"');
    assert.equal(result.exitCode, 0);
    assert.equal(result.status, 'completed');
    assert.equal(result.stdout.trim(), 'hello world');
  });

  it('should block dangerous commands according to policy', async () => {
    const runtime = new TerminalRuntime();
    const result = await runtime.execute('rm -rf /');
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.status, 'failed');
    assert.match(result.stderr, /blocked by policy/i);
  });

  it('should redact sensitive secrets in output', async () => {
    const runtime = new TerminalRuntime();
    const result = await runtime.execute('echo "My secret is ghp_123456789012345678901234567890123456"');
    assert.ok(!result.stdout.includes('ghp_123456789012345678901234567890123456'));
    assert.ok(result.stdout.includes('[REDACTED_SECRET]'));
  });

  it('should isolate environment and enforce non-interactive flags', async () => {
    const runtime = new TerminalRuntime();
    const result = await runtime.execute('echo "CI=$CI,TERM=$TERM"');
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /CI=1/);
    assert.match(result.stdout, /TERM=dumb/);
  });
});
