import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Shield,
  HardDrive,
  Activity,
  CheckCircle2,
  Download,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { OllamaService } from '../../services/ollamaService';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'permissions' | 'storage' | 'diagnostics'>('models');
  const [pullModelName, setPullModelName] = useState('');
  const [pullStatus, setPullStatus] = useState<string>('');
  const [pullPercent, setPullPercent] = useState<number | undefined>(undefined);
  const [isPulling, setIsPulling] = useState(false);

  const {
    models,
    providers,
    sessions,
    projects,
    skills,
    knowledge,
    isDiscovering,
    discoverProvidersAndModels,
    systemStatus,
    setDefaultModel,
    setActiveView,
    checkOllama,
    exportWorkspaceBackup,
    importWorkspaceBackup,
    resetWorkspaceData,
  } = useAppStore();

  const handlePullModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullModelName.trim() || isPulling) return;

    setIsPulling(true);
    setPullStatus('Initializing pull...');
    setPullPercent(undefined);

    const success = await OllamaService.pullModel(pullModelName.trim(), (status, percent) => {
      setPullStatus(status);
      setPullPercent(percent);
    });

    if (success) {
      setPullStatus('✓ Model downloaded successfully!');
      await checkOllama();
    } else {
      setPullStatus('❌ Failed to pull model. Check network or tag name.');
    }
    setIsPulling(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b subtle-border pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <Settings className="text-neutral-300" size={22} />
              <span>Evis Settings & Providers</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Manage local AI providers (Ollama, llama.cpp), sandbox permissions, storage, and system telemetry.
            </p>
          </div>

          <button
            onClick={() => setActiveView('chat')}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors cursor-pointer"
          >
            Back to Chat
          </button>
        </div>

        {/* Setting Tabs */}
        <div className="flex space-x-2 border-b subtle-border pb-2 text-xs select-none">
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'models' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cpu size={14} />
            <span>Providers & Models</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'permissions' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield size={14} />
            <span>Sandbox & Permissions</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'storage' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HardDrive size={14} />
            <span>Storage & Memory</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'diagnostics' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity size={14} />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Tab 1: Providers & Models */}
        {activeTab === 'models' && (
          <div className="space-y-6 text-xs">
            {/* Host Discovery Control Banner */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border subtle-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-neutral-200 text-sm flex items-center space-x-2">
                  <Activity size={16} className="text-emerald-400" />
                  <span>Dynamic Host Probing</span>
                </h2>
                <p className="text-neutral-400 text-[11px] mt-0.5">
                  Probes local daemons automatically on port 11434 (Ollama) and port 8080 (llama.cpp) to discover active models.
                </p>
              </div>

              <button
                type="button"
                onClick={() => discoverProvidersAndModels()}
                disabled={isDiscovering}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw size={12} className={isDiscovering ? 'animate-spin text-emerald-400' : ''} />
                <span>{isDiscovering ? 'Probing Hosts...' : 'Rescan Endpoints'}</span>
              </button>
            </div>

            {/* Provider 1: Ollama */}
            {(() => {
              const ollamaModels = models.filter((m) => m.provider === 'ollama');
              const ollamaProvider = providers.find((p) => p.id === 'ollama');
              const isOnline = ollamaProvider?.status === 'active' || ollamaModels.length > 0;

              return (
                <div className="p-5 rounded-xl bg-neutral-900/60 border subtle-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-sm text-neutral-100">Provider: Ollama</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          isOnline
                            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                            : 'bg-neutral-800/60 border-neutral-700 text-neutral-500'
                        }`}>
                          {isOnline ? 'Connected ●' : 'Offline ○'}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-[11px] mt-0.5 font-mono">
                        Host: http://127.0.0.1:11434 (Vite proxy /ollama)
                      </p>
                    </div>

                    <span className="flex items-center space-x-1 text-neutral-400 font-mono text-[11px]">
                      <span>Active Default:</span>
                      <strong className="text-emerald-400 ml-1">{systemStatus.modelName}</strong>
                    </span>
                  </div>

                  {/* Detected Ollama Models List */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Models Available on Ollama Host ({ollamaModels.length})
                    </div>

                    {ollamaModels.length === 0 ? (
                      <div className="p-3 rounded bg-neutral-950 border subtle-border text-neutral-500">
                        {isOnline ? 'No models installed in Ollama. Pull one below.' : 'Ollama host is currently offline or unreachable.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {ollamaModels.map((model) => {
                          const isDefault = model.id === systemStatus.modelName;
                          return (
                            <div
                              key={model.id}
                              className="p-3 rounded-lg bg-neutral-950 border subtle-border flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-neutral-200">{model.name}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-400">
                                    {model.size || 'Local'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-[10px] font-mono text-emerald-400 border border-emerald-900/40">
                                    {model.quantization || 'Q4_K_M'}
                                  </span>
                                  {isDefault && (
                                    <span className="text-emerald-400 text-[10px] font-mono flex items-center space-x-1">
                                      <CheckCircle2 size={11} />
                                      <span>Default</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-neutral-500 text-[10px] mt-0.5">{model.description}</p>
                              </div>

                              <div className="flex items-center space-x-2">
                                {!isDefault && (
                                  <button
                                    onClick={() => setDefaultModel(model.id)}
                                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors cursor-pointer"
                                  >
                                    Set Default
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pull Model Form */}
                  <div className="border-t subtle-border pt-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Pull New Model from Ollama Registry
                    </div>
                    <form onSubmit={handlePullModel} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={pullModelName}
                        onChange={(e) => setPullModelName(e.target.value)}
                        placeholder="e.g. qwen2.5:0.5b, llama3.2:1b, mistral:7b..."
                        className="flex-1 bg-neutral-950 border subtle-border rounded-lg px-3 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!pullModelName.trim() || isPulling}
                        className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          pullModelName.trim() && !isPulling
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        <Download size={13} />
                        <span>{isPulling ? 'Pulling...' : 'Pull Model'}</span>
                      </button>
                    </form>

                    {pullStatus && (
                      <div className="p-2.5 rounded bg-neutral-950 border subtle-border font-mono text-[11px] text-neutral-300 space-y-1">
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
                </div>
              );
            })()}

            {/* Provider 2: llama.cpp (Strictly separate as required by §18-20) */}
            {(() => {
              const llamaCppModels = models.filter((m) => m.provider === 'llama.cpp');
              const llamaCppProvider = providers.find((p) => p.id === 'llama.cpp');
              const isOnline = llamaCppProvider?.status === 'active' || llamaCppModels.length > 0;

              return (
                <div className="p-5 rounded-xl bg-neutral-900/60 border subtle-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-sm text-neutral-100">Provider: llama.cpp</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          isOnline
                            ? 'bg-amber-950/60 border-amber-800/60 text-amber-400'
                            : 'bg-neutral-800/60 border-neutral-700 text-neutral-500'
                        }`}>
                          {isOnline ? 'Connected ●' : 'Offline ○'}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-[11px] mt-0.5 font-mono">
                        Host: http://127.0.0.1:8080 (Vite proxy /llama-cpp)
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 font-mono">Inference Engine: llama-server</span>
                    </div>
                  </div>

                  {/* Detected llama.cpp Models List */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Models Available on llama.cpp Host ({llamaCppModels.length})
                    </div>

                    {llamaCppModels.length === 0 ? (
                      <div className="p-3.5 rounded-lg bg-neutral-950 border subtle-border text-neutral-400 space-y-2">
                        <div>
                          {isOnline
                            ? 'llama-server is running on port 8080, but no model alias is registered.'
                            : 'llama-server is currently not running on port 8080.'}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-500 bg-neutral-900 p-2 rounded border border-neutral-800">
                          Exemple de commande pour démarrer llama-server :<br />
                          <span className="text-amber-300">
                            /home/junior/llama.cpp/llama-server -m &lt;chemin-vers-modele.gguf&gt; --port 8080 --host 127.0.0.1 -c 4096
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {llamaCppModels.map((model) => {
                          const isDefault = model.id === systemStatus.modelName;
                          return (
                            <div
                              key={model.id}
                              className="p-3 rounded-lg bg-neutral-950 border subtle-border flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-neutral-200">{model.name}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-400">
                                    {model.size || 'GGUF'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-[10px] font-mono text-amber-400 border border-amber-900/40">
                                    {model.quantization || 'Q4_K_M'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-400">
                                    ctx {model.contextWindow || 4096}
                                  </span>
                                  {isDefault && (
                                    <span className="text-amber-400 text-[10px] font-mono flex items-center space-x-1">
                                      <CheckCircle2 size={11} />
                                      <span>Default</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-neutral-500 text-[10px] mt-0.5">{model.description}</p>
                              </div>

                              <div className="flex items-center space-x-2">
                                {!isDefault && (
                                  <button
                                    onClick={() => setDefaultModel(model.id)}
                                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors cursor-pointer"
                                  >
                                    Set Default
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Sandbox & Permissions */}
        {activeTab === 'permissions' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-neutral-900/60 border subtle-border space-y-2">
              <h3 className="font-semibold text-sm text-neutral-100">Workspace Root Boundary</h3>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                As required by Section 14 and 15 of skill_1.md, all AI file operations and command tools are strictly restricted within the defined workspace root.
              </p>
              <div className="p-2.5 rounded bg-neutral-950 font-mono text-emerald-400 text-[11px] border subtle-border flex items-center space-x-2">
                <FolderOpen size={14} />
                <span>/home/junior/Desktop/New-Ag</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Storage */}
        {activeTab === 'storage' && (() => {
          const totalMessages = sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0);
          const totalStorageEstimate = (() => {
            try {
              const item = localStorage.getItem('evis_workspace_store_v1');
              if (!item) return '0 KB';
              const bytes = new Blob([item]).size;
              if (bytes < 1024) return `${bytes} B`;
              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
              return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            } catch {
              return 'N/A';
            }
          })();

          const handleExportBackup = () => {
            try {
              const data = exportWorkspaceBackup();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `evis_workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error('Export error:', err);
              alert('Échec de l\'export de sauvegarde.');
            }
          };

          const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              const content = event.target?.result as string;
              if (!content) return;
              const ok = importWorkspaceBackup(content);
              if (ok) {
                alert('✓ Sauvegarde restaurée avec succès !');
              } else {
                alert('❌ Fichier de sauvegarde invalide.');
              }
            };
            reader.readAsText(file);
          };

          const handleReset = () => {
            if (window.confirm('Voulez-vous vraiment réinitialiser toutes les données locales du workspace Evis ? Cette action est irréversible.')) {
              resetWorkspaceData();
              alert('✓ Données réinitialisées avec succès.');
            }
          };

          return (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-900/60 border subtle-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-100 flex items-center space-x-2">
                      <HardDrive size={16} className="text-emerald-400" />
                      <span>Stockage & Persistance Locale</span>
                    </h3>
                    <p className="text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
                      Toutes les données (sessions, messages, pièces jointes, projets, skills, knowledge vault, historique de terminal) sont sauvegardées localement et persistent après rafraîchissement ou fermeture du navigateur, 100% hors-ligne.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono px-2 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                      Taille: {totalStorageEstimate}
                    </span>
                  </div>
                </div>

                {/* Storage Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg bg-neutral-950 border subtle-border">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Sessions</div>
                    <div className="text-base font-bold text-neutral-200 mt-0.5">{sessions.length}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border subtle-border">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Messages Total</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{totalMessages}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border subtle-border">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Knowledge Vault</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">{knowledge.length}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border subtle-border">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Projets & Skills</div>
                    <div className="text-base font-bold text-neutral-200 mt-0.5">
                      {projects.length} / {skills.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Backup and Restore Controls */}
              <div className="p-4 rounded-xl bg-neutral-900/60 border subtle-border space-y-4">
                <div>
                  <h4 className="font-semibold text-neutral-200 text-xs uppercase tracking-wider">
                    Sauvegarde & Restauration (JSON Portable)
                  </h4>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Exportez ou restaurez l'intégralité de votre espace de travail sous forme d'archive JSON autonome.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportBackup}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Exporter la sauvegarde (JSON)</span>
                  </button>

                  <label className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer border subtle-border">
                    <FolderOpen size={13} />
                    <span>Restaurer une sauvegarde...</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-red-300 font-medium text-xs transition-colors cursor-pointer ml-auto"
                  >
                    <RotateCcw size={13} />
                    <span>Réinitialiser les données</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tab 4: Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-3 text-xs font-mono">
            <div className="p-4 rounded-xl bg-neutral-900/60 border subtle-border space-y-2 text-neutral-300">
              <div>Application: Evis Workspace v0.1.0</div>
              <div>Platform: Linux 6.6.137+ (x86_64)</div>
              <div>Ollama Endpoint: http://127.0.0.1:11434 (Connected)</div>
              <div>Detected Model: {systemStatus.modelName}</div>
              <div>Speech Synthesis: Supported (Web Speech API)</div>
              <div>Speech Recognition: Supported (Web Speech API)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
