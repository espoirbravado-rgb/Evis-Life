import { ISkill } from '../types';
import { ToolRegistry } from './toolRegistry';

export interface IIntentAnalysis {
  isActionable: boolean;
  intentType:
    | 'desktop_note'
    | 'file_write'
    | 'file_read'
    | 'file_list'
    | 'terminal_exec'
    | 'web_search'
    | 'memory_save'
    | 'js_tutor'
    | 'conversational';
  actionDescription: string;
  targetSkillId: string;
  targetSkillName: string;
  targetToolId: string;
  targetToolName: string;
  canExecute: boolean;
  pointDeRupture: boolean;
  breakReason?: string;
  extractedArgs?: Record<string, any>;
  guidance?: string;
}

export class IntentRouter {
  /**
   * Analyse le prompt utilisateur pour classifier son intention
   * et vérifier la disponibilité du skill, de l'outil et des permissions.
   */
  static analyze(
    prompt: string,
    activeSkillIds: string[],
    skills: ISkill[]
  ): IIntentAnalysis {
    const text = prompt.trim();
    const lower = text.toLowerCase();

    // 1. INTENT : Écriture de Note sur le Bureau Linux
    const isDesktopNote =
      /(écris|ecris|crée|cree|mets|ajoute|laisse|fais|write|create|put|add).*?(note|rappel|fichier).*?(bureau|desktop)/i.test(
        lower
      ) ||
      /(note|rappel).*?(sur|on).*?(mon\s+bureau|le\s+bureau|desktop)/i.test(lower);

    if (isDesktopNote) {
      // Déterminer le contenu et titre de la note
      let noteContent = '';
      let noteTitle: string | undefined;

      // 1. Titre explicite (ex: intitulée "Reunion", nommée "Rappel")
      const titleMatch = text.match(/(?:intitulée?|nommée?|called|titled|named)\s+["'«]?([^"'»\n,]+)["'»]?/i);
      if (titleMatch && titleMatch[1]) {
        noteTitle = titleMatch[1].trim();
      }

      // 2. Contenu après formules explicites ("qui dit", "disant", "saying", ":")
      const quiDitMatch = text.match(/(?:qui\s+dit|disant|avec\s+le\s+texte|avec\s+ceci|contenant|saying|with\s+content|with\s+text)\s*[:：]?\s*(.*)$/i);
      const colonMatch = text.match(/(?:bureau|desktop)\s*[:：\-]\s*(.*)$/i);

      if (quiDitMatch && quiDitMatch[1]) {
        noteContent = quiDitMatch[1].replace(/^["'«]|["'»]$/g, '').trim();
      } else if (colonMatch && colonMatch[1]) {
        noteContent = colonMatch[1].replace(/^["'«]|["'»]$/g, '').trim();
      } else {
        // Recherche de guillemets qui ne sont pas le titre
        const quotesMatch = text.match(/["'«]([^"'»]+)["'»]/);
        if (quotesMatch && quotesMatch[1] && quotesMatch[1].trim() !== noteTitle) {
          noteContent = quotesMatch[1].trim();
        } else {
          // Enlever la formule de commande pour ne garder que le message utile
          const cleaned = text
            .replace(/^(s'il te plaît|stp|peux-tu|merci de|veux-tu|écris-moi|ecris-moi|écris|ecris|crée-moi|cree-moi|crée|cree|write|create)\s+/i, '')
            .replace(/^(une|la|a)\s+note\s+(sur\s+(mon|le)\s+bureau|on\s+my\s+desktop)\s*(qui dit|disant|saying|:|pour)?\s*/i, '');
          noteContent = cleaned.trim() || 'Note créée via Evis Workspace';
        }
      }

      const targetSkillId = 'file-system';
      const targetSkill = skills.find((s) => s.id === targetSkillId || s.id === 'desktop-notes');
      const isSkillActive = activeSkillIds.includes(targetSkillId) || activeSkillIds.includes('desktop-notes');
      const tool = ToolRegistry.getTool('write_desktop_note');

      // Vérifier permission
      const permGranted = targetSkill?.permissions.find((p) => p.id === 'perm-desktop-write' || p.id === 'fs-scope')?.granted ?? true;

      const pointDeRupture = !isSkillActive || !tool || !permGranted;
      let breakReason: string | undefined;
      if (!isSkillActive) {
        breakReason = `La compétence "${targetSkill?.name || 'Explorateur de Fichiers & Bureau'}" n'est pas activée dans cette session.`;
      } else if (!permGranted) {
        breakReason = `La permission d'écriture sur le système de fichiers est refusée pour cette compétence.`;
      } else if (!tool) {
        breakReason = `L'outil d'écriture de note "write_desktop_note" n'est pas disponible.`;
      }

      return {
        isActionable: true,
        intentType: 'desktop_note',
        actionDescription: 'Écrire une note physique sur le Bureau (/home/junior/Desktop)',
        targetSkillId: targetSkill?.id || targetSkillId,
        targetSkillName: targetSkill?.name || 'Explorateur de Fichiers & Bureau',
        targetToolId: 'write_desktop_note',
        targetToolName: 'Write Desktop Note',
        canExecute: !pointDeRupture,
        pointDeRupture,
        breakReason,
        extractedArgs: {
          title: noteTitle,
          content: noteContent,
        },
        guidance: 'Activez la compétence "Explorateur de Fichiers" dans le volet latéral pour autoriser les écritures.',
      };
    }

    // 2. INTENT : Exécution de Commande Terminal Shell
    const isTerminal =
      /(lance|exécute|execute|run|tape)\s+(la\s+commande|le\s+script|dans\s+le\s+terminal|bash|sh|cmd)\s*[:：]?\s*(.*)/i.test(
        lower
      ) ||
      /^(\$|bash:|sh:)\s+(.+)/i.test(text);

    if (isTerminal) {
      let command = '';
      const execMatch = text.match(/(?:commande|script|terminal|bash|sh)\s*[:：]?\s*[`"']?([^`"'\n]+)[`"']?/i);
      const dollarMatch = text.match(/^[\$]\s*(.+)/);
      if (dollarMatch) command = dollarMatch[1].trim();
      else if (execMatch) command = execMatch[1].trim();
      else command = text.trim();

      const targetSkillId = 'terminal';
      const targetSkill = skills.find((s) => s.id === targetSkillId);
      const isSkillActive = activeSkillIds.includes(targetSkillId);
      const tool = ToolRegistry.getTool('run_command');
      const permGranted = targetSkill?.permissions.find((p) => p.id === 'term-exec')?.granted ?? true;

      const pointDeRupture = !isSkillActive || !tool || !permGranted;
      let breakReason: string | undefined;
      if (!isSkillActive) {
        breakReason = `La compétence "Terminal Runner" n'est pas activée dans cette session.`;
      } else if (!permGranted) {
        breakReason = `La permission d'exécution de commandes système est désactivée.`;
      } else if (!tool) {
        breakReason = `L'outil d'exécution shell "run_command" n'est pas configuré.`;
      }

      return {
        isActionable: true,
        intentType: 'terminal_exec',
        actionDescription: `Exécuter la commande Linux : "${command}"`,
        targetSkillId,
        targetSkillName: targetSkill?.name || 'Terminal Runner',
        targetToolId: 'run_command',
        targetToolName: 'Execute Shell Command',
        canExecute: !pointDeRupture,
        pointDeRupture,
        breakReason,
        extractedArgs: { command },
        guidance: 'Activez la compétence "Terminal Runner" dans le panneau latéral pour autoriser l’exécution.',
      };
    }

    // 3. INTENT : Recherche Web
    const isWebSearch =
      /(cherche|recherche|trouve|search|google)\s+(sur\s+le\s+web|sur\s+internet|en\s+ligne|online|web)/i.test(
        lower
      ) ||
      lower.startsWith('cherche sur google') ||
      lower.startsWith('recherche sur google');

    if (isWebSearch) {
      const targetSkillId = 'web-search';
      const targetSkill = skills.find((s) => s.id === targetSkillId);
      const isSkillActive = activeSkillIds.includes(targetSkillId);
      const tool = ToolRegistry.getTool('search_web');
      const permGranted = targetSkill?.permissions.find((p) => p.id === 'web-perm')?.granted ?? false;

      const pointDeRupture = !isSkillActive || !tool || !permGranted;
      let breakReason: string | undefined;
      if (!isSkillActive) {
        breakReason = `La compétence "Web Search" n'est pas activée pour cette session.`;
      } else if (!permGranted) {
        breakReason = `La permission réseau "Accès HTTP Externe" n'est pas accordée.`;
      } else {
        breakReason = `L'accès externe au Web est désactivé en mode local offline-first.`;
      }

      return {
        isActionable: true,
        intentType: 'web_search',
        actionDescription: 'Recherche d’informations en ligne sur le Web',
        targetSkillId,
        targetSkillName: targetSkill?.name || 'Web Search',
        targetToolId: 'search_web',
        targetToolName: 'Web Search',
        canExecute: !pointDeRupture,
        pointDeRupture,
        breakReason,
        guidance: 'Activez la compétence "Web Search" et accordez la permission réseau pour tenter des requêtes en ligne.',
      };
    }

    // 4. INTENT : Écriture de Fichier dans le Projet Workspace
    const isFileWrite =
      /(crée|cree|écris|ecris|génère|genere|enregistre|sauvegarde|write|save)\s+(un\s+fichier|le\s+fichier|dans\s+le\s+fichier|file)\s+([^\s]+)/i.test(
        lower
      );

    if (isFileWrite) {
      const match = text.match(/(?:fichier|file)\s+([a-zA-Z0-9_\-\.\/]+)/i);
      const filePath = match ? match[1] : 'nouveau_fichier.txt';

      const targetSkillId = 'file-system';
      const targetSkill = skills.find((s) => s.id === targetSkillId);
      const isSkillActive = activeSkillIds.includes(targetSkillId);
      const tool = ToolRegistry.getTool('write_file');
      const permGranted = targetSkill?.permissions.find((p) => p.id === 'fs-scope')?.granted ?? true;

      const pointDeRupture = !isSkillActive || !tool || !permGranted;
      let breakReason: string | undefined;
      if (!isSkillActive) {
        breakReason = `La compétence "File Explorer" n'est pas activée dans cette session.`;
      } else if (!permGranted) {
        breakReason = `La permission d'écriture dans le workspace n'est pas accordée.`;
      } else if (!tool) {
        breakReason = `L'outil d'écriture "write_file" n'est pas disponible.`;
      }

      return {
        isActionable: true,
        intentType: 'file_write',
        actionDescription: `Créer ou modifier le fichier workspace "${filePath}"`,
        targetSkillId,
        targetSkillName: targetSkill?.name || 'File Explorer',
        targetToolId: 'write_file',
        targetToolName: 'Write Workspace File',
        canExecute: !pointDeRupture,
        pointDeRupture,
        breakReason,
        extractedArgs: { path: filePath, content: '' },
      };
    }

    // 5. INTENT : Sauvegarde de Connaissance / Vault
    const isMemorySave =
      /(enregistre|sauvegarde|garde|mémorise|memorise)\s+(cette\s+décision|cette\s+note|dans\s+la\s+mémoire|dans\s+le\s+vault|dans\s+le\s+coffre)/i.test(
        lower
      );

    if (isMemorySave) {
      const targetSkillId = 'memory-curator';
      const targetSkill = skills.find((s) => s.id === targetSkillId);
      const isSkillActive = activeSkillIds.includes(targetSkillId);
      const tool = ToolRegistry.getTool('save_knowledge');

      const pointDeRupture = !isSkillActive || !tool;
      let breakReason: string | undefined;
      if (!isSkillActive) {
        breakReason = `La compétence "Knowledge Vault Curator" n'est pas activée dans cette session.`;
      }

      return {
        isActionable: true,
        intentType: 'memory_save',
        actionDescription: 'Enregistrer une note dans le coffre de mémoire du projet',
        targetSkillId,
        targetSkillName: targetSkill?.name || 'Knowledge Vault Curator',
        targetToolId: 'save_knowledge',
        targetToolName: 'Save Knowledge Card',
        canExecute: !pointDeRupture,
        pointDeRupture,
        breakReason,
      };
    }

    // 6. INTENT : Par défaut, Conversationnel / Explication
    const isJsTutorRelated =
      activeSkillIds.includes('js-tutor') &&
      /(javascript|js|closure|async|promise|prototype|event loop|variable|fonction)/i.test(lower);

    return {
      isActionable: false,
      intentType: isJsTutorRelated ? 'js_tutor' : 'conversational',
      actionDescription: 'Génération de réponse textuelle ou tutorat',
      targetSkillId: isJsTutorRelated ? 'js-tutor' : '',
      targetSkillName: isJsTutorRelated ? 'JavaScript Tutor' : '',
      targetToolId: '',
      targetToolName: '',
      canExecute: true,
      pointDeRupture: false,
    };
  }

  /**
   * Formate un message de Point de Rupture standardisé et pédagogique
   * lorsqu'une action est refusée par manque d'outil, de skill ou de permission.
   */
  static generateBreakMessage(analysis: IIntentAnalysis): string {
    return (
      `⚠️ **Point de rupture : Action impossible sans outil adéquat**\n\n` +
      `Désolé, je n'ai pas trouvé les outils nécessaires ou les permissions requises pour accomplir une tâche pareille.\n\n` +
      `• **Action demandée** : ${analysis.actionDescription}\n` +
      `• **Compétence requise** : **${analysis.targetSkillName}**\n` +
      `• **Outil requis** : \`${analysis.targetToolName || analysis.targetToolId}\`\n` +
      `• **Diagnostic** : ${analysis.breakReason || 'Compétence non activée ou restreinte.'}\n\n` +
      `💡 **Comment débloquer cette action ?**\n` +
      `1. Ouvrez le volet latéral droit (**Context Drawer**).\n` +
      `2. Accédez à l'onglet **Skills**.\n` +
      `3. Activez la compétence **${analysis.targetSkillName}** pour cette session de travail.\n\n` +
      `*Le système n'exécute aucune action fictive et ne génère pas de faux résultats sans outil réel.*`
    );
  }
}
