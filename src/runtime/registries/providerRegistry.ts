/**
 * EVIS RUNTIME — PROVIDER REGISTRY
 * Phase 4: Provider Registry
 *
 * Responsibilities:
 * - Register inference providers.
 * - Discover live provider state and models.
 * - Expose provider capabilities.
 * - Resolve a provider driver for a model.
 * - Translate native provider responses into Evis domain contracts.
 *
 * This layer does NOT:
 * - resolve capabilities;
 * - resolve skills;
 * - authorize tool calls;
 * - execute tools;
 * - simulate tool calls;
 * - infer executable tool calls from ordinary model text.
 */

import {
  IProvider,
  IModelInfo,
  ProviderState,
  IProviderCapabilities,
  IToolCall,
  IToolResult,
  IToolParameterSchema,
} from '../types/domain';
import { OllamaService } from '../../services/ollamaService';
import { LlamaCppService } from '../../services/llamaCppService';

export interface IProviderMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  toolCalls?: IToolCall[];
  toolResults?: IToolResult[];
}

export interface IProviderToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: IToolParameterSchema;
  };
}


export interface IProviderGenerateOptions {
  modelId: string;
  messages: IProviderMessage[];
  systemPrompt?: string;
  tools?: IProviderToolSchema[];
  responseFormat?: 'json';
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface IProviderGenerateResult {
  content: string;
  toolCalls?: IToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  error?: string;
}

export interface IProviderDriver {
  readonly id: string;
  readonly name: string;
  readonly type: 'local-daemon' | 'local-binary' | 'remote-api';
  readonly endpoint: string;

  checkAvailability(): Promise<{
    online: boolean;
    state: ProviderState;
    error?: string;
  }>;

  discoverModels(): Promise<IModelInfo[]>;

  getCapabilities(): IProviderCapabilities;

  generate(
    options: IProviderGenerateOptions
  ): Promise<IProviderGenerateResult>;
}

// -----------------------------------------------------------------------------
// Provider response helpers
// -----------------------------------------------------------------------------

function createToolCallId(prefix: string, index?: number): string {
  const suffix = index === undefined ? '' : `-${index}`;
  return `${prefix}-${Date.now()}${suffix}`;
}

function normalizeToolArguments(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }

    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeNativeToolCall(
  nativeCall: unknown,
  fallbackId: string
): IToolCall | undefined {
  if (!nativeCall || typeof nativeCall !== 'object') {
    return undefined;
  }

  const call = nativeCall as {
    id?: unknown;
    function?: {
      name?: unknown;
      arguments?: unknown;
    };
  };

  const functionData = call.function;

  if (!functionData || typeof functionData !== 'object') {
    return undefined;
  }

  if (typeof functionData.name !== 'string' || !functionData.name.trim()) {
    return undefined;
  }

  return {
    id:
      typeof call.id === 'string' && call.id.length > 0
        ? call.id
        : fallbackId,
    toolId: functionData.name,
    arguments: normalizeToolArguments(functionData.arguments),
    rawCall: nativeCall,
  };
}

function buildProviderMessages(
  options: IProviderGenerateOptions
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];

  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  for (const message of options.messages) {
    const formatted: Record<string, unknown> = {
      role: message.role,
      content: message.content ?? '',
    };

    if (message.toolCalls && message.toolCalls.length > 0) {
      formatted.tool_calls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.toolId,
          arguments: JSON.stringify(toolCall.arguments),
        },
      }));
    }

    if (message.toolResults && message.toolResults.length > 0) {
      formatted.content = JSON.stringify(message.toolResults);
    }

    messages.push(formatted);
  }

  return messages;
}

function buildModelCapabilities(
  providerCapabilities: IProviderCapabilities,
  supportsToolCalling: boolean
) {
  return {
    toolCalling:
      supportsToolCalling && providerCapabilities.toolCalling,
    streaming: providerCapabilities.streaming,
    structuredOutput: providerCapabilities.structuredOutput,
    vision: providerCapabilities.vision,
    embeddings: providerCapabilities.embeddings,
  };
}

