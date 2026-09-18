/**
 * sandboxManager.ts — Phase 8: Sandbox Driver Architecture + Real Drivers
 *
 * Provides:
 *  - LocalDriver: explicitly reports isolation level 'none', makes NO isolation claims.
 *  - BubblewrapDriver: real Linux namespace isolation via bwrap (bubblewrap).
 *  - SandboxManager: selects the best available driver given a policy.
 *
 * Zero faux-semblant:
 *  - LocalDriver.checkCapabilities() explicitly reports available: false for isolation.
 *  - BubblewrapDriver.checkCapabilities() probes the binary before claiming availability.
 *  - wrapCommand() returns an accurate CommandWrapResult including isolated: boolean.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { SandboxPolicy } from './sandboxPolicy.ts';
import type {
  ISandboxDriver,
  SandboxDriverCapabilities,
  SandboxIsolationLevel,
  SandboxPolicyConfig,
  CommandWrapResult,
} from './sandboxTypes.ts';

const execFileAsync = promisify(execFile);

// ──────────────────────────────────────────────────────────────────────────────
// LocalDriver — No Isolation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * LocalDriver executes commands directly in the host environment.
 * It does NOT provide any isolation.
 *
 * This driver is always available and is used as a fallback when no
 * isolation driver is available. It is HONEST about providing no isolation.
 */
export class LocalDriver implements ISandboxDriver {
  public readonly name = 'local';
  public readonly isolationLevel: SandboxIsolationLevel = 'none';

  public async checkCapabilities(): Promise<SandboxDriverCapabilities> {
    return {
      available: true,
      isolationLevel: 'none',
      filesystemIsolation: false,
      networkIsolation: false,
      resourceLimits: false,
      environmentFiltering: true, // We CAN filter env variables (done in TS before spawn)
      unavailableReason: undefined,
    };
  }

  public async initialize(): Promise<void> {
    // Nothing to initialize — local driver runs in-process.
  }

  public wrapCommand(
    command: string,
    args: string[],
    _cwd: string,
    _policy: SandboxPolicyConfig,
    hostEnv: Record<string, string>
  ): CommandWrapResult {
    // Apply environment filtering in pure TS (no kernel-level isolation).
    const envPolicy = _policy.environment;
    let filteredEnv: Record<string, string>;

    if (envPolicy.allowedKeys && envPolicy.allowedKeys.length > 0) {
      filteredEnv = {};
      for (const key of envPolicy.allowedKeys) {
        if (hostEnv[key] !== undefined) {
          filteredEnv[key] = hostEnv[key];
        }
      }
    } else {
      filteredEnv = { ...hostEnv };
    }

    // Inject additional env variables.
    if (envPolicy.inject) {
      Object.assign(filteredEnv, envPolicy.inject);
    }

    return {
      command,
      args,
      env: filteredEnv,
      isolated: false,
      driverName: this.name,
    };
  }

