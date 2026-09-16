export interface IFSItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export class FilesystemService {
  /**
   * Lists real files and folders inside the workspace
   */
  static async list(relDir: string = ''): Promise<{ items: IFSItem[]; currentDir: string; rootDir: string }> {
    try {
      const res = await fetch(`/api/fs/list?dir=${encodeURIComponent(relDir)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      console.warn('FilesystemService.list error:', err);
      return { items: [], currentDir: relDir, rootDir: '/home/junior/Desktop/New-Ag' };
    }
  }

  /**
   * Reads real file content from workspace disk
   */
  static async read(relPath: string): Promise<{ path: string; content: string; size: number; modifiedAt: string } | null> {
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err: any) {
      console.warn('FilesystemService.read error:', err);
      return null;
    }
  }

  /**
   * Safely writes or creates a file in the workspace
   */
  static async write(relPath: string, content: string): Promise<boolean> {
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath, content }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Creates a directory in the workspace
   */
  static async mkdir(relPath: string): Promise<boolean> {
    try {
      const res = await fetch('/api/fs/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Deletes a file or directory from the workspace
   */
  static async delete(relPath: string): Promise<boolean> {
    try {
      const res = await fetch('/api/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
