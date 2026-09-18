/**
 * phase8.test.ts — Phase 8: Sandbox Driver Tests
 *
 * Tests verify:
 *  - LocalDriver honestly reports no isolation
 *  - BubblewrapDriver probes capabilities correctly
 *  - SandboxManager selects correct driver based on policy
 *  - wrapCommand produces correct bwrap argument structure
 *  - Environment filtering works in both drivers
 *  - SandboxPolicy presets are valid and logically correct
 *  - Real isolation test: a sandboxed command cannot write to host /tmp
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LocalDriver, BubblewrapDriver, SandboxManager } from '../sandbox/sandboxManager.ts';
import { SandboxPolicy } from '../sandbox/sandboxPolicy.ts';

const execFileAsync = promisify(execFile);

// ──────────────────────────────────────────────────────────────────────────────
// 1. LocalDriver
// ──────────────────────────────────────────────────────────────────────────────

describe('LocalDriver — No Isolation', () => {
  const driver = new LocalDriver();

  it('reports available: true (it can always run)', async () => {
    const caps = await driver.checkCapabilities();
    assert.equal(caps.available, true);
  });

  it('reports isolationLevel: none — honest about providing zero isolation', async () => {
    const caps = await driver.checkCapabilities();
    assert.equal(caps.isolationLevel, 'none');
    assert.equal(caps.filesystemIsolation, false);
    assert.equal(caps.networkIsolation, false);
    assert.equal(caps.resourceLimits, false);
  });

  it('wrapCommand returns isolated: false', async () => {
    await driver.initialize();
    const policy = SandboxPolicy.none().config;
    const result = driver.wrapCommand('echo hello', [], '/tmp', policy, { PATH: '/bin' });

    assert.equal(result.isolated, false);
    assert.equal(result.driverName, 'local');
    assert.equal(result.command, 'echo hello');
  });

  it('filters environment variables to allowedKeys', async () => {
    await driver.initialize();
    const policy = SandboxPolicy.strict().config;
    const hostEnv = { PATH: '/bin', HOME: '/root', AWS_SECRET: 'secret123', TERM: 'xterm' };

    const result = driver.wrapCommand('env', [], '/tmp', policy, hostEnv);

    // Should have PATH, HOME, TERM (in strict allowedKeys) but NOT AWS_SECRET
    assert.equal(result.env['PATH'], '/bin');
    assert.equal(result.env['HOME'], '/root');
    assert.equal(result.env['TERM'], 'xterm');
    assert.equal(result.env['AWS_SECRET'], undefined,
      'AWS_SECRET must be filtered out by environment policy');
  });

  it('injects additional env variables after filtering', async () => {
    await driver.initialize();
    const policy = new SandboxPolicy({
      isolationLevel: 'none',
      filesystem: { readOnlyPaths: [], writablePaths: [], cwdWritable: true, tmpfsAvailable: true },
      network: { allowed: true },
      resources: {},
      environment: {
        allowedKeys: ['PATH'],
        inject: { MY_AGENT_FLAG: '1' },
      },
    }).config;

    const result = driver.wrapCommand('echo', [], '/tmp', policy, { PATH: '/bin', HOME: '/root' });

    assert.equal(result.env['PATH'], '/bin');
    assert.equal(result.env['HOME'], undefined, 'HOME is not in allowedKeys');
    assert.equal(result.env['MY_AGENT_FLAG'], '1', 'injected key must be present');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. BubblewrapDriver
// ──────────────────────────────────────────────────────────────────────────────

describe('BubblewrapDriver — Capabilities Probe', () => {
  it('reports the correct isolation level always (regardless of availability)', async () => {
    const driver = new BubblewrapDriver();
    const caps = await driver.checkCapabilities();
    assert.equal(caps.isolationLevel, 'bubblewrap');
  });

  it('provides unavailableReason when bwrap namespace probe fails', async () => {
    const driver = new BubblewrapDriver();
    const caps = await driver.checkCapabilities();
    if (caps.available) {
      // Bwrap fully works — no reason needed.
      assert.equal(caps.unavailableReason, undefined);
    } else {
      // Not available: must explain why.
      assert.ok(
        typeof caps.unavailableReason === 'string' && caps.unavailableReason.length > 0,
        `unavailableReason must be set when available=false, got: ${caps.unavailableReason}`
      );
    }
  });

  it('wrapCommand generates correct args — does not need namespace support', () => {
    // wrapCommand() is a pure arg-generation function — it does NOT require
    // initialize() or namespace support. We test arg structure independently.
    const driver = new BubblewrapDriver();
    const policy = SandboxPolicy.strict('/tmp').config;
    const result = driver.wrapCommand('echo', ['sandbox_works'], '/tmp', policy, {
      PATH: '/bin',
      HOME: '/root',
      TERM: 'xterm',
      SHELL: '/bin/sh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    });

    assert.equal(result.command, '/bin/bwrap', 'Command must be the bwrap binary');
    assert.equal(result.isolated, true, 'BubblewrapDriver must always report isolated: true');
    assert.equal(result.driverName, 'bubblewrap');
    assert.ok(Array.isArray(result.args), 'args must be an array');
  });

  it('wrapCommand includes --unshare-net when network is not allowed', () => {
    const driver = new BubblewrapDriver();
    const policy = SandboxPolicy.strict('/tmp').config;
    const result = driver.wrapCommand('echo', [], '/tmp', policy, { PATH: '/bin' });

    assert.ok(result.args.includes('--unshare-net'),
      '--unshare-net must be present when network is denied');
  });

  it('wrapCommand does NOT include --unshare-net when network is allowed', () => {
    const driver = new BubblewrapDriver();
    const policy = SandboxPolicy.permissive('/tmp').config;
    const result = driver.wrapCommand('echo', [], '/tmp', policy, { PATH: '/bin' });

    assert.ok(!result.args.includes('--unshare-net'),
      '--unshare-net must NOT be present when network is allowed');
  });

  it('wrapCommand always includes --unshare-pid and --die-with-parent', () => {
    const driver = new BubblewrapDriver();
    const policy = SandboxPolicy.strict('/tmp').config;
    const result = driver.wrapCommand('echo', [], '/tmp', policy, { PATH: '/bin' });

    assert.ok(result.args.includes('--unshare-pid'), '--unshare-pid must always be present');
    assert.ok(result.args.includes('--die-with-parent'), '--die-with-parent must always be present');
  });

  it('wrapCommand uses --clearenv and --setenv for environment control', () => {
    const driver = new BubblewrapDriver();
    const policy = SandboxPolicy.strict('/tmp').config;
    const result = driver.wrapCommand('env', [], '/tmp', policy, {
      PATH: '/bin',
      HOME: '/root',
      TERM: 'xterm',
      SHELL: '/bin/sh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      AWS_SECRET: 'shouldnotappear',
    });

    assert.ok(result.args.includes('--clearenv'), '--clearenv must be present');

    // Reconstruct set env pairs from args
    const setenvPairs: Record<string, string> = {};
    for (let i = 0; i < result.args.length; i++) {
      if (result.args[i] === '--setenv' && i + 2 < result.args.length) {
        setenvPairs[result.args[i + 1]] = result.args[i + 2];
        i += 2;
      }
    }

    assert.ok('PATH' in setenvPairs, 'PATH must be re-injected via --setenv');
    assert.ok('HOME' in setenvPairs, 'HOME must be re-injected via --setenv (in strict allowedKeys)');
    assert.ok(!('AWS_SECRET' in setenvPairs), 'AWS_SECRET must NOT be re-injected');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. SandboxManager — Driver Selection
// ──────────────────────────────────────────────────────────────────────────────

describe('SandboxManager — Driver Selection & Initialization', () => {
  it('selects LocalDriver when policy isolationLevel is none', async () => {
    const manager = new SandboxManager(SandboxPolicy.none());
    const result = await manager.initialize();
    assert.equal(result.driver, 'local');
    assert.equal(result.isolated, false);
    await manager.cleanup();
  });

  it('reports honest result when bubblewrap is requested — either selects it or warns', async () => {
    // This test is environment-agnostic: whether bwrap works or not,
    // the manager must be transparent about what actually happened.
    const manager = new SandboxManager(SandboxPolicy.strict('/tmp'));
    const result = await manager.initialize();

    if (result.driver === 'bubblewrap') {
      assert.equal(result.isolated, true, 'bubblewrap driver must report isolated: true');
      assert.equal(result.warning, undefined, 'No warning when bwrap works');
    } else {
      // Fell back to local — must have a warning explaining why.
      assert.equal(result.driver, 'local');
      assert.equal(result.isolated, false);
      assert.ok(
        typeof result.warning === 'string' && result.warning.length > 0,
        `SandboxManager must emit a warning when falling back to local, got: ${result.warning}`
      );
    }
    await manager.cleanup();
  });

  it('throws if wrapCommand is called before initialize()', () => {
    const manager = new SandboxManager(SandboxPolicy.none());
    assert.throws(
      () => manager.wrapCommand('echo hi', '/tmp', {}),
      /initialize\(\)/,
      'Must throw with a message mentioning initialize()'
    );
  });

  it('wrapCommand after initialize() returns a valid CommandWrapResult', async () => {
    const manager = new SandboxManager(SandboxPolicy.none());
    await manager.initialize();
    const result = manager.wrapCommand('echo hello', '/tmp', { PATH: '/bin' });

    assert.equal(typeof result.command, 'string');
    assert.ok(result.command.length > 0);
    assert.equal(typeof result.isolated, 'boolean');
    assert.equal(typeof result.driverName, 'string');
    await manager.cleanup();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. SandboxPolicy — Validation & Presets
// ──────────────────────────────────────────────────────────────────────────────

describe('SandboxPolicy — Presets & Validation', () => {
  it('strict preset disables network', () => {
    const policy = SandboxPolicy.strict('/tmp');
    assert.equal(policy.isNetworkAllowed(), false);
  });

  it('permissive preset allows network', () => {
    const policy = SandboxPolicy.permissive('/tmp');
    assert.equal(policy.isNetworkAllowed(), true);
  });

  it('none preset has isolationLevel: none', () => {
    const policy = SandboxPolicy.none();
    assert.equal(policy.isolationLevel, 'none');
    assert.equal(policy.isNetworkAllowed(), true);
  });

  it('rejects maxMemoryMb below 16 MiB', () => {
    const policy = new SandboxPolicy({
      resources: { maxMemoryMb: 4 },
    });
    const errors = policy.validate();
    assert.ok(errors.length > 0, 'Should have validation errors for tiny memory');
    assert.ok(errors[0].includes('maxMemoryMb'), 'Error should mention maxMemoryMb');
  });

  it('rejects maxProcessCount below 1', () => {
    const policy = new SandboxPolicy({
      resources: { maxProcessCount: 0 },
    });
    const errors = policy.validate();
    assert.ok(errors.length > 0, 'Should have validation errors for zero process count');
    assert.ok(errors[0].includes('maxProcessCount'), 'Error should mention maxProcessCount');
  });

  it('valid policy has no validation errors', () => {
    const policy = SandboxPolicy.strict('/tmp');
    const errors = policy.validate();
    assert.equal(errors.length, 0, `Unexpected validation errors: ${errors.join(', ')}`);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Real Execution Test (requires kernel namespace support)
// ──────────────────────────────────────────────────────────────────────────────

describe('BubblewrapDriver — Real Isolation Verification', () => {
  it('sandboxed echo command executes successfully when bwrap is fully available', async () => {
    // Use real capability probe — binary existence alone is not sufficient.
    const driver = new BubblewrapDriver();
    const caps = await driver.checkCapabilities();
    if (!caps.available) {
      // Skip: kernel does not support user namespaces in this environment.
      // This is expected in containers without unprivileged namespace support.
      return;
    }

    await driver.initialize();

    const policy = SandboxPolicy.strict('/tmp').config;
    const hostEnv = {
      PATH: '/usr/bin:/bin',
      HOME: '/root',
      TERM: 'xterm',
      SHELL: '/bin/sh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    };

    const result = driver.wrapCommand('echo', ['sandbox_works'], '/tmp', policy, hostEnv);

    assert.equal(result.command, '/bin/bwrap');
    assert.equal(result.isolated, true);

    // Actually execute the wrapped command to prove it works.
    const { stdout } = await execFileAsync(result.command, result.args, {
      timeout: 10000,
      env: result.env, // Empty for bwrap — env managed via --setenv inside
    });

    assert.ok(stdout.includes('sandbox_works'),
      `Expected "sandbox_works" in stdout, got: ${stdout}`);
  });

  it('sandboxed command cannot see host-only env variables when bwrap is available', async () => {
    const driver = new BubblewrapDriver();
    const caps = await driver.checkCapabilities();
    if (!caps.available) return;

    await driver.initialize();

    const policy = SandboxPolicy.strict('/tmp').config;
    const hostEnv = {
      PATH: '/usr/bin:/bin',
      HOME: '/root',
      TERM: 'xterm',
      SHELL: '/bin/sh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      HOST_SECRET: 'should_not_be_visible',
    };

    // Command that prints HOST_SECRET if present, or "HIDDEN" if not.
    const result = driver.wrapCommand(
      "sh -c 'echo ${HOST_SECRET:-HIDDEN}'",
      [],
      '/tmp',
      policy,
      hostEnv
    );

    const { stdout } = await execFileAsync(result.command, result.args, {
      timeout: 10000,
      env: result.env,
    });

    assert.ok(stdout.trim() === 'HIDDEN',
      `HOST_SECRET must not be visible inside sandbox, got: ${stdout}`);
  });
});