  public async cleanup(): Promise<void> {
    // Nothing to clean up.
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// BubblewrapDriver — Real Linux Namespace Isolation
// ──────────────────────────────────────────────────────────────────────────────

const BWRAP_BINARY = '/bin/bwrap';

/**
 * BubblewrapDriver uses the bubblewrap (bwrap) Linux tool to create
 * real namespace isolation:
 *  - User namespace (unprivileged — no root required)
 *  - Mount namespace (custom filesystem view)
 *  - Network namespace (optional — isolates network)
 *  - PID namespace (isolates process tree)
 *
 * Capability probing is done at initialize() time, not lazily.
 */
export class BubblewrapDriver implements ISandboxDriver {
  public readonly name = 'bubblewrap';
  public readonly isolationLevel: SandboxIsolationLevel = 'bubblewrap';

  public async checkCapabilities(): Promise<SandboxDriverCapabilities> {
    // Check if bwrap binary exists.
    if (!existsSync(BWRAP_BINARY)) {
      return {
        available: false,
        isolationLevel: 'bubblewrap',
        filesystemIsolation: false,
        networkIsolation: false,
        resourceLimits: false,
        environmentFiltering: true,
        unavailableReason: `bwrap binary not found at ${BWRAP_BINARY}`,
      };
    }

    // Try running bwrap --version to confirm it's executable.
    try {
      await execFileAsync(BWRAP_BINARY, ['--version'], { timeout: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        isolationLevel: 'bubblewrap',
        filesystemIsolation: false,
        networkIsolation: false,
        resourceLimits: false,
        environmentFiltering: true,
        unavailableReason: `bwrap --version failed: ${message}`,
      };
    }

    // Probe: can we create a user namespace? Attempt minimal sandbox.
    try {
      await execFileAsync(
        BWRAP_BINARY,
        [
          '--ro-bind', '/usr', '/usr',
          '--ro-bind', '/bin', '/bin',
          '--tmpfs', '/tmp',
          '--proc', '/proc',
          '--dev', '/dev',
          '--unshare-pid',
          '--',
          '/bin/true',
        ],
        { timeout: 5000 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        isolationLevel: 'bubblewrap',
        filesystemIsolation: false,
        networkIsolation: false,
        resourceLimits: false,
        environmentFiltering: true,
        unavailableReason: `bwrap namespace probe failed: ${message}`,
      };
    }

    return {
      available: true,
      isolationLevel: 'bubblewrap',
      filesystemIsolation: true,
      networkIsolation: true,   // --unshare-net is available
      resourceLimits: false,    // bwrap alone cannot enforce cgroups limits
      environmentFiltering: true,
    };
  }

  public async initialize(): Promise<void> {
    const caps = await this.checkCapabilities();

    if (!caps.available) {
      throw new Error(
        `BubblewrapDriver cannot initialize: ${caps.unavailableReason}`
      );
    }
  }

  public wrapCommand(
    command: string,
    args: string[],
    cwd: string,
    policy: SandboxPolicyConfig,
    hostEnv: Record<string, string>
  ): CommandWrapResult {
    const bwrapArgs: string[] = [];

    // ── Filesystem ──────────────────────────────────────────────────────────

    // Standard system mounts (read-only).
    const systemReadOnly = ['/usr', '/bin', '/sbin', '/lib', '/lib64'];
    for (const p of systemReadOnly) {
      if (existsSync(p)) {
        bwrapArgs.push('--ro-bind', p, p);
      }
    }

    // /proc, /dev (needed by most programs).
    bwrapArgs.push('--proc', '/proc');
    bwrapArgs.push('--dev', '/dev');

    // /tmp as tmpfs.
    if (policy.filesystem.tmpfsAvailable) {
      bwrapArgs.push('--tmpfs', '/tmp');
    }

    // Additional read-only paths from policy.
    for (const p of policy.filesystem.readOnlyPaths) {
      if (!systemReadOnly.includes(p) && existsSync(p)) {
        bwrapArgs.push('--ro-bind', p, p);
      }
    }

    // Writable paths from policy.
    for (const p of policy.filesystem.writablePaths) {
      if (existsSync(p)) {
        bwrapArgs.push('--bind', p, p);
      }
    }

    // Working directory: writable if cwdWritable, otherwise read-only.
    if (cwd && existsSync(cwd)) {
      if (policy.filesystem.cwdWritable) {
        // Only add if not already in writablePaths.
        if (!policy.filesystem.writablePaths.includes(cwd)) {
          bwrapArgs.push('--bind', cwd, cwd);
        }
      } else {
        if (
          !policy.filesystem.writablePaths.includes(cwd) &&
          !policy.filesystem.readOnlyPaths.includes(cwd)
        ) {
          bwrapArgs.push('--ro-bind', cwd, cwd);
        }
      }
    }

    // ── Namespaces ──────────────────────────────────────────────────────────

    bwrapArgs.push('--unshare-pid');
    bwrapArgs.push('--unshare-uts');
    bwrapArgs.push('--unshare-ipc');

    // Network isolation.
    if (!policy.network.allowed) {
      bwrapArgs.push('--unshare-net');
    }

    // Die with parent.
    bwrapArgs.push('--die-with-parent');

    // Set working directory inside the sandbox.
    if (cwd) {
      bwrapArgs.push('--chdir', cwd);
    }

    // ── Environment ─────────────────────────────────────────────────────────

    // Clear all env inside bwrap, then selectively re-inject via wrapper env.
    bwrapArgs.push('--clearenv');

    // Build filtered env to pass through bwrap's --setenv mechanism.
    const envPolicy = policy.environment;
    const filteredEnv: Record<string, string> = {};

    if (envPolicy.allowedKeys && envPolicy.allowedKeys.length > 0) {
      for (const key of envPolicy.allowedKeys) {
        if (hostEnv[key] !== undefined) {
          bwrapArgs.push('--setenv', key, hostEnv[key]);
          filteredEnv[key] = hostEnv[key];
        }
      }
    } else {
      // No allowlist: inject all host env (bwrap still has --clearenv,
      // so we must explicitly re-inject everything).
      for (const [key, value] of Object.entries(hostEnv)) {
        bwrapArgs.push('--setenv', key, value);
        filteredEnv[key] = value;
      }
    }

    // Injected overrides.
    if (envPolicy.inject) {
      for (const [key, value] of Object.entries(envPolicy.inject)) {
        bwrapArgs.push('--setenv', key, value);
        filteredEnv[key] = value;
      }
    }

    // ── Separator + actual command ──────────────────────────────────────────

    bwrapArgs.push('--');
    bwrapArgs.push('/bin/sh', '-c', [command, ...args.map((a) => `'${a.replace(/'/g, "'\\''")}'`)].join(' '));

    return {
      command: BWRAP_BINARY,
      args: bwrapArgs,
      env: {}, // env is managed via --setenv inside bwrap, host spawner gets empty env
      isolated: true,
      driverName: this.name,
    };
  }

  public async cleanup(): Promise<void> {
    // Nothing to clean up for bubblewrap — each command is a separate bwrap invocation.
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SandboxManager
// ──────────────────────────────────────────────────────────────────────────────

export class SandboxManager {
  private activeDriver: ISandboxDriver;
  private _initialized = false;

  constructor(public readonly policy: SandboxPolicy = new SandboxPolicy()) {
    // Default to LocalDriver until initialize() selects the best available driver.
    this.activeDriver = new LocalDriver();
  }

  // ── Driver Selection ─────────────────────────────────────────────────────

  /**
   * Initialize the manager: probe available drivers and select the best one
   * matching the policy's requested isolation level.
   *
   * Falls back to LocalDriver if the requested driver is unavailable,
   * but logs a clear warning that isolation was NOT achieved.
   */
  public async initialize(): Promise<{
    driver: string;
    isolated: boolean;
    warning?: string;
  }> {
    const requestedLevel = this.policy.isolationLevel;

    if (requestedLevel === 'none') {
      this.activeDriver = new LocalDriver();
      await this.activeDriver.initialize();
      this._initialized = true;
      return { driver: 'local', isolated: false };
    }

    if (requestedLevel === 'bubblewrap') {
      const bwrap = new BubblewrapDriver();
      const caps = await bwrap.checkCapabilities();

      if (caps.available) {
        await bwrap.initialize();
        this.activeDriver = bwrap;
        this._initialized = true;
        return { driver: 'bubblewrap', isolated: true };
      } else {
        // Bubblewrap requested but unavailable: fall back to local, warn clearly.
        const local = new LocalDriver();
        await local.initialize();
        this.activeDriver = local;
        this._initialized = true;
        return {
          driver: 'local',
          isolated: false,
          warning: `Bubblewrap isolation was requested but is not available: ${caps.unavailableReason}. Commands will run WITHOUT isolation.`,
        };
      }
    }

    // Future drivers (docker, microvm): fall through to local.
    const local = new LocalDriver();
    await local.initialize();
    this.activeDriver = local;
    this._initialized = true;
    return {
      driver: 'local',
      isolated: false,
      warning: `Isolation level '${requestedLevel}' is not yet implemented. Commands will run WITHOUT isolation.`,
    };
  }

  // ── Manual Driver Override ───────────────────────────────────────────────

  /** Override the active driver (useful for testing). */
  public setDriver(driver: ISandboxDriver): void {
    this.activeDriver = driver;
  }

  public getDriver(): ISandboxDriver {
    return this.activeDriver;
  }

  public isInitialized(): boolean {
    return this._initialized;
  }

  // ── Command Wrapping ─────────────────────────────────────────────────────

  /**
   * Wrap a command according to the active driver and current policy.
   *
   * @param command  The shell command string to execute.
   * @param cwd      The working directory.
   * @param hostEnv  The host environment variables (will be filtered by policy).
   */
  public wrapCommand(
    command: string,
    cwd: string,
    hostEnv: Record<string, string> = {}
  ): CommandWrapResult {
    if (!this._initialized) {
      throw new Error(
        'SandboxManager.wrapCommand() called before initialize(). Call initialize() first.'
      );
    }

    return this.activeDriver.wrapCommand(
      command,
      [],
      cwd,
      this.policy.config,
      hostEnv
    );
  }

  // ── Capabilities ─────────────────────────────────────────────────────────

  public async getCapabilities(): Promise<SandboxDriverCapabilities> {
    return this.activeDriver.checkCapabilities();
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  public async cleanup(): Promise<void> {
    if (this._initialized) {
      await this.activeDriver.cleanup();
      this._initialized = false;
    }
  }
}
