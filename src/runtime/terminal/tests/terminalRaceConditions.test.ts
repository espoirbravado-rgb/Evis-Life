import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

test("a completed command stays successful when its signal is aborted afterward", async () => {
  const terminal = new TerminalRuntime();
  const controller = new AbortController();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_COMPLETED_BEFORE_ABORT')"],
    signal: controller.signal,
  });

  controller.abort();

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_COMPLETED_BEFORE_ABORT/);
});

test("aborting one concurrent command does not cancel another", async () => {
  const terminal = new TerminalRuntime();
  const controller = new AbortController();

  const cancelledExecution = terminal.execute({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10000)"],
    signal: controller.signal,
  });

  const independentExecution = terminal.execute({
    command: process.execPath,
    args: [
      "-e",
      "setTimeout(() => console.log('EVIS_INDEPENDENT_OK'), 250)",
    ],
  });

  await delay(100);
  controller.abort();

  const [cancelledResult, independentResult] = await Promise.all([
    cancelledExecution,
    independentExecution,
  ]);

  assert.equal(cancelledResult.status, "cancelled");
  assert.equal(independentResult.status, "success");
  assert.equal(independentResult.exitCode, 0);
  assert.match(independentResult.stdout, /EVIS_INDEPENDENT_OK/);
});

test("a fast command does not become a timeout after it has completed", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_FAST_COMMAND_OK')"],
    timeoutMs: 5000,
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_FAST_COMMAND_OK/);
});

test("output exactly at the configured byte limit is not truncated", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "process.stdout.write('12345')"],
    maxOutputBytes: 5,
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "12345");
  assert.equal(result.truncated, false);
});

test("an output limit is enforced when the command writes beyond the limit", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "process.stdout.write('123456')"],
    maxOutputBytes: 5,
  });

  assert.equal(result.status, "output_limit");
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.stdout, "utf8") <= 5);
});