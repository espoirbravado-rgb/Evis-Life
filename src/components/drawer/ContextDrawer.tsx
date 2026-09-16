import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Files,
  Terminal,
  X,
  CheckCircle,
  FileCode,
  CornerDownLeft,
  Folder,
  Loader2,
  Plus,
  Minus,
} from 'lucide-react';
import { useAppStore, DrawerTab } from '../../store/useAppStore';
import { FilePreviewModal } from './FilePreviewModal';
import { FilesystemService, IFSItem } from '../../services/filesystemService';

export const ContextDrawer: React.FC = () => {
  const [terminalInput, setTerminalInput] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const {
    contextDrawerOpen,
    contextDrawerTab,
    toggleContextDrawer,
    activeSessionId,
    sessions,
    skills,
    knowledge,
    projects,
    activeProjectId,
    terminalHistory,
    runTerminalCommand,
    selectedFile,
    openFilePreview,
    closeFilePreview,
    toggleSkillInSession,
  } = useAppStore();

  if (!contextDrawerOpen) return null;

  const currentSession = sessions.find((s) => s.id === activeSessionId);
  const currentProject = projects.find((p) => p.id === activeProjectId);
  const activeSkillIds = currentSession?.activeSkillIds || [];

  const activeSkills = skills.filter((s) => activeSkillIds.includes(s.id));
  const availableSkills = skills.filter(
    (s) => !activeSkillIds.includes(s.id) && s.status !== 'missing-dep' && s.status !== 'not-installed'
  );
  const unavailableSkills = skills.filter(
    (s) => !activeSkillIds.includes(s.id) && (s.status === 'missing-dep' || s.status === 'not-installed')
  );
  const projectKnowledge = knowledge.filter((k) => k.projectId === activeProjectId);

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'skills', label: 'Skills', icon: <Sparkles size={13} /> },
    { id: 'knowledge', label: 'Knowledge', icon: <BrainCircuit size={13} /> },
    { id: 'files', label: 'Files', icon: <Files size={13} /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal size={13} /> },
  ];

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    runTerminalCommand(terminalInput);
    setTerminalInput('');
  };

  const [drawerFiles, setDrawerFiles] = useState<IFSItem[]>([]);
  const [loadingDrawerFiles, setLoadingDrawerFiles] = useState(false);

  useEffect(() => {
    if (contextDrawerTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (contextDrawerTab === 'files') {
      let isMounted = true;
      setLoadingDrawerFiles(true);
      FilesystemService.list('').then((res) => {
        if (isMounted) {
          setDrawerFiles(res.items);
          setLoadingDrawerFiles(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [terminalHistory, contextDrawerTab]);

  return (
    <>
      <aside className="w-80 border-l subtle-border bg-neutral-900/90 backdrop-blur-md flex flex-col h-[calc(100vh-3rem-1.5rem)] select-none z-10">
        {/* Header & Tabs */}
        <div className="border-b subtle-border px-3 pt-2 pb-0 flex items-center justify-between">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const isActive = contextDrawerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => toggleContextDrawer(tab.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-emerald-500 text-neutral-100 bg-neutral-800/60'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => toggleContextDrawer()}
            className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
            title="Close Drawer"
            aria-label="Close Drawer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Tab 1: Skills Inspector */}
          {contextDrawerTab === 'skills' && (
            <div className="space-y-4">
              {/* Active Skills */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-400 flex items-center justify-between">
                  <span>Compétences Actives ({activeSkills.length})</span>
                </div>

                {activeSkills.length === 0 ? (
                  <div className="p-3 rounded-lg bg-neutral-950/60 border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
                    Aucune compétence active dans cette session. Attachez-en une ci-dessous pour autoriser des actions réelles.
                  </div>
                ) : (
                  activeSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-3 rounded-lg bg-neutral-950 border border-purple-900/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Sparkles size={14} className="text-purple-400" />
                          <span className="font-semibold text-neutral-200">{skill.name}</span>
                        </div>
                        <button
                          onClick={() => toggleSkillInSession(skill.id)}
                          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 text-neutral-400 text-[10px] transition-colors cursor-pointer"
                          title="Détacher cette compétence de la session (tester le point de rupture)"
                        >
                          <Minus size={11} />
                          <span>Détacher</span>
                        </button>
                      </div>

                      <p className="text-neutral-400 text-[11px] leading-relaxed">
                        {skill.description}
                      </p>

                      {/* Required Tools */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase text-neutral-500">Outils :</span>
                        <div className="flex flex-wrap gap-1">
                          {skill.requiredTools.map((tool, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/40 text-[10px] font-mono text-emerald-300">
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Permissions */}
                      <div className="space-y-1 pt-1 border-t subtle-border">
                        <span className="text-[10px] font-semibold uppercase text-neutral-500">Permissions :</span>
                        {skill.permissions.map((perm) => (
                          <div key={perm.id} className="flex items-center space-x-1.5 text-[11px] text-neutral-300">
                            <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                            <span>{perm.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Available Skills to Attach */}
              {availableSkills.length > 0 && (
                <div className="space-y-2 pt-3 border-t subtle-border">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                    <span>Compétences Disponibles ({availableSkills.length})</span>
                  </div>

                  {availableSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-2.5 rounded-lg bg-neutral-950/50 border border-neutral-800/80 hover:border-neutral-700 transition-colors space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-neutral-300">{skill.name}</span>
                        <button
                          onClick={() => toggleSkillInSession(skill.id)}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-800/50 text-purple-300 text-[10px] transition-colors cursor-pointer"
                          title="Attacher cette compétence à la session"
                        >
                          <Plus size={11} />
                          <span>Attacher</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500 line-clamp-2 leading-tight">
                        {skill.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {unavailableSkills.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-amber-900/40">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                    Compétences indisponibles ({unavailableSkills.length})
                  </div>
                  {unavailableSkills.map((skill) => (
                    <div key={skill.id} className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs">
                      <span className="font-medium text-amber-200">{skill.name}</span>
                      <p className="text-[10px] text-amber-400/70 mt-1">Contrat runtime incomplet : activation bloquée.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Knowledge Vault */}
          {contextDrawerTab === 'knowledge' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                <span>Project Memory Cards</span>
                <span className="text-neutral-500 font-mono text-[10px]">{projectKnowledge.length} cards</span>
              </div>

              {projectKnowledge.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-neutral-950 border subtle-border space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200">{item.title}</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800/50 text-blue-300 text-[9px] uppercase font-mono">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-neutral-500 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: File Explorer View (Interactive) */}
          {contextDrawerTab === 'files' && (
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between mb-2">
                <span>Scoped Project Files</span>
                <span className="text-[10px] text-neutral-500 font-mono">Click to preview</span>
              </div>

              <div className="p-2 rounded-lg bg-neutral-950 border subtle-border font-mono text-[11px] space-y-1 text-neutral-300 max-h-96 overflow-y-auto">
                <div className="text-neutral-500 text-[10px] truncate mb-2">
                  📁 {currentProject?.rootPath || '/home/junior/Desktop/New-Ag'}
                </div>

                {loadingDrawerFiles && (
                  <div className="flex items-center justify-center py-4 text-neutral-500 text-xs">
                    <Loader2 size={14} className="animate-spin mr-2 text-emerald-400" />
                    <span>Chargement des fichiers réels...</span>
                  </div>
                )}

                {!loadingDrawerFiles && drawerFiles.length === 0 && (
                  <div className="text-center py-4 text-neutral-600 text-xs italic">
                    Aucun fichier trouvé
                  </div>
                )}

                {!loadingDrawerFiles &&
                  drawerFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => !f.isDirectory && openFilePreview(f.path)}
                      disabled={f.isDirectory}
                      className={`w-full flex items-center justify-between p-1.5 rounded transition-colors text-left ${
                        f.isDirectory
                          ? 'opacity-80 text-neutral-400 cursor-default'
                          : 'hover:bg-neutral-800 hover:text-emerald-400 text-neutral-300 cursor-pointer group'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        {f.isDirectory ? (
                          <Folder size={13} className="text-amber-400 flex-shrink-0" />
                        ) : (
                          <FileCode size={13} className="text-emerald-400 flex-shrink-0" />
                        )}
                        <span className="truncate group-hover:underline">{f.name}</span>
                      </div>
                      {!f.isDirectory && (
                        <span className="text-[10px] text-neutral-500 ml-2 font-mono flex-shrink-0">
                          {f.size < 1024
                            ? `${f.size} B`
                            : f.size < 1024 * 1024
                            ? `${(f.size / 1024).toFixed(1)} KB`
                            : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Tab 4: Interactive Terminal */}
          {contextDrawerTab === 'terminal' && (
            <div className="flex flex-col h-full space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                <span className="flex items-center space-x-1.5">
                  <Terminal size={12} className="text-emerald-400" />
                  <span>Terminal Linux Réel</span>
                </span>
                <span className="text-emerald-400 text-[10px] font-mono">● Connecté</span>
              </div>

              {/* Quick toolbar */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                {['ollama list', 'ps aux | grep llama', 'ls -la', 'uname -r', 'clear'].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => runTerminalCommand(cmd)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer border border-neutral-700/60"
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              {/* Console Output Area */}
              <div className="flex-1 overflow-y-auto p-2.5 rounded-lg bg-neutral-950 border subtle-border text-[11px] text-neutral-300 space-y-3 min-h-[260px]">
                {terminalHistory.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-neutral-400 text-[10px]">
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="text-emerald-400 font-bold">junior@evis:~$</span>
                        <span className="font-semibold text-neutral-200">{item.command}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {item.exitCode !== 0 && (
                          <span className="px-1 py-0.2 rounded bg-red-950 text-red-400 border border-red-800 text-[9px]">
                            code {item.exitCode}
                          </span>
                        )}
                        <span className="text-neutral-600 text-[9px]">{item.timestamp}</span>
                      </div>
                    </div>

                    {item.output && (
                      <pre className="text-neutral-300 whitespace-pre-wrap leading-relaxed pl-2 border-l border-neutral-800 text-[10px]">
                        {item.output}
                      </pre>
                    )}

                    {item.stderr && (
                      <pre className="text-red-400 bg-red-950/20 p-1.5 rounded border border-red-900/40 text-[10px] whitespace-pre-wrap leading-relaxed">
                        {item.stderr}
                      </pre>
                    )}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Command Input Form */}
              <form onSubmit={handleTerminalSubmit} className="flex items-center space-x-1 pt-1">
                <span className="text-emerald-400 font-bold">$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="Tapez une commande bash (ex: ollama list, ps aux)..."
                  className="flex-1 bg-neutral-950 border subtle-border rounded px-2 py-1 text-neutral-200 text-[11px] focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                  title="Exécuter"
                >
                  <CornerDownLeft size={12} />
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* File Preview Modal */}
      <FilePreviewModal file={selectedFile} onClose={closeFilePreview} />
    </>
  );
};
