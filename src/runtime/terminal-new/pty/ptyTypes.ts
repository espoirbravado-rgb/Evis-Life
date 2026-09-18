export interface PtyDimensions {
  cols: number;
  rows: number;
}

export interface PtySpawnOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export interface IPtyInstance {
  pid: number;
  cols: number;
  rows: number;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitCode: number) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}
