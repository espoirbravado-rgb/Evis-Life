/**
 * EVIS RUNTIME DOMAIN
 *
 * Core domain contracts.
 *
 * Architectural invariants:
 * - Capability = WHAT Evis can do.
 * - Tool = executable mechanism exposed by the runtime.
 * - Skill = optional package that contributes capabilities, tools, instructions,
 *   resources and dependencies.
 * - Provider = inference/external service provider.
 * - Permission/Policy = authorization layer, independent from skills and tools.
 * - Environment = facts about the host, not authorization decisions.
 * - Execution = runtime state produced while fulfilling a goal.
 *
 * This file defines domain contracts only.
 * It must not contain provider-specific implementation, filesystem logic,
 * shell execution, HTTP logic, UI state, or authorization implementation.
 */

// -----------------------------------------------------------------------------
// 1. IDENTIFIERS
// -----------------------------------------------------------------------------

export type CapabilityId = string;
export type SkillId = string;
export type ToolId = string;
export type ProviderId = string;
export type ModelId = string;
export type PermissionId = string;
export type ResourceId = string;
export type DependencyId = string;
export type ExecutionId = string;
export type ExecutionStepId = string;
export type ToolCallId = string;
export type SessionId = string;
export type TaskId = string;
export type ProjectId = string;
export type CheckpointId = string;

// -----------------------------------------------------------------------------
// 2. CAPABILITY
// -----------------------------------------------------------------------------

/**
 * Capability describes WHAT Evis can do.
 *
 * A capability does not:
 * - execute anything;
 * - grant itself permission;
 * - select a provider;
 * - select a skill;
 * - contain implementation details.
 */
export type CapabilityCategory =
  | 'file'
  | 'terminal'
  | 'web'
  | 'code'
  | 'memory'
  | 'media'
  | 'system'
  | 'agent';

export type RiskLevel =
  | 'safe'
  | 'prompt'
  | 'dangerous';

export interface ICapability {
  id: CapabilityId;
  name: string;
  description: string;
  category: CapabilityCategory;
  riskLevel: RiskLevel;
}

// -----------------------------------------------------------------------------
// 3. PERMISSION / AUTHORIZATION DOMAIN
// -----------------------------------------------------------------------------

/**
 * A permission describes an authorization requirement.
 *
 * It does not contain the current user's grant state.
 * The actual decision belongs to the Policy / Permission layer.
 */
export interface IPermissionRequirement {
  id: PermissionId;
  description: string;
  scope?: string;
}

/**
 * Result of an authorization decision.
 *
 * This is a domain result, not the implementation of the permission system.
 */
export type AuthorizationDecision =
  | 'allow'
  | 'deny'
  | 'confirm';

export interface IAuthorizationResult {
  decision: AuthorizationDecision;
  reason: string;
  missingPermissions?: PermissionId[];
  requiresConfirmation?: boolean;
}

// -----------------------------------------------------------------------------
// 4. DEPENDENCIES
// -----------------------------------------------------------------------------

export type DependencyType =
  | 'runtime'
  | 'provider'
  | 'tool'
  | 'os'
  | 'network'
  | 'filesystem'
  | 'resource'
  | 'service';

export interface IDependency {
  id: DependencyId;
  type: DependencyType;
  name: string;
  target: string;
  optional?: boolean;
  resolutionHint?: string;
}

// -----------------------------------------------------------------------------
// 5. RESOURCES
// -----------------------------------------------------------------------------

export type ResourceType =
  | 'documentation'
  | 'schema'
  | 'knowledge'
  | 'reference'
  | 'script'
  | 'file'
  | 'directory'
  | 'source'
  | 'unknown';

export interface IResourceReference {
  id: ResourceId;
  type: ResourceType;
  name: string;
  path?: string;
  uri?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resource content is deliberately separate from its identity.
 *
 * A reference does not imply that Evis has read the resource.
 */
export interface IResourceContent {
  resourceId: ResourceId;
  content: string;
  encoding?: string;
  retrievedAt: string;
}

// -----------------------------------------------------------------------------
// 6. TOOL CONTRACT
// -----------------------------------------------------------------------------

export interface IToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: IToolPropertySchema;
  properties?: Record<string, IToolPropertySchema>;
}

export interface IToolParameterSchema {
  type: 'object';
  properties: Record<string, IToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * A tool describes an executable runtime capability.
 *
 * The actual handler is intentionally represented as a separate function
 * contract. Tool registration and execution remain runtime concerns.
 */
export interface IToolDefinition {
  id: ToolId;
  name: string;
  description: string;

  /**
   * Capabilities this tool can execute.
   */
  capabilities: CapabilityId[];

