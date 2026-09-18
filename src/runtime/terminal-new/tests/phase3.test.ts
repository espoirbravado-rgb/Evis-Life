import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRuntime } from '../terminalRuntime.ts';
import type { TerminalEvent } from '../streaming/terminalEvents.ts';

describe('Terminal-New Phase 3 (Streaming & Events)', () => {
  describe('Event Lifecycle & Chronology', () => {
    it('emits lifecycle events in proper order with valid IDs and timestamps', async () => {
      const runtime = new TerminalRuntime();
      const events: TerminalEvent[] = [];

      const unsubscribe = runtime.events.subscribe((event) => {
        events.push(event);
      });

      const result = await runtime.execute('echo "stream chunk 1" && echo "stream chunk 2"', {
        taskId: 'task_lifecycle_1',
        agentId: 'agent-stream-1'
      });

      assert.equal(result.status, 'completed');
      unsubscribe();

      // Check event types recorded
      const types = events.map(e => e.type);
      assert.ok(types.includes('process_created'));
      assert.ok(types.includes('process_started'));
      assert.ok(types.includes('stdout'));
      assert.ok(types.includes('process_exited'));

      // Check context propagation
      for (const ev of events) {
        assert.ok(ev.eventId);
        assert.ok(ev.timestamp > 0);
        assert.equal(ev.taskId, 'task_lifecycle_1');
        assert.equal(ev.agentId, 'agent-stream-1');
      }

      // Check chronological order
      const createdIdx = types.indexOf('process_created');
      const startedIdx = types.indexOf('process_started');
      const exitedIdx = types.indexOf('process_exited');
      assert.ok(createdIdx < startedIdx, 'created precedes started');
      assert.ok(startedIdx < exitedIdx, 'started precedes exited');
    });

    it('emits stderr events when process writes to standard error', async () => {
      const runtime = new TerminalRuntime();
      const stderrChunks: string[] = [];

      runtime.events.on('stderr', (ev) => {
        stderrChunks.push(ev.data);
      });

      await runtime.execute('bash -c "echo err1 >&2; echo err2 >&2"');

      const joinedStderr = stderrChunks.join('');
      assert.match(joinedStderr, /err1/);
      assert.match(joinedStderr, /err2/);
    });

    it('emits approval_required event on restricted commands', async () => {
      const runtime = new TerminalRuntime();
      let approvalEventCaptured = false;

      runtime.events.on('approval_required', (ev) => {
        approvalEventCaptured = true;
        assert.match(ev.command, /sudo/);
      });

      await runtime.execute('sudo ls /');
      assert.equal(approvalEventCaptured, true);
    });

    it('emits process_timeout event when process exceeds timeout limit', async () => {
      const runtime = new TerminalRuntime();
      let timeoutEventCaptured = false;

      runtime.events.on('process_timeout', (ev) => {
        timeoutEventCaptured = true;
        assert.ok(ev.durationMs >= 100);
      });

      await runtime.execute('sleep 5', { timeoutMs: 120 });
      assert.equal(timeoutEventCaptured, true);
    });

    it('emits session_created and session_closed events', async () => {
      const runtime = new TerminalRuntime();
      const sessionEvents: string[] = [];

      runtime.events.on('session_created', () => sessionEvents.push('created'));
      runtime.events.on('session_closed', () => sessionEvents.push('closed'));

      const sessionId = runtime.createSession();
      await runtime.closeSession(sessionId);

      assert.deepEqual(sessionEvents, ['created', 'closed']);
    });

    it('stops receiving events after unsubscription', async () => {
      const runtime = new TerminalRuntime();
      let eventCount = 0;

      const unsubscribe = runtime.events.subscribe(() => {
        eventCount++;
      });

      await runtime.execute('echo "first"');
      const countAfterFirst = eventCount;
      assert.ok(countAfterFirst > 0);

      // Unsubscribe
      unsubscribe();

      await runtime.execute('echo "second"');
      assert.equal(eventCount, countAfterFirst);
    });
  });

  describe('Intelligent Head/Tail Output Buffer Truncation', () => {
    it('preserves head and tail diagnostics when output exceeds max bytes', async () => {
      const runtime = new TerminalRuntime();

      // Generate large output with distinct START and END markers
      const command = `python3 -c "
print('START_OF_STREAM')
for i in range(2000):
    print(f'Line filler {i} with substantial amount of arbitrary payload text padding')
print('END_OF_STREAM_FAILURE_REASON')
"`;

      const result = await runtime.execute(command, {
        maxOutputBytes: 1024 // 1KB limit
      });

      assert.equal(result.truncated, true);

      // Verify head is preserved
      assert.ok(result.stdout.includes('START_OF_STREAM'), 'Preserves initial head output');

      // Verify truncation marker is inserted
      assert.match(result.stdout, /\[output truncated: \d+ bytes omitted\]/);

      // Verify tail is preserved so failure diagnostics are never lost
      assert.ok(result.stdout.includes('END_OF_STREAM_FAILURE_REASON'), 'Preserves tail diagnostic output');
    });
  });
});
