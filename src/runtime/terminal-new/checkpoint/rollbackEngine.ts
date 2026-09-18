import { GitStashAdapter } from './gitStashAdapter.ts';
import type { CheckpointSnapshot } from './snapshotManager.ts';

export class RollbackEngine {
  public static rollback(snapshot: CheckpointSnapshot): boolean {
    if (!snapshot.stashRef) {
      return false;
    }
    return GitStashAdapter.popStash(snapshot.cwd);
  }
}
