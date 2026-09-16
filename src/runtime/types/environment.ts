/**
 * EVIS ENVIRONMENT AWARENESS CONTRACTS
 * Conforming to Foundation.md, GEMINI.md, and Level 2 System Architecture.
 *
 * Core Principle:
 * Evis must understand its host environment before reaching out to external worlds.
 * UNKNOWN ≠ SAFE: An unknown path or resource is never considered safe by default.
 */

export interface IHostOS {
  platform: NodeJS.Platform;      // e.g. 'linux'
  distro: string;                 // e.g. 'Parrot GNU/Linux' or 'Debian'
  release: string;                // e.g. '7.0.13+parrot7-amd64'
  arch: string;                   // e.g. 'x64'
  hostname: string;
  username: string;               // e.g. 'junior'
  homedir: string;                // e.g. '/home/junior'
  desktopDir: string;             // e.g. '/home/junior/Desktop'
  projectDir: string;             // e.g. '/home/junior/Desktop/New-Ag'
}

export type FilesystemZoneType =
  | 'project'       // Active project workspace (read/write allowed)
  | 'user'          // User documents/desktop (read/write controlled)
  | 'system'        // System files /etc, /usr, /var (read restricted, write forbidden)
  | 'protected'     // Sensitive dirs /root, /boot, .ssh, .gnupg (forbidden)
  | 'temp'          // /tmp or project scratch space
  | 'unknown';      // Anything outside known boundaries (UNKNOWN ≠ SAFE -> rejected)

export interface IPathClassification {
  path: string;
  zone: FilesystemZoneType;
  isInsideProject: boolean;
  isInsideUserHome: boolean;
  isSystemPath: boolean;
  isProtected: boolean;
  canRead: boolean;
  canWrite: boolean;
  reason: string;
}

export interface IInstalledBinary {
  name: string;                   // e.g. 'git', 'ollama', 'node', 'python3'
  command: string;
  isAvailable: boolean;
  path?: string;
  version?: string;
  isRunning?: boolean;
}

export interface IEnvironmentProfile {
  os: IHostOS;
  binaries: Record<string, IInstalledBinary>;
  timestamp: number;
}