  /**
   * Parameters exposed to the model/runtime.
   */
  parameters: IToolParameterSchema;

  /**
   * Optional metadata used by the runtime.
   */
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 7. TOOL CALL / RESULT
// -----------------------------------------------------------------------------

export interface IToolCall {
  id: ToolCallId;
  toolId: ToolId;

  /**
   * Optional operation inside a multi-operation tool.
   *
   * Example:
   * toolId = "filesystem"
   * operation = "read"
   */
  operation?: string;

  arguments: Record<string, unknown>;

  /**
   * Provider-specific raw representation.
   */
  rawCall?: unknown;
}

export type ToolExecutionStatus =
  | 'success'
  | 'failed'
  | 'denied'
  | 'confirmation-required'
  | 'cancelled';

export interface IToolResult {
  callId: ToolCallId;
  toolId: ToolId;
  status: ToolExecutionStatus;

  data?: unknown;

  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  stdout?: string;
  stderr?: string;

  durationMs: number;
  timestamp: string;

  metadata?: Record<string, unknown>;
}


// -----------------------------------------------------------------------------
// 8. SKILL
// -----------------------------------------------------------------------------

export type SkillLifecycleState =
  | 'available'
  | 'loading'
  | 'active'
  | 'inactive'
  | 'unavailable'
  | 'not-configured'
  | 'error';

export interface ISkillTriggerDefinition {
  description: string;
  examples?: string[];
  exclusions?: string[];
}

export interface ISkillConstraint {
  id: string;
  description: string;
  value?: unknown;
}

export interface ISkillIOField {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
}

export interface ISkillConfigurationEntry {
  id: string;
  description: string;
  type?: string;
  required?: boolean;
  default?: unknown;
}

export interface ISkillManifest {
  id: SkillId;
  name: string;
  version: string;

  author?: string;

  purpose: string;
  scope: string;

  triggers?: ISkillTriggerDefinition[];

  /**
   * Contributions made by this skill.
   */
  capabilities: CapabilityId[];
  tools: ToolId[];

  /**
   * Dependencies required by the skill.
   */
  dependencies: IDependency[];

  /**
   * Permissions required by the skill.
   *
   * Permissions are declarations only.
   * They do not represent granted authorization.
   */
  permissions: IPermissionRequirement[];

  constraints?: ISkillConstraint[];

  inputs?: ISkillIOField[];
  outputs?: ISkillIOField[];

  /**
   * Resources belonging to or referenced by the skill.
   */
  resources?: IResourceReference[];

  /**
   * Instructions supplied as domain context.
   *
   * Instructions do NOT grant capabilities or permissions.
   */
  instructions?: string;

  configuration?: ISkillConfigurationEntry[];

  metadata?: Record<string, unknown>;
}

export type SkillResolutionStatus =
  | 'unresolved'
  | 'resolved'
  | 'partial'
  | 'failed';

export interface ISkillDependencyResolution {
  dependencyId: DependencyId;
  status: 'resolved' | 'unresolved' | 'failed';
  reason?: string;
}

export interface ISkillRuntimeResolution {
  status: SkillResolutionStatus;

  dependencies: ISkillDependencyResolution[];

  resolvedCapabilities: CapabilityId[];
  resolvedTools: ToolId[];

  errors?: string[];
}

export interface ISkillRuntimeRecord {
  manifest: ISkillManifest;

  state: SkillLifecycleState;
  stateReason?: string;

  resolution: ISkillRuntimeResolution;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 9. PROVIDER
// -----------------------------------------------------------------------------

export type ProviderType =
  | 'local-daemon'
  | 'local-binary'
  | 'remote-api'
  | 'remote-agent'
  | 'other';

export type ProviderState =
  | 'ready'
  | 'starting'
  | 'stopped'
  | 'offline'
  | 'error'
  | 'unknown';

export interface IProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  embeddings: boolean;
  vision?: boolean;
  audioInput?: boolean;
  audioOutput?: boolean;
}

export interface IProvider {
  id: ProviderId;
  name: string;
  type: ProviderType;

  /**
   * Endpoint is optional because not every provider is an HTTP service.
   */
  endpoint?: string;

  state: ProviderState;
  capabilities: IProviderCapabilities;

  lastError?: string;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 10. MODEL
// -----------------------------------------------------------------------------

export type ModelStatus =
  | 'ready'
  | 'offline'
  | 'loading'
  | 'unknown';

export interface IModelCapabilities {
  toolCalling: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  vision?: boolean;
  embeddings?: boolean;
}

export interface IModelInfo {
  id: ModelId;
  name: string;
  providerId: ProviderId;

  contextWindow?: number;

  size?: string;
  quantization?: string;

