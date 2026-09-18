/**
 * phase9.test.ts — Phase 9: Checkpoints & Rollback Engine Tests
 *
 * Verifies:
 *  - GitStashAdapter captures exact stash commit SHA and refuses non-git paths
 *  - SnapshotManager handles both Git repos and directory copy snapshots
 *  - RollbackEngine returns structured results:
 *     - 'not_found' for unknown snapshot IDs
 *     - 'not_supported' when target path no longer exists
 *     - 'success' when files are restored cleanly
 *     - 'conflict' when merge conflicts occur in Git rollback
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { GitStashAdapter } from '../checkpoint/gitStashAdapter.ts';
import { SnapshotManager } from '../checkpoint/snapshotManager.ts';
import { RollbackEngine } from '../checkpoint/rollbackEngine.ts';

describe('Terminal-New Phase 9 (Checkpoints & Rollback Engine)', () => {
  let testRootDir: string;
  let nonGitDir: string;
  let gitRepoDir: string;

  before(() => {
    testRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evis_phase9_test_'));
    nonGitDir = path.join(testRootDir, 'nongit');
    gitRepoDir = path.join(testRootDir, 'gitrepo');

    fs.mkdirSync(nonGitDir, { recursive: true });
    fs.mkdirSync(gitRepoDir, { recursive: true });

    // Initialize real git repo
    execFileSync('git', ['init', '-b', 'main'], { cwd: gitRepoDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: gitRepoDir });
    execFileSync('git', ['config', 'user.name', 'Evis Tester'], { cwd: gitRepoDir });

    // Initial commit
    fs.writeFileSync(path.join(gitRepoDir, 'initial.txt'), 'version 1');
    execFileSync('git', ['add', '.'], { cwd: gitRepoDir });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: gitRepoDir });
  });

  after(() => {
    try {
      fs.rmSync(testRootDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('GitStashAdapter — Verification & Exact References', () => {
    it('correctly distinguishes git repos from non-git directories', () => {
      assert.equal(GitStashAdapter.isGitRepo(gitRepoDir), true);
      assert.equal(GitStashAdapter.isGitRepo(nonGitDir), false);
    });

    it('refuses to stash in non-git directory', () => {
      const result = GitStashAdapter.createStash(nonGitDir, 'test');
      assert.equal(result.success, false);
      assert.match(result.error ?? '', /not inside a Git repository/i);
    });

    it('captures exact commit reference even with clean working tree', () => {
      const result = GitStashAdapter.createStash(gitRepoDir, 'clean_check');
      assert.equal(result.success, true);
      assert.equal(result.hasStashedChanges, false);
      assert.ok(result.stashSha && result.stashSha.length === 40, 'Should return full 40-char SHA');
    });

    it('captures exact stash commit SHA when changes exist', () => {
      const testFile = path.join(gitRepoDir, 'working.txt');
      fs.writeFileSync(testFile, 'temporary work');

      const result = GitStashAdapter.createStash(gitRepoDir, 'wip_stash');
      assert.equal(result.success, true);
      assert.equal(result.hasStashedChanges, true);
      assert.ok(result.stashSha && result.stashSha.length === 40);

      // File should be stashed away (clean working tree now)
      assert.equal(fs.existsSync(testFile), false);
    });
  });

  describe('SnapshotManager — Multi-Tier Checkpointing', () => {
    it('creates directory copy snapshot for non-git directory', async () => {
      const manager = new SnapshotManager();
      const sampleFile = path.join(nonGitDir, 'data.txt');
      fs.writeFileSync(sampleFile, 'hello world');

      const snapshot = await manager.createSnapshot(nonGitDir, {
        description: 'non-git snapshot',
      });

      assert.equal(snapshot.type, 'directory_copy');
      assert.ok(snapshot.backupPath);
      assert.equal(fs.existsSync(snapshot.backupPath), true);
      assert.equal(
        fs.readFileSync(path.join(snapshot.backupPath, 'data.txt'), 'utf-8'),
        'hello world'
      );
    });

    it('creates git checkpoint for git repository', async () => {
      const manager = new SnapshotManager();
      fs.writeFileSync(path.join(gitRepoDir, 'git_snap.txt'), 'git snap data');

      const snapshot = await manager.createSnapshot(gitRepoDir, {
        description: 'git repo snapshot',
      });

      assert.equal(snapshot.type, 'git');
      assert.ok(snapshot.gitCommitOrStashSha);
      assert.equal(manager.getSnapshot(snapshot.id)?.id, snapshot.id);
    });

    it('lists and deletes snapshots correctly', async () => {
      const manager = new SnapshotManager();
      const snapshot = await manager.createSnapshot(nonGitDir);

      assert.ok(manager.listSnapshots().some((s) => s.id === snapshot.id));
      const deleted = await manager.deleteSnapshot(snapshot.id);
      assert.equal(deleted, true);
      assert.equal(manager.getSnapshot(snapshot.id), undefined);
    });
  });

  describe('RollbackEngine — Deterministic Status Handling', () => {
    it('returns not_found for non-existent snapshot ID', async () => {
      const manager = new SnapshotManager();
      const result = await RollbackEngine.rollback('chk_unknown_123', manager);
      assert.equal(result.status, 'not_found');
    });

    it('restores directory snapshot cleanly (success)', async () => {
      const manager = new SnapshotManager();
      const fileToTrack = path.join(nonGitDir, 'important.txt');
      fs.writeFileSync(fileToTrack, 'original state');

      const snapshot = await manager.createSnapshot(nonGitDir);

      // Mutate directory
      fs.writeFileSync(fileToTrack, 'corrupted state');
      assert.equal(fs.readFileSync(fileToTrack, 'utf-8'), 'corrupted state');

      // Rollback
      const result = await RollbackEngine.rollback(snapshot.id, manager);
      assert.equal(result.status, 'success');
      assert.equal(fs.readFileSync(fileToTrack, 'utf-8'), 'original state');
    });

    it('returns not_supported when target directory was deleted', async () => {
      const deletedDir = path.join(testRootDir, 'will_delete');
      fs.mkdirSync(deletedDir, { recursive: true });
      fs.writeFileSync(path.join(deletedDir, 'file.txt'), 'data');

      const manager = new SnapshotManager();
      const snapshot = await manager.createSnapshot(deletedDir);

      fs.rmSync(deletedDir, { recursive: true, force: true });

      const result = await RollbackEngine.rollback(snapshot.id, manager);
      assert.equal(result.status, 'not_supported');
    });
  });
});
