
/**
 * EVIS RUNTIME — AGENT LOOP
 *
 * Executes the model/tool interaction loop.
 *
 * Architectural flow:
 *
 * Assembled Context
 *      ↓
 * Provider Model
 *      ↓
 * Assistant Response
 *      ↓
 * Tool Calls?
 *   ┌──┴──┐
 *   │ No  │ → Final Response
 *   │ Yes │
 *   ↓
 * ToolExecutor
 *      ↓
 * Real Tool Result
 *      ↓
 * Back to Model
 *
 * IMPORTANT:
 *
 * - The agent loop does not execute tools directly.
 * - The model decides whether a tool call is required.
 * - ToolExecutor is the only execution boundary.
 * - No textual/regex tool-call fallback is used.
 * - Missing implementations are real failures.
 * - The loop must return to the model after tool execution.
 */

import type {
  CapabilityId,
  IMessage,
  IModelInfo,
  IRuntimeContext,
  IToolCall,
  IToolResult,
} from '../types/domain';

import type {
  IProviderDriver,
  IProviderGenerateResult,
} from '../registries/providerRegistry';

import type { IAssembledContext } from '../context/contextManager';

import { ToolExecutor } from '../execution/toolExecutor';

export interface IAgentLoopCallbacks {
  onAssistantMessage?: (message: IMessage) => void;
  onToolCall?: (call: IToolCall) => void;
  onToolResult?: (result: IToolResult) => void;
}

export interface IAgentLoopOptions {
  modelId: string;
  providerDriver: IProviderDriver;
  context: IAssembledContext;
  runtimeContext: IRuntimeContext;
  toolExecutor: ToolExecutor;
  resolvedCapabilities?: CapabilityId[];
  maxIterations?: number;
  callbacks?: IAgentLoopCallbacks;
  signal?: AbortSignal;
}

export interface IAgentLoopResult {
  content: string;
  messages: IMessage[];
  toolResults: IToolResult[];
  iterations: number;
  finishReason?: string;
}

