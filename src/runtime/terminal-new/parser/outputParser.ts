import { AnsiCleaner } from './ansiCleaner.ts';
import { StructuredCommandParsers, type GitStatusResult, type FileEntry } from './structuredCommands.ts';

export class OutputParser {
  public static clean(output: string): string {
    return AnsiCleaner.clean(output);
  }

  public static tryParseStructured(command: string, rawOutput: string): { type: string; data: unknown } | null {
    const cleaned = this.clean(rawOutput);
    const trimmedCmd = command.trim();

    if (trimmedCmd === 'git status --short --branch' || trimmedCmd === 'git status -s -b') {
      const parsed: GitStatusResult = StructuredCommandParsers.parseGitStatus(cleaned);
      return { type: 'git_status', data: parsed };
    }

    if (trimmedCmd === 'ls -1F' || trimmedCmd === 'ls -F') {
      const parsed: FileEntry[] = StructuredCommandParsers.parseLs(cleaned);
      return { type: 'directory_listing', data: parsed };
    }

    return null;
  }
}