// -----------------------------------------------------------------------------
// 1. Ollama Provider Driver
// -----------------------------------------------------------------------------

export class OllamaProviderDriver implements IProviderDriver {
  readonly id = 'ollama';
  readonly name = 'Ollama Engine';
  readonly type = 'local-daemon' as const;
  readonly endpoint = 'http://127.0.0.1:11434';

  async checkAvailability(): Promise<{
    online: boolean;
    state: ProviderState;
    error?: string;
  }> {
    try {
      const result = await OllamaService.listModels();

      return {
        online: result.online,
        state: result.online ? 'ready' : 'offline',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      return {
        online: false,
        state: 'error',
        error: message,
      };
    }
  }

  async discoverModels(): Promise<IModelInfo[]> {
    try {
      const result = await OllamaService.listModels();

      if (!result.online) {
        return [];
      }

      const providerCapabilities = this.getCapabilities();

      return result.models.map((model) => {
        const sizeGb = (
          model.size /
          (1024 * 1024 * 1024)
        ).toFixed(1);

        const modelName = model.name.toLowerCase();

        const supportsToolCalling =
          modelName.includes('qwen') ||
          modelName.includes('coder') ||
          modelName.includes('llama3') ||
          modelName.includes('mistral');

        return {
          id: model.name,
          name: model.name,
          providerId: this.id,
          size: `${sizeGb} GB`,
          quantization:
            model.details?.quantization_level || undefined,
          contextWindow: modelName.includes('14b')
            ? 32768
            : 8192,
          status: 'ready',
          capabilities: buildModelCapabilities(
            providerCapabilities,
            supportsToolCalling
          ),
          description:
            `Ollama Local Model: ${model.name} ` +
            `(${model.details?.parameter_size || 'unknown'})`,
        };
      });
    } catch {
      return [];
    }
  }

  getCapabilities(): IProviderCapabilities {
    return {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      embeddings: true,
    };
  }

  async generate(
    options: IProviderGenerateOptions
  ): Promise<IProviderGenerateResult> {
    const payload: Record<string, unknown> = {
      model: options.modelId,
      messages: buildProviderMessages(options),
      stream: Boolean(options.onToken),
    };

    if (options.responseFormat === 'json') {
      payload.format = 'json';
    }

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    try {
      const chatUrl =
        typeof window !== 'undefined'
          ? '/ollama/api/chat'
          : `${this.endpoint}/api/chat`;

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();

        return {
          content: '',
          error: `Ollama HTTP ${response.status}: ${errorText}`,
          finishReason: 'error',
        };
      }

      if (!options.onToken || !response.body) {
        const data = await response.json();
        const message = data.message ?? {};

        const nativeToolCalls = Array.isArray(message.tool_calls)
          ? message.tool_calls
          : [];

        const toolCalls = nativeToolCalls
          .map((toolCall: unknown, index: number) =>
            normalizeNativeToolCall(
              toolCall,
              createToolCallId('ollama-tc', index)
            )
          )
          .filter(
            (toolCall: IToolCall | undefined): toolCall is IToolCall =>
              Boolean(toolCall)
          );

        return {
          content:
            typeof message.content === 'string'
              ? message.content
              : '',
          toolCalls:
            toolCalls.length > 0 ? toolCalls : undefined,
          finishReason:
            toolCalls.length > 0
              ? 'tool_calls'
              : 'stop',
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let fullContent = '';

      const toolCallsByIndex = new Map<
        number,
        {
          id: string;
          name: string;
          arguments: string;
          rawParts: unknown[];
        }
      >();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed) {
            continue;
          }

          try {
            const data = JSON.parse(trimmed);
            const message = data.message;

            if (
              message &&
              typeof message.content === 'string'
            ) {
              fullContent += message.content;
              options.onToken?.(message.content);
            }

            if (Array.isArray(message?.tool_calls)) {
              for (
                let index = 0;
                index < message.tool_calls.length;
                index += 1
              ) {
                const nativeCall =
                  message.tool_calls[index];

                if (
                  !nativeCall ||
                  typeof nativeCall !== 'object'
                ) {
                  continue;
                }

                const functionData =
                  nativeCall.function;

                if (
                  !functionData ||
                  typeof functionData !== 'object' ||
                  typeof functionData.name !== 'string'
                ) {
                  continue;
                }

                const existing =
                  toolCallsByIndex.get(index);

                const argumentsPart =
                  typeof functionData.arguments === 'string'
                    ? functionData.arguments
                    : JSON.stringify(
                        functionData.arguments ?? {}
                      );

                if (existing) {
                  existing.arguments += argumentsPart;
                  existing.rawParts.push(nativeCall);
                } else {
                  toolCallsByIndex.set(index, {
                    id:
                      typeof nativeCall.id === 'string' &&
                      nativeCall.id.length > 0
                        ? nativeCall.id
                        : createToolCallId(
                            'ollama-tc',
                            index
                          ),
                    name: functionData.name,
                    arguments: argumentsPart,
                    rawParts: [nativeCall],
                  });
                }
              }
            }
          } catch {
            // Ignore incomplete/non-JSON stream lines.
            // The buffered data remains the provider transport concern.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          const message = data.message;

          if (
            message &&
            typeof message.content === 'string'
          ) {
            fullContent += message.content;
            options.onToken?.(message.content);
          }

          if (Array.isArray(message?.tool_calls)) {
            for (
              let index = 0;
              index < message.tool_calls.length;
              index += 1
            ) {
              const nativeCall = message.tool_calls[index];
              const functionData = nativeCall?.function;

              if (
                !functionData ||
                typeof functionData !== 'object' ||
                typeof functionData.name !== 'string'
              ) {
                continue;
              }

              const existing =
                toolCallsByIndex.get(index);

              const argumentsPart =
                typeof functionData.arguments === 'string'
                  ? functionData.arguments
                  : JSON.stringify(
                      functionData.arguments ?? {}
                    );

              if (existing) {
                existing.arguments += argumentsPart;
                existing.rawParts.push(nativeCall);
              } else {
                toolCallsByIndex.set(index, {
                  id:
                    typeof nativeCall.id === 'string' &&
                    nativeCall.id.length > 0
                      ? nativeCall.id
                      : createToolCallId(
                          'ollama-tc',
                          index
                        ),
                  name: functionData.name,
                  arguments: argumentsPart,
                  rawParts: [nativeCall],
                });
              }
            }
          }
        } catch {
          // Ignore incomplete trailing transport data.
        }
      }

      const toolCalls: IToolCall[] = [];

      for (const [
        index,
        accumulated,
      ] of toolCallsByIndex.entries()) {
        toolCalls.push({
          id: accumulated.id,
          toolId: accumulated.name,
          arguments: normalizeToolArguments(
            accumulated.arguments
          ),
          rawCall: accumulated.rawParts,
        });

        void index;
      }

      return {
        content: fullContent,
        toolCalls:
          toolCalls.length > 0
            ? toolCalls
            : undefined,
        finishReason:
          toolCalls.length > 0
            ? 'tool_calls'
            : 'stop',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      return {
        content: '',
        error: message,
        finishReason: 'error',
      };
    }
  }
}

// -----------------------------------------------------------------------------
// 2. llama.cpp Provider Driver
// -----------------------------------------------------------------------------

export class LlamaCppProviderDriver implements IProviderDriver {
  readonly id = 'llama.cpp';
  readonly name = 'llama.cpp Engine';
  readonly type = 'local-binary' as const;
  readonly endpoint = 'http://127.0.0.1:8080';

