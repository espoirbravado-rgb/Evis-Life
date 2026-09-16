import {
  IRuntimeContext,
  IToolCall,
  IToolResult,
} from '../../types/domain';

import type { IToolImplementation } from '../toolExecutor';

interface IFilesystemModifyOptions {
  operation: 'replace' | 'insert' | 'delete';
  search?: string;
  replacement?: string;
  line?: number;
  startLine?: number;
  endLine?: number;
  position?: 'before' | 'after';
}

interface IFilesystemOperationResult {
  data?: unknown;
  stdout?: string;
}

export class FilesystemTool implements IToolImplementation {
  readonly toolId = 'filesystem';

  async execute(
    call: IToolCall,
    context: IRuntimeContext,
  ): Promise<IToolResult> {
    const startTime = Date.now();

    try {
      const action = this.getStringArgument(
        call.arguments,
        'action',
      );

      if (!action) {
        return this.failure(
          call,
          'INVALID_ARGUMENT',
          'Paramètre "action" manquant.',
          startTime,
        );
      }

      const result = await this.executeAction(
        action,
        call.arguments,
        context,
      );

      return {
        callId: call.id,
        toolId: this.toolId,
        status: 'success',
        data: result.data,
        stdout: result.stdout,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.failure(
        call,
        'FILESYSTEM_ERROR',
        this.getErrorMessage(error),
        startTime,
      );
    }
  }

  private async executeAction(
    action: string,
    argumentsObject: Record<string, unknown>,
    _context: IRuntimeContext,
  ): Promise<IFilesystemOperationResult> {
    switch (action) {
      case 'read':
        return this.read(argumentsObject);

      case 'write':
        return this.write(argumentsObject);

      case 'create':
        return this.create(argumentsObject);

      case 'modify':
        return this.modify(argumentsObject);

      case 'append':
        return this.append(argumentsObject);

      case 'list':
        return this.list(argumentsObject);

      case 'search':
        return this.search(argumentsObject);

      case 'mkdir':
        return this.mkdir(argumentsObject);

      case 'stat':
        return this.stat(argumentsObject);

      case 'exists':
        return this.exists(argumentsObject);

      case 'copy':
        return this.copy(argumentsObject);

      case 'move':
        return this.move(argumentsObject);

      case 'rename':
        return this.rename(argumentsObject);

      case 'delete':
        return this.delete(argumentsObject);

      default:
        throw new Error(
          `Action inconnue: "${action}". Actions permises: read, write, create, modify, append, list, search, mkdir, stat, exists, copy, move, rename, delete.`,
        );
    }
  }

  private async request(
    action: string,
    argumentsObject: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(
      '/api/runtime/tools/filesystem',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...argumentsObject,
        }),
      },
    );

    let payload: {
      success?: boolean;
      data?: unknown;
      error?: string;
    };

    try {
      payload = await response.json();
    } catch {
      throw new Error(
        `Le backend filesystem a retourné une réponse JSON invalide (HTTP ${response.status}).`,
      );
    }

    if (
      !response.ok ||
      payload.success === false
    ) {
      throw new Error(
        payload.error ||
          `La requête filesystem a échoué (HTTP ${response.status}).`,
      );
    }

    return payload.data;
  }

  private async read(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const maxSize =
      this.getNumberArgument(
        argumentsObject,
        'maxSize',
      );

    const result =
      await this.request(
        'read',
        {
          path: targetPath,
          ...(maxSize !== undefined
            ? { maxSize }
            : {}),
        },
      ) as {
        content: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: result.content,
    };
  }

  private async write(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const content =
      this.requireStringArgument(
        argumentsObject,
        'content',
      );

    const result =
      await this.request(
        'write',
        {
          path: targetPath,
          content,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Fichier écrit : ${result.fullPath}`,
    };
  }

  private async create(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const result =
      await this.request(
        'create',
        {
          path: targetPath,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Fichier créé : ${result.fullPath}`,
    };
  }

  private async modify(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const operation =
      this.getStringArgument(
        argumentsObject,
        'operation',
      ) as IFilesystemModifyOptions['operation'];

    if (
      operation !== 'replace' &&
      operation !== 'insert' &&
      operation !== 'delete'
    ) {
      throw new Error(
        'L’opération "modify" doit être "replace", "insert" ou "delete".',
      );
    }

    const file =
      await this.request(
        'read',
        {
          path: targetPath,
        },
      ) as {
        content: string;
        [key: string]: unknown;
      };

    let content = file.content;

    switch (operation) {
      case 'replace': {
        const search =
          this.requireStringArgument(
            argumentsObject,
            'search',
          );

        const replacement =
          this.getStringArgument(
            argumentsObject,
            'replacement',
            '',
          );

        const index =
          content.indexOf(search);

        if (index === -1) {
          throw new Error(
            `Le texte à remplacer est introuvable dans "${targetPath}".`,
          );
        }

        content =
          content.slice(0, index) +
          replacement +
          content.slice(
            index + search.length,
          );

        break;
      }

      case 'insert': {
        const insertion =
          this.requireStringArgument(
            argumentsObject,
            'content',
          );

        const search =
          this.getStringArgument(
            argumentsObject,
            'search',
          );

        if (search) {
          const index =
            content.indexOf(search);

          if (index === -1) {
            throw new Error(
              `Le texte cible est introuvable dans "${targetPath}".`,
            );
          }

          const position =
            this.getStringArgument(
              argumentsObject,
              'position',
              'after',
            );

          if (
            position !== 'before' &&
            position !== 'after'
          ) {
            throw new Error(
              'La position doit être "before" ou "after".',
            );
          }

          const insertionIndex =
            position === 'before'
              ? index
              : index + search.length;

          content =
            content.slice(
              0,
              insertionIndex,
            ) +
            insertion +
            content.slice(
              insertionIndex,
            );

          break;
        }

        const line =
          this.getNumberArgument(
            argumentsObject,
            'line',
          );

        if (line === undefined) {
          throw new Error(
            'Une opération "insert" nécessite "search" ou "line".',
          );
        }

        const lines =
          content.split('\n');

        if (
          line < 1 ||
          line > lines.length + 1
        ) {
          throw new Error(
            `Numéro de ligne invalide : ${line}.`,
          );
        }

        lines.splice(
          line - 1,
          0,
          insertion,
        );

        content =
          lines.join('\n');

        break;
      }

      case 'delete': {
        const search =
          this.getStringArgument(
            argumentsObject,
            'search',
          );

        if (search) {
          const index =
            content.indexOf(search);

          if (index === -1) {
            throw new Error(
              `Le texte à supprimer est introuvable dans "${targetPath}".`,
            );
          }

          content =
            content.slice(0, index) +
            content.slice(
              index + search.length,
            );

          break;
        }

        const startLine =
          this.getNumberArgument(
            argumentsObject,
            'startLine',
          );

        const endLine =
          this.getNumberArgument(
            argumentsObject,
            'endLine',
            startLine,
          );

        if (
          startLine === undefined ||
          endLine === undefined
        ) {
          throw new Error(
            'Une opération "delete" nécessite "search" ou "startLine".',
          );
        }

        const lines =
          content.split('\n');

        if (
          startLine < 1 ||
          endLine < startLine ||
          startLine > lines.length
        ) {
          throw new Error(
            `Plage de lignes invalide : ${startLine}-${endLine}.`,
          );
        }

        lines.splice(
          startLine - 1,
          endLine - startLine + 1,
        );

        content =
          lines.join('\n');

        break;
      }
    }

    const result =
      await this.request(
        'write',
        {
          path: targetPath,
          content,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: {
        ...result,
        operation,
      },
      stdout: `Fichier modifié : ${result.fullPath}`,
    };
  }

  private async append(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const content =
      this.requireStringArgument(
        argumentsObject,
        'content',
      );

    const result =
      await this.request(
        'append',
        {
          path: targetPath,
          content,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Contenu ajouté : ${result.fullPath}`,
    };
  }

  private async list(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.getStringArgument(
        argumentsObject,
        'path',
        '',
      );

    const result =
      await this.request(
        'list',
        {
          path: targetPath,
        },
      ) as {
        items: Array<{
          name: string;
          isDirectory: boolean;
        }>;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: result.items
        .map(
          (item) =>
            `${item.isDirectory ? '[DIR] ' : '      '}${item.name}`,
        )
        .join('\n'),
    };
  }

  private async search(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const query =
      this.requireStringArgument(
        argumentsObject,
        'query',
      );

    const path =
      this.getStringArgument(
        argumentsObject,
        'path',
        '',
      );

    const content =
      this.getBooleanArgument(
        argumentsObject,
        'content',
        false,
      );

    const maxResults =
      this.getNumberArgument(
        argumentsObject,
        'maxResults',
      );

    const maxFileSize =
      this.getNumberArgument(
        argumentsObject,
        'maxFileSize',
      );

    const result =
      await this.request(
        'search',
        {
          query,
          ...(path ? { path } : {}),
          content,
          ...(maxResults !== undefined
            ? { maxResults }
            : {}),
          ...(maxFileSize !== undefined
            ? { maxFileSize }
            : {}),
        },
      ) as Array<{
        path: string;
        isDirectory: boolean;
      }>;

    return {
      data: result,
      stdout: result
        .map(
          (item) =>
            `${item.isDirectory ? '[DIR] ' : '      '}${item.path}`,
        )
        .join('\n'),
    };
  }

  private async mkdir(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const result =
      await this.request(
        'mkdir',
        {
          path: targetPath,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Répertoire créé : ${result.fullPath}`,
    };
  }

  private async stat(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const result =
      await this.request(
        'stat',
        {
          path: targetPath,
        },
      ) as {
        fullPath: string;
        isDirectory: boolean;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `${result.fullPath} (${result.isDirectory ? 'directory' : 'file'})`,
    };
  }

  private async exists(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const result =
      await this.request(
        'exists',
        {
          path: targetPath,
        },
      ) as boolean;

    return {
      data: {
        path: targetPath,
        exists: result,
      },
      stdout: result
        ? `Existe : ${targetPath}`
        : `N'existe pas : ${targetPath}`,
    };
  }

  private async copy(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const sourcePath =
      this.requireStringArgument(
        argumentsObject,
        'path',
      );

    const destinationPath =
      this.requireStringArgument(
        argumentsObject,
        'destination',
      );

    const result =
      await this.request(
        'copy',
        {
          path: sourcePath,
          destination: destinationPath,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Copié : ${result.fullPath}`,
    };
  }

  private async move(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const sourcePath =
      this.requireStringArgument(
        argumentsObject,
        'path',
      );

    const destinationPath =
      this.requireStringArgument(
        argumentsObject,
        'destination',
      );

    const result =
      await this.request(
        'move',
        {
          path: sourcePath,
          destination: destinationPath,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Déplacé : ${result.fullPath}`,
    };
  }

  private async rename(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const newName =
      this.requireStringArgument(
        argumentsObject,
        'newName',
      );

    const result =
      await this.request(
        'rename',
        {
          path: targetPath,
          newName,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Renommé : ${result.fullPath}`,
    };
  }

  private async delete(
    argumentsObject: Record<string, unknown>,
  ): Promise<IFilesystemOperationResult> {
    const targetPath =
      this.requirePath(argumentsObject);

    const result =
      await this.request(
        'delete',
        {
          path: targetPath,
        },
      ) as {
        fullPath: string;
        [key: string]: unknown;
      };

    return {
      data: result,
      stdout: `Supprimé : ${result.fullPath}`,
    };
  }

  private requirePath(
    argumentsObject: Record<string, unknown>,
  ): string {
    const path =
      this.getStringArgument(
        argumentsObject,
        'path',
      );

    if (!path) {
      throw new Error(
        'Paramètre "path" manquant pour l’opération filesystem.',
      );
    }

    return path;
  }

  private requireStringArgument(
    argumentsObject: Record<string, unknown>,
    name: string,
  ): string {
    const value =
      this.getStringArgument(
        argumentsObject,
        name,
      );

    if (!value) {
      throw new Error(
        `Paramètre "${name}" manquant.`,
      );
    }

    return value;
  }

  private getStringArgument(
    argumentsObject: Record<string, unknown>,
    name: string,
    fallback = '',
  ): string {
    const value =
      argumentsObject[name];

    return typeof value === 'string'
      ? value.trim()
      : fallback;
  }

  private getNumberArgument(
    argumentsObject: Record<string, unknown>,
    name: string,
    fallback?: number,
  ): number | undefined {
    const value =
      argumentsObject[name];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    return fallback;
  }

  private getBooleanArgument(
    argumentsObject: Record<string, unknown>,
    name: string,
    fallback = false,
  ): boolean {
    const value =
      argumentsObject[name];

    return typeof value === 'boolean'
      ? value
      : fallback;
  }

  private failure(
    call: IToolCall,
    code: string,
    message: string,
    startTime: number,
  ): IToolResult {
    return {
      callId: call.id,
      toolId: this.toolId,
      status: 'failed',
      error: {
        code,
        message,
      },
      durationMs:
        Date.now() - startTime,
      timestamp:
        new Date().toISOString(),
    };
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}