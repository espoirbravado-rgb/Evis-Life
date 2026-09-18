import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { SessionId, TaskId } from '../terminalTypes.ts';

export interface BaseTerminalEvent {
  eventId: string;
  timestamp: number;
  sessionId?: SessionId;
  processId?: number;
  taskId?: TaskId;
  agentId?: string;
}

export interface ProcessCreatedEvent extends BaseTerminalEvent {
  type: 'process_created';
  command: string;
  cwd: string;
}

export interface ProcessStartedEvent extends BaseTerminalEvent {
  type: 'process_started';
  pid: number;
}

export interface StdoutEvent extends BaseTerminalEvent {
  type: 'stdout';
  data: string;
}

export interface StderrEvent extends BaseTerminalEvent {
  type: 'stderr';
  data: string;
}

export interface PromptDetectedEvent extends BaseTerminalEvent {
  type: 'prompt_detected';
  promptText: string;
}

export interface ApprovalRequiredEvent extends BaseTerminalEvent {
  type: 'approval_required';
  command: string;
  reason: string;
}

export interface ProcessSignalEvent extends BaseTerminalEvent {
  type: 'process_signal';
  signal: string;
}

export interface ProcessTimeoutEvent extends BaseTerminalEvent {
  type: 'process_timeout';
  durationMs: number;
}

export interface ProcessExitedEvent extends BaseTerminalEvent {
  type: 'process_exited';
  exitCode: number | null;
  signal?: string | null;
  durationMs: number;
}

export interface ProcessFailedEvent extends BaseTerminalEvent {
  type: 'process_failed';
  error: string;
  durationMs: number;
}

export interface SessionCreatedEvent extends BaseTerminalEvent {
  type: 'session_created';
  cwd: string;
}

export interface SessionClosedEvent extends BaseTerminalEvent {
  type: 'session_closed';
}

export type TerminalEvent =
  | ProcessCreatedEvent
  | ProcessStartedEvent
  | StdoutEvent
  | StderrEvent
  | PromptDetectedEvent
  | ApprovalRequiredEvent
  | ProcessSignalEvent
  | ProcessTimeoutEvent
  | ProcessExitedEvent
  | ProcessFailedEvent
  | SessionCreatedEvent
  | SessionClosedEvent;

export interface TerminalEventContext {
  sessionId?: SessionId;
  taskId?: TaskId;
  agentId?: string;
  processId?: number;
}

export class TerminalEventEmitter extends EventEmitter {
  public emitEvent(event: TerminalEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);
  }

  public subscribe(listener: (event: TerminalEvent) => void): () => void {
    this.on('event', listener);
    return () => {
      this.off('event', listener);
    };
  }

  public emitProcessCreated(command: string, cwd: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_created',
      timestamp: Date.now(),
      command,
      cwd,
      sessionId: context?.sessionId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitProcessStarted(pid: number, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_started',
      timestamp: Date.now(),
      pid,
      processId: pid,
      sessionId: context?.sessionId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitStdout(data: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'stdout',
      timestamp: Date.now(),
      data,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitStderr(data: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'stderr',
      timestamp: Date.now(),
      data,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitPromptDetected(promptText: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'prompt_detected',
      timestamp: Date.now(),
      promptText,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitApprovalRequired(command: string, reason: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'approval_required',
      timestamp: Date.now(),
      command,
      reason,
      sessionId: context?.sessionId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitProcessSignal(signal: string, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_signal',
      timestamp: Date.now(),
      signal,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitProcessTimeout(durationMs: number, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_timeout',
      timestamp: Date.now(),
      durationMs,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitProcessExited(exitCode: number | null, durationMs: number, signal?: string | null, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_exited',
      timestamp: Date.now(),
      exitCode,
      signal,
      durationMs,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitProcessFailed(error: string, durationMs: number, context?: TerminalEventContext): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'process_failed',
      timestamp: Date.now(),
      error,
      durationMs,
      sessionId: context?.sessionId,
      processId: context?.processId,
      taskId: context?.taskId,
      agentId: context?.agentId
    });
  }

  public emitSessionCreated(sessionId: SessionId, cwd: string): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'session_created',
      timestamp: Date.now(),
      sessionId,
      cwd
    });
  }

  public emitSessionClosed(sessionId: SessionId): void {
    this.emitEvent({
      eventId: randomUUID(),
      type: 'session_closed',
      timestamp: Date.now(),
      sessionId
    });
  }
}
