/**
 * EVIS RUNTIME — CONTEXT MANAGER
 *
 * Responsible for assembling the precise context given to the model
 * for inference.
 *
 * Architectural responsibility:
 *
 *   Resolved Runtime State
 *          ↓
 *   Context Assembly
 *          ↓
 *   Model Context
 *
 * ContextManager does NOT decide which capabilities or tools are
 * required. That responsibility belongs to the Orchestrator and
 * Capability / Skill / Tool resolution layers.
 *
 * It assembles:
 *   - Core system identity
 *   - Resolved skill instructions
 *   - Resolved resources
 *   - Resolved tool schemas
 *   - Conversation history
 *   - Working-memory navigation context
 *
 * IMPORTANT:
 *
 * - General model reasoning does not require a skill.
 * - Skills do not gate ordinary conversation.
 * - Tools are exposed because they were resolved for the execution,
 *   not because the UI happened to activate a skill.
 * - ContextManager does not execute tools.
 */

import { SkillRegistry } from '../registries/skillRegistry';
import { ToolRegistry } from '../registries/toolRegistry';
import { ResourceRegistry } from '../registries/resourceRegistry';
import type { IWorkingContext } from '../types/memory';
import type {
  CapabilityId,
  IMessage,
  SkillId,
  ToolId,
  IToolParameterSchema,
} from '../types/domain';

export interface IAssembledContext {
  systemPrompt: string;

  tools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: IToolParameterSchema;
    };
  }>;

  messages: IMessage[];

  activeSkillIds: SkillId[];
  activeToolIds: ToolId[];

  metadata: {
    totalActiveSkills: number;
    totalActiveTools: number;
    totalActiveResources: number;
  };
}

export interface IContextAssemblyOptions {
  conversationMessages: IMessage[];

  goal?: string;

  /**
   * Skills explicitly relevant to this execution.
   *
   * These are runtime resolution hints, not UI authorization.
   */
  targetSkillIds?: SkillId[];

  /**
   * Tools already resolved by the orchestration layer.
   *
   * When provided, ContextManager exposes these tools directly.
   * It does not independently resolve additional tools.
   */
  resolvedToolIds?: ToolId[];

  /**
   * Capabilities resolved for this execution.
   *
   * Kept as context metadata so the model context can remain
   * traceable to the execution plan.
   */
  resolvedCapabilities?: CapabilityId[];

  additionalInstructions?: string;

  workingContext?: IWorkingContext;
}

export class ContextManager {
  private static readonly baseSystemPrompt = `
Tu es Evis, un système d'intelligence artificielle locale et modulaire conçu pour Linux.

Tu es le cerveau central : c'est TOI qui raisonnes, analyses la demande de l'utilisateur et décides s'il faut répondre directement ou utiliser une capacité disponible.

Les skills, tools et providers sont des extensions du runtime. Ils ne remplacent pas ton raisonnement et ne doivent pas être considérés comme nécessaires pour les demandes générales auxquelles tu peux répondre avec tes connaissances et ton raisonnement.

PROTOCOLE DU RUNTIME:

1. COMPRÉHENSION
Analyse la demande de l'utilisateur et détermine ce qui est réellement nécessaire.

2. RAISONNEMENT DIRECT
Si la demande peut être satisfaite avec tes connaissances et ton raisonnement, réponds directement sans demander l'activation artificielle d'une compétence.

3. CAPACITÉ DISPONIBLE
Si une action externe est nécessaire et qu'un outil correspondant est disponible dans les fonctions exposées pour cette exécution, utilise cet outil avec les arguments appropriés.

4. CAPACITÉ ABSENTE
Si une action réelle est nécessaire mais qu'aucun outil correspondant n'est disponible:
- ne simule jamais l'action;
- ne détourne jamais un autre outil pour contourner cette absence;
- indique honnêtement que la capacité requise n'est pas disponible.

5. VÉRACITÉ
Ne prétends jamais qu'une opération physique a été effectuée sans résultat réel provenant du runtime.

6. RÉSULTATS D'OUTILS
Lorsque tu reçois un résultat d'outil, distingue toujours:
- succès réel;
- échec;
- refus;
- confirmation requise;
- résultat partiel.

7. CONTRÔLE CENTRAL
Le modèle raisonne sur le besoin. Le runtime contrôle les capacités, permissions, outils, providers et opérations physiques.
`.trim();

