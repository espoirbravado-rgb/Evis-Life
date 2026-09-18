import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { IPtyInstance, PtySpawnOptions } from './ptyTypes.ts';

const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

const BRIDGE_SCRIPT = join(currentDir, 'ptyBridge.py');

export class PtyExecutor {
  public static isPtyAvailable(): boolean {
    // Verified: Linux environment with Python 3 pty module
    return process.platform === 'linux' && existsSync(BRIDGE_SCRIPT);
  }

  public static spawnPty(command: string, args: string[] = [], options: PtySpawnOptions = {}): IPtyInstance {
    if (!this.isPtyAvailable()) {
      throw new Error('Native PTY is not available on this platform.');
    }

    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    let currentCols = options.cols ?? 80;
    let currentRows = options.rows ?? 24;

    const child = spawn('python3', [
      BRIDGE_SCRIPT,
      '--cols', String(currentCols),
      '--rows', String(currentRows),
      '--cwd', options.cwd ?? process.cwd(),
      '--cmd', fullCommand
    ], {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...(options.env ?? {}),
        TERM: 'xterm-256color'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'] // fd 3 is control channel
    });

    let innerPid: number = child.pid!;
    const dataListeners: ((data: string) => void)[] = [];
    const exitListeners: ((exitCode: number, signal?: string) => void)[] = [];

    // Parse child PID from bridge stderr
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      const match = text.match(/PID:(\d+)/);
      if (match) {
        innerPid = Number.parseInt(match[1], 10);
      }
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      for (const listener of dataListeners) {
        listener(text);
      }
    });

    child.once('close', (code, signal) => {
      const exitCode = code !== null ? code : (signal ? 143 : 0);
      for (const listener of exitListeners) {
        listener(exitCode, signal ?? undefined);
      }
    });

    const controlPipe = child.stdio[3] as import('node:stream').Writable | null;

    const instance: IPtyInstance = {
      get pid(): number {
        return innerPid;
      },
      get cols(): number {
        return currentCols;
      },
      get rows(): number {
        return currentRows;
      },
      isPty: true,
      onData: (callback: (data: string) => void) => {
        dataListeners.push(callback);
      },
      onExit: (callback: (exitCode: number, signal?: string) => void) => {
        exitListeners.push(callback);
      },
      write: (data: string) => {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.write(data);
        }
      },
      resize: (cols: number, rows: number) => {
        currentCols = cols;
        currentRows = rows;
        if (controlPipe && !controlPipe.destroyed) {
          controlPipe.write(`${cols},${rows}\n`);
        }
      },
      kill: (signal?: string) => {
        try {
          if (innerPid && innerPid !== child.pid) {
            process.kill(innerPid, signal as NodeJS.Signals ?? 'SIGTERM');
          }
        } catch {}
        child.kill(signal as NodeJS.Signals ?? 'SIGTERM');
      }
    };

    return instance;
  }
}
