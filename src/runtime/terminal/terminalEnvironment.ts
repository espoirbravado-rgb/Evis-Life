
import fs from "node:fs";
import path from "node:path";

import type {
  TerminalEnvironment,
  TerminalEnvironmentOptions,
  TerminalExecutionContext,
} from "./terminalTypes";

export class TerminalEnvironmentManager
  implements TerminalEnvironment
{
  private readonly options: Required<TerminalEnvironmentOptions>;
  private readonly defaultCwd: string;

  constructor(
    options: TerminalEnvironmentOptions = {},
    defaultCwd: string = process.cwd(),
  ) {
    this.options = {
      inheritProcessEnv: options.inheritProcessEnv ?? true,
      blockedEnvKeys: options.blockedEnvKeys ?? [],
      allowedEnvKeys: options.allowedEnvKeys ?? [],
    };

    this.defaultCwd = path.resolve(defaultCwd);
  }

  resolve(
    requestedCwd?: string,
    requestEnv?: Record<string, string | undefined>,
  ): TerminalExecutionContext {
    const cwd = this.resolveCwd(requestedCwd);
    const env = this.resolveEnv(requestEnv);

    return {
      cwd,
      env,
    };
  }

  private resolveCwd(requestedCwd?: string): string {
    const candidate = path.resolve(
      requestedCwd ?? this.defaultCwd,
    );

    let realPath: string;

    try {
      realPath = fs.realpathSync(candidate);
    } catch (error) {
      const code = this.getErrorCode(error);

      if (code === "ENOENT" || code === "ENOTDIR") {
        throw new Error(
          `Working directory does not exist: ${candidate}`,
        );
      }

      if (code === "EACCES" || code === "EPERM") {
        throw new Error(
          `Permission denied for working directory: ${candidate}`,
        );
      }

      throw new Error(
        `Unable to resolve working directory: ${candidate}`,
      );
    }

    let stats: fs.Stats;

    try {
      stats = fs.statSync(realPath);
    } catch {
      throw new Error(
        `Unable to inspect working directory: ${realPath}`,
      );
    }

    if (!stats.isDirectory()) {
      throw new Error(
        `Working directory is not a directory: ${realPath}`,
      );
    }

    return realPath;
  }

  private resolveEnv(
    requestEnv?: Record<string, string | undefined>,
  ): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = {};

    const blocked = new Set(
      this.options.blockedEnvKeys,
    );

    const allowed = this.options.allowedEnvKeys.length > 0
      ? new Set(this.options.allowedEnvKeys)
      : undefined;

    const isAllowed = (key: string): boolean => {
      if (blocked.has(key)) {
        return false;
      }

      if (allowed && !allowed.has(key)) {
        return false;
      }

      return true;
    };

    if (this.options.inheritProcessEnv) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && isAllowed(key)) {
          result[key] = value;
        }
      }
    }

    if (requestEnv) {
      for (const [key, value] of Object.entries(requestEnv)) {
        if (!isAllowed(key)) {
          continue;
        }

        if (value === undefined) {
          delete result[key];
          continue;
        }

        result[key] = value;
      }
    }

    return result;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return error.code;
    }

    return undefined;
  }
}

