import { execSync } from 'node:child_process';

export class GitStashAdapter {
  public static createStash(cwd: string, message: string): string | null {
    try {
      execSync(`git stash push -u -m "${message}"`, { cwd, stdio: 'ignore' });
      const stashList = execSync('git stash list -n 1', { cwd, encoding: 'utf-8' });
      return stashList.trim();
    } catch {
      return null;
    }
  }

  public static popStash(cwd: string): boolean {
    try {
      execSync('git stash pop', { cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
