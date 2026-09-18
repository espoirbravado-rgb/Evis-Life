/**
 * phase11.test.ts — Phase 11: Agent Integration & Tool Execution Layer
 *
 * Verifies the full integration of the Terminal Runtime into Evis:
 *  - RuntimeComposition includes TerminalTool by default
 *  - ToolExecutor dispatches 'terminal' calls to TerminalTool
 *  - Standard agent commands execute and return structured IToolResult
 *  - Security policies and approvals are strictly enforced at the agent boundary
 *  - Contextual sessions preserve CWD and state across multiple tool calls
 *  - Audit trail and telemetry track all agent terminal operations
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuntimeComposition } from '../../composition/runtimeComposition.ts';
import { TerminalTool } from '../../execution/implementations/terminalTool.ts';
import type { IRuntimeContext, IToolCall } from '../../types/domain.ts';

describe('Terminal-New Phase 11 (Agent Integration & Execution Boundary)', () => {
  const createContext = (overrides: Partial<IRuntimeContext> = {}): IRuntimeContext => ({
    sessionId: overrides.sessionId ?? `agent_sess_${Date.now()}`,
    goal: 'verify terminal integration',
    messages: [],
    environment: {
      workspaceRoot: process.cwd(),
      homeDir: process.env.HOME ?? '/home',
    },
    metadata: overrides.metadata ?? {},
    ...overrides,
  });

  describe('RuntimeComposition & Tool Registration', () => {
    it('automatically equips RuntimeComposition with TerminalTool', () => {
      const composition = new RuntimeComposition();
      const executor = composition.getToolExecutor();

      assert.equal(executor.hasImplementation('terminal'), true);
      assert.equal(executor.hasImplementation('filesystem'), true);
    });

    it('retrieves the TerminalTool instance and its underlying runtime', () => {
      const composition = new RuntimeComposition();
      const terminalImpl = composition.getImplementations().find((impl) => impl.toolId === 'terminal');

      assert.ok(terminalImpl instanceof TerminalTool);
      assert.ok(terminalImpl.getRuntime());
    });
  });

  describe('Agent Tool Execution Pipeline', () => {
    it('executes through full ToolExecutor -> ToolRegistry -> PermissionManager -> TerminalTool pipeline', async () => {
      const composition = new RuntimeComposition();
      const executor = composition.getToolExecutor();
      const terminalImpl = composition.getImplementations().find((impl) => impl.toolId === 'terminal') as TerminalTool;

      const call: IToolCall = {
        id: 'call_full_pipeline_1',
        toolId: 'terminal',
        arguments: { command: 'echo "full architecture path verified"' },
      };

      const context = createContext({
        metadata: { agentId: 'agent_coder_99', taskId: 'task_audit_trace_77' },
      });

      const result = await executor.execute({
        call,
        context,
        resolvedCapabilities: ['terminal.execute'],
      });

      assert.equal(result.status, 'success');
      assert.match(result.stdout ?? '', /full architecture path verified/);

      // Section 11.4: The final audit must answer which agent caused this process
      const records = terminalImpl.getRuntime().audit.getRecords({ taskId: 'task_audit_trace_77' });
      assert.ok(records.length >= 1);
      assert.equal(records[0].agentId, 'agent_coder_99');
      assert.equal(records[0].taskId, 'task_audit_trace_77');
    });

    it('executes shell commands and returns structured IToolResult on success', async () => {
      const tool = new TerminalTool();
      const call: IToolCall = {
        id: 'call_echo_1',
        toolId: 'terminal',
        arguments: { command: 'echo "agent integration verified"' },
      };

      const result = await tool.execute(call, createContext());

      assert.equal(result.status, 'success');
      assert.match(result.stdout ?? '', /agent integration verified/);
      assert.equal(result.error, undefined);
      assert.equal((result.data as Record<string, unknown>)?.exitCode, 0);
      assert.ok(result.durationMs >= 0);
      assert.ok(typeof result.timestamp === 'string');
    });

    it('reports failed with exit code when a command exits non-zero', async () => {
      const tool = new TerminalTool();
      const call: IToolCall = {
        id: 'call_fail_1',
        toolId: 'terminal',
        arguments: { command: 'ls /path_that_definitely_does_not_exist_404' },
      };

      const result = await tool.execute(call, createContext());

      assert.equal(result.status, 'failed');
      assert.notEqual((result.data as Record<string, unknown>)?.exitCode, 0);
      assert.ok(result.error);
      assert.equal(result.error?.code, 'COMMAND_FAILED');
    });

    it('rejects calls with missing command argument cleanly', async () => {
      const tool = new TerminalTool();
      const call: IToolCall = {
        id: 'call_empty_1',
        toolId: 'terminal',
        arguments: {},
      };

      const result = await tool.execute(call, createContext());

      assert.equal(result.status, 'failed');
      assert.equal(result.error?.code, 'INVALID_ARGUMENT');
    });

    it('enforces security policies on dangerous commands initiated by agent', async () => {
      const tool = new TerminalTool();
      const call: IToolCall = {
        id: 'call_dangerous_1',
        toolId: 'terminal',
        arguments: { command: 'rm -rf /' },
      };

      const result = await tool.execute(call, createContext());

      assert.equal(result.status, 'denied');
      assert.match(result.stderr ?? '', /denied|blocked|forbidden/i);
    });
  });

  describe('Session Continuity & Telemetry through Agent Calls', () => {
    it('preserves working directory navigation across agent tool calls in the same session', async () => {
      const tool = new TerminalTool();
      const sessionId = `continuity_${Date.now()}`;
      const context = createContext({ sessionId });

      // First call: navigate to /tmp
      await tool.execute({
        id: 'call_nav_1',
        toolId: 'terminal',
        arguments: { command: 'cd /tmp' },
      }, context);

      // Second call: check pwd
      const pwdResult = await tool.execute({
        id: 'call_pwd_1',
        toolId: 'terminal',
        arguments: { command: 'pwd' },
      }, context);

      assert.equal(pwdResult.status, 'success');
      assert.equal(pwdResult.stdout?.trim(), '/tmp');
    });

    it('records agent executions in audit log and metrics', async () => {
      const tool = new TerminalTool();
      const context = createContext({ metadata: { taskId: 'audit_verification_task' } });

      await tool.execute({
        id: 'call_audit_1',
        toolId: 'terminal',
        arguments: { command: 'echo "audited agent action"' },
      }, context);

      const runtime = tool.getRuntime();
      const records = runtime.audit.getRecords({ taskId: 'audit_verification_task' });
      assert.ok(records.length >= 1);
      assert.match(records[0].command, /audited agent action/);

      const metrics = runtime.metrics.getMetrics();
      assert.ok(metrics.totalCommandsExecuted >= 1);
      assert.ok(metrics.successfulCommands >= 1);
    });
  });
});
