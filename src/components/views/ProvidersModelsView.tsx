import React, { useState } from 'react';
import {
  Cpu,
  RotateCcw,
  CheckCircle2,
  Download,
  Zap,
  Server,
  ArrowRight,
  Play,
  Square,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { OllamaService } from '../../services/ollamaService';

export const ProvidersModelsView: React.FC = () => {
  const [pullModelName, setPullModelName] = useState('');
  const [pullStatus, setPullStatus] = useState<string>('');
  const [pullPercent, setPullPercent] = useState<number | undefined>(undefined);
  const [isPulling, setIsPulling] = useState(false);
  const [testResult, setTestResult] = useState<{ modelId: string; text: string; ms: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const {
    models,
    providers,
    activeProviderId,
    setActiveProvider,
    systemStatus,
    setDefaultModel,
    setModelInSession,
    setActiveView,
    isDiscovering,
    discoverProvidersAndModels,
    startProviderProcess,
    stopProviderProcess,
    isStartingProvider,
    providerProcessTelemetry,
    fetchProcessTelemetry,
    autoLaunchProviders,
    setAutoLaunchProviders,
  } = useAppStore();

  const currentProvider = providers.find((p) => p.id === activeProviderId) || {
    id: activeProviderId,
    name: activeProviderId === 'ollama' ? 'Ollama' : 'llama.cpp',
    status: 'offline' as const,
    endpoint: activeProviderId === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080',
    description: '',
    models: [],
  };

  // Filter models belonging strictly to the current active provider (§21)
  const currentProviderModels = models.filter((m) => m.provider === activeProviderId);

  // Other provider
  const otherProviderId = activeProviderId === 'ollama' ? 'llama.cpp' : 'ollama';
  const otherProvider = providers.find((p) => p.id === otherProviderId) || {
    id: otherProviderId,
    name: otherProviderId === 'ollama' ? 'Ollama' : 'llama.cpp',
    status: 'offline' as const,
    endpoint: otherProviderId === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080',
    description: '',
    models: [],
  };
  const otherProviderModels = models.filter((m) => m.provider === otherProviderId);

  const handlePullModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullModelName.trim() || isPulling) return;

    setIsPulling(true);
    setPullStatus('Initialisation du téléchargement...');
    setPullPercent(undefined);

    const success = await OllamaService.pullModel(pullModelName.trim(), (status, percent) => {
      setPullStatus(status);
      setPullPercent(percent);
    });

    if (success) {
      setPullStatus('✓ Modèle téléchargé avec succès !');
      await discoverProvidersAndModels();
    } else {
      setPullStatus('❌ Échec du téléchargement. Vérifiez la connexion ou le tag du modèle.');
    }
    setIsPulling(false);
  };

  const handleTestInference = async (modelId: string) => {
    setIsTesting(true);
    setTestResult(null);
    const startTime = performance.now();

    try {
      if (activeProviderId === 'llama.cpp') {
        const res = await fetch('/llama-cpp/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'Ping: réponds "OK local"' }],
            stream: false,
          }),
          signal: AbortSignal.timeout(45000),
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (res.ok) {
          const json = await res.json();
          const reply = json.choices?.[0]?.message?.content || 'Réponse reçue';
          setTestResult({ modelId, text: reply, ms: elapsed });
        } else {
          setTestResult({ modelId, text: `Erreur HTTP ${res.status}`, ms: elapsed });
        }
      } else {
        const res = await fetch('/ollama/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'Ping: réponds "OK local"' }],
            stream: false,
          }),
          signal: AbortSignal.timeout(45000),
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (res.ok) {
          const json = await res.json();
          const reply = json.message?.content || 'Réponse reçue';
          setTestResult({ modelId, text: reply, ms: elapsed });
        } else {
          setTestResult({ modelId, text: `Erreur HTTP ${res.status}`, ms: elapsed });
        }
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      setTestResult({ modelId, text: `Erreur: ${(err as Error).message}`, ms: elapsed });
    }
    setIsTesting(false);
  };

  const handleUseModelAndChat = async (modelId: string) => {
    await setModelInSession(modelId);
    if (activeProviderId === 'llama.cpp') {
      await startProviderProcess('llama.cpp', modelId);
    }
    setActiveView('chat');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b subtle-border pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <Cpu className="text-emerald-400" size={24} />
              <span>Providers & Modèles IA Locaux</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Architecture multi-provider locale-first : Ollama et llama.cpp gérés séparément avec détection automatique en arrière-plan.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => discoverProvidersAndModels()}
              disabled={isDiscovering}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
              title="Interroger les hôtes locaux en direct"
            >
              <RotateCcw size={13} className={isDiscovering ? 'animate-spin text-emerald-400' : ''} />
              <span>{isDiscovering ? 'Sonde en cours...' : 'Sonder les hôtes'}</span>
            </button>

            <button
              onClick={() => setActiveView('chat')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-medium transition-colors cursor-pointer"
            >
              Aller au Chat
            </button>
          </div>
        </div>

        {/* Provider Switcher Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Ollama */}
          <div
            onClick={() => setActiveProvider('ollama')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeProviderId === 'ollama'
                ? 'bg-neutral-900 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-lg'
                : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Server size={18} className={activeProviderId === 'ollama' ? 'text-emerald-400' : 'text-neutral-400'} />
                <div>
                  <h3 className="font-semibold text-sm text-neutral-100">Ollama</h3>
                  <div className="text-[10px] text-neutral-400 font-mono">http://127.0.0.1:11434</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    providers.find((p) => p.id === 'ollama')?.status === 'active'
                      ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                  }`}
                >
                  {providers.find((p) => p.id === 'ollama')?.status === 'active' ? 'En ligne ●' : 'Hors-ligne ○'}
                </span>

                {activeProviderId === 'ollama' && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-wider">
                    Actif
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Démon local pour modèles GGUF avec gestion automatique de la mémoire et GPU/CPU.
            </p>
          </div>

          {/* Option 2: llama.cpp */}
          <div
            onClick={() => setActiveProvider('llama.cpp')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeProviderId === 'llama.cpp'
                ? 'bg-neutral-900 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg'
                : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Zap size={18} className={activeProviderId === 'llama.cpp' ? 'text-amber-400' : 'text-neutral-400'} />
                <div>
                  <h3 className="font-semibold text-sm text-neutral-100">llama.cpp</h3>
                  <div className="text-[10px] text-neutral-400 font-mono">http://127.0.0.1:8080 (llama-server)</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    providers.find((p) => p.id === 'llama.cpp')?.status === 'active'
                      ? 'bg-amber-950/70 border-amber-800/60 text-amber-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                  }`}
                >
                  {providers.find((p) => p.id === 'llama.cpp')?.status === 'active' ? 'En ligne ●' : 'Hors-ligne ○'}
                </span>

                {activeProviderId === 'llama.cpp' && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wider">
                    Actif
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Moteur d'inférence C/C++ haute performance natif pour exécution GGUF ultra-rapide.
            </p>
          </div>
        </div>

        {/* Process Lifecycle Control Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border subtle-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Server size={16} className={currentProvider.status === 'active' ? 'text-emerald-400' : 'text-amber-400'} />
                <h3 className="font-semibold text-sm text-neutral-100">
                  Gestion du Démon Hôte : {currentProvider.name}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  currentProvider.status === 'active'
                    ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-400'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}>
                  {currentProvider.status === 'active' ? 'En exécution ●' : 'Arrêté ○'}
                </span>
              </div>
              <p className="text-neutral-400 text-xs mt-0.5">
                Contrôlez l'exécution du processus natif en arrière-plan sans avoir à ouvrir un terminal externe.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {currentProvider.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => stopProviderProcess(activeProviderId)}
                  className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Square size={12} fill="currentColor" />
                  <span>Arrêter le serveur</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isStartingProvider}
                  onClick={() => startProviderProcess(activeProviderId)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Play size={12} fill="currentColor" />
                  <span>{isStartingProvider ? 'Démarrage en cours...' : `Démarrer ${currentProvider.name}`}</span>
                </button>
              )}

              {activeProviderId === 'llama.cpp' && (
                <button
                  type="button"
                  onClick={async () => {
                    await fetchProcessTelemetry();
                    setShowLogs(!showLogs);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors cursor-pointer border border-neutral-700"
                >
                  {showLogs ? 'Masquer logs' : 'Voir logs'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t subtle-border/50 text-[11px] text-neutral-400">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoLaunchProviders}
                onChange={(e) => setAutoLaunchProviders(e.target.checked)}
                className="rounded bg-neutral-800 border-neutral-700 text-emerald-500 focus:ring-0"
              />
              <span>Démarrer automatiquement en arrière-plan lorsque vous sélectionnez ce provider</span>
            </label>

            <span className="font-mono text-[10px] text-neutral-500">
              Port : {activeProviderId === 'ollama' ? '11434' : '8080'}
            </span>
          </div>

          {/* Logs View */}
          {showLogs && (
            <div className="mt-2 p-2.5 rounded-lg bg-black border border-neutral-800 font-mono text-[10px] text-neutral-300 max-h-40 overflow-y-auto space-y-0.5">
              <div className="text-neutral-500 pb-1 border-b border-neutral-900 flex items-center justify-between">
                <span>Journal des logs llama-server</span>
                <span>Dernières lignes</span>
              </div>
              {providerProcessTelemetry?.llamaCpp?.logs && providerProcessTelemetry.llamaCpp.logs.length > 0 ? (
                providerProcessTelemetry.llamaCpp.logs.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">{line}</div>
                ))
              ) : (
                <div className="text-neutral-600 italic">Aucun log enregistré pour le moment.</div>
              )}
            </div>
          )}
        </div>

        {/* DEDICATED SECTION: Modèles du Provider Actuel (§18-21) */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border subtle-border space-y-4">
          <div className="flex items-center justify-between border-b subtle-border pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Section Dédiée
                </span>
                <span className="text-neutral-600">/</span>
                <h2 className="text-base font-bold text-neutral-100">
                  Modèles disponibles pour {currentProvider.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-xs font-mono font-medium">
                  {currentProviderModels.length} détecté{currentProviderModels.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cette liste est interrogée automatiquement depuis l'hôte <code className="text-neutral-300 font-mono">{currentProvider.endpoint}</code>.
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-neutral-400">Modèle Actif : </span>
              <strong className="text-emerald-400 font-mono text-xs ml-1">
                {systemStatus.modelName || 'Aucun'}
              </strong>
            </div>
          </div>

          {/* Test Inference Feedback Banner */}
          {testResult && (
            <div className="p-3 rounded-lg bg-neutral-950 border border-emerald-800/60 font-mono text-xs text-neutral-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-emerald-400">Test {testResult.modelId} :</span>
                <span className="text-neutral-300 truncate">"{testResult.text}"</span>
              </div>
              <span className="text-neutral-500 text-[11px] font-mono flex-shrink-0 ml-2">
                Latence : {testResult.ms} ms
              </span>
            </div>
          )}

          {/* Models Listing */}
          {currentProviderModels.length === 0 ? (
            <div className="p-6 rounded-lg bg-neutral-950 border subtle-border text-center space-y-3">
              <p className="text-neutral-400 text-xs">
                Aucun modèle n'est actuellement détecté sur l'hôte {currentProvider.name} ({currentProvider.endpoint}).
              </p>

              {activeProviderId === 'ollama' ? (
                <div className="max-w-md mx-auto text-left text-xs text-neutral-400 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 space-y-1">
                  <div className="font-semibold text-neutral-200">Comment ajouter un modèle dans Ollama :</div>
                  <div>Utilisez le formulaire ci-dessous pour télécharger un modèle comme <code className="text-emerald-400">qwen2.5-coder:1.5b</code>.</div>
                </div>
              ) : (
                <div className="max-w-xl mx-auto text-left text-xs text-neutral-400 bg-neutral-900/60 p-3.5 rounded-lg border border-neutral-800 space-y-2">
                  <div className="font-semibold text-neutral-200">Comment démarrer llama-server :</div>
                  <p className="text-neutral-400 text-[11px]">
                    Lancez le binaire en lui indiquant votre fichier GGUF local et le port 8080 :
                  </p>
                  <pre className="bg-black p-2.5 rounded font-mono text-[10px] text-amber-300 overflow-x-auto select-all">
/home/junior/llama.cpp/llama-server -m /home/junior/.ollama/models/blobs/sha256-29d8c98fa6b098e200069bfb88b9508dc3e85586d20cba59f8dda9a808165104 --port 8080 --host 127.0.0.1 -c 4096 --alias qwen2.5-coder-1.5b-gguf
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {currentProviderModels.map((model) => {
                const isDefault = model.id === systemStatus.modelName;
                return (
                  <div
                    key={model.id}
                    className="p-4 rounded-xl bg-neutral-950 border subtle-border hover:border-neutral-700 transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                        <span className="font-bold text-sm text-neutral-100 font-mono">{model.name}</span>
                        {model.id.toLowerCase().includes('14b') && (
                          <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/60 text-[11px] font-mono text-purple-300 font-bold">
                            14.8B
                          </span>
                        )}
                        {model.id.toLowerCase().includes('1.5b') && (
                          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-[11px] font-mono text-blue-300 font-bold">
                            1.5B
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono text-neutral-300">
                          {model.size || 'Local'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-[11px] font-mono text-emerald-400">
                          {model.quantization || 'Q4_K_M'}
                        </span>
                        {model.contextWindow && (
                          <span className="px-2 py-0.5 rounded bg-neutral-800/80 text-[11px] font-mono text-neutral-400">
                            ctx {model.contextWindow}
                          </span>
                        )}
                        {isDefault && (
                          <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center space-x-1">
                            <CheckCircle2 size={13} />
                            <span>Par défaut</span>
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-400 text-xs mt-1">{model.description}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {activeProviderId === 'llama.cpp' && (
                        <button
                          onClick={() => startProviderProcess('llama.cpp', model.id)}
                          disabled={isStartingProvider}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                          title="Démarrer llama-server avec ce modèle"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>Lancer</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTestInference(model.id)}
                        disabled={isTesting}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors cursor-pointer"
                        title="Tester une inférence rapide sur ce modèle"
                      >
                        <Zap size={12} className="text-amber-400" />
                        <span>Tester</span>
                      </button>

                      {!isDefault && (
                        <button
                          onClick={() => setDefaultModel(model.id)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors cursor-pointer"
                        >
                          Définir par défaut
                        </button>
                      )}

                      <button
                        onClick={() => handleUseModelAndChat(model.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer"
                      >
                        <span>Utiliser</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form to pull new model for Ollama */}
          {activeProviderId === 'ollama' && (
            <div className="border-t subtle-border pt-4 mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Télécharger un nouveau modèle depuis le registre Ollama
              </div>
              <form onSubmit={handlePullModel} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={pullModelName}
                  onChange={(e) => setPullModelName(e.target.value)}
                  placeholder="ex: qwen2.5:0.5b, llama3.2:1b, mistral:7b..."
                  className="flex-1 bg-neutral-950 border subtle-border rounded-lg px-3 py-2 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!pullModelName.trim() || isPulling}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    pullModelName.trim() && !isPulling
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Download size={13} />
                  <span>{isPulling ? 'Téléchargement...' : 'Télécharger le modèle'}</span>
                </button>
              </form>

              {pullStatus && (
                <div className="p-2.5 rounded bg-neutral-950 border subtle-border font-mono text-xs text-neutral-300 space-y-1">
                  <div>{pullStatus}</div>
                  {pullPercent !== undefined && (
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pullPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Secondary Provider Quick Peek Card */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border subtle-border flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-400">Autre provider disponible :</span>
              <span className="font-semibold text-xs text-neutral-200">{otherProvider.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  otherProvider.status === 'active' ? 'text-emerald-400' : 'text-neutral-500'
                }`}
              >
                ({otherProvider.status === 'active' ? 'En ligne' : 'Hors-ligne'}, {otherProviderModels.length} modèle{otherProviderModels.length > 1 ? 's' : ''})
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{otherProvider.endpoint}</div>
          </div>

          <button
            onClick={() => setActiveProvider(otherProviderId)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors cursor-pointer"
          >
            <span>Basculer sur {otherProvider.name}</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
