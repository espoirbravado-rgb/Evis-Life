export interface EnvironmentPolicyOptions {
  inheritProcessEnv?: boolean;
  allowedEnvKeys?: string[];
  blockedEnvKeys?: string[];
  enforceNonInteractive?: boolean;
}

export interface BuildEnvironmentOptions {
  baseEnv?: Record<string, string>;
  sessionEnv?: Record<string, string>;
  requestEnv?: Record<string, string>;
  nonInteractive?: boolean;
}

export const DEFAULT_BLOCKED_ENV_KEYS: readonly string[] = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'DATABASE_URL',
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID'
];

export const SAFE_BASE_ENV_KEYS: readonly string[] = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'PWD'
];

export class TerminalEnvironment {
  private customVars: Map<string, string> = new Map();
  private readonly inheritProcessEnv: boolean;
  private readonly allowedKeys?: Set<string>;
  private readonly blockedKeys: Set<string>;
  private readonly defaultNonInteractive: boolean;

  constructor(options: EnvironmentPolicyOptions = {}) {
    this.inheritProcessEnv = options.inheritProcessEnv ?? true;
    this.allowedKeys = options.allowedEnvKeys ? new Set(options.allowedEnvKeys) : undefined;
    this.blockedKeys = new Set([...DEFAULT_BLOCKED_ENV_KEYS, ...(options.blockedEnvKeys ?? [])]);
    this.defaultNonInteractive = options.enforceNonInteractive ?? true;
  }

  public setVariable(key: string, value: string): void {
    this.customVars.set(key, value);
  }

  public getVariable(key: string): string | undefined {
    return this.customVars.get(key) ?? process.env[key];
  }

  public removeVariable(key: string): void {
    this.customVars.delete(key);
  }

  /**
   * Builds the isolated, filtered environment applying the strict deterministic precedence:
   * 1. Filtered base (from process.env or safe keys)
   * 2. Persistent runtime custom variables
   * 3. Session variables
   * 4. Request-specific variables
   * 5. Enforced non-interactive runtime flags
   */
  public buildEnvironment(options: BuildEnvironmentOptions = {}): Record<string, string> {
    const env: Record<string, string> = {};

    // 1. Base Environment
    if (this.inheritProcessEnv) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined) continue;

        // Block sensitive keys matching blocklist or sensitive substrings
        if (this.isKeyBlocked(key)) {
          continue;
        }

        // Check allowlist if configured
        if (this.allowedKeys && !this.allowedKeys.has(key)) {
          continue;
        }

        env[key] = value;
      }
    } else {
      // Safe base keys only
      for (const key of SAFE_BASE_ENV_KEYS) {
        const val = process.env[key];
        if (val !== undefined && !this.isKeyBlocked(key)) {
          env[key] = val;
        }
      }
    }

    // Merge options.baseEnv if provided
    if (options.baseEnv) {
      for (const [k, v] of Object.entries(options.baseEnv)) {
        if (!this.isKeyBlocked(k)) {
          env[k] = v;
        }
      }
    }

    // 2. Persistent custom vars of this TerminalEnvironment instance
    for (const [k, v] of this.customVars.entries()) {
      if (!this.isKeyBlocked(k)) {
        env[k] = v;
      }
    }

    // 3. Session variables
    if (options.sessionEnv) {
      for (const [k, v] of Object.entries(options.sessionEnv)) {
        if (!this.isKeyBlocked(k)) {
          env[k] = v;
        }
      }
    }

    // 4. Request variables (explicit request overrides)
    if (options.requestEnv) {
      for (const [k, v] of Object.entries(options.requestEnv)) {
        if (!this.isKeyBlocked(k)) {
          env[k] = v;
        }
      }
    }

    // 5. Enforce non-interactive flags when enabled
    const nonInteractive = options.nonInteractive ?? this.defaultNonInteractive;
    if (nonInteractive) {
      env.CI = '1';
      env.DEBIAN_FRONTEND = 'noninteractive';
      env.NONINTERACTIVE = '1';
      env.TERM = 'dumb';
      env.GIT_TERMINAL_PROMPT = '0';
      env.PAGER = 'cat';
    }

    return env;
  }

  private isKeyBlocked(key: string): boolean {
    if (this.blockedKeys.has(key)) return true;
    const upper = key.toUpperCase();
    if (
      upper.includes('SECRET') ||
      upper.includes('TOKEN') ||
      upper.includes('PASSWORD') ||
      upper.includes('API_KEY')
    ) {
      return true;
    }
    return false;
  }
}
