import { randomUUID } from 'node:crypto';
import { TerminalSession } from './terminalSession.ts';
import type { SessionId } from '../terminalTypes.ts';

export class SessionManager {
  private sessions: Map<SessionId, TerminalSession> = new Map();
  private defaultSessionId: SessionId;

  constructor(initialCwd: string = process.cwd()) {
    const defaultSession = new TerminalSession(randomUUID(), initialCwd);
    this.sessions.set(defaultSession.id, defaultSession);
    this.defaultSessionId = defaultSession.id;
  }

  public createSession(cwd?: string, env?: Record<string, string>): TerminalSession {
    const session = new TerminalSession(randomUUID(), cwd, env);
    this.sessions.set(session.id, session);
    return session;
  }

  public getSession(id?: SessionId): TerminalSession | undefined {
    if (!id) {
      return this.sessions.get(this.defaultSessionId);
    }
    return this.sessions.get(id);
  }

  public getOrCreateSession(id?: SessionId, cwd?: string): TerminalSession {
    if (!id) {
      return this.getSession(this.defaultSessionId)!;
    }
    const existing = this.sessions.get(id);
    if (existing) return existing;

    const created = new TerminalSession(id, cwd);
    this.sessions.set(id, created);
    return created;
  }

  public closeSession(id: SessionId): boolean {
    if (id === this.defaultSessionId) return false;
    return this.sessions.delete(id);
  }

  public listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }
}
