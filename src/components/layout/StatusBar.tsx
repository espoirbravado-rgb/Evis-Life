import React from 'react';
import { Cpu, HardDrive, Sparkles, Globe, Terminal, FileCode, Activity } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const StatusBar: React.FC = () => {
  const { systemStatus, sessions, activeSessionId, toggleContextDrawer, setActiveView } = useAppStore();
  const currentSession = sessions.find((s) => s.id === activeSessionId);
  const activeSkillsCount = currentSession?.activeSkillIds.length || 0;

  return (
    <footer className="h-6 border-t subtle-border bg-neutral-950 px-3 flex items-center justify-between text-[11px] text-neutral-400 select-none z-20">
      {/* Left items: Core subsystem health */}
      <div className="flex items-center space-x-4">
        {/* Model */}
        <button
          onClick={() => setActiveView('settings')}
          className="flex items-center space-x-1 hover:text-neutral-200 transition-colors"
          title={`Active model: ${systemStatus.modelName}`}
        >
          <Cpu size={12} className="text-emerald-400" />
          <span>Model:</span>
          <span className="text-neutral-200 font-mono">
            {systemStatus.modelName || 'Scanning...'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-0.5" />
        </button>

        {/* Memory / Knowledge Store */}
        <button
          onClick={() => setActiveView('knowledge')}
          className="flex items-center space-x-1 hover:text-neutral-200 transition-colors"
          title="Local Memory Vault: SQLite + JSONL active"
        >
          <HardDrive size={12} className="text-blue-400" />
          <span>Memory:</span>
          <span className="text-neutral-300">Vault Ready</span>
        </button>

        {/* Active Skills */}
        <button
          onClick={() => toggleContextDrawer('skills')}
          className="flex items-center space-x-1 hover:text-neutral-200 transition-colors"
          title="View active skills in context drawer"
        >
          <Sparkles size={12} className="text-purple-400" />
          <span>Skills:</span>
          <span className="text-neutral-200 font-medium">{activeSkillsCount} active</span>
        </button>

        {/* Web Search */}
        <div className="flex items-center space-x-1">
          <Globe size={12} className={currentSession?.webSearchEnabled ? 'text-blue-400' : 'text-neutral-600'} />
          <span>Web:</span>
          <span className={currentSession?.webSearchEnabled ? 'text-blue-300' : 'text-neutral-500'}>
            {currentSession?.webSearchEnabled ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Terminal tool */}
        <button
          onClick={() => toggleContextDrawer('terminal')}
          className="hidden sm:flex items-center space-x-1 hover:text-neutral-200 transition-colors"
          title="Terminal runner available"
        >
          <Terminal size={12} className="text-emerald-400" />
          <span>Terminal:</span>
          <span className="text-neutral-300">Ready</span>
        </button>

        {/* File sandbox */}
        <button
          onClick={() => toggleContextDrawer('files')}
          className="hidden md:flex items-center space-x-1 hover:text-neutral-200 transition-colors"
          title="File access scoped to project root"
        >
          <FileCode size={12} className="text-amber-400" />
          <span>Files:</span>
          <span className="text-neutral-300">Scoped</span>
        </button>
      </div>

      {/* Right items: Context Token Gauge & Diagnostic shortcut */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-500">
          <span>Tokens:</span>
          <span className="text-neutral-300">
            {systemStatus.contextTokensUsed} / {systemStatus.contextTokensLimit}
          </span>
          <div className="w-12 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                width: `${(systemStatus.contextTokensUsed / systemStatus.contextTokensLimit) * 100}%`,
              }}
            />
          </div>
        </div>

        <button
          onClick={() => setActiveView('settings')}
          className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          title="System Diagnostics & Logs"
          aria-label="System Diagnostics & Logs"
        >
          <Activity size={12} />
        </button>
      </div>
    </footer>
  );
};
