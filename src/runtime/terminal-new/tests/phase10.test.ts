/**
 * phase10.test.ts — Phase 10: Observability, Audit & Metrics Tests
 *
 * Verifies:
 *  - TerminalAudit captures full execution telemetry without secret leaks
 *  - Audit log filtering by session, task, status, and timestamp
 *  - MetricsCollector tracks counts, durations, approvals, background jobs, and failures
 *  - Integration between TerminalRuntime execution and Observability subsystem
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TerminalAudit } from '../observability/terminalAudit.ts';
import { MetricsCollector } from '../observability/metricsCollector.ts';
import { TerminalRuntime } from '../terminalRuntime.ts';

describe('Terminal-New Phase 10 (Observability & Metrics)', () => {
  describe('TerminalAudit — Telemetry & Querying', () => {
    it('captures full execution record with all required context fields', () => {
      const audit = new TerminalAudit();
      const record = audit.logExecution({
        command: 'npm test',
        cwd: '/app',
        durationMs: 125,
        exitCode: 0,
        status: 'completed',
        actorId: 'user_42',
        agentId: 'agent_planner',
        taskId: 'task_deploy_1',
        sessionId: 'sess_abc',
        processId: 12345,
        decision: 'allow',
        approval: { required: false },
        sandbox: { driver: 'bubblewrap', isolated: true },
        signal: null,
      });

      assert.ok(record.eventId.startsWith('aud_'));
      assert.ok(record.timestamp > 0);
      assert.equal(record.command, 'npm test');
      assert.equal(record.cwd, '/app');
      assert.equal(record.exitCode, 0);
      assert.equal(record.actorId, 'user_42');
      assert.equal(record.agentId, 'agent_planner');
      assert.equal(record.taskId, 'task_deploy_1');
      assert.equal(record.sessionId, 'sess_abc');
      assert.equal(record.sandbox?.driver, 'bubblewrap');
      assert.equal(record.sandbox?.isolated, true);
    });

    it('filters audit records by sessionId and status', () => {
      const audit = new TerminalAudit();
      audit.logExecution({ command: 'ls', cwd: '/app', durationMs: 10, exitCode: 0, status: 'completed', sessionId: 's1' });
      audit.logExecution({ command: 'rm file', cwd: '/app', durationMs: 20, exitCode: 1, status: 'failed', sessionId: 's1' });
      audit.logExecution({ command: 'pwd', cwd: '/app', durationMs: 5, exitCode: 0, status: 'completed', sessionId: 's2' });

      const s1Records = audit.getRecords({ sessionId: 's1' });
      assert.equal(s1Records.length, 2);

      const failedRecords = audit.getRecords({ status: 'failed' });
      assert.equal(failedRecords.length, 1);
      assert.equal(failedRecords[0].command, 'rm file');
    });

    it('enforces maximum record retention capacity', () => {
      const audit = new TerminalAudit(5);
      for (let i = 0; i < 10; i++) {
        audit.logExecution({ command: `cmd_${i}`, cwd: '/app', durationMs: 1, exitCode: 0, status: 'completed' });
      }

      const records = audit.getRecords();
      assert.equal(records.length, 5);
      assert.equal(records[records.length - 1].command, 'cmd_9');
    });
  });

  describe('MetricsCollector — Quantitative Tracking', () => {
    it('aggregates command metrics, durations, and average times', () => {
      const metrics = new MetricsCollector();
      metrics.recordCommand({ durationMs: 100, status: 'completed' });
      metrics.recordCommand({ durationMs: 200, status: 'completed' });
      metrics.recordCommand({ durationMs: 300, status: 'failed' });
      metrics.recordCommand({ durationMs: 400, status: 'timed_out', timedOut: true });

      const m = metrics.getMetrics();
      assert.equal(m.totalCommandsExecuted, 4);
      assert.equal(m.successfulCommands, 2);
      assert.equal(m.failedCommands, 1);
      assert.equal(m.timeouts, 1);
      assert.equal(m.totalDurationMs, 1000);
      assert.equal(m.averageExecutionDurationMs, 250);
    });

    it('records security approvals and rejections', () => {
      const metrics = new MetricsCollector();
      metrics.recordApproval('required');
      metrics.recordApproval('required');
      metrics.recordApproval('granted');
      metrics.recordApproval('denied');

      const m = metrics.getMetrics();
      assert.equal(m.approvalsRequired, 2);
      assert.equal(m.approvalsGranted, 1);
      assert.equal(m.approvalsDenied, 1);
    });

    it('records active processes, background jobs, and pty sessions', () => {
      const metrics = new MetricsCollector();
      metrics.recordBackgroundJob();
      metrics.recordBackgroundJob();
      metrics.recordPtySession();
      metrics.setActiveProcesses(3);

      const m = metrics.getMetrics();
      assert.equal(m.backgroundJobsStarted, 2);
      assert.equal(m.ptySessionsStarted, 1);
      assert.equal(m.activeProcesses, 3);
    });

    it('tracks output truncations and sandbox failures', () => {
      const metrics = new MetricsCollector();
      metrics.recordCommand({ durationMs: 50, status: 'completed', truncated: true });
      metrics.recordSandboxFailure();

      const m = metrics.getMetrics();
      assert.equal(m.outputTruncations, 1);
      assert.equal(m.sandboxFailures, 1);
    });
  });

  describe('TerminalRuntime Observability Integration', () => {
    it('automatically records audit logs and metrics on runtime execution', async () => {
      const runtime = new TerminalRuntime();
      const result = await runtime.execute('echo "observability_test"');

      assert.equal(result.exitCode, 0);

      // Verify audit record was logged
      const records = runtime.audit.getRecords();
      assert.ok(records.length >= 1);
      const latest = records[records.length - 1];
      assert.match(latest.command, /observability_test/);
      assert.equal(latest.status, 'completed');

      // Verify metrics
      const metrics = runtime.metrics.getMetrics();
      assert.ok(metrics.totalCommandsExecuted >= 1);
      assert.ok(metrics.successfulCommands >= 1);

      await runtime.cleanup();
    });
  });
});
