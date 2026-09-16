export interface OllamaModelTag {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaService {
  private static baseUrl = typeof window !== 'undefined' ? '/ollama' : 'http://127.0.0.1:11434';

  /**
   * Check if Ollama daemon is reachable and list downloaded models
   */
  static async listModels(): Promise<{ online: boolean; models: OllamaModelTag[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { online: false, models: [] };
      }
      const data = await res.json();
      return {
        online: true,
        models: data.models || [],
      };
    } catch {
      return { online: false, models: [] };
    }
  }

  /**
   * Trigger pulling a model with streaming progress
   */
  static async pullModel(
    modelName: string,
    onProgress?: (status: string, percent?: number) => void
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!res.ok || !res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((l) => l.trim().length > 0);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const status = data.status || 'pulling...';
            let percent: number | undefined;
            if (data.total && data.completed) {
              percent = Math.round((data.completed / data.total) * 100);
            }
            onProgress?.(status, percent);
          } catch {
            // ignore non-json chunk
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the list of models currently loaded in Ollama's memory (via /api/ps).
   */
  static async getLoadedModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/ps`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Unloads a model from Ollama memory by sending keep_alive=0.
   * Safe to call even if the model is not currently loaded.
   */
  static async unloadModel(modelName: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, keep_alive: 0 }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // Ignore – model may already be unloaded or Ollama offline
    }
  }

  /**
   * Unloads ALL currently loaded models from Ollama memory.
   * Call this before loading a different model to avoid RAM saturation.
   */
  static async unloadAllModels(): Promise<void> {
    const loaded = await this.getLoadedModels();
    await Promise.all(loaded.map((name) => this.unloadModel(name)));
  }

  /**
   * Stream chat completion token by token using Ollama /api/chat
   */
  static async streamChat(
    model: string,
    messages: { role: string; content: string }[],
    systemPrompt?: string,
    onChunk?: (token: string) => void,
    onComplete?: () => void,
    onError?: (err: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    try {
      const formattedMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          stream: true,
        }),
        signal: abortSignal,
      });

      if (!res.ok) {
        throw new Error(`Ollama server returned status ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error('No readable body received from Ollama');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((l) => l.trim().length > 0);

        for (const line of lines) {
          try {
            const parsed: OllamaChatResponse = JSON.parse(line);
            if (parsed.message?.content) {
              onChunk?.(parsed.message.content);
            }
            if (parsed.done) {
              onComplete?.();
              return;
            }
          } catch {
            // ignore non-json line
          }
        }
      }

      onComplete?.();
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        onComplete?.();
      } else {
        onError?.(err as Error);
      }
    }
  }
}
