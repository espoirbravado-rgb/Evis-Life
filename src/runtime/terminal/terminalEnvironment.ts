import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type {
  TerminalEnvironment,
  TerminalEnvironmentOptions,
  TerminalExecutionContext,
} from "./terminalTypes";

const DEFAULT_BLOCKED_ENV_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "DATABASE_URL",
];

export class DefaultTerminalEnvironment implements TerminalEnvironment {
  private readonly options: Required<TerminalEnvironmentOptions>;

  constructor(options: TerminalEnvironmentOptions = {}) {
    this.options = {
      inheritProcessEnv: options.inheritProcessEnv ?? true,
      blockedEnvKeys: options.blockedEnvKeys ?? DEFAULT_BLOCKED_ENV_KEYS,
      allowedEnvKeys: options.allowedEnvKeys ?? [],
    };
  }

  resolve(
    requestedCwd?: string,
    requestEnv: Record<string, string | undefined> = {},
  ): TerminalExecutionContext {
    const cwd = resolve(requestedCwd ?? process.cwd());

    this.assertDirectory(cwd);

    const env: NodeJS.ProcessEnv = {};

    if (this.options.inheritProcessEnv) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined) {
          continue;
        }

        if (this.isBlocked(key)) {
          continue;
        }

        if (
          this.options.allowedEnvKeys.length > 0 &&
          !this.options.allowedEnvKeys.includes(key)
        ) {
          continue;
        }

        env[key] = value;
      }
    }

    for (const [key, value] of Object.entries(requestEnv)) {
      if (value === undefined || this.isBlocked(key)) {
        continue;
      }

      if (
        this.options.allowedEnvKeys.length > 0 &&
        !this.options.allowedEnvKeys.includes(key)
      ) {
        continue;
      }

      env[key] = value;
    }

    return {
      cwd,
      env,
    };
  }

  private isBlocked(key: string): boolean {
    const normalized = key.toUpperCase();

    return this.options.blockedEnvKeys.some(
      (blocked) => blocked.toUpperCase() === normalized,
    );
  }

  private assertDirectory(path: string): void {
    if (!isAbsolute(path)) {
      throw new Error(`Terminal working directory must be absolute: ${path}`);
    }

    let stats;

    try {
      stats = statSync(path);
    } catch {
      throw new Error(`Terminal working directory does not exist: ${path}`);
    }

    if (!stats.isDirectory()) {
      throw new Error(`Terminal working directory is not a directory: ${path}`);
    }
  }
}