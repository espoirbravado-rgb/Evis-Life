import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntime } from "../terminalRuntime";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestShellApproval(
  terminal: TerminalRuntime,
  request: {
    command: string;
    args?: string[];
    cwd?: string;
    authorization?: {
      actorId?: string;
      sessionId?: string;
      reason?: string;
    };
  },
) {
  const result = await terminal.execute({
    ...request,
    executionMode: "shell",
  });

  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalRequest);

  return result.approvalRequest!;
}

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

  setTimeout(() => controller.abort(), 100);

  const result = await execution;

  assert.equal(result.status, "cancelled");
});

test("TerminalRuntime stops a process when output exceeds the limit", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "process.stdout.write('X'.repeat(100000))"],
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
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.ok(result.approvalRequest);
  assert.equal(result.approvalRequest?.command, "echo EVIS_SHELL_OK");
});

test("TerminalRuntime exposes the pending approval request", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "echo EVIS_PENDING_REQUEST",
    executionMode: "shell",
  });

  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalRequest);

  const pending = terminal.getPendingApproval(result.approvalRequest!.id);

  assert.ok(pending);
  assert.equal(pending.id, result.approvalRequest!.id);
  assert.equal(pending.command, "echo EVIS_PENDING_REQUEST");
  assert.deepEqual(pending.args, []);
});

test("TerminalRuntime executes a shell command after explicit approval", async () => {
  const terminal = new TerminalRuntime();

  const approvalRequest = await requestShellApproval(terminal, {
    command: "echo EVIS_APPROVED_SHELL_OK",
  });

  const grant = terminal.approve(approvalRequest.id);

  assert.equal(grant.requestId, approvalRequest.id);
  assert.ok(grant.approvalToken);
  assert.ok(grant.expiresAt);

  const result = await terminal.execute({
    command: approvalRequest.command,
    args: approvalRequest.args,
    cwd: approvalRequest.cwd,
    shell: approvalRequest.shell,
    authorization: {
      actorId: approvalRequest.actorId,
      sessionId: approvalRequest.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /EVIS_APPROVED_SHELL_OK/);
});

test("TerminalRuntime does not execute a shell command before approval", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "echo EVIS_MUST_NOT_RUN_YET",
    executionMode: "shell",
  });

  assert.equal(result.status, "approval_required");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime rejects a pending approval request", async () => {
  const terminal = new TerminalRuntime();

  const approvalRequest = await requestShellApproval(terminal, {
    command: "echo EVIS_REJECTED",
  });

  assert.equal(terminal.reject(approvalRequest.id), true);
  assert.equal(terminal.getPendingApproval(approvalRequest.id), undefined);
});

test("TerminalRuntime cannot approve a rejected request", async () => {
  const terminal = new TerminalRuntime();

  const approvalRequest = await requestShellApproval(terminal, {
    command: "echo EVIS_REJECTED",
  });

  assert.equal(terminal.reject(approvalRequest.id), true);

  assert.throws(
    () => terminal.approve(approvalRequest.id),
    /missing|expired|already resolved/i,
  );
});

test("TerminalRuntime cannot approve the same request twice", async () => {
  const terminal = new TerminalRuntime();

  const approvalRequest = await requestShellApproval(terminal, {
    command: "echo EVIS_APPROVE_ONCE",
  });

  terminal.approve(approvalRequest.id);

  assert.throws(
    () => terminal.approve(approvalRequest.id),
    /missing|expired|already resolved/i,
  );
});

test("TerminalRuntime denies a sensitive command without an approval token", async () => {
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
  assert.ok(result.approvalRequest);
});

