import { GitStashAdapter } from './gitStashAdapter.ts';

export interface CheckpointSnapshot {
  id: string;
  cwd: string;
  timestamp: number;
  stashRef: string | null;
}

export class SnapshotManager {
  private snapshots: Map<string, CheckpointSnapshot> = new Map();

  public createSnapshot(cwd: string): CheckpointSnapshot {
    const id = `snap_${Date.now()}`;
    const stashRef = GitStashAdapter.createStash(cwd, `checkpoint_${id}`);
    
    const snapshot: CheckpointSnapshot = {
      id,
      cwd,
      timestamp: Date.now(),
      stashRef
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(id: string): CheckpointSnapshot | undefined {
    return this.snapshots.get(id);
  }
}
