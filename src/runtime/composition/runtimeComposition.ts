
import { FilesystemTool } from '../execution/implementations/filesystemTool';
import { TerminalTool } from '../execution/implementations/terminalTool';
import {
  IToolImplementation,
  ToolExecutor,
} from '../execution/toolExecutor';

export class RuntimeComposition {
  private readonly implementations: IToolImplementation[];
  private readonly toolExecutor: ToolExecutor;

  constructor() {
    this.implementations = [
      new FilesystemTool(),
      new TerminalTool(),
    ];

    this.toolExecutor = new ToolExecutor({
      implementations: this.implementations,
    });
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  getImplementations(): IToolImplementation[] {
    return [...this.implementations];
  }
}

