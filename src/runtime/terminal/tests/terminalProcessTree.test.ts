import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    // Linux /proc reports "Z" for a zombie: the PID exists, but it is no
    // longer executing. Parse after the final ")" because comm may contain
    // spaces and parentheses.
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const closingParen = stat.lastIndexOf(")");
    if (closingParen < 0) return true;
    const state = stat.slice(closingParen + 2, closingParen + 3);
    return state !== "Z" && state !== "X";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ESRCH" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

async function waitUntilStopped(pid: number, timeoutMs = 1_500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  do {
    if (!(await isProcessRunning(pid))) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);

  return !(await isProcessRunning(pid));
}

test(
  "TerminalRuntime terminates descendants when a timed-out parent exits",
  { skip: process.platform === "win32" },
  async () => {
    const terminal = new TerminalRuntime();

    const childProgram = [
      "process.on('SIGTERM', () => {})",
      "setInterval(() => {}, 1000)",
    ].join("; ");

    const parentProgram = [
      "const { spawn } = require('node:child_process')",
      `const child = spawn(process.execPath, ['-e', ${JSON.stringify(childProgram)}], { stdio: 'ignore' })`,
      "child.unref()",
      "child.once('spawn', () => console.log(child.pid))",
      "setInterval(() => {}, 1000)",
    ].join("; ");

    let descendantPid: number | undefined;

    try {
      const result = await terminal.execute({
        command: process.execPath,
        args: ["-e", parentProgram],
        timeoutMs: 500,
      });

      assert.equal(result.status, "timeout");

      const pidFromOutput = Number(result.stdout.trim());
      assert.ok(
        Number.isInteger(pidFromOutput) && pidFromOutput > 0,
        `Expected a descendant PID in stdout; received: ${JSON.stringify(result.stdout)}`,
      );

      descendantPid = pidFromOutput;

      assert.equal(
        await waitUntilStopped(descendantPid),
        true,
        `Descendant process ${descendantPid} was still running after timeout and SIGKILL escalation`,
      );
    } finally {
      // Cleanup is intentionally best-effort so a failed assertion does not
      // leave a test process running.
      if (
        descendantPid !== undefined &&
        (await isProcessRunning(descendantPid))
      ) {
        try {
          process.kill(descendantPid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
    }
  },
);
