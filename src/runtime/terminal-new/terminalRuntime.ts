import { ProcessManager } from './process/processManager.ts';
import { SessionManager } from './session/sessionManager.ts';
import { TerminalEnvironment } from './terminalEnvironment.ts';
import { TerminalPolicy } from './terminalPolicy.ts';
import { PermissionRules } from './security/permissionRules.ts';
import { ApprovalManager } from './security/approvalManager.ts';
import { SecretRedactor } from './security/secretRedactor.ts';
import { OutputParser } from './parser/outputParser.ts';
import { OutputBuffer } from './streaming/outputBuffer.ts';
import { TerminalEventEmitter } from './streaming/terminalEvents.ts';
import { TerminalAudit } from './observability/terminalAudit.ts';
import { MetricsCollector } from './observability/metricsCollector.ts';
import { PromptDetector } from './interactive/promptDetector.ts';
import { PromptResponder } from './interactive/promptResponder.ts';
import { SnapshotManager } from './checkpoint/snapshotManager.ts';
import { SandboxManager } from './sandbox/sandboxManager.ts';
import type { CommandExecutionOptions, CommandResult, SessionId } from './terminalTypes.ts';

export class TerminalRuntime {
  public readonly processManager: ProcessManager;
  public readonly sessionManager: SessionManager;
  public readonly environment: TerminalEnvironment;
  public readonly policy: TerminalPolicy;
  public readonly permissionRules: PermissionRules;
  public readonly approvalManager: ApprovalManager;
  public readonly audit: TerminalAudit;
  public readonly metrics: MetricsCollector;
  public readonly promptDetector: PromptDetector;
  public readonly snapshotManager: SnapshotManager;
  public readonly sandboxManager: SandboxManager;
  public readonly events: TerminalEventEmitter;

  constructor(options: {
    initialCwd?: string;
    policy?: TerminalPolicy;
    permissionRules?: PermissionRules;
  } = {}) {
    this.policy = options.policy ?? new TerminalPolicy();
    this.permissionRules = options.permissionRules ?? new PermissionRules();
    this.processManager = new ProcessManager(this.policy.getMaxConcurrentProcesses());
    this.sessionManager = new SessionManager(options.initialCwd ?? process.cwd());
    this.environment = new TerminalEnvironment(true);
    this.approvalManager = new ApprovalManager();
    this.audit = new TerminalAudit();
    this.metrics = new MetricsCollector();
    this.promptDetector = new PromptDetector();
    this.snapshotManager = new SnapshotManager();
    this.sandboxManager = new SandboxManager();
    this.events = new TerminalEventEmitter();
  }

  public async execute(command: string, options: CommandExecutionOptions = {}): Promise<CommandResult> {
    const startTime = Date.now();
    const session = this.sessionManager.getOrCreateSession(options.sessionId, options.cwd);
    const cwd = options.cwd ?? session.cwd;

    // 1. Policy check (Blocked commands)
    if (this.policy.isCommandBlocked(command)) {
      const result: CommandResult = {
        command,
        exitCode: 1,
        stdout: '',
        stderr: `Command blocked by policy: ${command}`,
        durationMs: 0,
        status: 'failed',
        timedOut: false,
        truncated: false
      };
      this.audit.logExecution(result, cwd);
      this.metrics.recordCommand(0, false);
      return result;
    }

    // 2. Security / Permission evaluation
    const perm = this.permissionRules.evaluate(command);
    if (!perm.allowed) {
      const result: CommandResult = {
        command,
        exitCode: 1,
        stdout: '',
        stderr: `Execution forbidden: ${perm.reason ?? 'Blocked by security rules'}`,
        durationMs: 0,
        status: 'failed',
        timedOut: false,
        truncated: false
      };
      this.audit.logExecution(result, cwd);
      this.metrics.recordCommand(0, false);
      return result;
    }

    // 3. Human Approval check if needed
    if (perm.needsApproval || options.requireApproval) {
      const approved = await this.approvalManager.requestApproval(
        command,
        perm.reason ?? 'Command requires confirmation'
      );
      if (!approved) {
        const result: CommandResult = {
          command,
          exitCode: 126,
          stdout: '',
          stderr: 'Execution denied: approval rejected or not provided',
          durationMs: 0,
          status: 'failed',
          timedOut: false,
          truncated: false
        };
        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand(0, false);
        return result;
      }
    }

    // 4. Wrap command in sandbox driver if configured
    const wrappedCommand = this.sandboxManager.wrapCommand(command, cwd);

    // 5. Build environment
    const env = this.environment.buildEnvironment({
      baseEnv: session.getEnv(),
      customEnv: options.env,
      nonInteractive: !options.interactive
    });

    const timeoutMs = this.policy.getEffectiveTimeout(options.timeoutMs);
    const maxOutputBytes = options.maxOutputBytes ?? this.policy.getMaxOutputBytes();

    const stdoutBuffer = new OutputBuffer(maxOutputBytes);
    const stderrBuffer = new OutputBuffer(maxOutputBytes);

    return new Promise<CommandResult>((resolve) => {
      let timedOut = false;
      let timer: NodeJS.Timeout | null = null;

      const handle = this.processManager.spawn({
        command: wrappedCommand,
        cwd,
        env,
        detached: true,
        shell: '/bin/bash'
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          handle.kill('SIGKILL');
        }, timeoutMs);
      }

      handle.child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stdoutBuffer.append(text);
        this.events.emitStdout(text);

        if (options.interactive) {
          const detected = this.promptDetector.detect(text);
          if (detected) {
            this.events.emitPromptDetected(detected.matchedText);
            PromptResponder.handlePrompt(handle, detected);
          }
        }
      });

      handle.child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stderrBuffer.append(text);
        this.events.emitStderr(text);
      });

      handle.child.once('close', (code) => {
        if (timer) clearTimeout(timer);

        const durationMs = Date.now() - startTime;
        const rawStdout = stdoutBuffer.toString();
        const rawStderr = stderrBuffer.toString();

        const cleanStdout = SecretRedactor.redact(OutputParser.clean(rawStdout));
        const cleanStderr = SecretRedactor.redact(OutputParser.clean(rawStderr));

        const result: CommandResult = {
          command,
          exitCode: code,
          stdout: cleanStdout,
          stderr: cleanStderr,
          durationMs,
          status: timedOut ? 'timeout' : code === 0 ? 'completed' : 'failed',
          timedOut,
          truncated: stdoutBuffer.truncated || stderrBuffer.truncated
        };

        // Session tracking
        session.addHistory({
          command,
          exitCode: code,
          timestamp: Date.now(),
          durationMs
        });

        // Observability
        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand(durationMs, code === 0);
        this.events.emitExit(result);

        resolve(result);
      });

      handle.child.once('error', (err) => {
        if (timer) clearTimeout(timer);

        const durationMs = Date.now() - startTime;
        const result: CommandResult = {
          command,
          exitCode: 1,
          stdout: stdoutBuffer.toString(),
          stderr: err.message,
          durationMs,
          status: 'failed',
          timedOut: false,
          truncated: false,
          error: err
        };

        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand(durationMs, false);
        this.events.emitExit(result);

        resolve(result);
      });
    });
  }

  public setCwd(newCwd: string, sessionId?: SessionId): void {
    const session = this.sessionManager.getOrCreateSession(sessionId);
    session.setCwd(newCwd);
  }

  public getCwd(sessionId?: SessionId): string {
    const session = this.sessionManager.getOrCreateSession(sessionId);
    return session.cwd;
  }
}
