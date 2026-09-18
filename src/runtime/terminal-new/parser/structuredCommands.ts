export interface GitStatusResult {
  branch: string;
  clean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export class StructuredCommandParsers {
  public static parseGitStatus(output: string): GitStatusResult {
    const lines = output.split('\n');
    let branch = 'unknown';
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        branch = line.substring(3).trim();
      } else if (line.startsWith(' M ') || line.startsWith('M ')) {
        modifiedFiles.push(line.substring(3).trim());
      } else if (line.startsWith('?? ')) {
        untrackedFiles.push(line.substring(3).trim());
      }
    }

    return {
      branch,
      clean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
      modifiedFiles,
      untrackedFiles
    };
  }

  public static parseLs(output: string): FileEntry[] {
    return output
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(entry => ({
        name: entry.endsWith('/') ? entry.slice(0, -1) : entry,
        isDirectory: entry.endsWith('/')
      }));
  }
}
