import { readdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ProcessSignals, type PosixSignal } from './processSignals.ts';

export class ProcessTree {
  /**
   * Discovers child PIDs of a given parent PID.
   * Uses Linux /proc scanning when available for zero-subprocess overhead.
   */
  public static getChildPids(parentPid: number): number[] {
    // Try reading /proc on Linux systems
    try {
      const procEntries = readdirSync('/proc');
      const children: number[] = [];

      for (const entry of procEntries) {
        // Fast numeric check
        const pid = Number(entry);
        if (!Number.isInteger(pid) || pid <= 0) continue;

        try {
          const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
          // Format: pid (comm) state ppid ...
          const commEnd = stat.lastIndexOf(') ');
          if (commEnd !== -1) {
            const afterComm = stat.substring(commEnd + 2).trimStart();
            const parts = afterComm.split(' ');
            // parts[0] is state (e.g. S, R, Z), parts[1] is ppid
            const ppid = Number.parseInt(parts[1], 10);
            if (ppid === parentPid) {
              children.push(pid);
            }
          }
        } catch {
          // Process might have terminated between readdir and readFileSync
        }
      }

      return children;
    } catch {
      // Fallback: pgrep -P on Unix systems
      try {
        const output = execSync(`pgrep -P ${parentPid}`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
        return output
          .trim()
          .split('\n')
          .map(line => Number.parseInt(line.trim(), 10))
          .filter(pid => !Number.isNaN(pid) && pid > 0);
      } catch {
        return [];
      }
    }
  }

  /**
   * Recursively finds all descendant PIDs.
   */
  public static getAllDescendantPids(rootPid: number): number[] {
    const pids: number[] = [];
    const queue: number[] = [rootPid];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = this.getChildPids(current);
      for (const child of children) {
        if (!pids.includes(child)) {
          pids.push(child);
          queue.push(child);
        }
      }
    }

    return pids;
  }

  /**
   * Safely terminates an entire process tree from leaves to root.
   */
  public static killTree(rootPid: number, signal: PosixSignal = 'SIGTERM'): boolean {
    const descendants = this.getAllDescendantPids(rootPid);

    // Terminate descendants from deepest leaf to nearest parent
    for (const pid of descendants.reverse()) {
      ProcessSignals.killPid(pid, signal);
    }

    // Terminate the root process itself
    return ProcessSignals.killPid(rootPid, signal);
  }
}
