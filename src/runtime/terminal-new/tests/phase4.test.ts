import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRuntime } from '../terminalRuntime.ts';
import { TerminalPolicy } from '../terminalPolicy.ts';

describe('Terminal-New Phase 4 (Background Processes)', () => {
  describe('Background Execution & Non-blocking Start', () => {
    it('starts background job immediately without blocking', async () => {
      const runtime = new TerminalRuntime();
      const startTime = Date.now();

      const job = await runtime.startBackground('bash -c "for i in {1..5}; do echo step-$i; sleep 0.05; done"');
      const startDuration = Date.now() - startTime;

      assert.ok(startDuration < 80, `startBackground returned promptly in ${startDuration}ms`);
      assert.ok(job.id);
      assert.ok(job.pid);
      assert.equal(job.getStatus(), 'running');

      // Wait for it to complete naturally
      const result = await job.wait();
      assert.equal(result.exitCode, 0);
      assert.equal(job.getStatus(), 'exited');
    });

    it('captures live stdout logs while background process is actively executing', async () => {
      const runtime = new TerminalRuntime();

      const job = await runtime.startBackground('bash -c "echo initial_log; sleep 0.1; echo follow_up_log; sleep 0.1"');

      // Poll logs quickly while running
      await new Promise(r => setTimeout(r, 40));
      const midLogs = job.getLogs();
      assert.match(midLogs.stdout, /initial_log/);

      await job.wait();
      const finalLogs = runtime.getProcessLogs(job.id);
      assert.ok(finalLogs);
      assert.match(finalLogs.stdout, /initial_log/);
      assert.match(finalLogs.stdout, /follow_up_log/);
    });
  });

  describe('Process Inspection & Querying', () => {
    it('inspects background process snapshot and lists in registry', async () => {
      const runtime = new TerminalRuntime();
      const session = runtime.sessionManager.createSession();

      const job = await runtime.startBackground('sleep 5', { sessionId: session.id, taskId: 'task_bg_inspect' });

      // Inspect via runtime
      const snapshot = runtime.inspectProcess(job.id);
      assert.ok(snapshot);
      assert.equal(snapshot.id, job.id);
      assert.equal(snapshot.state, 'running');
      assert.equal(snapshot.sessionId, session.id);
      assert.equal(snapshot.taskId, 'task_bg_inspect');

      // Query list
      const jobs = runtime.listBackgroundJobs(session.id);
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].id, job.id);

      // Kill to clean up
      job.kill('SIGKILL');
      await job.wait();
    });
  });

  describe('Signaling, Termination & Tree Cleanup', () => {
    it('kills background process tree cleanly and reports status killed', async () => {
      const runtime = new TerminalRuntime();
      const job = await runtime.startBackground('bash -c "sleep 30"');

      assert.equal(job.getStatus(), 'running');
      const killed = job.kill('SIGTERM');
      assert.equal(killed, true);

      await job.wait();
      assert.equal(job.getStatus(), 'killed');
    });

    it('cleans up all running processes on runtime.cleanup()', async () => {
      const runtime = new TerminalRuntime();
      const job1 = await runtime.startBackground('sleep 20');
      const job2 = await runtime.startBackground('sleep 20');

      assert.equal(job1.getStatus(), 'running');
      assert.equal(job2.getStatus(), 'running');

      runtime.cleanup();

      await Promise.all([job1.wait(), job2.wait()]);
      assert.equal(job1.getStatus(), 'killed');
      assert.equal(job2.getStatus(), 'killed');
    });
  });

  describe('Policy Enforcement for Background Jobs', () => {
    it('rejects startBackground if allowBackground is disabled by policy', async () => {
      const customPolicy = new TerminalPolicy({
        ...new TerminalPolicy()['config'],
        allowBackground: false
      });

      const runtime = new TerminalRuntime({ policy: customPolicy });

      await assert.rejects(
        async () => {
          await runtime.startBackground('sleep 5');
        },
        /Background execution denied by policy/
      );
    });
  });
});
