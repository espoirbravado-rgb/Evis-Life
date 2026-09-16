import React, { useState, useEffect } from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PanelRightClose, 
  PanelRightOpen, 
  Search, 
  FolderKanban, 
  Cpu, 
  Globe, 
  ShieldCheck 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { CommandPalette } from '../common/CommandPalette';

export const AppHeader: React.FC = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const {
    sidebarCollapsed,
    toggleSidebar,
    contextDrawerOpen,
    toggleContextDrawer,
    projects,
    activeProjectId,
    systemStatus,
    createNewSession,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === activeProjectId);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleContextDrawer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNewSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleContextDrawer, createNewSession]);

  return (
    <>
      <header className="h-12 border-b subtle-border bg-neutral-900/80 backdrop-blur-md flex items-center justify-between px-3 select-none z-20">
        {/* Left controls & project title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
            aria-label={sidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          <div className="flex items-center space-x-2 text-sm">
            <span className="font-bold text-xs tracking-wider uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              Evis
            </span>
            <span className="text-neutral-500">/</span>
            <FolderKanban size={15} className="text-emerald-400" />
            <span className="font-semibold text-neutral-200">
              {currentProject?.name || 'Workspace'}
            </span>
            <span className="text-xs text-neutral-500 font-mono hidden sm:inline">
              ({currentProject?.rootPath || ''})
            </span>
          </div>
        </div>

        {/* Center Search / Command Palette trigger */}
        <button 
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center space-x-2 px-3 py-1 bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/50 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <Search size={13} />
          <span>Search sessions, skills, knowledge...</span>
          <kbd className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 border border-neutral-700 rounded text-[10px] font-mono">
            Ctrl K
          </kbd>
        </button>

        {/* Right indicators & drawer toggles */}
        <div className="flex items-center space-x-2">
          {/* Model quick badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-neutral-800/60 rounded-md border border-neutral-700/40 text-xs">
            <Cpu size={13} className="text-emerald-400" />
            <span className="text-neutral-300 font-mono text-[11px]">
              {systemStatus.modelName ? systemStatus.modelName.split(':')[0] : 'Scanning...'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Web Search status pill */}
          <div 
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs border ${
              systemStatus.webSearchEnabled 
                ? 'bg-blue-950/40 border-blue-800 text-blue-300' 
                : 'bg-neutral-800/40 border-neutral-800 text-neutral-500'
            }`}
            title={systemStatus.webSearchEnabled ? 'Web access enabled' : 'Operating in offline local-first mode'}
          >
            <Globe size={13} />
            <span className="text-[10px] hidden lg:inline">
              {systemStatus.webSearchEnabled ? 'Online' : 'Local'}
            </span>
          </div>

          {/* Security sandbox icon */}
          <div 
            className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors cursor-help"
            title="Sandbox Enforced: Project directory scoped access"
          >
            <ShieldCheck size={16} />
          </div>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Right contextual drawer toggle */}
          <button
            onClick={() => toggleContextDrawer()}
            title={contextDrawerOpen ? 'Hide Context Inspector (Ctrl+J)' : 'Show Context Inspector (Ctrl+J)'}
            aria-label={contextDrawerOpen ? 'Hide Context Inspector (Ctrl+J)' : 'Show Context Inspector (Ctrl+J)'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              contextDrawerOpen
                ? 'text-neutral-100 bg-neutral-800'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            }`}
          >
            {contextDrawerOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </>
  );
};
