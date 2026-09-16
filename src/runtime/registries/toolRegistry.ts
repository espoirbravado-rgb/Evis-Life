/**
 * EVIS RUNTIME — TOOL REGISTRY
 *
 * Responsibility:
 *   Register and expose tool definitions to the runtime.
 *
 * The registry does NOT:
 *   - execute tools
 *   - access the filesystem
 *   - execute terminal commands
 *   - perform network requests
 *   - evaluate permissions
 *   - decide whether a tool call is authorized
 *
 * Execution is handled by ToolExecutor and concrete tool implementations.
 *
 * Architecture:
 *
 *   Orchestrator
 *        ↓
 *   ToolRegistry
 *        ↓
 *   ToolDefinition
 *        ↓
 *   ToolExecutor
 *        ↓
 *   ToolImplementation
 */

import {
  CapabilityId,
  IToolDefinition,
  IToolParameterSchema,
} from '../types/domain';

export class ToolRegistry {
  private static readonly tools = new Map<string, IToolDefinition>();
  private static initialized = false;

  /**
   * Initialize the core tool definitions.
   *
   * This registers definitions only.
   * No physical operation is performed here.
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    this.registerFilesystemTool();
    this.registerTerminalTool();
    this.registerMemoryTool();
    this.registerWebTool();

    this.initialized = true;
  }

  /**
   * Register a tool definition.
   *
   * A tool definition describes the interface exposed to the model.
   * It does not contain executable code.
   */
  static register(tool: IToolDefinition): void {
    if (!tool.id.trim()) {
      throw new Error(
        'Tool registration failed: tool id cannot be empty.',
      );
    }

    if (this.tools.has(tool.id)) {
      throw new Error(
        `Tool registration failed: "${tool.id}" is already registered.`,
      );
    }

    this.tools.set(tool.id, tool);
  }

  static has(id: string): boolean {
    this.initialize();
    return this.tools.has(id);
  }

  static get(id: string): IToolDefinition | undefined {
    this.initialize();
    return this.tools.get(id);
  }

  static getAll(): IToolDefinition[] {
    this.initialize();
    return Array.from(this.tools.values());
  }

  /**
   * Return every registered tool capable of providing the requested
   * capability.
   *
   * Multiple tools may provide the same capability.
   * The registry therefore does not select an execution strategy.
   */
  static findToolsForCapability(
    capabilityId: CapabilityId,
  ): IToolDefinition[] {
    this.initialize();

    return this.getAll().filter((tool) =>
      tool.capabilities.includes(capabilityId),
    );
  }

