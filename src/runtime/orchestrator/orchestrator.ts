
/**
 * EVIS RUNTIME — ORCHESTRATOR
 *
 * Central coordinator of the Evis runtime.
 *
 * Architectural flow:
 *
 * User Goal
 *    ↓
 * Capability Resolution
 *    ↓
 * Capability Registry
 *    ↓
 * Skill Resolution
 *    ↓
 * Tool Resolution
 *    ↓
 * Provider Resolution
 *    ↓
 * Context Assembly
 *    ↓
 * Runtime Context
 *    ↓
 * Agent Loop
 *    ↓
 * Tool Executor
 *    ↓
 * Real Tool Implementation
 *    ↓
 * Verification / Result
 *
 * Important invariants:
 *
 * - General knowledge and conversation do not require a skill.
 * - Skills add capabilities; they do not gate the model's baseline ability.
 * - targetSkillIds are optional hints/context, not the source of truth for
 *   capability resolution.
 * - A capability must be resolved from the declared capability registry.
 * - A capability must never be simulated when the required runtime capability
 *   is unavailable.
 * - The orchestrator does not grant permissions.
 * - The orchestrator does not execute tools directly.
 * - Tool execution remains behind AgentLoop -> ToolExecutor.
 * - Provider resolution uses ProviderRegistry.
 */

import type {
  CapabilityId,
  ExecutionStepId,
  IMessage,
  IExecutionPlan,
  IRuntimeContext,
  IToolCall,
  IToolResult,
  SkillId,
  ToolId,
} from '../types/domain';

import { CapabilityRegistry } from '../registries/capabilityRegistry';
import { ToolRegistry } from '../registries/toolRegistry';
import { ProviderRegistry } from '../registries/providerRegistry';
import { SkillRegistry } from '../registries/skillRegistry';
import { ResourceRegistry } from '../registries/resourceRegistry';
import { PermissionManager } from '../security/permissionManager';
import { ContextManager } from '../context/contextManager';
import { AgentLoop } from './agentLoop';
import { CapabilityResolver } from './capabilityResolver';
import type { IWorkingContext } from '../types/memory';
import { RuntimeComposition } from '../composition/runtimeComposition';

export interface IOrchestratorRequest {
  prompt: string;
  conversationHistory?: IMessage[];
  sessionId?: string;
  modelId?: string;
  providerId?: string;
  targetSkillIds?: SkillId[];
  workingContext?: IWorkingContext;
  onToken?: (token: string) => void;
  onToolCall?: (call: IToolCall) => void;
  onToolResult?: (result: IToolResult) => void;
  signal?: AbortSignal;
}

export interface IOrchestratorResult {
  success: boolean;
  finalResponse: string;
  executionPlan: IExecutionPlan;
  toolCallsExecuted: Array<{
    call: IToolCall;
    result: IToolResult;
  }>;
  error?: string;
}

export class Orchestrator {
  private static initialized = false;

  private static runtimeComposition:
  RuntimeComposition | undefined;
  /**
   * Initializes runtime registries and security subsystems.
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    CapabilityRegistry.initialize();
    ToolRegistry.initialize();
    ProviderRegistry.initialize();
    SkillRegistry.initialize();
    ResourceRegistry.initialize();
    PermissionManager.initialize();

    this.runtimeComposition =
      new RuntimeComposition();

    this.initialized = true;
  }


  /**
   * Creates a runtime execution step.
   */
  private static createStep(options: {
    index: number;
    description: string;
    status: IExecutionPlan['steps'][number]['status'];
    capabilityRequired?: CapabilityId;
    toolId?: ToolId;
    result?: unknown;
    error?: string;
  }): IExecutionPlan['steps'][number] {
    return {
      id: `step-${Date.now()}-${options.index}` as ExecutionStepId,
      index: options.index,
      description: options.description,
      capabilityRequired: options.capabilityRequired,
      toolId: options.toolId,
      status: options.status,
      result: options.result,
      error: options.error,
    };
  }

