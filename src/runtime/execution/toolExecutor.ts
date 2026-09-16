/**
 * EVIS RUNTIME — TOOL EXECUTOR
 *
 * Central execution boundary for runtime tools.
 *
 * Architectural flow:
 *
 * Model Tool Call
 *      ↓
 * Tool Resolution
 *      ↓
 * Argument Validation
 *      ↓
 * Capability Validation
 *      ↓
 * Policy / Permission
 *      ↓
 * Confirmation
 *      ↓
 * Tool Implementation
 *      ↓
 * Normalized Tool Result
 *
 * IMPORTANT:
 *
 * - ToolRegistry describes tools; it does not execute them.
 * - ToolExecutor does not grant permissions.
 * - ToolExecutor does not implement filesystem, terminal, web, etc.
 * - A denied or unavailable operation must never be simulated.
 * - Environment facts are not authorization decisions.
 */

import type {
  CapabilityId,
  IAuthorizationResult,
  IRuntimeContext,
  IToolCall,
  IToolDefinition,
  IToolResult,
} from '../types/domain';

import { ToolRegistry } from '../registries/toolRegistry';
import { PermissionManager } from '../security/permissionManager';

export interface IToolImplementation {
  /**
   * Tool implementation identifier.
   *
   * This normally corresponds to the runtime tool definition ID.
   */
  toolId: string;

  /**
   * Execute the physical operation.
   *
   * Implementations are responsible for the actual mechanism:
   * filesystem, terminal, web, memory, media, etc.
   */
  execute(
    call: IToolCall,
    context: IRuntimeContext
  ): Promise<IToolResult>;
}

export interface IToolExecutorOptions {
  /**
   * Physical tool implementations available to the runtime.
   *
   * The registry remains responsible for definitions.
   * Implementations are registered separately.
   */
  implementations?: Iterable<IToolImplementation>;

  /**
   * Optional cancellation signal.
   */
  signal?: AbortSignal;
}

export interface IToolExecutionRequest {
  call: IToolCall;

  /**
   * Runtime context created by the orchestration layer.
   */
  context: IRuntimeContext;

  /**
   * Capabilities resolved for this execution.
   *
   * These are runtime facts produced by orchestration, not inferred
   * from the tool itself.
   */
  resolvedCapabilities?: CapabilityId[];
}

export class ToolExecutor {
  private readonly implementations = new Map<
    string,
    IToolImplementation
  >();

  private readonly signal?: AbortSignal;

  constructor(options: IToolExecutorOptions = {}) {
    this.signal = options.signal;

    for (const implementation of options.implementations ?? []) {
      this.registerImplementation(implementation);
    }
  }

  /**
   * Registers a physical implementation for a tool.
   *
   * Registration does not grant permissions.
   */
  registerImplementation(
    implementation: IToolImplementation
  ): void {
    if (!implementation.toolId.trim()) {
      throw new Error(
        'Cannot register a tool implementation without a toolId.'
      );
    }

    if (this.implementations.has(implementation.toolId)) {
      throw new Error(
        `Tool implementation already registered: ${implementation.toolId}`
      );
    }

    this.implementations.set(
      implementation.toolId,
      implementation
    );
  }

  /**
   * Returns whether an implementation exists for a tool.
   */
  hasImplementation(toolId: string): boolean {
    return this.implementations.has(toolId);
  }

  /**
   * Returns the registered implementation.
   */
  getImplementation(
    toolId: string
  ): IToolImplementation | undefined {
    return this.implementations.get(toolId);
  }