test("TerminalRuntime executes a dangerous command only after explicit approval", async () => {
  const terminal = new TerminalRuntime();

  const approvalRequest = await terminal.execute({
    command: "rm",
    args: ["-rf", "/tmp/evis-terminal-test"],
    executionMode: "direct",
  });

  assert.equal(approvalRequest.status, "approval_required");
  assert.ok(approvalRequest.approvalRequest);

  const approval = approvalRequest.approvalRequest!;
  const grant = terminal.approve(approval.id);

  const result = await terminal.execute({
    command: approval.command,
    args: approval.args,
    cwd: approval.cwd,
    shell: approval.shell,
    authorization: {
      actorId: approval.actorId,
      sessionId: approval.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  // La commande est autorisée par le jeton.
  // Le résultat dépend ensuite de l'existence de la cible et des permissions OS.
  assert.notEqual(result.status, "approval_required");
  assert.notEqual(result.status, "policy_denied");
});

test("TerminalRuntime denies an unknown approval token", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "echo EVIS_UNKNOWN_TOKEN",
    executionMode: "shell",
    authorization: {
      approvalToken: "not-a-real-token",
    },
  });

  assert.equal(result.status, "policy_denied");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime denies a token after it has already been consumed", async () => {
  const terminal = new TerminalRuntime();

  const approval = await requestShellApproval(terminal, {
    command: "echo EVIS_SINGLE_USE",
  });

  const grant = terminal.approve(approval.id);

  const first = await terminal.execute({
    command: approval.command,
    args: approval.args,
    cwd: approval.cwd,
    shell: approval.shell,
    authorization: {
      actorId: approval.actorId,
      sessionId: approval.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  assert.equal(first.status, "success");

  const second = await terminal.execute({
    command: approval.command,
    args: approval.args,
    cwd: approval.cwd,
    shell: approval.shell,
    authorization: {
      actorId: approval.actorId,
      sessionId: approval.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  assert.equal(second.status, "policy_denied");
});

test("TerminalRuntime denies a token used with a different command", async () => {
  const terminal = new TerminalRuntime();

  const approval = await requestShellApproval(terminal, {
    command: "echo EVIS_ORIGINAL_COMMAND",
  });

  const grant = terminal.approve(approval.id);

  const result = await terminal.execute({
    command: "echo EVIS_CHANGED_COMMAND",
    executionMode: "shell",
    authorization: {
      actorId: approval.actorId,
      sessionId: approval.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  assert.equal(result.status, "policy_denied");
});

test("TerminalRuntime expires pending approval requests", async () => {
  const terminal = new TerminalRuntime({
    policy: {
      approvalTtlMs: 25,
    },
  });

  const approval = await requestShellApproval(terminal, {
    command: "echo EVIS_EXPIRED_PENDING",
  });

  await delay(60);

  assert.equal(terminal.getPendingApproval(approval.id), undefined);

  assert.throws(
    () => terminal.approve(approval.id),
    /missing|expired|already resolved/i,
  );
});

test("TerminalRuntime expires approval tokens", async () => {
  const terminal = new TerminalRuntime({
    policy: {
      approvalTtlMs: 25,
    },
  });

  const approval = await requestShellApproval(terminal, {
    command: "echo EVIS_EXPIRED_TOKEN",
  });

  const grant = terminal.approve(approval.id);

  await delay(60);

  const result = await terminal.execute({
    command: approval.command,
    args: approval.args,
    cwd: approval.cwd,
    shell: approval.shell,
    authorization: {
      actorId: approval.actorId,
      sessionId: approval.sessionId,
      approvalToken: grant.approvalToken,
    },
  });

  assert.equal(result.status, "policy_denied");
});

test("TerminalRuntime does not expose blocked environment variables", async () => {
  const terminal = new TerminalRuntime({
    environment: {
      blockedEnvKeys: ["EVIS_TEST_SECRET"],
      allowedEnvKeys: ["EVIS_TEST_SECRET"],
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

test("TerminalRuntime denies environment variables outside the allowlist", async () => {
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
      "console.log(process.env.EVIS_NOT_ALLOWED ?? 'NOT_ALLOWED')",
    ],
    env: {
      EVIS_NOT_ALLOWED: "SHOULD_NOT_PASS",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.stdout.trim(), "NOT_ALLOWED");
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

test("TerminalRuntime includes actor and session metadata in approval requests", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "echo EVIS_APPROVAL_METADATA",
    executionMode: "shell",
    cwd: process.cwd(),
    authorization: {
      actorId: "test-actor",
      sessionId: "test-session",
      reason: "Testing approval metadata",
    },
  });

  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalRequest);

  assert.equal(result.approvalRequest?.command, "echo EVIS_APPROVAL_METADATA");
  assert.deepEqual(result.approvalRequest?.args, []);
  assert.equal(result.approvalRequest?.actorId, "test-actor");
  assert.equal(result.approvalRequest?.sessionId, "test-session");
  assert.equal(
    result.approvalRequest?.reason,
    "Shell execution requires explicit user approval.",
  );
  assert.ok(result.approvalRequest?.createdAt);
  assert.ok(result.approvalRequest?.expiresAt);
});

test("TerminalRuntime rejects an empty command", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: "   ",
  });

  assert.equal(result.status, "policy_denied");
  assert.equal(result.exitCode, null);
});

test("TerminalRuntime rejects a non-existent working directory", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('SHOULD_NOT_RUN')"],
    cwd: "/tmp/evis-directory-that-does-not-exist",
  });

  assert.equal(result.status, "working_directory_not_found");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime rejects a file as a working directory", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('SHOULD_NOT_RUN')"],
    cwd: process.execPath,
  });

  assert.equal(result.status, "execution_error");
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("TerminalRuntime rejects an invalid timeout", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('SHOULD_NOT_RUN')"],
    timeoutMs: -1,
  });

  assert.equal(result.status, "execution_error");
});

test("TerminalRuntime rejects an invalid output limit", async () => {
  const terminal = new TerminalRuntime();

  const result = await terminal.execute({
    command: process.execPath,
    args: ["-e", "console.log('SHOULD_NOT_RUN')"],
    maxOutputBytes: 0,
  });

  assert.equal(result.status, "execution_error");
});