  /**
   * Provider-neutral conversion of tool definitions into model tool schemas.
   *
   * Provider-specific adapters are responsible for converting this neutral
   * representation into Ollama, OpenAI-compatible, llama.cpp, etc. formats.
   */
  static toModelToolSchemas(
    tools: IToolDefinition[] = this.getAll(),
  ): Array<{
    name: string;
    description: string;
    parameters: IToolParameterSchema;
  }> {
    return tools.map((tool) => ({
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  // ---------------------------------------------------------------------------
  // Core tool definitions
  // ---------------------------------------------------------------------------

  private static registerFilesystemTool(): void {
    this.register({
      id: 'filesystem',
      name: 'Filesystem Tool',
      description:
        'Provides controlled filesystem operations for navigating, inspecting, creating, reading, writing, modifying, organizing, deleting, copying, moving, renaming, and searching files and directories.',
      capabilities: [
        'file.read',
        'file.write',
        'file.create',
        'file.modify',
        'file.list',
        'file.delete',
        'file.append',
        'file.mkdir',
        'file.stat',
        'file.exists',
        'file.rename',
        'file.move',
        'file.copy',
        'file.search',
      ],
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description:
              'Filesystem operation to perform.',
            enum: [
              'list',
              'read',
              'write',
              'append',
              'create',
              'modify',
              'mkdir',
              'stat',
              'exists',
              'delete',
              'rename',
              'move',
              'copy',
              'search',
            ],
          },

          path: {
            type: 'string',
            description:
              'Target file or directory path. Relative paths are resolved by the filesystem runtime according to the current Evis environment.',
          },

          destination: {
            type: 'string',
            description:
              'Destination path used by move and copy operations.',
          },

          newName: {
            type: 'string',
            description:
              'New file or directory name used by the rename operation.',
          },

          content: {
            type: 'string',
            description:
              'Text content used by write, append, or modify insert operations.',
          },

          operation: {
            type: 'string',
            description:
              'Modification operation used by the modify action.',
            enum: [
              'replace',
              'insert',
              'delete',
            ],
          },

          search: {
            type: 'string',
            description:
              'Text used to locate content during a modify operation.',
          },

          replacement: {
            type: 'string',
            description:
              'Replacement text used by a modify replace operation.',
          },

          line: {
            type: 'number',
            description:
              'Line number used by a modify insert operation when no search text is provided.',
          },

          startLine: {
            type: 'number',
            description:
              'First line of the range used by a modify delete operation.',
          },

          endLine: {
            type: 'number',
            description:
              'Last line of the range used by a modify delete operation.',
          },

          position: {
            type: 'string',
            description:
              'Position at which inserted content is placed relative to the search text.',
            enum: [
              'before',
              'after',
            ],
            default: 'after',
          },

          recursive: {
            type: 'boolean',
            description:
              'Whether a directory operation should operate recursively when supported.',
            default: false,
          },

          query: {
            type: 'string',
            description:
              'Filename or content search query used by the search operation.',
          },

          searchMode: {
            type: 'string',
            description:
              'Search mode used by the search operation.',
            enum: [
              'name',
              'content',
            ],
            default: 'name',
          },

          maxResults: {
            type: 'number',
            description:
              'Maximum number of search results to return.',
            default: 100,
          },

          maxFileSize: {
            type: 'number',
            description:
              'Maximum file size considered by content search operations.',
          },

          maxSize: {
            type: 'number',
            description:
              'Maximum file size allowed when reading a file.',
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      metadata: {
        category: 'filesystem',
        execution: 'runtime',
        securitySensitive: true,
      },
    });
  }

  private static registerTerminalTool(): void {
    this.register({
      id: 'terminal',
      name: 'Terminal Tool',
      description:
        'Executes shell commands through the runtime execution layer and returns stdout, stderr, and the process result.',
      capabilities: [
        'terminal.execute',
        'code.execute',
        'code.test',
      ],
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'Shell command to execute.',
          },
          cwd: {
            type: 'string',
            description:
              'Optional working directory for the command.',
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
      metadata: {
        category: 'terminal',
        execution: 'runtime',
        securitySensitive: true,
      },
    });
  }

  private static registerMemoryTool(): void {
    this.register({
      id: 'memory',
      name: 'Memory Tool',
      description:
        'Reads or saves persistent Evis memory through the runtime memory subsystem.',
      capabilities: [
        'memory.read',
        'memory.save',
      ],
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description:
              'Memory operation to perform.',
            enum: [
              'store',
              'retrieve',
            ],
          },
          key: {
            type: 'string',
            description:
              'Persistent memory key.',
          },
          value: {
            type: 'string',
            description:
              'Content to store when using the store operation.',
          },
        },
        required: ['action', 'key'],
        additionalProperties: false,
      },
      metadata: {
        category: 'memory',
        execution: 'runtime',
        persistent: true,
      },
    });
  }

  private static registerWebTool(): void {
    this.register({
      id: 'web_search',
      name: 'Web Search Tool',
      description:
        'Searches public web information or retrieves textual content from web pages through the runtime web layer.',
      capabilities: [
        'web.search',
        'web.open',
        'web.fetch',
      ],
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description:
              'Web operation to perform.',
            enum: [
              'search',
              'fetch',
            ],
          },
          query: {
            type: 'string',
            description:
              'Search query used by the search operation.',
          },
          url: {
            type: 'string',
            description:
              'HTTP or HTTPS URL used by the fetch operation.',
          },
          limit: {
            type: 'number',
            description:
              'Maximum number of search results to request.',
            default: 5,
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      metadata: {
        category: 'web',
        execution: 'runtime',
        networkRequired: true,
        securitySensitive: true,
      },
    });
  }
}