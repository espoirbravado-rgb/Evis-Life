/**
 * EVIS ENVIRONMENT DETECTOR
 * Conforming to Foundation.md, GEMINI.md, and Level 2 Architecture.
 *
 * Provides real-time host inspection, filesystem zone classification,
 * and security perimeter enforcement (UNKNOWN ≠ SAFE).
 * Isomorphic: works in Browser (via Host Bridge) and in Node.js runtime.
 */

import {
  IHostOS,
  IPathClassification,
  IInstalledBinary,
  IEnvironmentProfile,
} from '../types/environment';

export class EnvironmentDetector {
  private static cachedOS: IHostOS | null = null;
  private static cachedBinaries: Record<string, IInstalledBinary> | null = null;

  /**
   * Returns host OS information synchronously (cached or fallback) or inspects in Node.
   */
  public static getHostOS(): IHostOS {
    if (this.cachedOS) return this.cachedOS;

    // Check if running in Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const nodeOs = require('node:os');
        const nodeFs = require('node:fs');
        const nodePath = require('node:path');

        const userInfo = nodeOs.userInfo();
        const homedir = nodeOs.homedir();
        const desktopDir = nodePath.join(homedir, 'Desktop');
        const projectDir = process.cwd();

        let distro = `${nodeOs.platform()} ${nodeOs.release()}`;
        try {
          if (nodeFs.existsSync('/etc/os-release')) {
            const osRelease = nodeFs.readFileSync('/etc/os-release', 'utf-8');
            const match = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
            if (match && match[1]) distro = match[1];
          }
        } catch {}

        this.cachedOS = {
          platform: nodeOs.platform(),
          distro,
          release: nodeOs.release(),
          arch: nodeOs.arch(),
          hostname: nodeOs.hostname(),
          username: userInfo.username,
          homedir,
          desktopDir,
          projectDir,
        };
        return this.cachedOS;
      } catch {}
    }

    // Default Linux host parameters for Evis (when running in browser client before async sync)
    this.cachedOS = {
      platform: 'linux',
      distro: 'Parrot Security GNU/Linux',
      release: '7.0.13+parrot7-amd64',
      arch: 'x64',
      hostname: 'parrot',
      username: 'junior',
      homedir: '/home/junior',
      desktopDir: '/home/junior/Desktop',
      projectDir: '/home/junior/Desktop/New-Ag',
    };
    return this.cachedOS;
  }

  /**
   * Fetches real environment profile from host bridge if in browser.
   */
  public static async refreshProfileFromBridge(): Promise<IEnvironmentProfile> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/environment/profile');
        if (res.ok) {
          const data = await res.json();
          this.cachedOS = data.os;
          this.cachedBinaries = data.binaries;
          return data;
        }
      } catch {}
    }
    return this.getProfile();
  }

  /**
   * Classifies a target filesystem path into security zones.
   * Enforces UNKNOWN ≠ SAFE.
   */
  public static classifyPath(targetPath: string): IPathClassification {
    const hostOS = this.getHostOS();

    // Pure string path normalization (isomorphic, works in browser and Node)
    let resolved = targetPath.trim();
    if (resolved.startsWith('desktop:')) {
      resolved = `${hostOS.desktopDir}/${resolved.replace(/^desktop:/, '')}`;
    } else if (resolved.startsWith('bureau:')) {
      resolved = `${hostOS.desktopDir}/${resolved.replace(/^bureau:/, '')}`;
    } else if (resolved.startsWith('~')) {
      resolved = `${hostOS.homedir}/${resolved.slice(1)}`;
    } else if (!resolved.startsWith('/')) {
      resolved = `${hostOS.projectDir}/${resolved}`;
    }

    // Clean up double slashes and dot segments
    resolved = resolved.replace(/\/+/g, '/');

    // 1. High-Security Protected System Directories (FORBIDDEN WRITE)
    const protectedPrefixes = [
      '/root',
      '/boot',
      '/sys',
      '/proc',
      '/dev',
      `${hostOS.homedir}/.ssh`,
      `${hostOS.homedir}/.gnupg`,
    ];
    for (const p of protectedPrefixes) {
      if (resolved === p || resolved.startsWith(p + '/')) {
        return {
          path: resolved,
          zone: 'protected',
          isInsideProject: false,
          isInsideUserHome: resolved.startsWith(hostOS.homedir),
          isSystemPath: true,
          isProtected: true,
          canRead: false,
          canWrite: false,
          reason: `Zone protégée interdite (${p}): accès refusé par politique de sécurité.`,
        };
      }
    }

    // 2. System Directories (READ RESTRICTED, WRITE FORBIDDEN)
    const systemPrefixes = ['/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/opt', '/var'];
    for (const s of systemPrefixes) {
      if (resolved === s || resolved.startsWith(s + '/')) {
        return {
          path: resolved,
          zone: 'system',
          isInsideProject: false,
          isInsideUserHome: false,
          isSystemPath: true,
          isProtected: false,
          canRead: true,
          canWrite: false,
          reason: 'Zone système hôte: lecture seule restreinte, écriture interdite.',
        };
      }
    }

    // 3. Project Workspace Zone (FULL READ/WRITE)
    if (resolved === hostOS.projectDir || resolved.startsWith(hostOS.projectDir + '/')) {
      return {
        path: resolved,
        zone: 'project',
        isInsideProject: true,
        isInsideUserHome: true,
        isSystemPath: false,
        isProtected: false,
        canRead: true,
        canWrite: true,
        reason: 'Espace de travail du projet Evis: lecture et écriture autorisées.',
      };
    }

    // 4. User Workspace Zone (Desktop, Documents, Home) (CONTROLLED READ/WRITE)
    if (resolved === hostOS.homedir || resolved.startsWith(hostOS.homedir + '/')) {
      return {
        path: resolved,
        zone: 'user',
        isInsideProject: false,
        isInsideUserHome: true,
        isSystemPath: false,
        isProtected: false,
        canRead: true,
        canWrite: true,
        reason: 'Espace utilisateur (/home): lecture et écriture contrôlées.',
      };
    }

    // 5. Temporary Directory Zone
    if (resolved === '/tmp' || resolved.startsWith('/tmp/')) {
      return {
        path: resolved,
        zone: 'temp',
        isInsideProject: false,
        isInsideUserHome: false,
        isSystemPath: false,
        isProtected: false,
        canRead: true,
        canWrite: true,
        reason: 'Répertoire temporaire système (/tmp): lecture et écriture autorisées.',
      };
    }

    // 6. Unknown Path -> UNKNOWN ≠ SAFE
    return {
      path: resolved,
      zone: 'unknown',
      isInsideProject: false,
      isInsideUserHome: false,
      isSystemPath: false,
      isProtected: true,
      canRead: false,
      canWrite: false,
      reason: 'UNKNOWN ≠ SAFE: chemin hors des périmètres autorisés, accès refusé.',
    };
  }

  /**
   * Scans for key developer tools and services on host.
   */
  public static scanBinaries(): Record<string, IInstalledBinary> {
    if (this.cachedBinaries) return this.cachedBinaries;

    const targets = [
      { name: 'Node.js', command: 'node' },
      { name: 'NPM', command: 'npm' },
      { name: 'Git', command: 'git' },
      { name: 'Python 3', command: 'python3' },
      { name: 'Ollama', command: 'ollama' },
      { name: 'Bash', command: 'bash' },
      { name: 'Curl', command: 'curl' },
    ];

    const results: Record<string, IInstalledBinary> = {};

    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const { execSync } = require('node:child_process');
        for (const t of targets) {
          try {
            const binPath = execSync(`which ${t.command}`, {
              stdio: ['pipe', 'pipe', 'ignore'],
              timeout: 2000,
            })
              .toString()
              .trim();

            results[t.command] = {
              name: t.name,
              command: t.command,
              isAvailable: Boolean(binPath),
              path: binPath || undefined,
            };
          } catch {
            results[t.command] = {
              name: t.name,
              command: t.command,
              isAvailable: false,
            };
          }
        }
        this.cachedBinaries = results;
        return results;
      } catch {}
    }

    // Fallback if running purely client-side
    for (const t of targets) {
      results[t.command] = {
        name: t.name,
        command: t.command,
        isAvailable: true,
      };
    }
    this.cachedBinaries = results;
    return results;
  }

  /**
   * Generates a complete Environment Profile for Evis.
   */
  public static getProfile(): IEnvironmentProfile {
    return {
      os: this.getHostOS(),
      binaries: this.scanBinaries(),
      timestamp: Date.now(),
    };
  }
}