  async checkAvailability(): Promise<{
    online: boolean;
    state: ProviderState;
    error?: string;
  }> {
    try {
      const health = await LlamaCppService.checkHealth();

      return {
        online: health.online,
        state: health.online ? 'ready' : 'offline',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      return {
        online: false,
        state: 'error',
        error: message,
      };
    }
  }

  async discoverModels(): Promise<IModelInfo[]> {
    try {
      const result = await LlamaCppService.listModels();
      const providerCapabilities = this.getCapabilities();

      return result.models.map((model) => ({
        id: model.id,
        name: model.name,
        providerId: this.id,
        size: model.size,
        quantization: model.quantization || undefined,
        contextWindow: model.contextWindow || 2048,
        status:
          model.status === 'ready'
            ? 'ready'
            : 'offline',
        capabilities: buildModelCapabilities(
          providerCapabilities,
          true
        ),
        description:
          model.description ||
          `llama.cpp Local GGUF Model: ${model.name}`,
      }));
    } catch {
      return [];
    }
  }

  getCapabilities(): IProviderCapabilities {
    return {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      embeddings: false,
    };
  }

  async generate(
    options: IProviderGenerateOptions
  ): Promise<IProviderGenerateResult> {
    const payload: Record<string, unknown> = {
      model: options.modelId,
      messages: buildProviderMessages(options),
      stream: Boolean(options.onToken),
      temperature: 0.2,
    };

    if (options.responseFormat === 'json') {
      payload.response_format = {
        type: 'json_object',
      };
    }

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    try {
      const completionUrl =
        typeof window !== 'undefined'
          ? '/llama-cpp/v1/chat/completions'
          : `${this.endpoint}/v1/chat/completions`;

      const response = await fetch(completionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();

        return {
          content: '',
          error:
            `llama.cpp HTTP ${response.status}: ` +
            errorText,
          finishReason: 'error',
        };
      }

      if (!options.onToken || !response.body) {
        const data = await response.json();
        const choice = data.choices?.[0];
        const message = choice?.message ?? {};

        const nativeToolCalls = Array.isArray(
          message.tool_calls
        )
          ? message.tool_calls
          : [];

        const toolCalls = nativeToolCalls
          .map((toolCall: unknown, index: number) =>
            normalizeNativeToolCall(
              toolCall,
              createToolCallId(
                'llama-cpp-tc',
                index
              )
            )
          )
          .filter(
            (toolCall: IToolCall | undefined): toolCall is IToolCall =>
              Boolean(toolCall)
          );

        return {
          content:
            typeof message.content === 'string'
              ? message.content
              : '',
          toolCalls:
            toolCalls.length > 0
              ? toolCalls
              : undefined,
          finishReason:
            toolCalls.length > 0
              ? 'tool_calls'
              : 'stop',
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let fullContent = '';

      const toolCallsByIndex = new Map<
        number,
        {
          id: string;
          name: string;
          arguments: string;
          rawParts: unknown[];
        }
      >();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed) {
            continue;
          }

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const jsonText = trimmed.slice(5).trim();

          if (jsonText === '[DONE]') {
            continue;
          }

          try {
            const chunk = JSON.parse(jsonText);
            const delta = chunk.choices?.[0]?.delta;

            if (typeof delta?.content === 'string') {
              fullContent += delta.content;
              options.onToken?.(delta.content);
            }

            if (Array.isArray(delta?.tool_calls)) {
              for (
                let index = 0;
                index < delta.tool_calls.length;
                index += 1
              ) {
                const nativeCall =
                  delta.tool_calls[index];

                if (
                  !nativeCall ||
                  typeof nativeCall !== 'object'
                ) {
                  continue;
                }

                const callIndex =
                  typeof nativeCall.index === 'number'
                    ? nativeCall.index
                    : index;

                const functionData =
                  nativeCall.function;

                const existing =
                  toolCallsByIndex.get(callIndex);

                const name =
                  typeof functionData?.name === 'string'
                    ? functionData.name
                    : existing?.name ?? '';

                const argumentsPart =
                  typeof functionData?.arguments === 'string'
                    ? functionData.arguments
                    : '';

                if (existing) {
                  existing.name = name;
                  existing.arguments += argumentsPart;
                  existing.rawParts.push(nativeCall);

                  if (
                    typeof nativeCall.id === 'string' &&
                    nativeCall.id.length > 0
                  ) {
                    existing.id = nativeCall.id;
                  }
                } else {
                  toolCallsByIndex.set(callIndex, {
                    id:
                      typeof nativeCall.id === 'string' &&
                      nativeCall.id.length > 0
                        ? nativeCall.id
                        : createToolCallId(
                            'llama-cpp-tc',
                            callIndex
                          ),
                    name,
                    arguments: argumentsPart,
                    rawParts: [nativeCall],
                  });
                }
              }
            }
          } catch {
            // Ignore malformed/incomplete transport chunks.
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();

        if (trimmed.startsWith('data:')) {
          const jsonText = trimmed.slice(5).trim();

          if (jsonText !== '[DONE]') {
            try {
              const chunk = JSON.parse(jsonText);
              const delta = chunk.choices?.[0]?.delta;

              if (typeof delta?.content === 'string') {
                fullContent += delta.content;
                options.onToken?.(delta.content);
              }
            } catch {
              // Ignore incomplete trailing data.
            }
          }
        }
      }

      const toolCalls: IToolCall[] = [];

      for (const accumulated of toolCallsByIndex.values()) {
        if (!accumulated.name) {
          continue;
        }

        toolCalls.push({
          id: accumulated.id,
          toolId: accumulated.name,
          arguments: normalizeToolArguments(
            accumulated.arguments
          ),
          rawCall: accumulated.rawParts,
        });
      }

      return {
        content: fullContent,
        toolCalls:
          toolCalls.length > 0
            ? toolCalls
            : undefined,
        finishReason:
          toolCalls.length > 0
            ? 'tool_calls'
            : 'stop',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      return {
        content: '',
        error: message,
        finishReason: 'error',
      };
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Provider Registry Central Manager
// -----------------------------------------------------------------------------

export class ProviderRegistry {
  private static drivers: Map<
    string,
    IProviderDriver
  > = new Map();

  private static initialized = false;

  static initialize(): void {
    if (this.initialized) {
      return;
    }

    this.register(new OllamaProviderDriver());
    this.register(new LlamaCppProviderDriver());

    this.initialized = true;
  }

  static register(driver: IProviderDriver): void {
    this.drivers.set(driver.id, driver);
  }

  static getDriver(
    providerId: string
  ): IProviderDriver | undefined {
    this.initialize();

    return this.drivers.get(providerId);
  }

  static getAllDrivers(): IProviderDriver[] {
    this.initialize();

    return Array.from(this.drivers.values());
  }

  /**
   * Discover and inspect every registered provider.
   *
   * Provider state comes from the actual driver.
   */
  static async getProviders(): Promise<IProvider[]> {
    this.initialize();

    const providers: IProvider[] = [];

    for (const driver of this.drivers.values()) {
      const availability =
        await driver.checkAvailability();

      providers.push({
        id: driver.id,
        name: driver.name,
        type: driver.type,
        endpoint: driver.endpoint,
        state: availability.state,
        capabilities: driver.getCapabilities(),
        lastError: availability.error,
      });
    }

    return providers;
  }

  /**
   * Discover actual models exposed by every registered provider.
   */
  static async discoverAllModels(): Promise<IModelInfo[]> {
    this.initialize();

    const models: IModelInfo[] = [];

    for (const driver of this.drivers.values()) {
      const discoveredModels =
        await driver.discoverModels();

      models.push(...discoveredModels);
    }

    return models;
  }

  /**
   * Resolve a provider driver for a model.
   *
   * A preferred provider is authoritative when explicitly supplied.
   * Otherwise, the registry uses the model identifier only as a
   * provider-resolution hint.
   *
   * This method does not inspect skills, capabilities or permissions.
   */
  static resolveDriverForModel(
    modelId: string,
    preferredProviderId?: string
  ): IProviderDriver | undefined {
    this.initialize();

    if (
      preferredProviderId &&
      this.drivers.has(preferredProviderId)
    ) {
      return this.drivers.get(
        preferredProviderId
      );
    }

    const normalizedModelId =
      modelId.toLowerCase();

    if (
      normalizedModelId.includes('gguf') ||
      normalizedModelId.includes('llama.cpp')
    ) {
      return (
        this.drivers.get('llama.cpp') ||
        this.drivers.get('ollama')
      );
    }

    return (
      this.drivers.get('ollama') ||
      this.drivers.get('llama.cpp')
    );
  }
}