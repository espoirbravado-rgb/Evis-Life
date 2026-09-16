export type RiskLevel = 'safe' | 'prompt' | 'dangerous';

export interface ISkillPermission {
  id: string;
  name: string;
  description: string;
  granted: boolean;
}

export interface ISkill {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  author?: string;
  category?: 'global' | 'specialized';
  capabilities: string[];
  dependencies: string[];
  requiredTools: string[];
  optionalTools: string[];
  permissions: ISkillPermission[];
  systemInstructions?: string;
  intentTriggers?: string[];
  status?: 'active' | 'available' | 'missing-dep' | 'not-installed' | 'inactive' | 'unavailable' | 'not-configured' | 'error';
}

export interface IModel {
  id: string;
  name: string;
  provider: 'ollama' | 'llama.cpp' | 'remote' | 'custom';
  status: 'ready' | 'pulling' | 'offline';
  size?: string;
  quantization?: string;
  contextWindow: number;
  description?: string;
}

export interface ITool {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  category: 'file' | 'terminal' | 'web' | 'memory' | 'system';
  parameters?: Record<string, unknown>;
  requiredPermission?: string;
}

export interface IToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'confirming' | 'running' | 'success' | 'error';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  result?: unknown;
}

export interface IAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'text' | 'image' | 'code' | 'pdf';
  snippetPreview?: string;
}

export interface IMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  attachments?: IAttachment[];
  toolCalls?: IToolCall[];
  activeSkillsAtGeneration?: string[];
  isStreaming?: boolean;
}

export interface ISession {
  id: string;
  title: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  activeSkillIds: string[];
  activeModelId: string;
  webSearchEnabled: boolean;
  messages: IMessage[];
  isArchived: boolean;
  summary?: string;
  workingMemoryState?: unknown;
}

export interface IFileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: IFileNode[];
}

export interface IProject {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  defaultSkillIds: string[];
  defaultModelId: string;
  conversationCount: number;
  knowledgeCount: number;
  createdAt: string;
}

export interface IKnowledgeItem {
  id: string;
  title: string;
  category: 'note' | 'decision' | 'summary' | 'constraint';
  summary: string;
  content: string;
  tags: string[];
  projectId?: string;
  sourceSessionId?: string;
  updatedAt: string;
}

export interface ISystemStatus {
  modelStatus: 'ready' | 'connecting' | 'offline';
  modelName: string;
  memoryStatus: 'ready' | 'indexing' | 'idle';
  activeSkillsCount: number;
  webSearchEnabled: boolean;
  terminalAvailable: boolean;
  contextTokensUsed: number;
  contextTokensLimit: number;
}

export type ExerciseStatus =
  | 'requested'
  | 'generated'
  | 'active'
  | 'completed'
  | 'failed'
  | 'abandoned'
  | 'archived';

export interface IExercise {
  id: string;
  title: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  status: ExerciseStatus;
  description: string;
  starterCode: string;
  starterPrompt: string;
  hints?: string[];
  solution?: string;
  learningObjective?: string;
  createdAt?: string;
}

export interface IExerciseEvaluation {
  feedback: string;
  passed: boolean;
  score: number;
  evaluatedAt: string;
}
