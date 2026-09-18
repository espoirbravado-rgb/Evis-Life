/**
 * rollbackEngine.ts — Phase 9: Deterministic Rollback Engine
 *
 * Restores a specific checkpoint without guessing or blindly popping latest stash.
 * Returns structured status:
 *   - 'success': checkpoint restored cleanly
 *   - 'conflict': merge conflict detected (with conflicted file list)
 *   - 'not_found': snapshot ID does not exist in registry
 *   - 'not_supported': snapshot type or target directory invalid
 *   - 'failed': underlying OS or Git error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitStashAdapter } from './gitStashAdapter.ts';
import type { SnapshotManager } from './snapshotManager.ts';
import type {
  CheckpointSnapshot,
  RollbackResult,
} from './checkpointTypes.ts';

export class RollbackEngine {
  /**
   * Rolls back a workspace to a specific snapshot ID.
   */
  public static async rollback(
    snapshotId: string,
    manager: SnapshotManager
  ): Promise<RollbackResult> {
    const snapshot = manager.getSnapshot(snapshotId);
    if (!snapshot) {
      return {
        status: 'not_found',
        snapshotId,
        detail: `Checkpoint snapshot '${snapshotId}' was not found.`,
      };
    }

    return this.rollbackSnapshot(snapshot);
  }

  /**
   * Executes rollback on an existing CheckpointSnapshot object.
   */
  public static async rollbackSnapshot(
    snapshot: CheckpointSnapshot
  ): Promise<RollbackResult> {
    if (!fs.existsSync(snapshot.cwd)) {
      return {
        status: 'not_supported',
        snapshotId: snapshot.id,
        detail: `Target directory '${snapshot.cwd}' no longer exists.`,
      };
    }

    if (snapshot.type === 'git') {
      const targetRef = snapshot.gitCommitOrStashSha;
      if (!targetRef) {
        return {
          status: 'failed',
          snapshotId: snapshot.id,
          detail: 'No commit or stash SHA recorded for git snapshot.',
        };
      }

      const applyResult = snapshot.isStash
        ? GitStashAdapter.applyStash(snapshot.cwd, targetRef)
        : GitStashAdapter.restoreCommit(snapshot.cwd, targetRef);

      if (applyResult.success) {
        return {
          status: 'success',
          snapshotId: snapshot.id,
        };
      }

      if (applyResult.conflict) {
        return {
          status: 'conflict',
          snapshotId: snapshot.id,
          conflictedFiles: applyResult.conflictedFiles,
          detail: applyResult.error ?? 'Merge conflict detected during rollback.',
        };
      }

      return {
        status: 'failed',
        snapshotId: snapshot.id,
        detail: applyResult.error ?? 'Git rollback failed.',
      };
    }

    if (snapshot.type === 'directory_copy') {
      if (!snapshot.backupPath || !fs.existsSync(snapshot.backupPath)) {
        return {
          status: 'failed',
          snapshotId: snapshot.id,
          detail: 'Snapshot backup directory missing or corrupted.',
        };
      }

      try {
        // Restore directory contents (pruning newly created files and overwriting modified)
        await this.restoreDirectory(snapshot.backupPath, snapshot.cwd);
        return {
          status: 'success',
          snapshotId: snapshot.id,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          status: 'failed',
          snapshotId: snapshot.id,
          detail: `Failed to restore directory snapshot: ${msg}`,
        };
      }
    }

    return {
      status: 'not_supported',
      snapshotId: snapshot.id,
      detail: `Unsupported checkpoint type: ${(snapshot as CheckpointSnapshot).type}`,
    };
  }

  /**
   * Restores files from backup directory into target cwd:
   * 1. Removes files and directories in targetDir that do not exist in backupDir.
   * 2. Copies files from backupDir into targetDir.
   */
  private static async restoreDirectory(backupDir: string, targetDir: string): Promise<void> {
    // 1. Prune newly created files/directories in targetDir
    if (fs.existsSync(targetDir)) {
      const targetEntries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of targetEntries) {
        if (entry.name === '.git') continue;
        const backupPath = path.join(backupDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (!fs.existsSync(backupPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
      }
    }

    // 2. Restore all files and subdirectories from backupDir
    const entries = fs.readdirSync(backupDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(backupDir, entry.name);
      const destPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        await this.restoreDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
