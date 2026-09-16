import { OllamaService } from './ollamaService';
import { LlamaCppService } from './llamaCppService';
import { IModel } from '../types';

export interface IProviderInfo {
  id: 'ollama' | 'llama.cpp';
  name: string;
  status: 'active' | 'available' | 'not-configured' | 'offline';
  description: string;
  endpoint?: string;
  models: IModel[];
}

export class ProviderService {
  /**
   * Queries both Ollama and llama.cpp hosts dynamically in the background
   * Returns detected providers and their real, currently available models
   */
  static async discoverProviders(): Promise<IProviderInfo[]> {
    const providers: IProviderInfo[] = [];

    // 1. Ollama Provider Discovery
    try {
      const ollamaRes = await OllamaService.listModels();
      const detectedOllamaModels: IModel[] = ollamaRes.models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        status: 'ready' as const,
        size: `${(m.size / (1024 * 1024)).toFixed(0)} MB`,
        quantization: m.details?.quantization_level || 'Q4_K_M',
        contextWindow: m.details?.parameter_size ? 32768 : 16384,
        description: `Ollama local model (${m.details?.family || 'local'})`,
      }));

      providers.push({
        id: 'ollama',
        name: 'Ollama',
        status: ollamaRes.online ? 'active' : 'offline',
        endpoint: 'http://127.0.0.1:11434',
        description: 'Local daemon running GGUF models with automatic GPU/CPU acceleration.',
        models: detectedOllamaModels,
      });
    } catch {
      providers.push({
        id: 'ollama',
        name: 'Ollama',
        status: 'offline',
        endpoint: 'http://127.0.0.1:11434',
        description: 'Local daemon running GGUF models with automatic GPU/CPU acceleration.',
        models: [],
      });
    }

    // 2. llama.cpp Provider Discovery (strictly separate as required by §18-20)
    try {
      const llamaRes = await LlamaCppService.listModels();
      providers.push({
        id: 'llama.cpp',
        name: 'llama.cpp',
        status: llamaRes.online ? 'active' : 'offline',
        endpoint: 'http://127.0.0.1:8080',
        description: 'High-performance standalone C/C++ inference engine (llama-server).',
        models: llamaRes.models,
      });
    } catch {
      providers.push({
        id: 'llama.cpp',
        name: 'llama.cpp',
        status: 'offline',
        endpoint: 'http://127.0.0.1:8080',
        description: 'High-performance standalone C/C++ inference engine (llama-server).',
        models: [],
      });
    }

    return providers;
  }

  /**
   * Queries all hosts and returns an aggregated list of all currently available models
   */
  static async discoverAllModels(): Promise<{ models: IModel[]; providers: IProviderInfo[] }> {
    const providers = await this.discoverProviders();
    const allModels: IModel[] = [];

    for (const p of providers) {
      allModels.push(...p.models);
    }

    return { models: allModels, providers };
  }

  /**
   * Starts a local provider daemon in the background via the backend host bridge
   */
  static async startProvider(
    provider: 'llama.cpp' | 'ollama',
    modelId?: string,
    modelPath?: string
  ): Promise<{ success: boolean; message: string; pid?: number; activeModel?: string }> {
    try {
      const res = await fetch('/api/provider/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId, modelPath }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection to backend bridge failed' };
    }
  }

  /**
   * Stops a running provider daemon
   */
  static async stopProvider(provider: 'llama.cpp' | 'ollama'): Promise<{ success: boolean; status: string }> {
    try {
      const res = await fetch('/api/provider/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, status: 'error' };
    }
  }

  /**
   * Fetches real-time host process telemetry and logs
   */
  static async getProcessTelemetry(): Promise<{
    llamaCpp: { running: boolean; status: string; pid?: number; logs: string[] };
    ollama: { running: boolean; status: string };
  } | null> {
    try {
      const res = await fetch('/api/provider/status');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

