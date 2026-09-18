import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { TerminalRuntime } from '../terminalRuntime.ts';

describe('Terminal-New Phase 2 (Sessions)', () => {
  describe('Persistent Working Directory (CWD)', () => {
    it('persists CWD across consecutive commands in the same session', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();
      const originalCwd = session.cwd;

      // 1. Navigate to 'src'
      const cdResult = await runtime.execute('cd src', { sessionId: session.id });
      assert.equal(cdResult.status, 'completed');
      assert.equal(cdResult.exitCode, 0);
      assert.equal(session.cwd, resolve(originalCwd, 'src'));

      // 2. Next command verifies CWD is preserved
      const pwdResult = await runtime.execute('pwd', { sessionId: session.id });
      assert.equal(pwdResult.status, 'completed');
      assert.equal(pwdResult.stdout.trim(), resolve(originalCwd, 'src'));

      // 3. Navigate back with 'cd ..'
      const backResult = await runtime.execute('cd ..', { sessionId: session.id });
      assert.equal(backResult.status, 'completed');
      assert.equal(session.cwd, originalCwd);
    });

    it('supports cd - to return to the previous working directory', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();
      const originalCwd = session.cwd;

      await runtime.execute('cd src', { sessionId: session.id });
      assert.equal(session.cwd, resolve(originalCwd, 'src'));

      // 'cd -' switches back to previous directory
      const prevResult = await runtime.execute('cd -', { sessionId: session.id });
      assert.equal(prevResult.status, 'completed');
      assert.equal(session.cwd, originalCwd);
    });

    it('supports cd ~ to navigate to the user home directory', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();

      const homeResult = await runtime.execute('cd ~', { sessionId: session.id });
      assert.equal(homeResult.status, 'completed');
      assert.equal(session.cwd, homedir());
    });

    it('fails truthfully when navigating to non-existent directory without altering CWD', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();
      const originalCwd = session.cwd;

      const failResult = await runtime.execute('cd non_existent_folder_xyz_999', { sessionId: session.id });
      assert.equal(failResult.status, 'failed');
      assert.equal(failResult.exitCode, 1);
      assert.match(failResult.stderr, /No such file or directory/);
      assert.equal(session.cwd, originalCwd); // CWD remains unchanged
    });
  });

  describe('Persistent Environment Variables', () => {
    it('persists environment variables across commands in the same session', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();

      // 1. Export variable in session
      const exportResult = await runtime.execute('export AGENT_SESSION_FLAG=active_mode', {
        sessionId: session.id
      });
      assert.equal(exportResult.status, 'completed');
      assert.equal(exportResult.exitCode, 0);

      // 2. Next command reads the exported variable
      const echoResult = await runtime.execute('echo "FLAG=$AGENT_SESSION_FLAG"', {
        sessionId: session.id
      });
      assert.equal(echoResult.status, 'completed');
      assert.match(echoResult.stdout, /FLAG=active_mode/);
    });
  });

  describe('Multi-Session Isolation', () => {
    it('completely isolates CWD and environment between different sessions', async () => {
      const runtime = new TerminalRuntime();
      const sessionA = runtime.sessionManager.createSession();
      const sessionB = runtime.sessionManager.createSession();

      // Setup session A
      await runtime.execute('cd src', { sessionId: sessionA.id });
      await runtime.execute('export VAR_ISOLATION=ALPHA', { sessionId: sessionA.id });

      // Setup session B
      await runtime.execute('export VAR_ISOLATION=BETA', { sessionId: sessionB.id });

      // Query session A
      const resA = await runtime.execute('echo "VAR=$VAR_ISOLATION,DIR=$(pwd)"', { sessionId: sessionA.id });
      assert.match(resA.stdout, /VAR=ALPHA/);
      assert.match(resA.stdout, /DIR=.*\/src/);

      // Query session B
      const resB = await runtime.execute('echo "VAR=$VAR_ISOLATION,DIR=$(pwd)"', { sessionId: sessionB.id });
      assert.match(resB.stdout, /VAR=BETA/);
      assert.ok(!resB.stdout.includes('/src'));
    });
  });

  describe('Process Ownership & Session Closing', () => {
    it('tracks active processes and kills them when session is closed', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();

      // Launch long running process in background
      const spawnPromise = runtime.execute('sleep 30', { sessionId: session.id });

      // Allow brief moment for process to spawn
      await new Promise(r => setTimeout(r, 20));

      const activeProcesses = session.getActiveProcessIds();
      assert.equal(activeProcesses.length, 1);
      const pid = activeProcesses[0];
      const handle = runtime.processManager.get(pid);
      assert.ok(handle);
      assert.equal(handle.isAlive, true);

      // Close session
      const closed = await runtime.closeSession(session.id);
      assert.equal(closed, true);
      assert.equal(session.status, 'closed');

      // The process must be killed
      await spawnPromise;
      assert.equal(handle.isAlive, false);
      assert.ok(['killed', 'stopping', 'failed'].includes(handle.state));
    });
  });

  describe('Session Snapshot Security', () => {
    it('generates snapshot without leaking secret environment values', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();

      session.setEnvVar('PUBLIC_CONF', 'public_value');
      session.setEnvVar('APP_SECRET_TOKEN', 'super_secret_123');

      const snapshot = session.toSnapshot();
      assert.equal(snapshot.sessionId, session.id);
      assert.equal(snapshot.environmentMetadata.variableCount, 2);
      assert.ok(snapshot.environmentMetadata.keys.includes('PUBLIC_CONF'));
      assert.ok(snapshot.environmentMetadata.keys.includes('APP_SECRET_TOKEN'));

      // Ensure raw values are NOT serialized in snapshot
      const json = JSON.stringify(snapshot);
      assert.ok(!json.includes('super_secret_123'));
    });
  });

  describe('Session Lifecycle and Control Methods', () => {
    it('executes commands via executeInSession and persists session state', async () => {
      const runtime = new TerminalRuntime();
      const sessionId = runtime.createSession();

      const r1 = await runtime.executeInSession(sessionId, 'export FOO_BAR=baz_qux');
      assert.equal(r1.status, 'completed');

      const r2 = await runtime.executeInSession(sessionId, 'echo "FOO=$FOO_BAR"');
      assert.equal(r2.status, 'completed');
      assert.match(r2.stdout, /FOO=baz_qux/);

      const session = runtime.getSession(sessionId);
      assert.ok(session);
      assert.equal(session.id, sessionId);
    });

    it('command failure does not destroy or close the session', async () => {
      const runtime = new TerminalRuntime();
      const sessionId = runtime.createSession();

      const failedResult = await runtime.executeInSession(sessionId, 'bash -c "exit 5"');
      assert.equal(failedResult.status, 'failed');
      assert.equal(failedResult.exitCode, 5);

      const session = runtime.getSession(sessionId);
      assert.ok(session);
      assert.equal(session.status, 'active');

      const okResult = await runtime.executeInSession(sessionId, 'echo "session is alive"');
      assert.equal(okResult.status, 'completed');
      assert.match(okResult.stdout, /session is alive/);
    });

    it('supports detaching and reattaching sessions', async () => {
      const runtime = new TerminalRuntime();
      const sessionId = runtime.createSession();

      const detached = runtime.detachSession(sessionId);
      assert.equal(detached, true);
      assert.equal(runtime.getSession(sessionId)?.status, 'detached');

      const attached = runtime.attachSession(sessionId);
      assert.equal(attached, true);
      assert.equal(runtime.getSession(sessionId)?.status, 'active');
    });

    it('can interrupt a running process in session via interruptSession', async () => {
      const runtime = new TerminalRuntime();
      const sessionId = runtime.createSession();

      const execPromise = runtime.executeInSession(sessionId, 'sleep 10');
      // Wait for process to spawn
      await new Promise(r => setTimeout(r, 30));

      const interrupted = runtime.interruptSession(sessionId);
      assert.equal(interrupted, true);

      const result = await execPromise;
      assert.ok(result.durationMs < 2000);
    });
  });
});