  /**
   * Executes one model-generated tool call through the central
   * runtime boundary.
   */
  async execute(
    request: IToolExecutionRequest
  ): Promise<IToolResult> {
    const startedAt = Date.now();

    const { call, context } = request;

    /*
     * ---------------------------------------------------------------
     * 1. Cancellation
     * ---------------------------------------------------------------
     */
    if (this.signal?.aborted) {
      return this.createResult(
        call,
        startedAt,
        'cancelled',
        {
          code: 'EXECUTION_CANCELLED',
          message:
            'Tool execution was cancelled before it started.',
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * 2. Validate the tool call
     * ---------------------------------------------------------------
     */
    const validationError =
      this.validateToolCall(call);

    if (validationError) {
      return this.createResult(
        call,
        startedAt,
        'failed',
        validationError
      );
    }

    /*
     * ---------------------------------------------------------------
     * 3. Resolve the tool definition
     * ---------------------------------------------------------------
     */
    const definition =
      ToolRegistry.get(call.toolId);

    if (!definition) {
      return this.createResult(
        call,
        startedAt,
        'failed',
        {
          code: 'TOOL_NOT_FOUND',
          message:
            `No registered tool definition exists for "${call.toolId}".`,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * 4. Validate capability boundary
     * ---------------------------------------------------------------
     *
     * A tool must not silently provide a capability that was not
     * resolved for the current execution.
     *
     * An execution with no resolved capabilities is valid for
     * ordinary model reasoning, but a tool call itself requires
     * an explicit capability relationship.
     */
    const capabilityError =
      this.validateCapabilities(
        definition,
        request.resolvedCapabilities ?? []
      );

    if (capabilityError) {
      return this.createResult(
        call,
        startedAt,
        'denied',
        capabilityError
      );
    }

    /*
     * ---------------------------------------------------------------
     * 5. Policy / permission boundary
     * ---------------------------------------------------------------
     *
     * ToolExecutor asks the authorization layer for a decision.
     *
     * It does not grant permission itself.
     */
    const authorization =
      this.authorize(call);

    if (authorization.decision === 'deny') {
      return this.createResult(
        call,
        startedAt,
        'denied',
        {
          code: 'PERMISSION_DENIED',
          message: authorization.reason,
          details: authorization.missingPermissions,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * 6. Confirmation boundary
     * ---------------------------------------------------------------
     *
     * The executor cannot invent user confirmation.
     *
     * If policy requires confirmation, return a structured runtime
     * state and let the upper execution layer handle the interaction.
     */
    if (
      authorization.decision === 'confirm' ||
      authorization.requiresConfirmation === true
    ) {
      return this.createResult(
        call,
        startedAt,
        'confirmation-required',
        {
          code: 'CONFIRMATION_REQUIRED',
          message: authorization.reason,
          details:
            authorization.missingPermissions,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * 7. Resolve physical implementation
     * ---------------------------------------------------------------
     */
    const implementation =
      this.implementations.get(call.toolId);

    if (!implementation) {
      return this.createResult(
        call,
        startedAt,
        'failed',
        {
          code: 'TOOL_IMPLEMENTATION_UNAVAILABLE',
          message:
            `Tool "${call.toolId}" is registered but has no executable implementation.`,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * 8. Execute the real implementation
     * ---------------------------------------------------------------
     *
     * No fallback success is allowed here.
     */
    try {
      const result =
        await implementation.execute(
          call,
          context
        );

      /*
       * The implementation is required to return a normalized
       * IToolResult. We still normalize identity/timing fields here
       * so the executor remains the final result boundary.
       */
      return {
        ...result,
        callId: call.id,
        toolId: call.toolId,
        durationMs:
          result.durationMs >= 0
            ? result.durationMs
            : Date.now() - startedAt,
        timestamp:
          result.timestamp ||
          new Date().toISOString(),
      };
    } catch (error) {
      return this.createResult(
        call,
        startedAt,
        'failed',
        {
          code: 'TOOL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message
              : String(error),
          details: error,
        }
      );
    }
  }

  /**
   * Validates the structural integrity of a tool call.
   */
  private validateToolCall(
    call: IToolCall
  ): IToolResult['error'] | undefined {
    if (!call.id.trim()) {
      return {
        code: 'INVALID_TOOL_CALL',
        message:
          'Tool call is missing its identifier.',
      };
    }

    if (!call.toolId.trim()) {
      return {
        code: 'INVALID_TOOL_CALL',
        message:
          'Tool call is missing its tool identifier.',
      };
    }

    if (
      !call.arguments ||
      typeof call.arguments !== 'object' ||
      Array.isArray(call.arguments)
    ) {
      return {
        code: 'INVALID_TOOL_ARGUMENTS',
        message:
          `Tool "${call.toolId}" requires arguments to be an object.`,
      };
    }

    return undefined;
  }

  /**
   * Ensures that the selected tool actually contributes at least
   * one capability resolved for the current execution.
   */
  private validateCapabilities(
    definition: IToolDefinition,
    resolvedCapabilities: CapabilityId[]
  ): IToolResult['error'] | undefined {
    if (definition.capabilities.length === 0) {
      return {
        code: 'TOOL_HAS_NO_CAPABILITY',
        message:
          `Tool "${definition.id}" is registered without any declared capability.`,
      };
    }

    const resolved = new Set(
      resolvedCapabilities
    );

    const hasResolvedCapability =
      definition.capabilities.some(
        (capability) =>
          resolved.has(capability)
      );

    if (!hasResolvedCapability) {
      return {
        code: 'CAPABILITY_NOT_RESOLVED',
        message:
          `Tool "${definition.id}" requires a capability that was not resolved for this execution.`,
        details: {
          toolCapabilities:
            definition.capabilities,
          resolvedCapabilities,
        },
      };
    }

    return undefined;
  }

  /**
   * Delegates authorization to the security layer.
   *
   * This method intentionally contains no authorization policy.
   */
  private authorize(
    call: IToolCall
  ): IAuthorizationResult {
    return PermissionManager.evaluateToolCall(
      call.toolId,
      call.arguments
    );
  }

  /**
   * Creates the canonical runtime result.
   */
  private createResult(
    call: IToolCall,
    startedAt: number,
    status: IToolResult['status'],
    error?: IToolResult['error']
  ): IToolResult {
    return {
      callId: call.id,
      toolId: call.toolId,
      status,
      error,
      durationMs:
        Date.now() - startedAt,
      timestamp:
        new Date().toISOString(),
    };
  }
}