/**
 * gitStashAdapter.ts — Phase 9: Git-specific Checkpoint Adapter
 *
 * Provides safe Git-based stashing and rollback:
 *  - Verifies repository status
 *  - Captures exact stash reference (SHA and stash name)
 *  - Never uses ambiguous blind `git stash pop`
 *  - Applies specific references and detects merge conflicts
 */

import { execFileSync } from 'node:child_process';

export interface GitStashResult {
  success: boolean;
  stashSha?: string;
  stashRef?: string;
  hasStashedChanges?: boolean;
  error?: string;
}

export interface GitApplyResult {
  success: boolean;
  conflict: boolean;
  conflictedFiles?: string[];
  error?: string;
}

export class GitStashAdapter {
  /**
   * Verifies whether the specified directory is inside a valid Git work tree.
   */
  public static isGitRepo(cwd: string): boolean {
    try {
      const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Captures the current repository state into a stash with an exact reference.
   * If working directory is clean, captures HEAD commit SHA without error.
   */
  public static createStash(cwd: string, message: string): GitStashResult {
    if (!this.isGitRepo(cwd)) {
      return { success: false, error: 'Directory is not inside a Git repository.' };
    }

    try {
      // Check if there are modified, staged, or untracked changes
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!status.trim()) {
        // Clean working directory: capture HEAD SHA as the reference point
        const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd,
          encoding: 'utf-8',
        }).trim();

        return {
          success: true,
          stashSha: headSha,
          hasStashedChanges: false,
        };
      }

      // Stash all changes including untracked files
      execFileSync('git', ['stash', 'push', '-u', '-m', message], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Capture the exact stash commit SHA from stash@{0}
      const stashSha = execFileSync('git', ['rev-parse', 'stash@{0}'], {
        cwd,
        encoding: 'utf-8',
      }).trim();

      const stashList = execFileSync('git', ['stash', 'list', '-n', '1'], {
        cwd,
        encoding: 'utf-8',
      }).trim();

      return {
        success: true,
        stashSha,
        stashRef: stashList,
        hasStashedChanges: true,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Git stash creation failed: ${msg}`,
      };
    }
  }

  /**
   * Applies an exact stash reference or commit without blindly popping the top.
   * Detects merge conflicts and extracts conflicted filenames.
   */
  public static applyStash(cwd: string, targetRefOrSha: string): GitApplyResult {
    if (!this.isGitRepo(cwd)) {
      return { success: false, conflict: false, error: 'Directory is not inside a Git repository.' };
    }

    try {
      execFileSync('git', ['stash', 'apply', targetRefOrSha], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      return { success: true, conflict: false };
    } catch (err: unknown) {
      // Check if failure is due to merge conflict
      const conflictedFiles = this.getConflictedFiles(cwd);
      if (conflictedFiles.length > 0) {
        return {
          success: false,
          conflict: true,
          conflictedFiles,
          error: `Merge conflict while applying stash: ${conflictedFiles.join(', ')}`,
        };
      }

      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        conflict: false,
        error: `Failed to apply stash: ${msg}`,
      };
    }
  }

  /**
   * Restores a commit reference when the checkpoint was captured on a clean tree.
   * Performs reset --hard and clean -fd to deterministically return to that commit state.
   */
  public static restoreCommit(cwd: string, commitSha: string): GitApplyResult {
    if (!this.isGitRepo(cwd)) {
      return { success: false, conflict: false, error: 'Directory is not inside a Git repository.' };
    }

    try {
      execFileSync('git', ['reset', '--hard', commitSha], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      execFileSync('git', ['clean', '-fd'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { success: true, conflict: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        conflict: false,
        error: `Failed to restore commit: ${msg}`,
      };
    }
  }

  /**
   * Drops a specific stash reference once it has been consumed or discarded.
   */
  public static dropStash(cwd: string, stashRefOrSha: string): boolean {
    if (!this.isGitRepo(cwd)) return false;
    try {
      execFileSync('git', ['stash', 'drop', stashRefOrSha], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scans git status for files in unmerged/conflict states (UU, AA, DD, etc.)
   */
  private static getConflictedFiles(cwd: string): string[] {
    try {
      const statusOutput = execFileSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const conflictPrefixes = ['UU', 'AA', 'DD', 'AU', 'UA', 'DU', 'UD'];
      const conflicts: string[] = [];

      for (const line of statusOutput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const prefix = trimmed.slice(0, 2);
        if (conflictPrefixes.includes(prefix)) {
          conflicts.push(trimmed.slice(3).trim());
        }
      }

      return conflicts;
    } catch {
      return [];
    }
  }
}
