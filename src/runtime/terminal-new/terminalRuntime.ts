import { existsSync, statSync } from 'node:fs';
import { ProcessManager } from './process/processManager.ts';
import { SessionManager } from './session/sessionManager.ts';
import type { TerminalSession } from './session/terminalSession.ts';
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
import { PtyExecutor } from './pty/ptyExecutor.ts';
import type { IPtyInstance, PtySpawnOptions } from './pty/ptyTypes.ts';
import type { PosixSignal } from './process/processSignals.ts';
import type {
  BackgroundJobLogs,
  BackgroundJobSnapshot,
  CommandExecutionOptions,
  CommandResult,
  ProcessHandleSnapshot,
  ProcessState,
  SessionId,
  TaskId
} from './terminalTypes.ts';

export interface BackgroundJob {
  id: string;
  pid?: number;
  command: string;
  cwd: string;
  sessionId?: SessionId;
  taskId?: TaskId;
  startedAt: number;
  getStatus: () => ProcessState;
  getLogs: () => BackgroundJobLogs;
  toSnapshot: () => BackgroundJobSnapshot;
  signal: (signal: PosixSignal) => boolean;
  kill: (signal?: PosixSignal) => boolean;
  wait: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
}

export interface TerminalRuntimeConfig {
  initialCwd?: string;
  policy?: TerminalPolicy;
  permissionRules?: PermissionRules;
  environment?: TerminalEnvironment;
}

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

  private backgroundJobs: Map<string, BackgroundJob> = new Map();

  constructor(config: TerminalRuntimeConfig = {}) {
    this.policy = config.policy ?? new TerminalPolicy();
    this.permissionRules = config.permissionRules ?? new PermissionRules();
    this.environment = config.environment ?? new TerminalEnvironment({ enforceNonInteractive: true });
    this.processManager = new ProcessManager(this.policy.getMaxConcurrentProcesses());
    this.sessionManager = new SessionManager(config.initialCwd ?? process.cwd());
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
    const context = { sessionId: session.id, taskId: options.taskId, agentId: options.agentId };
    if (!this.sandboxManager.isInitialized()) {
      await this.sandboxManager.initialize();
    }

    // 1. Central Policy & Permission Evaluation (two-layer: TerminalPolicy → PermissionRules)
    const authResult = await this.authorizeExecution(command, cwd, session.id, options, context);
    if (authResult.action !== 'allow') {
      const result: CommandResult = {
        command,
        exitCode: authResult.action === 'deny' ? 1 : 126,
        stdout: '',
        stderr: authResult.reason ?? 'Command execution denied.',
        durationMs: 0,
        status: authResult.action === 'deny' ? 'denied' : 'approval_required',
        timedOut: false,
        truncated: false,
        sessionId: session.id,
        taskId: options.taskId,
        agentId: options.agentId
      };
      this.audit.logExecution(result, cwd);
      this.metrics.recordCommand(0, false);
      return result;
    }

    // 2. Built-in Session State Commands (cd & export)
    const trimmedCmd = command.trim();

    // Check for 'cd'
    const cdMatch = this.checkCdCommand(trimmedCmd);
    if (cdMatch.isCd) {
      const target = cdMatch.target ?? '~';
      const resolved = session.resolvePath(target);
      const isPrev = target === '-';

      if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        const result: CommandResult = {
          command,
          exitCode: 1,
          stdout: '',
          stderr: `bash: cd: ${target}: No such file or directory`,
          durationMs: Date.now() - startTime,
          status: 'failed',
          timedOut: false,
          truncated: false,
          sessionId: session.id,
          taskId: options.taskId
        };
        session.addHistory({ command, exitCode: 1, timestamp: Date.now(), durationMs: result.durationMs });
        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand(result.durationMs, false);
        return result;
      }

      session.setCwd(resolved);
      const stdout = isPrev ? `${resolved}\n` : '';
      const result: CommandResult = {
        command,
        exitCode: 0,
        stdout,
        stderr: '',
        durationMs: Date.now() - startTime,
        status: 'completed',
        timedOut: false,
        truncated: false,
        sessionId: session.id,
        taskId: options.taskId
      };
      session.addHistory({ command, exitCode: 0, timestamp: Date.now(), durationMs: result.durationMs });
      this.audit.logExecution(result, session.cwd);
      this.metrics.recordCommand(result.durationMs, true);
      return result;
    }

    // Check for 'export KEY=VALUE'
    const exportMatch = this.checkExportCommand(trimmedCmd);
    if (exportMatch.isExport && exportMatch.key) {
      session.setEnvVar(exportMatch.key, exportMatch.value ?? '');
      const result: CommandResult = {
        command,
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: Date.now() - startTime,
        status: 'completed',
        timedOut: false,
        truncated: false,
        sessionId: session.id,
        taskId: options.taskId
      };
      session.addHistory({ command, exitCode: 0, timestamp: Date.now(), durationMs: result.durationMs });
      this.audit.logExecution(result, session.cwd);
      this.metrics.recordCommand(result.durationMs, true);
      return result;
    }

    // 3. Wrap command with sandbox isolation if driver is active
    const effectiveCommand = authResult.modifiedCommand ?? command;
    const wrapResult = this.sandboxManager.wrapCommand(effectiveCommand, cwd);
    const wrappedCommand = wrapResult.command;

    // 4. Environment building (hermetic & filtered)
    // When sandbox driver manages env (bwrap --clearenv --setenv), wrapResult.env is empty
    // and env vars are encoded in the bwrap args. Otherwise merge normally.
    const baseBuilt = this.environment.buildEnvironment({
      baseEnv: session.getEnv(),
      sessionEnv: session.getEnv(),
      requestEnv: options.env,
      nonInteractive: !options.interactive
    });
    const env = wrapResult.isolated ? wrapResult.env : { ...baseBuilt, ...wrapResult.env };

    // 5. Timeouts & output bounding
    const timeoutMs = authResult.effectiveTimeoutMs ?? this.policy.getEffectiveTimeout(options.timeoutMs);
    const maxOutputBytes = authResult.maxOutputBytes ?? this.policy.getEffectiveMaxOutput(options.maxOutputBytes);

    const stdoutBuffer = new OutputBuffer(maxOutputBytes);
    const stderrBuffer = new OutputBuffer(maxOutputBytes);

    return new Promise<CommandResult>((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      this.events.emitProcessCreated(wrappedCommand, cwd, context);

      const handle = this.processManager.spawn({
        command: wrappedCommand,
        cwd,
        env,
        sessionId: session.id,
        taskId: options.taskId,
        detached: true,
        shell: '/bin/bash'
      });

      // Attach process to session
      session.attachProcess(handle.id);

      // Wire AbortSignal: when caller cancels, propagate to the OS process
      let abortHandler: (() => void) | null = null;
      if (options.signal) {
        abortHandler = () => { handle.markCancelled(); };
        options.signal.addEventListener('abort', abortHandler, { once: true });
      }

      this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());

      if (handle.pid) {
        this.events.emitProcessStarted(handle.pid, context);
      } else {
        handle.child.once('spawn', () => {
          if (handle.pid) {
            this.events.emitProcessStarted(handle.pid, context);
          }
        });
      }

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const duration = Date.now() - startTime;
          this.events.emitProcessTimeout(duration, { ...context, processId: handle.pid });
          handle.markTimeout();
        }, timeoutMs);
      }

      const checkPrompt = (text: string) => {
        if (options.interactive) {
          const detected = this.promptDetector.detect(text);
          if (detected) {
            this.events.emitPromptDetected(detected.matchedText, { ...context, processId: handle.pid });
            PromptResponder.handlePrompt(handle, detected);
          }
        }
      };

      handle.child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stdoutBuffer.append(text);
        this.events.emitStdout(text, { ...context, processId: handle.pid });
        checkPrompt(text);
      });

      handle.child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stderrBuffer.append(text);
        this.events.emitStderr(text, { ...context, processId: handle.pid });
        checkPrompt(text);
      });

      handle.child.once('close', (code, signal) => {
        if (timer) clearTimeout(timer);
        // Remove abort listener to avoid memory leak
        if (abortHandler && options.signal) {
          options.signal.removeEventListener('abort', abortHandler);
        }

        // Detach process from session
        session.detachProcess(handle.id);

        const durationMs = Date.now() - startTime;
        const rawStdout = stdoutBuffer.toString();
        const rawStderr = stderrBuffer.toString();

        const cleanStdout = SecretRedactor.redact(OutputParser.clean(rawStdout));
        const cleanStderr = SecretRedactor.redact(OutputParser.clean(rawStderr));

        // Map process handle state to CommandResult status
        let finalStatus: CommandResult['status'];
        if (handle.state === 'exited') {
          finalStatus = 'completed';
        } else if (handle.state === 'cancelled') {
          finalStatus = 'cancelled';
        } else if (handle.state === 'failed') {
          finalStatus = 'failed';
        } else {
          finalStatus = handle.state as CommandResult['status'];
        }

        const isCancelled = handle.state === 'cancelled';

        const result: CommandResult = {
          command,
          exitCode: code,
          signal,
          stdout: cleanStdout,
          stderr: cleanStderr,
          durationMs,
          status: finalStatus,
          timedOut: handle.state === 'timeout',
          cancelled: isCancelled,
          truncated: stdoutBuffer.truncated || stderrBuffer.truncated,
          sessionId: session.id,
          processId: handle.pid,
          taskId: options.taskId,
          agentId: options.agentId
        };

        // Session history tracking
        session.addHistory({
          command,
          exitCode: code,
          timestamp: Date.now(),
          durationMs
        });

        // Observability
        this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());
        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand({
          durationMs,
          status: finalStatus,
          timedOut: handle.state === 'timeout',
          truncated: stdoutBuffer.truncated || stderrBuffer.truncated
        });
        this.events.emitProcessExited(code, durationMs, signal, { ...context, processId: handle.pid });

        resolve(result);
      });

      handle.child.once('error', (err) => {
        if (timer) clearTimeout(timer);
        session.detachProcess(handle.id);

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
          sessionId: session.id,
          taskId: options.taskId,
          agentId: options.agentId,
          error: err
        };

        this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());
        this.audit.logExecution(result, cwd);
        this.metrics.recordCommand({ durationMs, status: 'failed', timedOut: false });
        this.events.emitProcessFailed(err.message, durationMs, { ...context, processId: handle.pid });

        resolve(result);
      });
    });
  }

  public async startBackground(command: string, options: CommandExecutionOptions = {}): Promise<BackgroundJob> {
    const session = this.sessionManager.getOrCreateSession(options.sessionId, options.cwd);
    const cwd = options.cwd ?? session.cwd;
    const context = { sessionId: session.id, taskId: options.taskId, agentId: options.agentId };
    if (!this.sandboxManager.isInitialized()) {
      await this.sandboxManager.initialize();
    }

    // 1. Policy & permission check for background execution (two-layer)
    const optsWithBackground: CommandExecutionOptions = { ...options, background: true };
    const bgAuthResult = await this.authorizeExecution(command, cwd, session.id, optsWithBackground, context);

    if (bgAuthResult.action === 'deny') {
      throw new Error(`Background execution denied: ${bgAuthResult.reason ?? command}`);
    }

    if (bgAuthResult.action === 'approval_required') {
      throw new Error(`Background execution blocked: ${bgAuthResult.reason ?? 'Approval required but not granted.'}`);
    }

    // 2. Prepare environment & wrap command
    const effectiveCommand = bgAuthResult.modifiedCommand ?? command;
    const wrapResult2 = this.sandboxManager.wrapCommand(effectiveCommand, cwd);
    const wrappedCommand2 = wrapResult2.command;
    const baseBuilt2 = this.environment.buildEnvironment({
      baseEnv: session.getEnv(),
      sessionEnv: session.getEnv(),
      requestEnv: options.env,
      nonInteractive: !options.interactive
    });
    const env = wrapResult2.isolated ? wrapResult2.env : { ...baseBuilt2, ...wrapResult2.env };

    this.events.emitProcessCreated(wrappedCommand2, cwd, context);

    const handle = this.processManager.spawn({
      command: wrappedCommand2,
      cwd,
      env,
      sessionId: session.id,
      taskId: options.taskId,
      detached: true,
      shell: '/bin/bash'
    });

    session.attachProcess(handle.id);
    this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());

    if (handle.pid) {
      this.events.emitProcessStarted(handle.pid, context);
    } else {
      handle.child.once('spawn', () => {
        if (handle.pid) {
          this.events.emitProcessStarted(handle.pid, context);
        }
      });
    }

    handle.child.stdout?.on('data', (chunk: Buffer) => {
      this.events.emitStdout(chunk.toString('utf-8'), { ...context, processId: handle.pid });
    });

    handle.child.stderr?.on('data', (chunk: Buffer) => {
      this.events.emitStderr(chunk.toString('utf-8'), { ...context, processId: handle.pid });
    });

    handle.child.once('close', (code, signal) => {
      session.detachProcess(handle.id);
      this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());
      this.events.emitProcessExited(code, handle.durationMs, signal, { ...context, processId: handle.pid });
    });

    handle.child.once('error', (err) => {
      session.detachProcess(handle.id);
      this.metrics.setActiveProcesses(this.processManager.getActiveProcessCount());
      this.events.emitProcessFailed(err.message, handle.durationMs, { ...context, processId: handle.pid });
    });

    const job: BackgroundJob = {
      id: handle.id,
      pid: handle.pid,
      command,
      cwd,
      sessionId: session.id,
      taskId: options.taskId,
      startedAt: handle.startedAt,
      getStatus: () => handle.state,
      getLogs: () => handle.getLogs(),
      toSnapshot: () => ({
        id: handle.id,
        command,
        pid: handle.pid,
        state: handle.state,
        cwd,
        sessionId: session.id,
        taskId: options.taskId,
        startedAt: handle.startedAt,
        finishedAt: handle.finishedAt,
        durationMs: handle.durationMs,
        exitCode: handle.exitCode
      }),
      signal: (sig: PosixSignal) => handle.sendSignal(sig),
      kill: (sig?: PosixSignal) => handle.kill(sig),
      wait: () => handle.wait()
    };

    this.backgroundJobs.set(job.id, job);
    this.metrics.recordBackgroundJob();
    return job;
  }

  public spawnPty(command: string, args: string[] = [], options: PtySpawnOptions = {}): IPtyInstance {
    const session = this.sessionManager.getOrCreateSession(options.sessionId, options.cwd);
    const cwd = options.cwd ?? session.cwd;
    const fullCmd = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    // 1. Policy evaluation
    const policyDecision = this.policy.evaluate(fullCmd, { cwd, sessionId: session.id });
    if (policyDecision.action === 'deny') {
      throw new Error(`PTY execution denied by policy: ${policyDecision.reason ?? fullCmd}`);
    }

    // 2. Permission evaluation
    const permDecision = this.permissionRules.evaluate(fullCmd, { cwd, sessionId: session.id });
    if (permDecision.action === 'deny') {
      throw new Error(`PTY execution denied by security rules: ${permDecision.reason ?? fullCmd}`);
    }

    // 3. Filtered environment
    const filteredEnv = this.environment.buildEnvironment({
      baseEnv: session.getEnv(),
      sessionEnv: session.getEnv(),
      requestEnv: options.env,
      nonInteractive: false
    });

    // 4. Record metric
    this.metrics.recordPtySession();

    const optsWithCwd: PtySpawnOptions = {
      ...options,
      cwd,
      env: filteredEnv
    };
    return PtyExecutor.spawnPty(command, args, optsWithCwd);
  }

  public isPtyAvailable(): boolean {
    return PtyExecutor.isPtyAvailable();
  }

  public getBackgroundJob(id: string): BackgroundJob | undefined {
    return this.backgroundJobs.get(id);
  }

  public listBackgroundJobs(sessionId?: SessionId): BackgroundJob[] {
    const all = Array.from(this.backgroundJobs.values());
    if (!sessionId) return all;
    return all.filter(job => job.sessionId === sessionId);
  }

  public inspectProcess(id: string): ProcessHandleSnapshot | undefined {
    const handle = this.processManager.get(id);
    return handle ? handle.toSnapshot() : undefined;
  }

  public listProcesses(sessionId?: SessionId): ProcessHandleSnapshot[] {
    const processes = sessionId
      ? this.processManager.getRegistry().listBySession(sessionId)
      : this.processManager.listAll();
    return processes.map(p => p.toSnapshot());
  }

  public getProcessLogs(id: string): BackgroundJobLogs | undefined {
    return this.processManager.getProcessLogs(id);
  }

  public killProcess(id: string, signal: PosixSignal = 'SIGTERM'): boolean {
    return this.processManager.kill(id, signal);
  }

  public signalProcess(id: string, signal: PosixSignal): boolean {
    return this.processManager.signal(id, signal);
  }

  public setCwd(newCwd: string, sessionId?: SessionId): void {
    const session = this.sessionManager.getOrCreateSession(sessionId);
    session.setCwd(newCwd);
  }

  public getCwd(sessionId?: SessionId): string {
    const session = this.sessionManager.getOrCreateSession(sessionId);
    return session.cwd;
  }

  public createSession(cwd?: string): SessionId {
    const session = this.sessionManager.createSession({ cwd });
    this.events.emitSessionCreated(session.id, session.cwd);
    return session.id;
  }

  public async closeSession(sessionId: SessionId): Promise<boolean> {
    const closed = await this.sessionManager.closeSession(sessionId, this.processManager);
    if (closed) {
      this.events.emitSessionClosed(sessionId);
    }
    return closed;
  }

  public getSession(sessionId?: SessionId): TerminalSession | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  public async executeInSession(
    sessionId: SessionId,
    command: string,
    options: Omit<CommandExecutionOptions, 'sessionId'> = {}
  ): Promise<CommandResult> {
    return this.execute(command, { ...options, sessionId });
  }

  public writeToSession(sessionId: SessionId, data: string): boolean {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return false;
    const processIds = session.getActiveProcessIds();
    let written = false;
    for (const pid of processIds) {
      const handle = this.processManager.get(pid);
      if (handle && handle.isAlive) {
        if (handle.writeInput(data)) {
          written = true;
        }
      }
    }
    return written;
  }

  public interruptSession(sessionId: SessionId): boolean {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return false;
    const processIds = session.getActiveProcessIds();
    let interrupted = false;
    for (const pid of processIds) {
      if (this.processManager.signal(pid, 'SIGINT')) {
        interrupted = true;
      }
    }
    return interrupted;
  }

  public detachSession(sessionId: SessionId): boolean {
    return this.sessionManager.detach(sessionId) !== undefined;
  }

  public attachSession(sessionId: SessionId): boolean {
    return this.sessionManager.attach(sessionId) !== undefined;
  }

  public cleanup(): void {
    this.processManager.cleanup();
  }

  /**
   * Two-layer authorization: TerminalPolicy → PermissionRules → ApprovalManager.
   * Returns a unified decision including modifiedCommand/timeouts from policy.
   */
  private async authorizeExecution(
    command: string,
    cwd: string,
    sessionId: string,
    options: CommandExecutionOptions,
    context: { sessionId?: string; taskId?: string; agentId?: string } = {}
  ): Promise<{
    action: 'allow' | 'deny' | 'approval_required';
    reason?: string;
    modifiedCommand?: string;
    effectiveTimeoutMs?: number;
    maxOutputBytes?: number;
  }> {
    // Layer 1: TerminalPolicy (timeout, output bounds, command transforms)
    const policyDecision = this.policy.evaluate(command, options);

    if (policyDecision.action === 'deny') {
      return {
        action: 'deny',
        reason: policyDecision.reason ?? 'Command denied by terminal policy.',
        modifiedCommand: policyDecision.modifiedCommand,
        effectiveTimeoutMs: policyDecision.effectiveTimeoutMs,
        maxOutputBytes: policyDecision.maxOutputBytes
      };
    }

    // Layer 2: PermissionRules (security rules: destructive ops, sudo, etc.)
    const permDecision = this.permissionRules.evaluate(command, { cwd, sessionId });

    if (permDecision.action === 'deny') {
      return {
        action: 'deny',
        reason: permDecision.reason ?? 'Command denied by security rules.',
        modifiedCommand: policyDecision.modifiedCommand,
        effectiveTimeoutMs: policyDecision.effectiveTimeoutMs,
        maxOutputBytes: policyDecision.maxOutputBytes
      };
    }

    // Determine if approval is needed (either layer can require it)
    const needsApproval =
      policyDecision.action === 'require_approval' || permDecision.action === 'require_approval';

    if (needsApproval) {
      const reason =
        policyDecision.action === 'require_approval'
          ? (policyDecision.reason ?? 'Approval required by policy.')
          : (permDecision.reason ?? 'Approval required by security rules.');

      this.events.emitApprovalRequired(command, reason, context);
      const approved = await this.approvalManager.requestApproval(command, reason, {
        cwd,
        sessionId,
        taskId: options.taskId,
        agentId: options.agentId
      });

      if (!approved) {
        return {
          action: 'approval_required',
          reason,
          modifiedCommand: policyDecision.modifiedCommand,
          effectiveTimeoutMs: policyDecision.effectiveTimeoutMs,
          maxOutputBytes: policyDecision.maxOutputBytes
        };
      }
    }

    return {
      action: 'allow',
      modifiedCommand: policyDecision.modifiedCommand,
      effectiveTimeoutMs: policyDecision.effectiveTimeoutMs,
      maxOutputBytes: policyDecision.maxOutputBytes
    };
  }

  private checkCdCommand(command: string): { isCd: boolean; target?: string } {
    if (command === 'cd') {
      return { isCd: true, target: '~' };
    }
    if (command.startsWith('cd ') || command.startsWith('cd\t')) {
      const target = command.substring(3).trim();
      // Ensure it is a single command and not chained
      if (!/[;&|]/.test(target)) {
        return { isCd: true, target: target.replace(/^["']|["']$/g, '') };
      }
    }
    return { isCd: false };
  }

  private checkExportCommand(command: string): { isExport: boolean; key?: string; value?: string } {
    if (command.startsWith('export ') || command.startsWith('export\t')) {
      const expr = command.substring(7).trim();
      if (!/[;&|]/.test(expr)) {
        const eqIdx = expr.indexOf('=');
        if (eqIdx !== -1) {
          const key = expr.substring(0, eqIdx).trim();
          let value = expr.substring(eqIdx + 1).trim();
          value = value.replace(/^["']|["']$/g, '');
          return { isExport: true, key, value };
        }
      }
    }
    return { isExport: false };
  }
}
