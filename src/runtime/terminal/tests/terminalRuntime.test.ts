import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

test("TerminalRuntime executes a real command independently", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_TERMINAL_OK')"],
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_TERMINAL_OK/);
  assert.equal(result.stderr, "");
});

test("TerminalRuntime captures stderr", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.error('EVIS_STDERR_OK')"],
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /EVIS_STDERR_OK/);
});

test("TerminalRuntime reports non-zero exit codes", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "process.exit(7)"],
  });

  assert.equal(result.status, "non_zero_exit");
  assert.equal(result.exitCode, 7);
});

test("TerminalRuntime reports command not found", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "__evis_command_that_does_not_exist__",
  });

  assert.equal(result.status, "command_not_found");
});

test("TerminalRuntime executes from the requested working directory", async () => {
  const terminal = new TerminalRuntime();
  const cwd = process.cwd();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log(process.cwd())"],
    cwd,
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), cwd);
});

test("TerminalRuntime passes stdin to the process", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: [
      "-e",
      "process.stdin.setEncoding('utf8'); process.stdin.on('data', data => process.stdout.write(data));",
    ],
    stdin: "EVIS_STDIN_OK\n",
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "EVIS_STDIN_OK\n");
});

test("TerminalRuntime stops a process that exceeds the timeout", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10000)"],
    timeoutMs: 100,
  });

  assert.equal(result.status, "timeout");
});

test("TerminalRuntime cancels a running process", async () => {
  const terminal = new TerminalRuntime();
  const controller = new AbortController();

  const execution = terminal.execute({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10000)"],
    signal: controller.signal,
  });

  setTimeout(() => {
    controller.abort();
  }, 100);

  const result = await execution;

  assert.equal(result.status, "cancelled");
});

test("TerminalRuntime stops a process when output exceeds the limit", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write('X'.repeat(100000))",
    ],
    maxOutputBytes: 1024,
  });

  assert.equal(result.status, "output_limit");
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.stdout, "utf8") <= 1024);
});

test("TerminalRuntime requires approval for shell execution", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "echo EVIS_SHELL_OK",
    executionMode: "shell",
  });

  assert.equal(result.status, "approval_required");
});

test("TerminalRuntime executes shell command after approval", async () => {
  const terminal = new TerminalRuntime({
    policy: {
      approvalHandler: async () => ({
        approved: true,
        decidedBy: "test",
      }),
    },
  });

  const result = await terminal.execute({
    command: "echo EVIS_APPROVED_SHELL_OK",
    executionMode: "shell",
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_APPROVED_SHELL_OK/);
});

test("TerminalRuntime denies shell execution after approval rejection", async () => {
  const terminal = new TerminalRuntime({
    policy: {
      approvalHandler: async () => ({
        approved: false,
        reason: "Rejected by test.",
      }),
    },
  });

  const result = await terminal.execute({
    command: "echo EVIS_SHOULD_NOT_RUN",
    executionMode: "shell",
  });

  assert.equal(result.status, "policy_denied");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.match(result.errorMessage ?? "", /Rejected by test/);
});

test("TerminalRuntime requires approval for a dangerous command", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "rm",
    args: ["-rf", "/tmp/evis-terminal-test"],
    executionMode: "direct",
  });

  assert.equal(result.status, "approval_required");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime denies a dangerous command after approval rejection", async () => {
  const terminal = new TerminalRuntime({
    policy: {
      approvalHandler: async () => ({
        approved: false,
        reason: "Rejected by test.",
      }),
    },
  });

  const result = await terminal.execute({
    command: "rm",
    args: ["-rf", "/tmp/evis-terminal-test"],
    executionMode: "direct",
  });

  assert.equal(result.status, "policy_denied");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime does not expose blocked environment variables", async () => {
  const terminal = new TerminalRuntime({
    environment: {
      blockedEnvKeys: ["EVIS_TEST_SECRET"],
    },
  });

  const result = await terminal.execute({
    command: process.execPath,
    args: [
      "-e",
      "console.log(process.env.EVIS_TEST_SECRET ?? 'NOT_EXPOSED')",
    ],
    env: {
      EVIS_TEST_SECRET: "SECRET_SHOULD_NOT_APPEAR",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.stdout.trim(), "NOT_EXPOSED");
  assert.doesNotMatch(result.stdout, /SECRET_SHOULD_NOT_APPEAR/);
});

test("TerminalRuntime only passes allowed environment variables", async () => {
  const terminal = new TerminalRuntime({
    environment: {
      inheritProcessEnv: false,
      allowedEnvKeys: ["EVIS_ALLOWED"],
    },
  });

  const result = await terminal.execute({
    command: process.execPath,
    args: [
      "-e",
      "console.log(JSON.stringify({ allowed: process.env.EVIS_ALLOWED, blocked: process.env.EVIS_BLOCKED }))",
    ],
    env: {
      EVIS_ALLOWED: "allowed-value",
      EVIS_BLOCKED: "blocked-value",
    },
  });

  assert.equal(result.status, "success");

  const output = JSON.parse(result.stdout);

  assert.deepEqual(output, {
    allowed: "allowed-value",
  });

  assert.equal("blocked" in output, false);
});

test("TerminalRuntime allows execution inside an allowed working directory", async () => {
  const cwd = process.cwd();

  const terminal = new TerminalRuntime({
    policy: {
      allowedWorkingDirectories: [cwd],
    },
  });

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_ALLOWED_CWD')"],
    cwd,
  });

  assert.equal(result.status, "success");
  assert.match(result.stdout, /EVIS_ALLOWED_CWD/);
});

test("TerminalRuntime denies execution outside allowed working directories", async () => {
  const cwd = process.cwd();

  const terminal = new TerminalRuntime({
    policy: {
      allowedWorkingDirectories: [cwd],
    },
  });

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('EVIS_SHOULD_NOT_RUN')"],
    cwd: "/tmp",
  });

  assert.equal(result.status, "policy_denied");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime includes request metadata in approval requests", async () => {
  let capturedApprovalRequest: {
    command: string;
    args: string[];
    cwd: string;
    actorId?: string;
    sessionId?: string;
    reason?: string;
  } | undefined;

  const terminal = new TerminalRuntime({
    policy: {
      approvalHandler: async (request) => {
        capturedApprovalRequest = request;

        return {
          approved: false,
          reason: "Rejected by metadata test.",
        };
      },
    },
  });

  const result = await terminal.execute({
    command: "echo",
    args: ["EVIS_APPROVAL_METADATA"],
    executionMode: "shell",
    cwd: process.cwd(),
    authorization: {
      actorId: "test-actor",
      sessionId: "test-session",
      reason: "Testing approval metadata",
    },
  });

  assert.equal(result.status, "policy_denied");
  assert.ok(capturedApprovalRequest);
  assert.equal(capturedApprovalRequest.command, "echo");
  assert.deepEqual(capturedApprovalRequest.args, [
    "EVIS_APPROVAL_METADATA",
  ]);
  assert.equal(capturedApprovalRequest.actorId, "test-actor");
  assert.equal(capturedApprovalRequest.sessionId, "test-session");
  assert.equal(
    capturedApprovalRequest.reason,
    "Shell execution requires user approval.",
  );
});