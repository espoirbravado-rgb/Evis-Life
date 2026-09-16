import { ITool } from '../types';

export interface IExecutableTool extends ITool {
  execute: (args: Record<string, any>) => Promise<{
    success: boolean;
    result?: any;
    error?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  }>;
}

export class ToolRegistry {
  private static tools: Map<string, IExecutableTool> = new Map();

  static initialize() {
    if (this.tools.size > 0) return;

    // 1. Tool: write_desktop_note
    this.registerTool({
      id: 'write_desktop_note',
      name: 'Write Desktop Note',
      description: 'Crée ou écrit physiquement une note textuelle sur le Bureau Linux (/home/junior/Desktop).',
      riskLevel: 'safe',
      category: 'file',
      requiredPermission: 'perm-desktop-write',
      parameters: {
        title: { type: 'string', description: 'Titre ou nom de la note (ex: Note_Reunion, Todo)' },
        content: { type: 'string', description: 'Contenu textuel de la note' },
      },
      execute: async (args) => {
        const content = String(args.content || '').trim();
        const title = args.title ? String(args.title).trim() : undefined;

        if (!content) {
          return {
            success: false,
            error: 'Le contenu de la note ne peut pas être vide.',
            stderr: 'Missing note content',
            exitCode: 1,
          };
        }

        try {
          const res = await fetch('/api/fs/desktop-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return {
              success: false,
              error: errData.error || `Erreur HTTP ${res.status}`,
              stderr: errData.error,
              exitCode: 1,
            };
          }

          const data = await res.json();
          return {
            success: true,
            result: data,
            stdout: `[EVIS HOST BRIDGE] Note créée avec succès sur le bureau :\nFichier : ${data.fullPath}\nTaille : ${data.size} octets\nDate : ${data.createdAt}`,
            exitCode: 0,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.message,
            stderr: `Network / Host Bridge error: ${err.message}`,
            exitCode: 1,
          };
        }
      },
    });

    // 2. Tool: write_file
    this.registerTool({
      id: 'write_file',
      name: 'Write Workspace File',
      description: 'Écrit ou modifie un fichier dans le workspace du projet.',
      riskLevel: 'prompt',
      category: 'file',
      requiredPermission: 'fs-scope',
      parameters: {
        path: { type: 'string', description: 'Chemin relatif du fichier dans le projet' },
        content: { type: 'string', description: 'Contenu textuel du fichier' },
      },
      execute: async (args) => {
        const targetPath = String(args.path || '').trim();
        const content = String(args.content ?? '');

        if (!targetPath) {
          return { success: false, error: 'Chemin de fichier manquant', exitCode: 1 };
        }

        try {
          const res = await fetch('/api/fs/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath, content }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'Erreur écriture fichier', exitCode: 1 };
          }

          const data = await res.json();
          return {
            success: true,
            result: data,
            stdout: `[EVIS HOST BRIDGE] Fichier enregistré : ${data.fullPath || data.path} (${data.size || 0} octets)`,
            exitCode: 0,
          };
        } catch (err: any) {
          return { success: false, error: err.message, exitCode: 1 };
        }
      },
    });