  /**
   * Extracts the actual tool call/result pairs produced by the AgentLoop.
   *
   * AgentLoop is the execution authority. The orchestrator only reconstructs
   * the relationship between the model-generated call and the real result
   * returned by ToolExecutor.
   */
  private static collectToolExecutions(
    messages: IMessage[],
    toolResults: IToolResult[]
  ): Array<{
    call: IToolCall;
    result: IToolResult;
  }> {
    const executions: Array<{
      call: IToolCall;
      result: IToolResult;
    }> = [];

    for (const message of messages) {
      if (
        message.role !== 'assistant' ||
        !message.toolCalls
      ) {
        continue;
      }

      for (const call of message.toolCalls) {
        const result = toolResults.find(
          (toolResult) =>
            toolResult.callId === call.id
        );

        if (result) {
          executions.push({
            call,
            result,
          });
        }
      }
    }

    return executions;
  }

  /**
   * Orchestrates a user request through the runtime.
   */
  static async orchestrate(
    request: IOrchestratorRequest
  ): Promise<IOrchestratorResult> {
    this.initialize();

    const executionId =
      `execution-${Date.now()}`;

    const createdAt =
      new Date().toISOString();

    const sessionId =
      request.sessionId ??
      `session-${Date.now()}`;

    const createBasePlan = (
      overrides?: Partial<IExecutionPlan>
    ): IExecutionPlan => ({
      id: executionId,
      goal: request.prompt,
      requiredCapabilities: [],
      resolvedSkills: [],
      resolvedTools: [],
      resolvedProviders: [],
      steps: [],
      createdAt,
      ...overrides,
    });

    /*
     * ---------------------------------------------------------------
     * 1. Discover installed runtime skills
     * ---------------------------------------------------------------
     *
     * Discovery is useful for capability-backed execution, but failure
     * must not prevent ordinary model reasoning.
     */
    try {
      const discovery =
        await SkillRegistry.refresh();

      if (!discovery.success) {
        console.warn(
          'Skill discovery notice:',
          discovery.error
        );
      }
    } catch (error) {
      console.warn(
        'Skill discovery exception:',
        error instanceof Error
          ? error.message
          : String(error)
      );
    }

    /*
     * ---------------------------------------------------------------
     * 2. Resolve inference model/provider
     * ---------------------------------------------------------------
     */
    const modelId =
      request.modelId;

    if (!modelId) {
      const executionPlan =
        createBasePlan({
          completedAt:
            new Date().toISOString(),
          steps: [
            this.createStep({
              index: 0,
              description:
                'Resolve the inference model and provider.',
              status: 'failed',
              error:
                'No model was specified for this execution.',
            }),
          ],
        });

      return {
        success: false,
        finalResponse:
          'Erreur runtime : aucun modèle d’inférence n’a été sélectionné pour cette exécution.',
        executionPlan,
        toolCallsExecuted: [],
        error:
          'No model was specified for this execution.',
      };
    }

    const driver =
      ProviderRegistry.resolveDriverForModel(
        modelId,
        request.providerId
      );

    if (!driver) {
      const executionPlan =
        createBasePlan({
          completedAt:
            new Date().toISOString(),
          steps: [
            this.createStep({
              index: 0,
              description:
                'Resolve the inference model and provider.',
              status: 'failed',
              error:
                `No provider driver found for model "${modelId}".`,
            }),
          ],
        });

      return {
        success: false,
        finalResponse:
          `Erreur runtime : aucun moteur d’inférence n’a pu être résolu pour le modèle "${modelId}".`,
        executionPlan,
        toolCallsExecuted: [],
        error:
          `No provider driver found for model "${modelId}".`,
      };
    }

    const steps:
      IExecutionPlan['steps'] = [];

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Resolve the inference model and provider.',
        status: 'completed',
        result: {
          modelId,
          providerId: driver.id,
        },
      })
    );

    /*
     * ---------------------------------------------------------------
     * 3. Resolve required capabilities
     * ---------------------------------------------------------------
     *
     * The model decides which declared capabilities are actually
     * required. An empty result is valid.
     */
    const capabilityResolution =
      await CapabilityResolver.resolve({
        goal: request.prompt,
        capabilities:
          CapabilityRegistry.getAll(),
        driver,
        modelId,
        signal: request.signal,
      });

    if (
      capabilityResolution.status ===
      'failed'
    ) {
      const errorMessage =
        capabilityResolution.error?.message ??
        'Capability resolution failed.';

      steps.push(
        this.createStep({
          index: steps.length,
          description:
            'Resolve required capabilities from the user goal.',
          status: 'failed',
          error: errorMessage,
          result:
            capabilityResolution.error,
        })
      );

      const executionPlan =
        createBasePlan({
          requiredCapabilities: [],
          steps,
          completedAt:
            new Date().toISOString(),
        });

      return {
        success: false,
        finalResponse:
          'Erreur runtime : les capacités nécessaires à cette demande n’ont pas pu être déterminées de manière fiable.',
        executionPlan,
        toolCallsExecuted: [],
        error: errorMessage,
      };
    }

    const requiredCapabilities =
      capabilityResolution.requiredCapabilities;

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Resolve required capabilities from the user goal.',
        status: 'completed',
        result: {
          capabilities:
            requiredCapabilities,
          explanation:
            capabilityResolution.explanation,
        },
      })
    );

    /*
     * ---------------------------------------------------------------
     * 4. Resolve skills dynamically
     * ---------------------------------------------------------------
     *
     * targetSkillIds are contextual hints.
     *
     * Required capabilities remain the source of truth for resolving
     * runtime skills.
     */
    const resolvedSkillIds =
      new Set<SkillId>();

    for (
      const skillId of
      request.targetSkillIds ?? []
    ) {
      const skill =
        SkillRegistry.get(skillId);

      if (!skill) {
        continue;
      }

      resolvedSkillIds.add(skill.id);

      const skillRuntime =
        SkillRegistry.getRuntimeRecord(
          skill.id
        );

      if (
        !skillRuntime ||
        skillRuntime.state !==
          'active'
      ) {
        try {
          SkillRegistry.activate(
            skill.id
          );
        } catch (error) {
          console.warn(
            `Unable to activate targeted skill "${skill.id}":`,
            error instanceof Error
              ? error.message
              : String(error)
          );
        }
      }
    }

    const unavailableCapabilities:
      CapabilityId[] = [];

    for (
      const capability of
      requiredCapabilities
    ) {
      const matchingSkills =
        SkillRegistry.findSkillsForCapability(
          capability
        );

      if (
        matchingSkills.length === 0
      ) {
        unavailableCapabilities.push(
          capability
        );
        continue;
      }

      let capabilityResolved =
        false;

      for (
        const skill of matchingSkills
      ) {
        try {
          const skillRuntime =
            SkillRegistry.getRuntimeRecord(
              skill.id
            );

          if (
            !skillRuntime ||
            skillRuntime.state !==
              'active'
          ) {
            SkillRegistry.activate(
              skill.id
            );
          }

          const refreshedSkill =
            SkillRegistry.get(
              skill.id
            );

          const refreshedSkillRuntime =
            SkillRegistry.getRuntimeRecord(
              skill.id
            );

          if (
            refreshedSkill &&
            refreshedSkillRuntime &&
            refreshedSkillRuntime.state ===
              'active'
          ) {
            resolvedSkillIds.add(
              refreshedSkill.id
            );

            capabilityResolved =
              true;
          }
        } catch (error) {
          console.warn(
            `Unable to activate skill "${skill.id}" for capability "${capability}":`,
            error instanceof Error
              ? error.message
              : String(error)
          );
        }
      }

      if (
        !capabilityResolved
      ) {
        unavailableCapabilities.push(
          capability
        );
      }
    }

    const resolvedSkills =
      SkillRegistry.getActive().filter(
        (skill) =>
          resolvedSkillIds.has(
            skill.id
          )
      );

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Resolve installed skills required by the resolved capabilities.',
        status:
          unavailableCapabilities.length > 0
            ? 'failed'
            : 'completed',
        result: {
          resolvedSkills:
            resolvedSkills.map(
              (skill) => skill.id
            ),
          unavailableCapabilities,
        },
        error:
          unavailableCapabilities.length >
          0
            ? `Unable to resolve required capabilities: ${unavailableCapabilities.join(', ')}.`
            : undefined,
      })
    );

    /*
     * ---------------------------------------------------------------
     * 5. Resolve tools
     * ---------------------------------------------------------------
     *
     * Keep two distinct representations:
     *
     *   resolvedToolIds
     *       -> ToolId[]
     *
     *   resolvedToolDefinitions
     *       -> IToolDefinition[]
     *
     * The execution plan stores identifiers.
     * Context assembly needs actual definitions.
     */
    const resolvedToolIds: ToolId[] = [
      ...new Set(
        resolvedSkills.flatMap(
          (skill) => skill.tools
        )
      ),
    ];

    const resolvedToolDefinitions =
      resolvedToolIds
        .map((toolId) =>
          ToolRegistry.get(toolId)
        )
        .filter(
          (
            tool
          ): tool is NonNullable<
            typeof tool
          > =>
            Boolean(tool)
        );

    const missingToolIds =
      resolvedToolIds.filter(
        (toolId) =>
          !resolvedToolDefinitions.some(
            (tool) =>
              tool.id === toolId
          )
      );

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Resolve runtime tools contributed by the resolved skills.',
        status:
          missingToolIds.length > 0
            ? 'failed'
            : 'completed',
        result: {
          resolvedTools:
            resolvedToolDefinitions.map(
              (tool) => tool.id
            ),
          missingToolIds,
        },
        error:
          missingToolIds.length > 0
            ? `Resolved skills reference unavailable tools: ${missingToolIds.join(', ')}.`
            : undefined,
      })
    );

    if (
      missingToolIds.length > 0
    ) {
      const errorMessage =
        `Resolved skills reference unavailable tools: ${missingToolIds.join(', ')}.`;

      const executionPlan =
        createBasePlan({
          requiredCapabilities,
          resolvedSkills:
            resolvedSkills.map(
              (skill) => skill.id
            ),
          resolvedTools:
            resolvedToolIds,
          resolvedProviders: [
            driver.id,
          ],
          steps,
          completedAt:
            new Date().toISOString(),
        });

      return {
        success: false,
        finalResponse:
          'Erreur runtime : une capacité a été résolue vers un outil qui n’est pas disponible.',
        executionPlan,
        toolCallsExecuted: [],
        error: errorMessage,
      };
    }

    /*
     * ---------------------------------------------------------------
     * 6. Capability boundary
     * ---------------------------------------------------------------
     *
     * Missing capabilities are explicitly communicated to the model.
     *
     * No fake tool call or fake result is created.
     */
    const unavailableSkillNames =
      unavailableCapabilities.flatMap(
        (capability) =>
          SkillRegistry
            .findSkillsForCapability(
              capability
            )
            .map(
              (skill) =>
                `${skill.name} (${skill.id})`
            )
      );

    const uniqueUnavailableSkillNames =
      [
        ...new Set(
          unavailableSkillNames
        ),
      ];

    const additionalInstructions =
      unavailableCapabilities.length >
      0
        ? [
            'RUNTIME CAPABILITY BOUNDARY:',
            `The user's request requires these unavailable capabilities: ${unavailableCapabilities.join(', ')}.`,
            uniqueUnavailableSkillNames.length >
            0
              ? `Potential skills associated with these capabilities: ${uniqueUnavailableSkillNames.join(', ')}.`
              : 'No installed skill currently provides these capabilities.',
            'You do not have a runtime tool capable of performing these operations in this execution.',
            'Never simulate the operation.',
            'Never invent a tool call.',
            'Never invent a tool result.',
            'Answer honestly and explain the runtime limitation in the context of the user request.',
          ].join('\n')
        : undefined;

    /*
     * ---------------------------------------------------------------
     * 7. Assemble model context
     * ---------------------------------------------------------------
     */
    const conversationMessages: IMessage[] =
      request.conversationHistory
        ? [...request.conversationHistory]
        : [];

    conversationMessages.push({
      role: 'user',
      content: request.prompt,
      timestamp:
        new Date().toISOString(),
    });

    const context =
      ContextManager.assembleContext({
        conversationMessages,
        goal: request.prompt,
        targetSkillIds:
          resolvedSkills.map(
            (skill) => skill.id
          ),
        workingContext:
          request.workingContext,
        additionalInstructions,
      });

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Assemble model context from the resolved runtime state.',
        status: 'completed',
        result: context.metadata,
      })
    );

    /*
     * ---------------------------------------------------------------
     * 8. Build the actual runtime context
     * ---------------------------------------------------------------
     *
     * ContextManager already returns canonical IMessage objects.
     *
     * Do not reconstruct messages here.
     * In particular, do not use legacy fields such as:
     *
     *   message.tool_call_id
     *   message.name
     */
    const providerCapabilities =
      driver.getCapabilities();

    const runtimeContext:
      IRuntimeContext = {
        sessionId,
        executionId,
        goal: request.prompt,
        messages: [
          ...context.messages,
        ],
        activeProvider: {
          id: driver.id,
          name: driver.name,
          type: driver.type,
          endpoint:
            driver.endpoint,
          state: 'ready',
          capabilities:
            providerCapabilities,
        },
        activeModel: {
          id: modelId,
          name: modelId,
          providerId: driver.id,
          status: 'ready',
          capabilities: {
            toolCalling:
              providerCapabilities.toolCalling,
            streaming:
              providerCapabilities.streaming,
            structuredOutput:
              providerCapabilities.structuredOutput,
            vision:
              providerCapabilities.vision,
            embeddings:
              providerCapabilities.embeddings,
          },
        },
        metadata: {
          resolvedCapabilities:
            requiredCapabilities,
          resolvedSkills:
            resolvedSkills.map(
              (skill) => skill.id
            ),
          resolvedTools:
            resolvedToolIds,
        },
      };

    steps.push(
      this.createStep({
        index: steps.length,
        description:
          'Build the runtime execution context.',
        status: 'completed',
        result: {
          sessionId,
          executionId,
          providerId: driver.id,
          modelId,
          capabilities:
            requiredCapabilities,
        },
      })
    );

    /*
     * ---------------------------------------------------------------
     * 9. Build execution plan
     * ---------------------------------------------------------------
     */
    const executionPlan:
      IExecutionPlan =
      createBasePlan({
        requiredCapabilities,
        resolvedSkills:
          resolvedSkills.map(
            (skill) => skill.id
          ),
        resolvedTools:
          resolvedToolIds,
        resolvedProviders: [
          driver.id,
        ],
        steps,
      });

    for (
      const capability of
      unavailableCapabilities
    ) {
      executionPlan.steps.push(
        this.createStep({
          index:
            executionPlan.steps
              .length,
          description:
            `Required capability unavailable: ${capability}.`,
          capabilityRequired:
            capability,
          status: 'skipped',
        })
      );
    }

    const runtimeComposition =
  this.runtimeComposition;