  /**
   * Assembles the full execution context for model inference.
   *
   * ContextManager assembles already-resolved runtime state.
   * It does not perform capability resolution.
   */
  static assembleContext(
    options: IContextAssemblyOptions
  ): IAssembledContext {
    SkillRegistry.initialize();
    ToolRegistry.initialize();
    ResourceRegistry.initialize();

    /*
     * ---------------------------------------------------------------
     * 1. Resolve contextual skills
     * ---------------------------------------------------------------
     *
     * Skills are used here for their instructions/resources.
     * They are not the source of authorization.
     *
     * If no target skills were resolved, no skill instructions are
     * injected. This is valid for ordinary model reasoning.
     */
    const targetSkillIds =
      new Set(
        options.targetSkillIds ?? []
      );

    const resolvedSkills =
      options.targetSkillIds &&
      options.targetSkillIds.length > 0
        ? SkillRegistry.getActive().filter(
            (skill) =>
              targetSkillIds.has(skill.id)
          )
        : [];

    const activeSkillIds =
      resolvedSkills.map(
        (skill) => skill.id
      );

    /*
     * ---------------------------------------------------------------
     * 2. Skill instructions
     * ---------------------------------------------------------------
     */
    const skillInstructions: string[] = [];

    for (const skill of resolvedSkills) {
      if (
        skill.instructions &&
        skill.instructions.trim().length > 0
      ) {
        skillInstructions.push(
          [
            `### Compétence: ${skill.name} (${skill.id})`,
            skill.instructions,
          ].join('\n')
        );
      }
    }

    /*
     * ---------------------------------------------------------------
     * 3. Resources
     * ---------------------------------------------------------------
     *
     * Resources are selected according to resolved skills.
     * Unassociated resources remain globally available when the
     * ResourceRegistry exposes them as such.
     */
    const activeResources =
      ResourceRegistry.getActiveResources().filter(
        (resource) => {
          if (!resource.skillId) {
            return true;
          }

          return activeSkillIds.includes(
            resource.skillId
          );
        }
      );

    const resourceSnippets: string[] = [];

    for (const resource of activeResources) {
      if (
        resource.content &&
        resource.content.trim().length > 0
      ) {
        resourceSnippets.push(
          [
            `[Ressource: ${resource.name} (${resource.type})]`,
            resource.content,
          ].join('\n')
        );
      }
    }

    /*
     * ---------------------------------------------------------------
     * 4. System prompt
     * ---------------------------------------------------------------
     */
    const promptSections: string[] = [
      this.baseSystemPrompt,
    ];

    if (
      options.goal &&
      options.goal.trim().length > 0
    ) {
      promptSections.push(
        [
          '## OBJECTIF COURANT:',
          options.goal,
        ].join('\n')
      );
    }

    if (skillInstructions.length > 0) {
      promptSections.push(
        [
          '## INSTRUCTIONS DES COMPÉTENCES RÉSOLUES:',
          skillInstructions.join('\n\n'),
        ].join('\n')
      );
    }

    if (resourceSnippets.length > 0) {
      promptSections.push(
        [
          '## DOCUMENTS & RESSOURCES DE RÉFÉRENCE:',
          resourceSnippets.join('\n\n'),
        ].join('\n')
      );
    }

    if (
      options.additionalInstructions &&
      options.additionalInstructions.trim().length > 0
    ) {
      promptSections.push(
        [
          '## DIRECTIVES ADDITIONNELLES:',
          options.additionalInstructions,
        ].join('\n')
      );
    }

    /*
     * ---------------------------------------------------------------
     * 5. Working Memory navigation
     * ---------------------------------------------------------------
     */
    if (options.workingContext) {
      const wc =
        options.workingContext;

      const navigationLines = [
        '## NAVIGATION & MÉMOIRE DE TRAVAIL:',
        `- Tâche active : ${wc.currentTask.id} "${wc.currentTask.objective}"`,
        `- Tâche parente : ${
          wc.parentTask
            ? `${wc.parentTask.id} "${wc.parentTask.objective}"`
            : 'Racine'
        }`,
        `- Objectif d'origine : ${wc.originTask.id} "${wc.originTask.objective}"`,
        `- Fil d'Ariane : ${wc.breadcrumbs.join(' > ')}`,
      ];

      if (wc.currentTask.returnTarget) {
        navigationLines.push(
          `- Point de retour garanti : ${wc.currentTask.returnTarget}`
        );
      }

      if (wc.nextAction) {
        navigationLines.push(
          `- Prochaine action planifiée : ${wc.nextAction}`
        );
      }

      promptSections.push(
        navigationLines.join('\n')
      );
    }

    /*
     * ---------------------------------------------------------------
     * 6. Execution metadata
     * ---------------------------------------------------------------
     */
    if (
      options.resolvedCapabilities &&
      options.resolvedCapabilities.length > 0
    ) {
      promptSections.push(
        [
          '## CAPACITÉS RÉSOLUES POUR CETTE EXÉCUTION:',
          options.resolvedCapabilities
            .map(
              (capability) =>
                `- ${capability}`
            )
            .join('\n'),
        ].join('\n')
      );
    }

    /*
     * ---------------------------------------------------------------
     * 7. Resolve already-selected tool definitions
     * ---------------------------------------------------------------
     *
     * The Orchestrator decides which tools belong to this execution.
     * ContextManager only converts their definitions into schemas
     * understood by the model/provider layer.
     */
    const resolvedToolIds =
      options.resolvedToolIds ?? [];

    const physicalTools =
      resolvedToolIds
        .map((toolId) =>
          ToolRegistry.get(toolId)
        )
        .filter(
          (
            tool
          ): tool is NonNullable<
            typeof tool
          > => Boolean(tool)
        );

    /*
     * A missing tool definition is not silently replaced.
     *
     * The Orchestrator should already have validated the tool set.
     * If one disappears between resolution and context assembly,
     * fail explicitly rather than silently exposing a different tool.
     */
    if (
      physicalTools.length !==
      resolvedToolIds.length
    ) {
      const resolvedIds =
        new Set(
          physicalTools.map(
            (tool) => tool.id
          )
        );

      const missingToolIds =
        resolvedToolIds.filter(
          (toolId) =>
            !resolvedIds.has(toolId)
        );

      throw new Error(
        `Resolved tool definitions are unavailable: ${missingToolIds.join(', ')}`
      );
    }

    const modelToolSchemas =
      ToolRegistry.toModelToolSchemas(
        physicalTools
      );

    const formattedTools =
      modelToolSchemas.map(
        (tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters:
              tool.parameters
          },
        })
      );

    /*
     * ---------------------------------------------------------------
     * 8. Final context
     * ---------------------------------------------------------------
     */
    return {
      systemPrompt:
        promptSections.join(
          '\n\n'
        ),

      tools: formattedTools,

      messages:
        options.conversationMessages,

      activeSkillIds,

      activeToolIds:
        resolvedToolIds,

      metadata: {
        totalActiveSkills:
          activeSkillIds.length,

        totalActiveTools:
          formattedTools.length,

        totalActiveResources:
          activeResources.length,
      },
    };
  }
}