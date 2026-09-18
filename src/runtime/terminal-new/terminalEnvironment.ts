export interface EnvironmentOptions {
  baseEnv?: Record<string, string>;
  customEnv?: Record<string, string>;
  nonInteractive?: boolean;
}

export class TerminalEnvironment {
  private customVars: Map<string, string> = new Map();

  constructor(private readonly defaultNonInteractive: boolean = true) {}

  public setVariable(key: string, value: string): void {
    this.customVars.set(key, value);
  }

  public getVariable(key: string): string | undefined {
    return this.customVars.get(key) ?? process.env[key];
  }

  public removeVariable(key: string): void {
    this.customVars.delete(key);
  }

  public buildEnvironment(options: EnvironmentOptions = {}): Record<string, string> {
    const base: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(options.baseEnv ?? {})
    };

    // Inject custom vars tracked in this session/runtime
    for (const [k, v] of this.customVars.entries()) {
      base[k] = v;
    }

    if (options.customEnv) {
      Object.assign(base, options.customEnv);
    }

    // Enforce non-interactive flags when requested to prevent hanging processes
    const nonInteractive = options.nonInteractive ?? this.defaultNonInteractive;
    if (nonInteractive) {
      base.CI = '1';
      base.DEBIAN_FRONTEND = 'noninteractive';
      base.NONINTERACTIVE = '1';
      base.TERM = 'dumb';
      base.GIT_TERMINAL_PROMPT = '0';
      base.PAGER = 'cat';
    }

    return base;
  }
}