if (!runtimeComposition) {
  throw new Error(
    'Runtime composition is not initialized.'
  );
}

const toolExecutor =
  runtimeComposition.getToolExecutor();

    /*
     * ---------------------------------------------------------------
     * 10. Execute through AgentLoop
     * ---------------------------------------------------------------
     *
     * Orchestrator does not execute tools.
     *
     * AgentLoop receives the actual runtime context and the capabilities
     * resolved for this execution.
     *
     * AgentLoop currently exposes assistant/tool-result callbacks,
     * not an onToken callback.
     */
    const loopResult =
      await AgentLoop.run({
        modelId,
        providerDriver: driver,
        context,
        runtimeContext,
        toolExecutor,
        resolvedCapabilities:
          requiredCapabilities,
        callbacks: {
          onToolCall:
            request.onToolCall,
          onToolResult:
            request.onToolResult,
        },
        signal:
          request.signal,
      });

    /*
     * ---------------------------------------------------------------
     * 11. Record real tool execution results
     * ---------------------------------------------------------------
     *
     * AgentLoop returns:
     *
     *   messages
     *   toolResults
     *
     * The orchestrator reconstructs the actual call/result pairs using
     * the stable tool call ID.
     */
    const toolCallsExecuted =
      this.collectToolExecutions(
        loopResult.messages,
        loopResult.toolResults
      );

    for (
      const {
        call,
        result,
      } of toolCallsExecuted
    ) {
      const executionStatus =
        result.status === 'success'
          ? 'completed'
          : result.status ===
              'cancelled'
            ? 'cancelled'
            : result.status ===
                'confirmation-required'
              ? 'pending'
              : 'failed';

      executionPlan.steps.push(
        this.createStep({
          index:
            executionPlan.steps
              .length,
          description:
            `Execute ${call.toolId} requested by the model.`,
          toolId: call.toolId,
          status:
            executionStatus,
          result,
          error:
            result.error?.message,
        })
      );
    }

    /*
     * ---------------------------------------------------------------
     * 12. Final runtime result
     * ---------------------------------------------------------------
     *
     * AgentLoop throws when provider/model execution fails.
     *
     * Therefore a returned loopResult represents a completed agent
     * interaction according to its current contract.
     */
    executionPlan.completedAt =
      new Date().toISOString();

    return {
      success: true,
      finalResponse:
        loopResult.content,
      executionPlan,
      toolCallsExecuted,
    };
  }
}

