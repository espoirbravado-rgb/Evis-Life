import type { IPtyInstance, PtySpawnOptions } from './ptyTypes.ts';

export class PtyExecutor {
  public static isPtyAvailable(): boolean {
    try {
      // Check if node-pty or equivalent native module can be loaded
      return false;
    } catch {
      return false;
    }
  }

  public static spawnPty(_command: string, _args: string[] = [], _options: PtySpawnOptions = {}): IPtyInstance {
    throw new Error('PTY emulation requires native node-pty dependency. Fallback to stdio pipeline.');
  }
}
