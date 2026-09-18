/**
 * snapshotManager.ts — Phase 9: Unified Snapshot & Checkpoint Manager
 *
 * Distinguishes between:
 *  - Git checkpoints: captured via GitStashAdapter with exact commit/stash references.
 *  - Directory copy snapshots: fallback for non-Git workspaces or explicit local state capture.
 *
 * Never misrepresents Git stash as universal filesystem snapshot.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GitStashAdapter } from './gitStashAdapter.ts';
import type {
  CheckpointSnapshot,
  CreateCheckpointOptions,
} from './checkpointTypes.ts';

export class SnapshotManager {
  private snapshots: Map<string, CheckpointSnapshot> = new Map();
  private baseBackupDir: string;

  constructor(customBackupDir?: string) {
    this.baseBackupDir = customBackupDir ?? path.join(os.tmpdir(), 'evis_terminal_snapshots');
  }

  /**
   * Creates a checkpoint for the specified directory.
   */
  public async createSnapshot(
    cwd: string,
    options: CreateCheckpointOptions = {}
  ): Promise<CheckpointSnapshot> {
    const id = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const resolvedType = options.type ?? 'auto';

    const isGit = GitStashAdapter.isGitRepo(cwd);

    if (resolvedType === 'git' || (resolvedType === 'auto' && isGit)) {
      if (!isGit) {
        throw new Error(`Cannot create git checkpoint: ${cwd} is not a git repository.`);
      }

      const stashResult = GitStashAdapter.createStash(cwd, `checkpoint_${id}`);
      if (!stashResult.success) {
        throw new Error(`Failed to create git checkpoint: ${stashResult.error}`);
      }

      const snapshot: CheckpointSnapshot = {
        id,
        type: 'git',
        cwd,
        timestamp: Date.now(),
        description: options.description ?? `Git checkpoint ${id}`,
        gitCommitOrStashSha: stashResult.stashSha,
        stashRef: stashResult.stashRef,
      };

      this.snapshots.set(id, snapshot);
      return snapshot;
    }

    // Directory copy snapshot for non-git workspaces or explicit request
    const backupPath = path.join(this.baseBackupDir, id);
    fs.mkdirSync(backupPath, { recursive: true });

    await this.copyDirectory(cwd, backupPath);

    const snapshot: CheckpointSnapshot = {
      id,
      type: 'directory_copy',
      cwd,
      timestamp: Date.now(),
      description: options.description ?? `Directory snapshot ${id}`,
      backupPath,
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(id: string): CheckpointSnapshot | undefined {
    return this.snapshots.get(id);
  }

  public listSnapshots(): CheckpointSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public async deleteSnapshot(id: string): Promise<boolean> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return false;

    if (snapshot.type === 'directory_copy' && snapshot.backupPath && fs.existsSync(snapshot.backupPath)) {
      fs.rmSync(snapshot.backupPath, { recursive: true, force: true });
    } else if (snapshot.type === 'git' && snapshot.gitCommitOrStashSha) {
      // Best-effort drop of stash if one was recorded
      GitStashAdapter.dropStash(snapshot.cwd, snapshot.gitCommitOrStashSha);
    }

    this.snapshots.delete(id);
    return true;
  }

  /**
   * Safe recursive copy ignoring bulky artifacts (.git, node_modules)
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(src)) return;

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.evis_snapshots') {
        continue;
      }

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