  status: ModelStatus;

  capabilities: IModelCapabilities;

  description?: string;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 11. EXECUTION PLAN
// -----------------------------------------------------------------------------

export type ExecutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface IExecutionStep {
  id: ExecutionStepId;
  index: number;

  description: string;

  capabilityRequired?: CapabilityId;
  toolId?: ToolId;

  status: ExecutionStepStatus;

  result?: unknown;
  error?: string;

  startedAt?: string;
  completedAt?: string;
}

export interface IExecutionPlan {
  id: ExecutionId;

  goal: string;

  requiredCapabilities: CapabilityId[];

  /**
   * These are resolutions made by the orchestrator.
   */
  resolvedSkills: SkillId[];
  resolvedTools: ToolId[];
  resolvedProviders: ProviderId[];

  steps: IExecutionStep[];

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// -----------------------------------------------------------------------------
// 12. EXECUTION REQUEST
// -----------------------------------------------------------------------------

/**
 * Canonical request entering the orchestration layer.
 *
 * This separates the user's goal from the execution context.
 */
export interface IExecutionRequest {
  sessionId: SessionId;
  goal: string;

  /**
   * Optional explicit constraints.
   *
   * They are constraints, not a mandatory skill-selection mechanism.
   */
  targetSkillIds?: SkillId[];

  requestedCapabilities?: CapabilityId[];

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 13. EXECUTION STATE
// -----------------------------------------------------------------------------

export type ExecutionState =
  | 'idle'
  | 'planning'
  | 'waiting-confirmation'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface IExecutionState {
  executionId: ExecutionId;
  sessionId: SessionId;

  state: ExecutionState;

  currentStepId?: ExecutionStepId;

  startedAt?: string;
  completedAt?: string;

  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// -----------------------------------------------------------------------------
// 14. MESSAGE DOMAIN
// -----------------------------------------------------------------------------

export type MessageRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool';

export interface IMessage {
  id?: string;
  role: MessageRole;
  content: string;

  toolCalls?: IToolCall[];
  toolResults?: IToolResult[];

  timestamp?: string;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 15. ENVIRONMENT REFERENCE
// -----------------------------------------------------------------------------

/**
 * This is deliberately a reference to environment information.
 *
 * Authorization does NOT belong here.
 *
 * In particular, fields such as `canRead`, `canWrite`, or `granted`
 * must not be stored as environmental facts.
 */
export interface IEnvironmentReference {
  workspaceRoot?: string;
  installationRoot?: string;
  dataRoot?: string;
  homeDir?: string;
  desktopDir?: string;

  isOffline?: boolean;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 16. RUNTIME CONTEXT
// -----------------------------------------------------------------------------

/**
 * Runtime context is the information needed during execution.
 *
 * It is intentionally lighter than the old IExecutionContext.
 *
 * Resolved skills, tools, capabilities, permissions, environment and
 * provider state should remain independently represented by their
 * respective runtime components.
 */
export interface IRuntimeContext {
  sessionId: SessionId;
  executionId?: ExecutionId;

  goal: string;

  messages: IMessage[];

  environment?: IEnvironmentReference;

  activeProvider?: IProvider;
  activeModel?: IModelInfo;

  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 17. DOMAIN REFERENCES
// -----------------------------------------------------------------------------

/**
 * Generic relation between domain objects.
 *
 * This supports the reference graph used by Working Memory without making
 * Working Memory responsible for the objects themselves.
 */
export type DomainRelation =
  | 'contains'
  | 'references'
  | 'depends_on'
  | 'requires'
  | 'implements'
  | 'modifies'
  | 'creates'
  | 'reads'
  | 'blocks'
  | 'blocked_by'
  | 'follows'
  | 'next'
  | 'previous'
  | 'derived_from'
  | 'verified_by'
  | 'related_to';

export interface IDomainReference {
  sourceId: string;
  targetId: string;
  relation: DomainRelation;
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 18. RESULT TYPES
// -----------------------------------------------------------------------------

export interface IOperationError {
  code: string;
  message: string;
  details?: unknown;
}

export interface IOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: IOperationError;
  timestamp: string;
  durationMs?: number;
}

// -----------------------------------------------------------------------------
// 19. DOMAIN CONSTANTS / HELPERS
// -----------------------------------------------------------------------------

/**
 * These helpers contain no runtime side effects.
 *
 * They only provide small domain-level predicates.
 */
export function isSuccessfulToolResult(
  result: IToolResult
): boolean {
  return result.status === 'success';
}

export function isExecutionTerminalState(
  state: ExecutionState
): boolean {
  return (
    state === 'completed' ||
    state === 'failed' ||
    state === 'cancelled'
  );
}