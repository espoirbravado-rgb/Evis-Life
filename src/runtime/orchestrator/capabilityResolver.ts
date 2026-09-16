
/**
 * EVIS RUNTIME — CAPABILITY RESOLVER
 *
 * Responsibility:
 * - Use the model to determine which declared capabilities are required
 *   to fulfil a user goal.
 * - Validate the model's capability selection against the declared
 *   capability contract.
 *
 * This component does NOT:
 * - resolve skills;
 * - resolve tools;
 * - resolve providers;
 * - authorize operations;
 * - execute tools;
 * - grant permissions;
 * - perform keyword or regex routing.
 *
 * Architectural flow:
 *
 * User Goal
 *    ↓
 * Model understands the goal
 *    ↓
 * CapabilityResolver
 *    ↓
 * Required Capabilities
 *
 * General knowledge/conversation does not require a capability.
 * A capability is required only when the goal needs an operation outside
 * the model's normal reasoning/generation ability.
 */

import type {
  CapabilityId,
  ICapability,
} from '../types/domain';

import type {
  IProviderDriver,
} from '../registries/providerRegistry';

// -----------------------------------------------------------------------------
// Resolution Contract
// -----------------------------------------------------------------------------

export type CapabilityResolutionStatus =
  | 'resolved'
  | 'failed';

export interface ICapabilityResolution {
  status: CapabilityResolutionStatus;

  /**
   * Capabilities determined to be necessary.
   *
   * An empty array with status "resolved" means:
   * the goal requires no external/runtime capability.
   */
  requiredCapabilities: CapabilityId[];

