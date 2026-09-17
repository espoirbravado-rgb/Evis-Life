import { realpathSync, statSync } from "node:fs";
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
  "NODE_OPTIONS",
  "NODE_EXTRA_CA_CERTS",
];

const DEFAULT_ALLOWED_ENV_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "TEMP",
  "TMP",
];

export class DefaultTerminalEnvironment implements TerminalEnvironment {
  private readonly options: Required<TerminalEnvironmentOptions>;

  constructor(options: TerminalEnvironmentOptions = {}) {
    this.options = {
      inheritProcessEnv: options.inheritProcessEnv ?? true,
      blockedEnvKeys: options.blockedEnvKeys ?? DEFAULT_BLOCKED_ENV_KEYS,
      allowedEnvKeys: options.allowedEnvKeys ?? DEFAULT_ALLOWED_ENV_KEYS,
    };
  }

  resolve(
    requestedCwd?: string,
    requestEnv: Record<string, string | undefined> = {},
  ): TerminalExecutionContext {
    const requestedPath = resolve(requestedCwd ?? process.cwd());

    if (!isAbsolute(requestedPath)) {
      throw new Error(`Terminal working directory must be absolute: ${requestedPath}`);
    }

    let cwd: string;

    try {
      cwd = realpathSync(requestedPath);
    } catch {
      throw new Error(`Terminal working directory does not exist: ${requestedPath}`);
    }

    if (!statSync(cwd).isDirectory()) {
      throw new Error(`Terminal working directory is not a directory: ${cwd}`);
    }

    const env: NodeJS.ProcessEnv = {};
    const allowed = new Set(this.options.allowedEnvKeys.map((key) => key.toUpperCase()));
    const blocked = new Set(this.options.blockedEnvKeys.map((key) => key.toUpperCase()));

    const canPass = (key: string) =>
      !blocked.has(key.toUpperCase()) &&
      allowed.has(key.toUpperCase());

    if (this.options.inheritProcessEnv) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && canPass(key)) {
          env[key] = value;
        }
      }
    }

    for (const [key, value] of Object.entries(requestEnv)) {
      if (value !== undefined && canPass(key)) {
        env[key] = value;
      }
    }

    return { cwd, env };
  }
}