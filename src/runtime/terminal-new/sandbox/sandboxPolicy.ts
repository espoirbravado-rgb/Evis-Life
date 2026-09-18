/**
 * sandboxPolicy.ts — Phase 8: Sandbox Policy Builder
 *
 * Provides factory methods and validation for SandboxPolicyConfig.
 * Policies are immutable value objects — create once, validate once, pass to drivers.
 *
 * Zero faux-semblant: a policy that cannot be enforced by any available driver
 * must be explicitly rejected, not silently ignored.
 */

import type {
  SandboxPolicyConfig,
  SandboxFilesystemPolicy,
  SandboxNetworkPolicy,
  SandboxResourceLimits,
  SandboxEnvironmentPolicy,
  SandboxIsolationLevel,
} from './sandboxTypes.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Default Filesystem Policy
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILESYSTEM: SandboxFilesystemPolicy = {
  readOnlyPaths: ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc'],
  writablePaths: [],
  cwdWritable: true,
  tmpfsAvailable: true,
};

const DEFAULT_NETWORK: SandboxNetworkPolicy = {
  allowed: false,
};

const DEFAULT_RESOURCES: SandboxResourceLimits = {
  maxMemoryMb: 512,
  maxProcessCount: 64,
};

const DEFAULT_ENVIRONMENT: SandboxEnvironmentPolicy = {
  allowedKeys: ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TERM', 'SHELL'],
};

// ──────────────────────────────────────────────────────────────────────────────
// SandboxPolicy
// ──────────────────────────────────────────────────────────────────────────────

export class SandboxPolicy {
  public readonly config: SandboxPolicyConfig;

  constructor(config: Partial<SandboxPolicyConfig> = {}) {
    this.config = {
      isolationLevel: config.isolationLevel ?? 'bubblewrap',
      filesystem: { ...DEFAULT_FILESYSTEM, ...(config.filesystem ?? {}) },
      network: { ...DEFAULT_NETWORK, ...(config.network ?? {}) },
      resources: { ...DEFAULT_RESOURCES, ...(config.resources ?? {}) },
      environment: { ...DEFAULT_ENVIRONMENT, ...(config.environment ?? {}) },
    };
  }

  // ── Convenience getters ──────────────────────────────────────────────────

  public get isolationLevel(): SandboxIsolationLevel {
    return this.config.isolationLevel;
  }

  public isNetworkAllowed(): boolean {
    return this.config.network.allowed;
  }

  public isFilesystemReadOnly(path: string): boolean {
    const { writablePaths, readOnlyPaths } = this.config.filesystem;
    if (writablePaths.some((p) => path.startsWith(p))) return false;
    return readOnlyPaths.some((p) => path.startsWith(p));
  }

  // ── Policy Validation ────────────────────────────────────────────────────

  /**
   * Returns a list of human-readable validation errors.
   * An empty array means the policy is internally consistent.
   */
  public validate(): string[] {
    const errors: string[] = [];
    const { filesystem, resources } = this.config;

    if (resources.maxMemoryMb !== undefined && resources.maxMemoryMb < 16) {
      errors.push(`maxMemoryMb (${resources.maxMemoryMb}) is too small — minimum is 16 MiB.`);
    }

    if (resources.maxProcessCount !== undefined && resources.maxProcessCount < 1) {
      errors.push(`maxProcessCount must be at least 1.`);
    }

    const overlap = filesystem.writablePaths.filter(
      (p) => filesystem.readOnlyPaths.includes(p)
    );
    if (overlap.length > 0) {
      // Overlapping paths are allowed (writablePaths wins), but warn.
      // This is informational, not an error.
    }

    return errors;
  }

  // ── Named Presets ────────────────────────────────────────────────────────

  /**
   * Strict sandbox: no network, minimal env, read-only system paths, writable cwd only.
   */
  static strict(cwd?: string): SandboxPolicy {
    return new SandboxPolicy({
      isolationLevel: 'bubblewrap',
      filesystem: {
        readOnlyPaths: ['/usr', '/bin', '/sbin', '/lib', '/lib64'],
        writablePaths: cwd ? [cwd] : [],
        cwdWritable: true,
        tmpfsAvailable: true,
      },
      network: { allowed: false },
      resources: { maxMemoryMb: 256, maxProcessCount: 32 },
      environment: {
        allowedKeys: ['PATH', 'HOME', 'TERM'],
      },
    });
  }

  /**
   * Permissive sandbox: network allowed, broader filesystem access,
   * still isolated from host namespaces.
   */
  static permissive(cwd?: string): SandboxPolicy {
    return new SandboxPolicy({
      isolationLevel: 'bubblewrap',
      filesystem: {
        readOnlyPaths: ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc', '/opt'],
        writablePaths: cwd ? [cwd, '/tmp'] : ['/tmp'],
        cwdWritable: true,
        tmpfsAvailable: true,
      },
      network: { allowed: true },
      resources: { maxMemoryMb: 1024, maxProcessCount: 128 },
      environment: {
        allowedKeys: ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TERM', 'SHELL', 'TMPDIR'],
      },
    });
  }

  /**
   * No-op policy for trusted / unsandboxed execution.
   * Drivers receiving 'none' must not apply any restrictions.
   */
  static none(): SandboxPolicy {
    return new SandboxPolicy({
      isolationLevel: 'none',
      filesystem: { readOnlyPaths: [], writablePaths: [], cwdWritable: true, tmpfsAvailable: true },
      network: { allowed: true },
      resources: {},
      environment: {},
    });
  }
}