  explanation?: string;

  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// -----------------------------------------------------------------------------
// Structured Response Parsing
// -----------------------------------------------------------------------------

interface ICapabilityPlannerResponse {
  requiredCapabilities: unknown;
  explanation?: unknown;
}

/**
 * Extracts the JSON object returned by a model.
 *
 * This parser exists only as a compatibility boundary for providers that
 * return JSON surrounded by incidental text.
 *
 * It does not perform capability inference.
 */
function parsePlannerResponse(
  content: string
): ICapabilityPlannerResponse | undefined {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed) as ICapabilityPlannerResponse;
  } catch {
    // Some providers may still surround structured output with markdown
    // fences or incidental text. Recover the outermost JSON object.
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end < start) {
    return undefined;
  }

  try {
    return JSON.parse(
      trimmed.slice(start, end + 1)
    ) as ICapabilityPlannerResponse;
  } catch {
    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Capability Resolver
// -----------------------------------------------------------------------------

export class CapabilityResolver {
  static async resolve(options: {
    goal: string;
    capabilities: ICapability[];
    driver: IProviderDriver;
    modelId: string;
    signal?: AbortSignal;
  }): Promise<ICapabilityResolution> {
    const capabilityList = options.capabilities
      .map(
        (capability) =>
          `- ${capability.id}: ${capability.description}`
      )
      .join('\n');

    let result;

    try {
      result = await options.driver.generate({
        modelId: options.modelId,
        signal: options.signal,
        tools: [],
        responseFormat: 'json',

        systemPrompt: [
          'Tu es le planificateur de capacités d’Evis.',
          '',
          'Ta responsabilité est uniquement de déterminer quelles capacités',
          'déclarées sont nécessaires pour accomplir le but de l’utilisateur.',
          '',
          'Tu ne dois pas exécuter d’action.',
          'Tu ne dois pas répondre à l’utilisateur.',
          'Tu ne dois pas sélectionner de skill, tool ou provider.',
          'Tu ne dois pas inventer de capacité.',
          '',
          'Une demande de connaissance générale, d’explication, de définition,',
          'de conversation ou de raisonnement qui ne nécessite aucune opération',
          'externe doit produire une liste vide.',
          '',
          'Une capability doit être sélectionnée uniquement lorsque le but',
          'nécessite réellement l’opération correspondante.',
          '',
          'Règles importantes :',
          '- file.* uniquement pour une opération réelle sur des fichiers.',
          '- terminal.* uniquement pour une exécution réelle dans le terminal.',
          '- web.* uniquement lorsqu’une opération Web est réellement demandée',
          '  ou nécessaire.',
          '- code.analyze uniquement lorsqu’un code réel doit être analysé.',
          '- code.execute uniquement lorsqu’une exécution réelle de code',
          '  est demandée.',
          '- code.test uniquement lorsqu’une suite de tests doit être exécutée.',
          '- memory.* uniquement lorsqu’une opération réelle de mémoire',
          '  persistante est nécessaire.',
          '',
          'Exemples :',
          '',
          'Demande: "Explique TypeScript."',
          '→ {"requiredCapabilities":[],"explanation":"Question conceptuelle sans opération externe."}',
          '',
          'Demande: "Lis package.json."',
          '→ {"requiredCapabilities":["file.read"],"explanation":"Lecture réelle d’un fichier demandée."}',
          '',
          'Demande: "Crée notes.md."',
          '→ {"requiredCapabilities":["file.create","file.write"],"explanation":"Création puis écriture d’un fichier demandées."}',
          '',
          'Demande: "Cherche la documentation officielle de TypeScript."',
          '→ {"requiredCapabilities":["web.search"],"explanation":"Une recherche Web réelle est nécessaire."}',
          '',
          'Réponds uniquement avec un objet JSON valide :',
          '{"requiredCapabilities":["capability.id"],"explanation":"..."}',
          '',
          'CAPACITÉS DÉCLARÉES :',
          capabilityList,
        ].join('\n'),

        messages: [
          {
            role: 'user',
            content: options.goal,
          },
        ],
      });
    } catch (error) {
      return {
        status: 'failed',
        requiredCapabilities: [],
        error: {
          code: 'capability_planner_execution_failed',
          message: 'Capability planner execution failed.',
          details: error,
        },
      };
    }

    if (result.error) {
      return {
        status: 'failed',
        requiredCapabilities: [],
        error: {
          code: 'capability_planner_provider_error',
          message: 'The capability planner provider returned an error.',
          details: result.error,
        },
      };
    }

    const parsed = parsePlannerResponse(result.content);

    if (!parsed) {
      return {
        status: 'failed',
        requiredCapabilities: [],
        error: {
          code: 'capability_planner_invalid_json',
          message:
            'The capability planner did not return a valid structured response.',
        },
      };
    }

    if (!Array.isArray(parsed.requiredCapabilities)) {
      return {
        status: 'failed',
        requiredCapabilities: [],
        error: {
          code: 'capability_planner_invalid_capability_list',
          message:
            'The capability planner response does not contain a valid capability list.',
        },
      };
    }

    const knownCapabilities = new Map(
      options.capabilities.map(
        (capability) => [capability.id, capability]
      )
    );

    const unknownCapabilities: unknown[] = [];

    for (const id of parsed.requiredCapabilities) {
      if (
        typeof id !== 'string' ||
        !knownCapabilities.has(id)
      ) {
        unknownCapabilities.push(id);
      }
    }

    /**
     * Unknown capability identifiers are an invalid planner result.
     *
     * Silently removing them would turn a planner error into an apparently
     * valid but incomplete resolution.
     */
    if (unknownCapabilities.length > 0) {
      return {
        status: 'failed',
        requiredCapabilities: [],
        error: {
          code: 'capability_planner_unknown_capability',
          message:
            'The capability planner returned one or more undeclared capability identifiers.',
          details: {
            unknownCapabilities,
          },
        },
      };
    }

    const requiredCapabilities = [
      ...new Set(
        parsed.requiredCapabilities as CapabilityId[]
      ),
    ];

    return {
      status: 'resolved',
      requiredCapabilities,
      explanation:
        typeof parsed.explanation === 'string'
          ? parsed.explanation
          : undefined,
    };
  }
}

