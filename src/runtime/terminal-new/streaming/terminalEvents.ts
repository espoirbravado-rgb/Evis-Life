import { EventEmitter } from 'node:events';
import type { CommandResult } from '../terminalTypes.ts';

export interface TerminalEventMap {
  'stdout': (data: string) => void;
  'stderr': (data: string) => void;
  'prompt_detected': (promptText: string) => void;
  'exit': (result: CommandResult) => void;
}

export class TerminalEventEmitter extends EventEmitter {
  public emitStdout(data: string): void {
    this.emit('stdout', data);
  }

  public emitStderr(data: string): void {
    this.emit('stderr', data);
  }

  public emitPromptDetected(promptText: string): void {
    this.emit('prompt_detected', promptText);
  }

  public emitExit(result: CommandResult): void {
    this.emit('exit', result);
  }
}
