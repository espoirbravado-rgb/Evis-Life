import { randomUUID } from 'node:crypto';
import type { SessionId, TaskId } from '../terminalTypes.ts';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface ApprovalRequest {
  requestId: string;
  command: string;
  cwd: string;
  sessionId?: SessionId;
  taskId?: TaskId;
  agentId?: string;
  reason: string;
  createdAt: number;
  expiresAt: number;
  status: ApprovalStatus;
}

export type InteractiveApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

export class ApprovalManager {
  private requests: Map<string, ApprovalRequest> = new Map();
  private handler: InteractiveApprovalHandler | null = null;
  private readonly defaultTtlMs: number;

  constructor(options: { defaultTtlMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 60000; // 1 minute default TTL
  }

  public setApprovalHandler(handler: InteractiveApprovalHandler): void {
    this.handler = handler;
  }

  public createRequest(
    command: string,
    reason: string,
    context: { cwd?: string; sessionId?: SessionId; taskId?: TaskId; agentId?: string; ttlMs?: number } = {}
  ): ApprovalRequest {
    const ttl = context.ttlMs ?? this.defaultTtlMs;
    const request: ApprovalRequest = {
      requestId: `appr_${randomUUID()}`,
      command,
      cwd: context.cwd ?? process.cwd(),
      sessionId: context.sessionId,
      taskId: context.taskId,
      agentId: context.agentId,
      reason,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      status: 'pending'
    };

    this.requests.set(request.requestId, request);
    return request;
  }

  public approve(requestId: string): boolean {
    const req = this.requests.get(requestId);
    if (!req) return false;

    if (this.isExpired(req)) {
      req.status = 'expired';
      return false;
    }

    if (req.status !== 'pending') return false;
    req.status = 'approved';
    return true;
  }

  public reject(requestId: string): boolean {
    const req = this.requests.get(requestId);
    if (!req) return false;
    if (req.status !== 'pending') return false;
    req.status = 'rejected';
    return true;
  }

  /**
   * Consumes an approved request strictly bound to the requested command and context.
   * Ensures single-use authorization and prevents command or context hijacking.
   */
  public consumeApproval(
    requestId: string,
    commandToExecute: string,
    context?: { cwd?: string; sessionId?: SessionId; taskId?: TaskId; agentId?: string }
  ): boolean {
    const req = this.requests.get(requestId);
    if (!req) return false;

    if (this.isExpired(req)) {
      req.status = 'expired';
      return false;
    }

    if (req.status !== 'approved') {
      return false;
    }

    // Strict scope bound check: must match the exact authorized command
    if (req.command.trim() !== commandToExecute.trim()) {
      return false;
    }

    // Context bounds check: prevent reusing approval in another session/task/agent
    if (context?.sessionId && req.sessionId && req.sessionId !== context.sessionId) {
      return false;
    }
    if (context?.taskId && req.taskId && req.taskId !== context.taskId) {
      return false;
    }
    if (context?.agentId && req.agentId && req.agentId !== context.agentId) {
      return false;
    }

    // Mark single-use consumption
    req.status = 'consumed';
    return true;
  }

  public getRequest(requestId: string): ApprovalRequest | undefined {
    const req = this.requests.get(requestId);
    if (req && req.status === 'pending' && this.isExpired(req)) {
      req.status = 'expired';
    }
    return req;
  }

  public listPending(): ApprovalRequest[] {
    const now = Date.now();
    return Array.from(this.requests.values()).filter(r => {
      if (r.status === 'pending' && r.expiresAt < now) {
        r.status = 'expired';
        return false;
      }
      return r.status === 'pending';
    });
  }

  public async requestApproval(
    command: string,
    reason: string,
    context: { cwd?: string; sessionId?: SessionId; taskId?: TaskId; agentId?: string; ttlMs?: number } = {}
  ): Promise<boolean> {
    const request = this.createRequest(command, reason, context);

    if (!this.handler) {
      request.status = 'rejected';
      return false;
    }

    try {
      const approved = await this.handler(request);
      if (approved) {
        request.status = 'approved';
        return this.consumeApproval(request.requestId, command, context);
      } else {
        request.status = 'rejected';
        return false;
      }
    } catch {
      request.status = 'rejected';
      return false;
    }
  }

  private isExpired(req: ApprovalRequest): boolean {
    return Date.now() > req.expiresAt;
  }
}
