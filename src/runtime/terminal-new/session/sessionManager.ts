import { randomUUID } from 'node:crypto';
import { TerminalSession, type TerminalSessionOptions } from './terminalSession.ts';
import type { ProcessManager } from '../process/processManager.ts';
import type { SessionId } from '../terminalTypes.ts';

export class SessionManager {
  private sessions: Map<SessionId, TerminalSession> = new Map();
  private defaultSessionId: SessionId;

  constructor(initialCwd: string = process.cwd()) {
    const defaultSession = new TerminalSession(randomUUID(), { cwd: initialCwd });
    this.sessions.set(defaultSession.id, defaultSession);
    this.defaultSessionId = defaultSession.id;
  }

  public createSession(options?: TerminalSessionOptions): TerminalSession {
    const session = new TerminalSession(randomUUID(), options);
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

    const created = new TerminalSession(id, { cwd });
    this.sessions.set(id, created);
    return created;
  }

  public attach(id: SessionId): TerminalSession | undefined {
    const session = this.sessions.get(id);
    if (!session || session.status === 'closed') return undefined;
    session.setStatus('active');
    return session;
  }

  public detach(id: SessionId): TerminalSession | undefined {
    const session = this.sessions.get(id);
    if (!session || session.status === 'closed') return undefined;
    session.setStatus('detached');
    return session;
  }

  public async closeSession(id: SessionId, processManager?: ProcessManager): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.close();

    // Terminate all session-owned processes
    if (processManager) {
      const processIds = session.getActiveProcessIds();
      for (const pid of processIds) {
        processManager.signal(pid, 'SIGTERM');
      }

      // Small grace period before force killing
      await new Promise(resolve => setTimeout(resolve, 50));

      for (const pid of processIds) {
        const handle = processManager.get(pid);
        if (handle && handle.isAlive) {
          processManager.kill(pid, 'SIGKILL');
        }
      }
    }

    if (id !== this.defaultSessionId) {
      this.sessions.delete(id);
    }

    return true;
  }

  public listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  public listActive(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  public async cleanup(processManager?: ProcessManager): Promise<void> {
    for (const session of this.sessions.values()) {
      await this.closeSession(session.id, processManager);
    }
  }
}