    // 3. Tool: read_file
    this.registerTool({
      id: 'read_file',
      name: 'Read Workspace / Desktop File',
      description: 'Lit le contenu d’un fichier du workspace ou du bureau.',
      riskLevel: 'safe',
      category: 'file',
      requiredPermission: 'fs-scope',
      parameters: {
        path: { type: 'string', description: 'Chemin relatif ou absolu du fichier' },
      },
      execute: async (args) => {
        const targetPath = String(args.path || '').trim();
        if (!targetPath) {
          return { success: false, error: 'Chemin requis', exitCode: 1 };
        }

        try {
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(targetPath)}`);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'Erreur lecture', exitCode: 1 };
          }
          const data = await res.json();
          return {
            success: true,
            result: data,
            stdout: data.content,
            exitCode: 0,
          };
        } catch (err: any) {
          return { success: false, error: err.message, exitCode: 1 };
        }
      },
    });

    // 4. Tool: list_dir
    this.registerTool({
      id: 'list_dir',
      name: 'List Directory Files',
      description: 'Liste le contenu d’un dossier du projet ou du bureau.',
      riskLevel: 'safe',
      category: 'file',
      requiredPermission: 'fs-scope',
      parameters: {
        dir: { type: 'string', description: 'Dossier relatif ou "desktop:"' },
      },
      execute: async (args) => {
        const targetDir = String(args.dir || '').trim();
        try {
          const res = await fetch(`/api/fs/list?dir=${encodeURIComponent(targetDir)}`);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'Erreur list_dir', exitCode: 1 };
          }
          const data = await res.json();
          const lines = (data.items || []).map(
            (item: any) => `${item.isDirectory ? '[DIR] ' : '      '} ${item.name} (${item.size || 0} bytes)`
          );
          return {
            success: true,
            result: data,
            stdout: lines.join('\n') || '(Dossier vide)',
            exitCode: 0,
          };
        } catch (err: any) {
          return { success: false, error: err.message, exitCode: 1 };
        }
      },
    });

    // 5. Tool: run_command
    this.registerTool({
      id: 'run_command',
      name: 'Execute Shell Command',
      description: 'Exécute une commande dans le shell Linux (/bin/bash).',
      riskLevel: 'prompt',
      category: 'terminal',
      requiredPermission: 'term-exec',
      parameters: {
        command: { type: 'string', description: 'La commande bash à exécuter' },
        cwd: { type: 'string', description: 'Répertoire de travail optionnel' },
      },
      execute: async (args) => {
        const command = String(args.command || '').trim();
        if (!command) {
          return { success: false, error: 'Commande requise', exitCode: 1 };
        }

        try {
          const res = await fetch('/api/terminal/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, cwd: args.cwd }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return {
              success: false,
              error: errData.error || 'Erreur execution shell',
              exitCode: 1,
            };
          }

          const data = await res.json();
          return {
            success: data.exitCode === 0,
            result: data,
            stdout: data.stdout,
            stderr: data.stderr,
            exitCode: data.exitCode,
          };
        } catch (err: any) {
          return { success: false, error: err.message, exitCode: 1 };
        }
      },
    });

    // 6. Tool: save_knowledge
    this.registerTool({
      id: 'save_knowledge',
      name: 'Save Knowledge Card',
      description: 'Enregistre une fiche dans le coffre de mémoire du projet.',
      riskLevel: 'safe',
      category: 'memory',
      requiredPermission: 'mem-save',
      parameters: {
        title: { type: 'string', description: 'Titre de la fiche' },
        category: { type: 'string', description: 'Catégorie (note, decision, summary, constraint)' },
        content: { type: 'string', description: 'Contenu détaillé de la note' },
        tags: { type: 'array', description: 'Mots-clés associés' },
      },
      execute: async (args) => {
        const title = String(args.title || '').trim();
        const content = String(args.content || '').trim();
        if (!title || !content) {
          return { success: false, error: 'Titre et contenu requis', exitCode: 1 };
        }

        return {
          success: true,
          result: {
            id: `k-${Date.now()}`,
            title,
            category: args.category || 'note',
            content,
            tags: Array.isArray(args.tags) ? args.tags : ['auto'],
            updatedAt: new Date().toISOString(),
          },
          stdout: `[EVIS MEMORY] Fiche de connaissance enregistrée : "${title}"`,
          exitCode: 0,
        };
      },
    });

    // 7. Tool: search_web
    this.registerTool({
      id: 'search_web',
      name: 'Web Search',
      description: 'Recherche documentaire externe sur le Web.',
      riskLevel: 'prompt',
      category: 'web',
      requiredPermission: 'web-perm',
      parameters: {
        query: { type: 'string', description: 'Requête de recherche' },
      },
      execute: async () => {
        return {
          success: false,
          error: 'Accès Internet actuellement restreint en mode local offline-first.',
          stderr: 'Web search is disabled in offline mode.',
          exitCode: 1,
        };
      },
    });
  }

  static registerTool(tool: IExecutableTool) {
    this.tools.set(tool.id, tool);
  }

  static getTool(id: string): IExecutableTool | undefined {
    this.initialize();
    return this.tools.get(id);
  }

  static getAllTools(): IExecutableTool[] {
    this.initialize();
    return Array.from(this.tools.values());
  }

  static getToolsByCategory(category: string): IExecutableTool[] {
    this.initialize();
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }
}
