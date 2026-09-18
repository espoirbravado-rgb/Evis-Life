/**
 * phase14_e2e.test.ts — Phase 14: End-to-End Architectural Integration Test
 *
 * Demonstrates the full unbroken chain:
 *   Agent Context
 *       ↓
 *   ToolExecutor
 *       ↓
 *   TerminalTool
 *       ↓
 *   TerminalRuntime
 *       ↓
 *   Policy & Permission
 *       ↓
 *   Environment Filtering
 *       ↓
 *   Sandbox
 *       ↓
 *   ProcessManager & Handle
 *       ↓
 *   stdout / stderr
 *       ↓
 *   Events, Audit, Metrics
 *       ↓
 *   Normalized IToolResult
 *
 * Zero faux-semblant:
 *  - Real OS child process spawned and waited
 *  - Full telemetry, agentId, taskId, processId, and audit verified
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuntimeComposition } from '../../composition/runtimeComposition.ts';
import { TerminalTool } from '../../execution/implementations/terminalTool.ts';
import type { IRuntimeContext, IToolCall } from '../../types/domain.ts';
import type { TerminalEvent } from '../streaming/terminalEvents.ts';

describe('Terminal-New Phase 14 (End-to-End Architecture)', () => {
  it('executes full pipeline: Agent -> ToolExecutor -> TerminalTool -> Runtime -> OS -> Audit -> Metrics', async () => {
    const composition = new RuntimeComposition();
    const executor = composition.getToolExecutor();
    const terminalImpl = composition.getImplementations().find((impl) => impl.toolId === 'terminal') as TerminalTool;
    const runtime = terminalImpl.getRuntime();

    // 1. Setup events collector
    const capturedEvents: TerminalEvent[] = [];
    const unsubscribe = runtime.events.subscribe((event) => {
      capturedEvents.push(event);
    });

    // 2. Metrics baseline
    const initialMetrics = runtime.metrics.getMetrics();
    const initialCommands = initialMetrics.totalCommandsExecuted;

    // 3. Agent context & tool call
    const agentId = 'agent_architect_42';
    const taskId = 'task_e2e_deploy_007';
    const sessionId = `e2e_session_${Date.now()}`;

    const context: IRuntimeContext = {
      sessionId,
      goal: 'perform end-to-end integration test of terminal-new',
      messages: [],
      environment: {
        workspaceRoot: process.cwd(),
        homeDir: process.env.HOME ?? '/home',
      },
      metadata: {
        agentId,
        taskId,
      },
    };

    const call: IToolCall = {
      id: 'call_e2e_verified_1',
      toolId: 'terminal',
      arguments: {
        command: 'echo "E2E_VERIFICATION_PAYLOAD_SUCCESS"',
      },
    };

    // 4. Execution through central ToolExecutor boundary
    const toolResult = await executor.execute({
      call,
      context,
      resolvedCapabilities: ['terminal.execute'],
    });

    unsubscribe();

    // 5. Verify normalized tool result
    assert.equal(toolResult.status, 'success');
    assert.equal(toolResult.callId, 'call_e2e_verified_1');
    assert.equal(toolResult.toolId, 'terminal');
    assert.match(toolResult.stdout ?? '', /E2E_VERIFICATION_PAYLOAD_SUCCESS/);
    assert.equal(toolResult.stderr ?? '', '');
    assert.equal(toolResult.error, undefined);
    assert.ok(toolResult.durationMs >= 0);

    const callData = toolResult.data as Record<string, unknown>;
    assert.equal(callData.exitCode, 0);
    assert.equal(callData.status, 'completed');
    assert.ok(typeof callData.processId === 'number' && (callData.processId as number) > 0);

    // 6. Verify event streaming telemetry
    const eventTypes = capturedEvents.map((e) => e.type);
    assert.ok(eventTypes.includes('process_created'), 'Must emit process_created');
    assert.ok(eventTypes.includes('process_started'), 'Must emit process_started');
    assert.ok(eventTypes.includes('stdout'), 'Must emit stdout');
    assert.ok(eventTypes.includes('process_exited'), 'Must emit process_exited');

    for (const ev of capturedEvents) {
      assert.ok(ev.eventId, 'Every event must have an eventId');
      assert.ok(ev.timestamp > 0, 'Every event must have a valid timestamp');
      assert.equal(ev.sessionId, sessionId, 'Event must preserve sessionId');
      assert.equal(ev.taskId, taskId, 'Event must preserve taskId');
      assert.equal(ev.agentId, agentId, 'Event must preserve agentId');
    }

    // 7. Verify Audit Trail records
    const auditRecords = runtime.audit.getRecords({ taskId });
    assert.ok(auditRecords.length >= 1, 'Audit record must be persisted for this task');
    const audit = auditRecords[auditRecords.length - 1];
    assert.ok(audit.eventId.startsWith('aud_'));
    assert.equal(audit.agentId, agentId, 'Audit must capture agentId');
    assert.equal(audit.taskId, taskId, 'Audit must capture taskId');
    assert.equal(audit.sessionId, sessionId, 'Audit must capture sessionId');
    assert.equal(audit.processId, callData.processId, 'Audit must record real OS processId');
    assert.equal(audit.exitCode, 0, 'Audit must capture exitCode');
    assert.equal(audit.status, 'completed', 'Audit must capture final status');
    assert.match(audit.command, /E2E_VERIFICATION_PAYLOAD_SUCCESS/);

    // 8. Verify quantitative metrics consistency
    const updatedMetrics = runtime.metrics.getMetrics();
    assert.equal(updatedMetrics.totalCommandsExecuted, initialCommands + 1);
    assert.ok(updatedMetrics.successfulCommands >= 1);
    assert.equal(updatedMetrics.activeProcesses, 0, 'Active processes must return to zero');
  });
});
