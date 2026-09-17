import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

test("multiple concurrent commands keep their outputs isolated", async () => {
  const terminal = new TerminalRuntime();

  const labels = [
    "EVIS_PARALLEL_A",
    "EVIS_PARALLEL_B",
    "EVIS_PARALLEL_C",
    "EVIS_PARALLEL_D",
  ];

  const executions = labels.map((label, index) =>
    terminal.execute({
      command: process.execPath,
      args: [
        "-e",
        `setTimeout(() => console.log('${label}'), ${100 + index * 50})`,
      ],
    }),
  );

  const results = await Promise.all(executions);

  for (const [index, result] of results.entries()) {
    assert.equal(result.status, "success");
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, new RegExp(labels[index]));
    assert.equal(
      labels.filter((label) => result.stdout.includes(label)).length,
      1,
    );
  }
});

test("cancelling selected commands leaves the remaining concurrent commands running", async () => {
  const terminal = new TerminalRuntime();

  const controllers = Array.from(
    { length: 4 },
    () => new AbortController(),
  );

  const executions = controllers.map((controller, index) =>
    terminal.execute({
      command: process.execPath,
      args: [
        "-e",
        `setTimeout(() => console.log('EVIS_SELECTIVE_${index}'), ${
          index % 2 === 0 ? 10000 : 250
        })`,
      ],
      signal: controller.signal,
    }),
  );

  await delay(100);

  controllers[0].abort();
  controllers[2].abort();

  const results = await Promise.all(executions);

  assert.equal(results[0].status, "cancelled");
  assert.equal(results[2].status, "cancelled");

  assert.equal(results[1].status, "success");
  assert.equal(results[1].exitCode, 0);
  assert.match(results[1].stdout, /EVIS_SELECTIVE_1/);

  assert.equal(results[3].status, "success");
  assert.equal(results[3].exitCode, 0);
  assert.match(results[3].stdout, /EVIS_SELECTIVE_3/);
});

test("repeated concurrent executions do not mix results between batches", async () => {
  const terminal = new TerminalRuntime();

  for (let batch = 0; batch < 3; batch++) {
    const executions = Array.from({ length: 3 }, (_, index) => {
      const label = `EVIS_BATCH_${batch}_COMMAND_${index}`;

      return terminal.execute({
        command: process.execPath,
        args: [
          "-e",
          `setTimeout(() => console.log('${label}'), ${
            50 + index * 40
          })`,
        ],
      });
    });

    const results = await Promise.all(executions);

    for (let index = 0; index < results.length; index++) {
      const expectedLabel = `EVIS_BATCH_${batch}_COMMAND_${index}`;
      const result = results[index];

      assert.equal(result.status, "success");
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout.trim(), expectedLabel);
    }
  }
});