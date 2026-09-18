/**
 * sandboxTypes.ts — Phase 8: Sandbox Type Contracts
 *
 * Defines the complete type surface for sandbox isolation in the terminal runtime.
 * Every restriction must be expressed as a typed constraint enforceable by a real driver.
 *
 * Zero faux-semblant: no type may exist that cannot be enforced by at least one driver.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Isolation Level
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Isolation level indicates the mechanism used to restrict process execution.
 *
 * - 'none':        No isolation. Process runs in the host environment.
 *                  Used only when no sandbox driver is available or for trusted operations.
 * - 'bubblewrap':  Linux bubblewrap (bwrap) namespace isolation.
 *                  Provides real user namespace + mount namespace + network namespace separation.
 * - 'docker':      Docker container isolation (future driver).
 * - 'microvm':     MicroVM-level isolation (future driver).
 */
export type SandboxIsolationLevel = 'none' | 'bubblewrap' | 'docker' | 'microvm';

// ──────────────────────────────────────────────────────────────────────────────
// Filesystem Policy
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Controls which parts of the filesystem the sandboxed process can access.
 */
export interface SandboxFilesystemPolicy {
  /**
   * Bind-mount these host paths as read-only inside the sandbox.
   * Paths that do not exist on the host are silently skipped.
   */
  readOnlyPaths: string[];

  /**
   * Bind-mount these host paths as read-write inside the sandbox.
   * If a path is in both readOnlyPaths and writablePaths, writablePaths wins.
   */
  writablePaths: string[];

  /**
   * Whether the working directory (cwd) is automatically added as writable.
   * Default: true.
   */
  cwdWritable: boolean;

  /**
   * Whether /tmp is available inside the sandbox (as a tmpfs).
   * Default: true.
   */
  tmpfsAvailable: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Network Policy
// ──────────────────────────────────────────────────────────────────────────────

export interface SandboxNetworkPolicy {
  /**
   * Whether the sandboxed process is allowed to make network calls.
   * When false, a new network namespace with no interfaces is used.
   */
  allowed: boolean;

  /**
   * Optional allowlist of hostnames or CIDR ranges (informational only;
   * actual enforcement requires a supporting driver or firewall).
   */
  allowedHosts?: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Resource Limits
// ──────────────────────────────────────────────────────────────────────────────

export interface SandboxResourceLimits {
  /**
   * Maximum number of CPU cores the process may use (informational for bwrap;
   * enforced via cgroups when available).
   */
  maxCpuCores?: number;

  /**
   * Maximum memory in MiB (enforced via cgroups when available).
   */
  maxMemoryMb?: number;

  /**
   * Maximum disk write quota in MiB (informational; not enforced by bwrap alone).
   */
  diskQuotaMb?: number;

  /**
   * Maximum number of processes the sandboxed tree may spawn.
   * Enforced via prlimit RLIMIT_NPROC when available.
   */
  maxProcessCount?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Environment Policy
// ──────────────────────────────────────────────────────────────────────────────

export interface SandboxEnvironmentPolicy {
  /**
   * If set, the sandboxed process receives only these environment variables.
   * Keys not in this list are stripped from the environment before execution.
   */
  allowedKeys?: string[];

  /**
   * Additional key=value pairs to inject into the sandbox environment.
   * Injected after filtering; overrides values from the host.
   */
  inject?: Record<string, string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Full Sandbox Policy
// ──────────────────────────────────────────────────────────────────────────────

export interface SandboxPolicyConfig {
  isolationLevel: SandboxIsolationLevel;
  filesystem: SandboxFilesystemPolicy;
  network: SandboxNetworkPolicy;
  resources: SandboxResourceLimits;
  environment: SandboxEnvironmentPolicy;
}

// ──────────────────────────────────────────────────────────────────────────────
// Driver Capability Report
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Describes what a driver can actually enforce.
 * Drivers must honestly report their real capabilities.
 */
export interface SandboxDriverCapabilities {
  /** True if the driver binary/kernel feature is available on this host. */
  available: boolean;

  /** The actual isolation level this driver provides. */
  isolationLevel: SandboxIsolationLevel;

  /** Whether this driver can enforce filesystem restrictions. */
  filesystemIsolation: boolean;

  /** Whether this driver can enforce network restrictions. */
  networkIsolation: boolean;

  /** Whether this driver can enforce memory/CPU resource limits (requires cgroups). */
  resourceLimits: boolean;

  /** Whether this driver can restrict the process environment. */
  environmentFiltering: boolean;

  /** Human-readable reason if not available. */
  unavailableReason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Wrap Result
// ──────────────────────────────────────────────────────────────────────────────

export interface CommandWrapResult {
  /** The wrapped command to execute (e.g. `bwrap --ro-bind / / -- original cmd`). */
  command: string;

  /** Any additional arguments to prepend (for exec-style drivers). */
  args: string[];

  /** Filtered environment to pass to the child process. */
  env: Record<string, string>;

  /** Whether any isolation is actually being applied. */
  isolated: boolean;

  /** The driver that produced this wrap result. */
  driverName: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Driver Interface
// ──────────────────────────────────────────────────────────────────────────────

export interface ISandboxDriver {
  readonly name: string;
  readonly isolationLevel: SandboxIsolationLevel;

  /** Check availability and report capabilities without throwing. */
  checkCapabilities(): Promise<SandboxDriverCapabilities>;

  /** Initialize the driver (verify binary, check namespaces, etc.). */
  initialize(): Promise<void>;

  /**
   * Wrap a command according to the given policy.
   * Returns a CommandWrapResult that can be passed directly to a spawner.
   */
  wrapCommand(
    command: string,
    args: string[],
    cwd: string,
    policy: SandboxPolicyConfig,
    hostEnv: Record<string, string>
  ): CommandWrapResult;

  /** Release any resources held by the driver. */
  cleanup(): Promise<void>;
}
