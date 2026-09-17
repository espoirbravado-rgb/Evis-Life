import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function assertRuntimeStillWorks(terminal: TerminalRuntime) {
  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_RUNTIME_RECOVERED')"],
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_RUNTIME_RECOVERED/);
}

test("runtime remains usable after a command cannot be spawned", async () => {
  const terminal = new TerminalRuntime();

  const failed = await terminal.execute({
    command: "__evis_missing_command_after_failure__",
  });

  assert.equal(failed.status, "command_not_found");

  await assertRuntimeStillWorks(terminal);
});

test("runtime remains usable after a command times out", async () => {
  const terminal = new TerminalRuntime();

  const timedOut = await terminal.execute({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10000)"],
    timeoutMs: 100,
  });

  assert.equal(timedOut.status, "timeout");

  await assertRuntimeStillWorks(terminal);
});

test("runtime remains usable after a command is cancelled", async () => {
  const terminal = new TerminalRuntime();
  const controller = new AbortController();

  const execution = terminal.execute({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10000)"],
    signal: controller.signal,
  });

  await delay(100);
  controller.abort();

  const cancelled = await execution;

  assert.equal(cancelled.status, "cancelled");

  await assertRuntimeStillWorks(terminal);
});

test("runtime remains usable after an output-limit termination", async () => {
  const terminal = new TerminalRuntime();

  const limited = await terminal.execute({
    command: process.execPath,
    args: ["-e", "process.stdout.write('X'.repeat(100000))"],
    maxOutputBytes: 1024,
  });

  assert.equal(limited.status, "output_limit");
  assert.equal(limited.truncated, true);

  await assertRuntimeStillWorks(terminal);
});

test("runtime handles repeated failures followed by successful commands", async () => {
  const terminal = new TerminalRuntime();

  for (let index = 0; index < 5; index++) {
    const failed = await terminal.execute({
      command: `__evis_missing_command_${index}__`,
    });

    assert.equal(failed.status, "command_not_found");
  }

  await assertRuntimeStillWorks(terminal);
});