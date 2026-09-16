import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquarePlus,
  MessagesSquare,
  FolderTree,
  Sparkles,
  BrainCircuit,
  GraduationCap,
  Settings,
  Cpu,
  CornerDownLeft,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    setActiveView,
    createNewSession,
    sessions,
    setActiveSession,
    models,
    setModelInSession,
    toggleSidebar,
    toggleContextDrawer,
  } = useAppStore();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const staticActions = [
    {
      id: 'new-chat',
      title: 'New Conversation',
      subtitle: 'Create a new AI conversation session',
      icon: <MessageSquarePlus size={16} className="text-emerald-400" />,
      action: () => {
        createNewSession();
        onClose();
      },
    },
    {
      id: 'view-chat',
      title: 'Conversations View',
      subtitle: 'Switch to conversation workspace',
      icon: <MessagesSquare size={16} className="text-emerald-400" />,
      action: () => {
        setActiveView('chat');
        onClose();
      },
    },
    {
      id: 'view-projects',
      title: 'Projects View',
      subtitle: 'Switch to project workspaces manager',
      icon: <FolderTree size={16} className="text-emerald-400" />,
      action: () => {
        setActiveView('projects');
        onClose();
      },
    },
    {
      id: 'view-skills',
      title: 'Skills Hub',
      subtitle: 'Browse and attach modular capabilities',
      icon: <Sparkles size={16} className="text-purple-400" />,
      action: () => {
        setActiveView('skills');
        onClose();
      },
    },
    {
      id: 'view-knowledge',
      title: 'Knowledge Vault',
      subtitle: 'Search persistent notes and technical decisions',
      icon: <BrainCircuit size={16} className="text-blue-400" />,
      action: () => {
        setActiveView('knowledge');
        onClose();
      },
    },
    {
      id: 'view-exercises',
      title: 'Practice & Exercises',
      subtitle: 'Interactive JavaScript Tutor practice session',
      icon: <GraduationCap size={16} className="text-amber-400" />,
      action: () => {
        setActiveView('exercises');
        onClose();
      },
    },
    {
      id: 'view-settings',
      title: 'Settings & Diagnostics',
      subtitle: 'Configure models, sandbox permissions, and storage',
      icon: <Settings size={16} className="text-neutral-400" />,
      action: () => {
        setActiveView('settings');
        onClose();
      },
    },
    {
      id: 'toggle-sidebar',
      title: 'Toggle Sidebar',
      subtitle: 'Collapse or expand navigation sidebar',
      icon: <FolderTree size={16} className="text-neutral-400" />,
      action: () => {
        toggleSidebar();
        onClose();
      },
    },
    {
      id: 'toggle-drawer',
      title: 'Toggle Context Drawer',
      subtitle: 'Open or close the right context inspector',
      icon: <Sparkles size={16} className="text-neutral-400" />,
      action: () => {
        toggleContextDrawer();
        onClose();
      },
    },
  ];

  // Also include matching sessions
  const sessionActions = sessions.map((sess) => ({
    id: `sess-${sess.id}`,
    title: sess.title,
    subtitle: `Conversation • ${sess.messages.length} messages`,
    icon: <MessagesSquare size={16} className="text-neutral-400" />,
    action: () => {
      setActiveSession(sess.id);
      setActiveView('chat');
      onClose();
    },
  }));

  // Also include models
  const modelActions = models.map((m) => ({
    id: `model-${m.id}`,
    title: `Use Model: ${m.name}`,
    subtitle: `${m.provider} • ${m.size || 'Local'}`,
    icon: <Cpu size={16} className="text-emerald-400" />,
    action: () => {
      setModelInSession(m.id);
      onClose();
    },
  }));

  const allItems = [...staticActions, ...sessionActions, ...modelActions];

  const filteredItems = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-neutral-900 border subtle-border shadow-2xl overflow-hidden flex flex-col font-sans select-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 bg-neutral-950 border-b subtle-border space-x-3">
          <Search size={17} className="text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, session title, or model name..."
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-neutral-800 border subtle-border text-[10px] text-neutral-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No matching commands or conversations found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-neutral-200 truncate">{item.title}</div>
                      <div className="text-[11px] text-neutral-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <CornerDownLeft size={13} className="text-emerald-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-neutral-950/80 border-t subtle-border flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span>Navigate with ↑ and ↓</span>
          <span>Execute with ↵ Enter</span>
        </div>
      </div>
    </div>
  );
};
