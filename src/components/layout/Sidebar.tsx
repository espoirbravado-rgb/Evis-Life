import React from 'react';
import {
  MessageSquarePlus,
  MessagesSquare,
  FolderTree,
  Sparkles,
  BrainCircuit,
  Files,
  GraduationCap,
  Settings,
  Archive,
  Trash2,
  Plus,
  Cpu,
} from 'lucide-react';
import { useAppStore, ActiveView } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    activeView,
    setActiveView,
    sessions,
    activeSessionId,
    setActiveSession,
    createNewSession,
    projects,
    activeProjectId,
    setActiveProject,
    archiveSession,
    deleteSession,
    models,
  } = useAppStore();

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { view: 'chat', label: 'Conversations', icon: <MessagesSquare size={16} /> },
    { view: 'models', label: 'Providers & Models', icon: <Cpu size={16} />, badge: models.length },
    { view: 'projects', label: 'Projects', icon: <FolderTree size={16} />, badge: projects.length },
    { view: 'skills', label: 'Skills Hub', icon: <Sparkles size={16} /> },
    { view: 'knowledge', label: 'Knowledge Vault', icon: <BrainCircuit size={16} /> },
    { view: 'files', label: 'File Explorer', icon: <Files size={16} /> },
    { view: 'exercises', label: 'Exercises', icon: <GraduationCap size={16} /> },
  ];

  // Group active non-archived sessions
  const activeSessions = sessions.filter((s) => !s.isArchived);

  return (
    <aside
      className={`h-[calc(100vh-3rem-1.5rem)] flex flex-col border-r subtle-border bg-neutral-900/60 backdrop-blur-md transition-all duration-200 select-none z-10 ${
        sidebarCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Top action: New Chat CTA */}
      <div className="p-2 border-b subtle-border">
        <button
          onClick={createNewSession}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-all cursor-pointer ${
            sidebarCollapsed ? 'px-2' : ''
          }`}
          title="New Conversation (Ctrl+N)"
          aria-label="New Conversation (Ctrl+N)"
        >
          <MessageSquarePlus size={16} />
          {!sidebarCollapsed && <span>New Conversation</span>}
        </button>
      </div>

      {/* Navigation views */}
      <div className="py-2 px-1.5 space-y-0.5 border-b subtle-border">
        {navItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <div className="flex items-center space-x-2.5">
                <span className={isActive ? 'text-emerald-400' : 'text-neutral-400'}>
                  {item.icon}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </div>
              {!sidebarCollapsed && item.badge !== undefined && (
                <span className="px-1.5 py-0.2 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded text-[10px]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Project Switcher section */}
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
          <span>Active Project</span>
          <button 
            onClick={() => setActiveView('projects')}
            className="text-neutral-500 hover:text-neutral-300 p-0.5 rounded"
            title="Manage Projects"
            aria-label="Manage Projects"
          >
            <Plus size={12} />
          </button>
        </div>
      )}
      {!sidebarCollapsed && (
        <div className="px-2 pb-2">
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProject(e.target.value)}
            className="w-full bg-neutral-800/80 border border-neutral-700/60 rounded-md text-xs text-neutral-200 px-2 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Conversation History List */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-1">
        {!sidebarCollapsed && (
          <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Recent Chats
          </div>
        )}

        {activeSessions.map((session) => {
          const isSelected = activeSessionId === session.id && activeView === 'chat';
          return (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-neutral-800/90 text-neutral-100 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
              title={session.title}
            >
              <div className="flex items-center space-x-2 truncate pr-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="truncate">{session.title}</span>
                )}
              </div>

              {!sidebarCollapsed && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveSession(session.id);
                    }}
                    title="Archive & Extract Knowledge"
                    aria-label="Archive & Extract Knowledge"
                    className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200"
                  >
                    <Archive size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    title="Delete Conversation"
                    aria-label="Delete Conversation"
                    className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer: Settings */}
      <div className="p-2 border-t subtle-border mt-auto">
        <button
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer ${
            activeView === 'settings' ? 'bg-neutral-800 text-neutral-100' : ''
          }`}
          title="Settings & Diagnostics"
          aria-label="Settings & Diagnostics"
        >
          <Settings size={16} />
          {!sidebarCollapsed && <span>Settings & Diagnostics</span>}
        </button>
      </div>
    </aside>
  );
};
