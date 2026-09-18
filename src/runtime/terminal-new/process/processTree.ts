import { execSync } from 'node:child_process';

export class ProcessTree {
  /**
   * Discovers child PIDs of a given parent PID on Linux/Unix systems.
   */
  public static getChildPids(parentPid: number): number[] {
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
}
