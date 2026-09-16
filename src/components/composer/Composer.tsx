import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Cpu,
  Globe,
  Paperclip,
  Check,
  ChevronDown,
  StopCircle,
  Mic,
  MicOff,
  X,
  Star,
  RotateCcw,
  ArrowRight,
  Play,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { VoiceInputService, VoiceInputState } from '../../services/speechService';
import { PROJECT_FILES } from '../../services/fileData';
import { IAttachment } from '../../types';

export const Composer: React.FC = () => {
  const [input, setInput] = useState('');
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [interimVoice, setInterimVoice] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceInputState>('idle');
  const [stopVoiceFn, setStopVoiceFn] = useState<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseInputRef = useRef<string>('');

  const {
    activeSessionId,
    sessions,
    skills,
    models,
    providers,
    activeProviderId,
    setActiveProvider,
    setActiveView,
    isDiscovering,
    discoverProvidersAndModels,
    startProviderProcess,
    isStartingProvider,
    autoLaunchProviders,
    setAutoLaunchProviders,
    toggleSkillInSession,
    setModelInSession,
    setDefaultModel,
    toggleWebSearchInSession,
    sendMessage,
    stopGeneration,
    isGenerating,
  } = useAppStore();

  const currentSession = sessions.find((s) => s.id === activeSessionId);
  const activeSkillIds = currentSession?.activeSkillIds || [];
  const currentModelId = currentSession?.activeModelId || models[0]?.id || 'qwen2.5-coder:1.5b';
  const webSearchEnabled = currentSession?.webSearchEnabled || false;

  const activeModel = models.find((m) => m.id === currentModelId) || models[0];

  const ollamaModels = models.filter((m) => m.provider === 'ollama');
  const llamaCppModels = models.filter((m) => m.provider === 'llama.cpp');
  const ollamaProvider = providers.find((p) => p.id === 'ollama');
  const llamaCppProvider = providers.find((p) => p.id === 'llama.cpp');
  const ollamaOnline = ollamaProvider?.status === 'active' || ollamaModels.length > 0;
  const llamaOnline = llamaCppProvider?.status === 'active' || llamaCppModels.length > 0;

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return;

    const attachments: IAttachment[] = attachedFiles.map((filename) => {
      const file = PROJECT_FILES[filename];
      return {
        id: `att-${filename}`,
        name: filename,
        path: file?.path || `/home/junior/Desktop/New-Ag/${filename}`,
        size: 1024,
        type: 'code',
      };
    });

    sendMessage(input, attachments);
    setInput('');
    setAttachedFiles([]);
    setInterimVoice('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleVoice = () => {
    if (voiceState === 'listening' || voiceState === 'transcribing') {
      stopVoiceFn?.();
      setStopVoiceFn(null);
      setVoiceState('idle');
      if (interimVoice.trim()) {
        setInput((prev) => (prev ? `${prev} ${interimVoice.trim()}` : interimVoice.trim()));
      }
      setInterimVoice('');
    } else {
      baseInputRef.current = input;
      setInterimVoice('');
      const stop = VoiceInputService.startListening(
        (finalText, interimText) => {
          const base = baseInputRef.current.trim();
          const cleanFinal = finalText.trim();
          const nextInput = base
            ? (cleanFinal ? `${base} ${cleanFinal}` : base)
            : cleanFinal;
          setInput(nextInput);
          setInterimVoice(interimText);
        },
        (state) => {
          setVoiceState(state);
          if (state === 'idle') {
            setInterimVoice('');
          }
        },
        (err) => {
          console.warn('Voice recognition notice:', err);
          setVoiceState('idle');
          setInterimVoice('');
        }
      );
      setStopVoiceFn(() => stop);
    }
  };

  return (
    <div className="relative border-t subtle-border bg-neutral-900/90 backdrop-blur-md p-3">
      {/* Offline Provider Quick Action Banner */}
      {((activeProviderId === 'ollama' && !ollamaOnline) || (activeProviderId === 'llama.cpp' && !llamaOnline)) && (
        <div className="max-w-4xl mx-auto mb-2 px-3 py-1.5 rounded-lg bg-amber-950/50 border border-amber-800/50 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2 text-amber-200">
            <Zap size={13} className="text-amber-400 flex-shrink-0" />
            <span>
              Le provider <strong>{activeProviderId === 'ollama' ? 'Ollama' : 'llama.cpp'}</strong> n'est pas actif en arrière-plan.
            </span>
          </div>
          <button
            type="button"
            disabled={isStartingProvider}
            onClick={() => startProviderProcess(activeProviderId)}
            className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-[11px] transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
          >
            <Play size={11} fill="currentColor" />
            <span>{isStartingProvider ? 'Démarrage...' : 'Démarrer en arrière-plan'}</span>
          </button>
        </div>
      )}

      {/* Container box */}
      <div className="max-w-4xl mx-auto rounded-xl border subtle-border bg-neutral-950 focus-within:border-neutral-700 transition-colors shadow-lg">
        {/* Attached Files Chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1 border-b subtle-border/50">
            {attachedFiles.map((fname) => (
              <span
                key={fname}
                className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-200 text-[11px] font-mono border border-neutral-800"
              >
                <Paperclip size={11} className="text-emerald-400" />
                <span className="truncate max-w-[150px]">{fname}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles((prev) => prev.filter((f) => f !== fname))}
                  className="hover:text-red-400 text-neutral-500 cursor-pointer p-0.5 rounded"
                  title="Remove attachment"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Input area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question, specify a task, or dictate with the mic... (Shift+Enter for newline)"
          rows={1}
          className="w-full bg-transparent text-neutral-100 text-sm p-3 focus:outline-none resize-none placeholder-neutral-500 max-h-48"
        />

        {/* Live Interim Voice Preview */}
        {interimVoice && (
          <div className="px-3 py-1 bg-amber-950/40 border-t border-amber-900/40 text-amber-300 text-xs flex items-center space-x-2 animate-pulse">
            <Mic size={12} className="text-amber-400 flex-shrink-0" />
            <span className="text-[11px] italic truncate">Dictée en direct : "{interimVoice}"</span>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t subtle-border text-xs select-none">
          {/* Left tools and selectors */}
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {/* Skill Selector Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSkillMenuOpen(!skillMenuOpen)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-purple-900/50 hover:border-purple-800 transition-colors cursor-pointer"
                title="Attach or remove skills for this conversation"
              >
                <Sparkles size={13} className="text-purple-400" />
                <span className="font-medium">
                  Skills ({activeSkillIds.length})
                </span>
                <ChevronDown size={11} />
              </button>

              {skillMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-neutral-900 border subtle-border shadow-xl p-2 z-50 space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 px-2 py-1">
                    Toggle Active Skills
                  </div>
                  {skills.map((skill) => {
                    const isActive = activeSkillIds.includes(skill.id);
                    const unavailable = skill.status === 'missing-dep' || skill.status === 'not-installed';
                    return (
                      <button
                        key={skill.id}
                        disabled={unavailable}
                        onClick={() => toggleSkillInSession(skill.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                          isActive
                            ? 'bg-purple-950/50 text-purple-200 border border-purple-800/40'
                            : unavailable
                            ? 'text-amber-500/70 cursor-not-allowed'
                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-medium truncate">{skill.name}</div>
                          <div className="text-[10px] text-neutral-500 truncate">{unavailable ? 'Unavailable: missing runtime contract' : skill.description}</div>
                        </div>
                        {isActive && <Check size={14} className="text-purple-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Provider & Model Selector Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
                title="Select local AI provider and model"
              >
                <Cpu size={13} className={activeModel?.provider === 'llama.cpp' ? 'text-amber-400' : 'text-emerald-400'} />
                <span className="font-mono text-[11px] truncate max-w-[120px]">
                  {activeModel?.name || (isDiscovering ? 'Scanning hosts...' : 'No model loaded')}
                </span>
                {activeModel && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
                    activeModel.provider === 'llama.cpp'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  }`}>
                    {activeModel.provider === 'llama.cpp' ? 'llama' : 'ollama'}
                  </span>
                )}
                <ChevronDown size={11} />
              </button>

              {modelMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl bg-neutral-900 border subtle-border shadow-2xl p-2.5 z-50 space-y-2.5 max-h-96 overflow-y-auto">
                  {/* Header with live Refresh trigger */}
                  <div className="flex items-center justify-between px-1 pb-1.5 border-b subtle-border">
                    <span className="text-[11px] font-semibold text-neutral-300">Sélection du Provider & Modèle</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        discoverProvidersAndModels();
                      }}
                      disabled={isDiscovering}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors cursor-pointer"
                      title="Interroger les hôtes locaux en direct"
                    >
                      <RotateCcw size={10} className={isDiscovering ? 'animate-spin text-emerald-400' : ''} />
                      <span>{isDiscovering ? 'Sonde...' : 'Sonder'}</span>
                    </button>
                  </div>

                  {/* Provider Tabs Switcher (§21) */}
                  <div className="flex p-0.5 bg-neutral-950 rounded-lg border subtle-border text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProvider('ollama');
                      }}
                      className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                        activeProviderId === 'ollama'
                          ? 'bg-neutral-800 text-emerald-400 shadow-sm font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${ollamaOnline ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                      <span>Ollama</span>
                      <span className="text-[10px] text-neutral-500 font-mono">({ollamaModels.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProvider('llama.cpp');
                      }}
                      className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                        activeProviderId === 'llama.cpp'
                          ? 'bg-neutral-800 text-amber-400 shadow-sm font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${llamaOnline ? 'bg-amber-400' : 'bg-neutral-600'}`} />
                      <span>llama.cpp</span>
                      <span className="text-[10px] text-neutral-500 font-mono">({llamaCppModels.length})</span>
                    </button>
                  </div>

                  {/* Modèles du Provider Actif Uniquement (§21: "the available model list must update dynamically") */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 px-1 py-0.5 flex items-center justify-between">
                      <span>Modèles {activeProviderId === 'ollama' ? 'Ollama' : 'llama.cpp'} détectés</span>
                      <span className="text-[9px] font-mono text-neutral-500">
                        {activeProviderId === 'ollama' ? '127.0.0.1:11434' : '127.0.0.1:8080'}
                      </span>
                    </div>

                    {activeProviderId === 'ollama' ? (
                      ollamaModels.length === 0 ? (
                        <div className="p-3 text-neutral-400 text-xs bg-neutral-950 rounded-lg border subtle-border space-y-2">
                          <div className="text-[11px] text-neutral-300">
                            {ollamaOnline
                              ? 'Aucun modèle installé dans Ollama.'
                              : 'Hôte Ollama non détecté sur le port 11434.'}
                          </div>
                          {!ollamaOnline && (
                            <button
                              type="button"
                              disabled={isStartingProvider}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await startProviderProcess('ollama');
                              }}
                              className="w-full py-1.5 px-2.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-[11px] transition-colors flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              <Play size={11} fill="currentColor" />
                              <span>{isStartingProvider ? 'Démarrage en cours...' : 'Démarrer le démon Ollama'}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        ollamaModels.map((model) => {
                          const isSelected = model.id === currentModelId;
                          return (
                            <div
                              key={model.id}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                isSelected
                                  ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-800/50'
                                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setModelInSession(model.id);
                                  setModelMenuOpen(false);
                                }}
                                className="truncate pr-2 flex-1 text-left cursor-pointer"
                              >
                                <div className="font-medium text-neutral-200 flex items-center space-x-1.5">
                                  <span>{model.name}</span>
                                  {model.name.includes('14b') && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/60 text-[9px] font-mono text-purple-300 font-bold">
                                      14B
                                    </span>
                                  )}
                                  {model.name.includes('1.5b') && (
                                    <span className="px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-800/60 text-[9px] font-mono text-blue-300 font-bold">
                                      1.5B
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 font-mono">
                                  {model.size || 'Local'} • {model.quantization || 'Q4_K_M'}
                                </div>
                              </button>

                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDefaultModel(model.id);
                                  }}
                                  className="p-1 rounded text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                                  title="Définir comme modèle par défaut"
                                >
                                  <Star size={12} />
                                </button>
                                {isSelected && <Check size={14} className="text-emerald-400" />}
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : (
                      llamaCppModels.length === 0 ? (
                        <div className="p-3 text-neutral-400 text-xs bg-neutral-950 rounded-lg border subtle-border space-y-2.5">
                          <div>
                            <div className="text-[11px] font-medium text-amber-300 flex items-center space-x-1.5">
                              <Zap size={12} className="text-amber-400" />
                              <span>llama.cpp n'est pas actif</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                              Le serveur llama-server n'est pas encore lancé sur le port 8080.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isStartingProvider}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await startProviderProcess('llama.cpp');
                            }}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            <Play size={12} fill="currentColor" />
                            <span>{isStartingProvider ? 'Démarrage en cours...' : 'Démarrer llama.cpp en arrière-plan'}</span>
                          </button>
                          <label className="flex items-center space-x-1.5 text-[10px] text-neutral-400 cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={autoLaunchProviders}
                              onChange={(e) => setAutoLaunchProviders(e.target.checked)}
                              className="rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-0"
                            />
                            <span>Démarrer automatiquement à la sélection</span>
                          </label>
                        </div>
                      ) : (
                        llamaCppModels.map((model) => {
                          const isSelected = model.id === currentModelId;
                          const is14b = model.name.toLowerCase().includes('14b') || model.id.toLowerCase().includes('14b');
                          const is1_5b = model.name.toLowerCase().includes('1.5b') || model.id.toLowerCase().includes('1.5b');
                          return (
                            <div
                              key={model.id}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                isSelected
                                  ? 'bg-amber-950/60 text-amber-200 border border-amber-800/50'
                                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setModelInSession(model.id);
                                  setModelMenuOpen(false);
                                }}
                                className="truncate pr-2 flex-1 text-left cursor-pointer"
                              >
                                <div className="font-medium text-neutral-200 flex items-center space-x-1.5">
                                  <span>{model.name}</span>
                                  {is14b && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/60 text-[9px] font-mono text-purple-300 font-bold">
                                      14.8B
                                    </span>
                                  )}
                                  {is1_5b && (
                                    <span className="px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-800/60 text-[9px] font-mono text-blue-300 font-bold">
                                      1.5B
                                    </span>
                                  )}
                                  {model.status === 'ready' && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-800/60 text-[9px] font-mono text-emerald-400 font-medium">
                                      Actif ●
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 font-mono">
                                  {model.size || 'GGUF'} • {model.quantization || 'Q4_K_M'} • ctx {model.contextWindow || 2048}
                                </div>
                              </button>

                              <div className="flex items-center space-x-1.5 flex-shrink-0">
                                {model.status !== 'ready' && (
                                  <button
                                    type="button"
                                    disabled={isStartingProvider}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await startProviderProcess('llama.cpp', model.id);
                                    }}
                                    className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                    title={`Démarrer ${model.name} sur llama-server`}
                                  >
                                    <Play size={9} fill="currentColor" />
                                    <span>Lancer</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDefaultModel(model.id);
                                  }}
                                  className="p-1 rounded text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                                  title="Définir comme modèle par défaut"
                                >
                                  <Star size={12} />
                                </button>
                                {isSelected && <Check size={14} className="text-amber-400" />}
                              </div>
                            </div>
                          );
                        })
                      )
                    )}
                  </div>

                  {/* Direct Link to Dedicated View */}
                  <div className="border-t subtle-border pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuOpen(false);
                        setActiveView('models');
                      }}
                      className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors border subtle-border cursor-pointer font-medium"
                    >
                      <span>Ouvrir la section dédiée Providers & Modèles</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={toggleWebSearchInSession}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-colors border cursor-pointer ${
                webSearchEnabled
                  ? 'bg-blue-950/70 border-blue-700 text-blue-300 font-medium'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
              title={webSearchEnabled ? 'Web search enabled' : 'Web search disabled (Offline Local)'}
            >
              <Globe size={13} />
              <span>Web</span>
            </button>

            {/* Non-blocking Attach file dropdown (Section 6, 32, 34) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAttachMenuOpen(!attachMenuOpen)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                  attachedFiles.length > 0
                    ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300 font-medium'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title="Attach workspace project files without blocking dialogs"
              >
                <Paperclip size={13} />
                <span className="hidden sm:inline">Attach</span>
                {attachedFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-mono">
                    {attachedFiles.length}
                  </span>
                )}
              </button>

              {attachMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-neutral-900 border subtle-border shadow-xl p-2 z-50 space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 px-2 py-1 flex items-center justify-between border-b subtle-border pb-1">
                    <span>Workspace Files</span>
                    <span className="text-[9px] text-neutral-500">Root: /New-Ag</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
                    {Object.keys(PROJECT_FILES).map((fname) => {
                      const isAttached = attachedFiles.includes(fname);
                      return (
                        <button
                          key={fname}
                          type="button"
                          onClick={() => {
                            setAttachedFiles((prev) =>
                              isAttached ? prev.filter((f) => f !== fname) : [...prev, fname]
                            );
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer text-left ${
                            isAttached
                              ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-800/40'
                              : 'text-neutral-300 hover:bg-neutral-800'
                          }`}
                        >
                          <span className="truncate">{fname}</span>
                          {isAttached ? (
                            <Check size={12} className="text-emerald-400 flex-shrink-0" />
                          ) : (
                            <span className="text-[10px] text-neutral-500">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action: Voice Input & Send/Stop button */}
          <div className="flex items-center space-x-2">
            {/* Voice Input Microphone Control (Section 7) */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                voiceState === 'listening'
                  ? 'bg-red-950 border border-red-700 text-red-400 animate-pulse'
                  : voiceState === 'transcribing'
                  ? 'bg-amber-950 border border-amber-700 text-amber-300 animate-pulse'
                  : 'bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
              title={
                voiceState === 'listening'
                  ? 'Listening... (click to stop)'
                  : voiceState === 'transcribing'
                  ? 'Transcribing audio...'
                  : 'Voice input (Dictate prompt)'
              }
            >
              {voiceState === 'listening' ? <Mic size={14} /> : <MicOff size={14} />}
            </button>

            {isGenerating ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-medium border border-red-700/60 transition-colors cursor-pointer"
                title="Stop generation"
              >
                <StopCircle size={14} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() && attachedFiles.length === 0}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  input.trim() || attachedFiles.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
                title="Send Message (Enter)"
              >
                <span>Send</span>
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
