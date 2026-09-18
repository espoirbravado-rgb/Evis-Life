/**
 * checkpointTypes.ts — Phase 9: Checkpoint & Rollback Types
 *
 * Defines explicit contracts for filesystem and version-controlled checkpoints.
 * Avoids calling a git stash a universal snapshot.
 */

export type CheckpointType = 'git' | 'directory_copy';

export interface CheckpointSnapshot {
  id: string;
  type: CheckpointType;
  cwd: string;
  timestamp: number;
  description?: string;
  gitCommitOrStashSha?: string;
  stashRef?: string;
  isStash?: boolean;
  backupPath?: string;
  metadata?: Record<string, unknown>;
}

export type RollbackStatus =
  | 'success'
  | 'conflict'
  | 'not_found'
  | 'not_supported'
  | 'failed';

export interface RollbackResult {
  status: RollbackStatus;
  snapshotId: string;
  detail?: string;
  conflictedFiles?: string[];
}

export interface CreateCheckpointOptions {
  type?: 'auto' | 'git' | 'directory_copy';
  description?: string;
}