export class AgentLoop {
  /**
   * Runs the model/tool interaction loop until the model produces
   * a final response or the iteration limit is reached.
   */
  static async run(
    options: IAgentLoopOptions
  ): Promise<IAgentLoopResult> {
    const maxIterations =
      options.maxIterations ?? 10;

    const messages =
      this.normalizeMessages(
        options.context.messages
      );

    const toolResults: IToolResult[] = [];

    const toolExecutor =
      options.toolExecutor;

    let iterations = 0;
    let lastResult:
      | IProviderGenerateResult
      | undefined;

    while (iterations < maxIterations) {
      if (options.signal?.aborted) {
        throw new Error(
          'Agent execution was cancelled.'
        );
      }

      iterations += 1;

      const result =
        await options.providerDriver.generate({
          modelId: options.modelId,
          messages,
          systemPrompt:
            options.context.systemPrompt,
          tools:
            options.context.tools,
          signal: options.signal,
        });

      lastResult = result;

      /*
       * -------------------------------------------------------------
       * Provider error
       * -------------------------------------------------------------
       */
      if (result.error) {
        throw new Error(
          result.error
        );
      }

      /*
       * -------------------------------------------------------------
       * Assistant response
       * -------------------------------------------------------------
       */
      const assistantMessage: IMessage = {
        role: 'assistant',
        content: result.content ?? '',
        toolCalls:
          result.toolCalls?.length
            ? result.toolCalls
            : undefined,
        timestamp:
          new Date().toISOString(),
      };

      messages.push(
        assistantMessage
      );

      options.callbacks?.onAssistantMessage?.(
        assistantMessage
      );

      /*
       * -------------------------------------------------------------
       * No tool call → final response
       * -------------------------------------------------------------
       */
      if (
        !result.toolCalls ||
        result.toolCalls.length === 0
      ) {
        return {
          content:
            result.content ?? '',
          messages,
          toolResults,
          iterations,
          finishReason:
            result.finishReason,
        };
      }

      /*
       * -------------------------------------------------------------
       * Execute model-generated tool calls
       * -------------------------------------------------------------
       *
       * Every tool call passes through the injected ToolExecutor.
       *
       * AgentLoop does not:
       * - inspect filesystem
       * - execute shell commands
       * - perform HTTP requests
       * - grant permissions
       * - invoke tool implementations directly
       */
      const currentToolResults: IToolResult[] = [];

      for (const call of result.toolCalls) {
        if (options.signal?.aborted) {
          throw new Error(
            'Agent execution was cancelled.'
          );
        }

        options.callbacks?.onToolCall?.(
          call
        );

        const toolResult =
          await toolExecutor.execute({
            call,
            context:
              options.runtimeContext,
            resolvedCapabilities:
              options.resolvedCapabilities,
          });

        currentToolResults.push(
          toolResult
        );

        toolResults.push(
          toolResult
        );

        options.callbacks?.onToolResult?.(
          toolResult
        );
      }

      /*
       * -------------------------------------------------------------
       * Return tool results to the model
       * -------------------------------------------------------------
       *
       * Tool results are part of the conversation state.
       * The next model generation therefore has access to the
       * actual result of the operation.
       */
      const toolMessage: IMessage = {
        role: 'tool',
        content:
          this.serializeToolResults(
            currentToolResults
          ),
        toolResults:
          currentToolResults,
        timestamp:
          new Date().toISOString(),
      };

      messages.push(
        toolMessage
      );
    }

    /*
     * ---------------------------------------------------------------
     * Iteration limit
     * ---------------------------------------------------------------
     *
     * Do not simulate completion.
     *
     * One final model call is made without tools so the model can
     * honestly summarize the state reached by the execution.
     */
    if (options.signal?.aborted) {
      throw new Error(
        'Agent execution was cancelled.'
      );
    }

    const fallbackModel =
      this.createFallbackModel(
        options.modelId
      );

    const finalResult =
      await options.providerDriver.generate({
        modelId:
          fallbackModel.id,
        messages,
        systemPrompt: [
          options.context.systemPrompt,
          '',
          'The maximum agent iteration limit has been reached.',
          'Do not claim that unfinished work was completed.',
          'Provide an honest final response based only on the actual tool results and conversation state.',
        ].join('\n'),
        tools: [],
        signal: options.signal,
      });

    if (finalResult.error) {
      throw new Error(
        finalResult.error
      );
    }

    const finalMessage: IMessage = {
      role: 'assistant',
      content:
        finalResult.content ?? '',
      timestamp:
        new Date().toISOString(),
    };

    messages.push(
      finalMessage
    );

    options.callbacks?.onAssistantMessage?.(
      finalMessage
    );

    return {
      content:
        finalResult.content ?? '',
      messages,
      toolResults,
      iterations,
      finishReason:
        finalResult.finishReason ??
        lastResult?.finishReason,
    };
  }

  /**
   * Copies the canonical runtime messages into the agent loop state.
   *
   * ContextManager already returns IMessage objects, so no legacy
   * provider-message conversion is required here.
   */
  private static normalizeMessages(
    sourceMessages: IMessage[]
  ): IMessage[] {
    return sourceMessages.map(
      (message) => ({
        ...message,
        content: message.content ?? '',
      })
    );
  }

  /**
   * Serializes actual tool results into content that can be
   * consumed by the next model turn.
   */
  private static serializeToolResults(
    results: IToolResult[]
  ): string {
    return results
      .map((result) => {
        return JSON.stringify({
          callId:
            result.callId,
          toolId:
            result.toolId,
          status:
            result.status,
          data:
            result.data,
          error:
            result.error,
          stdout:
            result.stdout,
          stderr:
            result.stderr,
          durationMs:
            result.durationMs,
        });
      })
      .join('\n');
  }

  /**
   * Creates the minimum valid model information required by the
   * provider contract when performing the final no-tools turn.
   *
   * This does not invent provider/model availability. It only
   * supplies the structural model information required by the
   * current provider interface.
   */
  private static createFallbackModel(
    modelId: string
  ): IModelInfo {
    return {
      id: modelId,
      name: modelId,
      providerId: 'unknown',
      status: 'unknown',
      capabilities: {
        toolCalling: false,
        streaming: false,
        structuredOutput: false,
      },
    };
  }
}

