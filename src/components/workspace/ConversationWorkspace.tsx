import React, { useRef, useEffect, useState } from 'react';
import {
  Cpu,
  PanelRight,
  MessagesSquare,
  ArrowRight,
  Download,
  BrainCircuit,
  RotateCcw,
  Edit2,
  Check,
  Search,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MessageCard } from './MessageCard';
import { Composer } from '../composer/Composer';

export const ConversationWorkspace: React.FC = () => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    sessions,
    activeSessionId,
    models,
    projects,
    activeProjectId,
    toggleContextDrawer,
    isGenerating,
    sendMessage,
    updateSessionTitle,
    clearSessionMessages,
    archiveSession,
    setActiveView,
  } = useAppStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId);
  const currentProject = projects.find((p) => p.id === activeProjectId);
  const activeModel = models.find((m) => m.id === session?.activeModelId);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages.length, isGenerating, searchQuery]);

  const handleStartEditing = () => {
    setTitleInput(session?.title || '');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (session && titleInput.trim()) {
      updateSessionTitle(session.id, titleInput);
    }
    setIsEditingTitle(false);
  };

  const handleExportMarkdown = () => {
    if (!session) return;
    const content = `# ${session.title}\n\nDate: ${new Date(session.createdAt).toLocaleString()}\nProject: ${
      currentProject?.name || 'None'
    }\nModel: ${session.activeModelId}\nSkills: ${session.activeSkillIds.join(', ')}\n\n---\n\n` +
      session.messages
        .map((m) => `### ${m.role === 'user' ? 'User' : 'Assistant'} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n`)
        .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${session.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDistillMemory = () => {
    if (!session) return;
    archiveSession(session.id);
    setActiveView('knowledge');
  };

  const quickPrompts = [
    'Can you give me a JavaScript exercise on Promises and Async/Await?',
    'Inspect the current project structure and list available tools.',
    'Explain how lexical closures work with an event listener pattern.',
    'Create an architecture diagram for our local memory extraction flow.',
  ];

  const displayedMessages = session?.messages
    ? searchQuery.trim()
      ? session.messages.filter((m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : session.messages
    : [];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem-1.5rem)] bg-neutral-950 overflow-hidden">
      {/* Conversation Thread Header */}
      <div className="h-12 border-b subtle-border bg-neutral-900/40 px-4 flex items-center justify-between select-none">
        {/* Left: Editable Title & Project Tag */}
        <div className="flex items-center space-x-3 truncate">
          {isEditingTitle ? (
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
                className="bg-neutral-800 border border-emerald-500 rounded px-2 py-0.5 text-xs text-neutral-100 font-semibold focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 group cursor-pointer" onClick={handleStartEditing}>
              <h2 className="font-semibold text-sm text-neutral-100 truncate max-w-xs sm:max-w-md">
                {session?.title || 'Conversation'}
              </h2>
              <Edit2 size={12} className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[11px] font-mono border border-neutral-700/60 hidden sm:inline">
            {currentProject?.name || 'No Project'}
          </span>
        </div>

        {/* Header Right Badges & Actions */}
        <div className="flex items-center space-x-2">
          {/* Model Tag */}
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800/70 border subtle-border text-[11px] text-neutral-300 font-mono">
            <Cpu size={11} className="text-emerald-400" />
            <span>{activeModel?.name.split(' ')[0]}</span>
          </div>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Actions toolbar */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`p-1.5 rounded transition-colors ${
              searchOpen
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                : 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title="Search in conversation (Non-blocking)"
          >
            <Search size={15} />
          </button>

          <button
            onClick={handleDistillMemory}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-blue-400 transition-colors"
            title="Distill session to Knowledge Vault"
          >
            <BrainCircuit size={15} />
          </button>

          <button
            onClick={handleExportMarkdown}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Export conversation as Markdown (.md)"
          >
            <Download size={15} />
          </button>

          <button
            onClick={() => session && clearSessionMessages(session.id)}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors"
            title="Clear messages in this chat"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => toggleContextDrawer()}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Toggle Context Drawer (Ctrl+J)"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>

      {/* Non-blocking in-thread Search Bar (Section 24, 25) */}
      {searchOpen && (
        <div className="px-4 py-2 bg-neutral-900/90 border-b subtle-border flex items-center justify-between space-x-3 text-xs">
          <div className="flex items-center space-x-2 flex-1 max-w-md bg-neutral-950 px-3 py-1.5 rounded-lg border subtle-border focus-within:border-emerald-500">
            <Search size={13} className="text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words, commands, or code in this thread..."
              autoFocus
              className="bg-transparent text-neutral-100 focus:outline-none w-full text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 text-neutral-400 text-[11px]">
            {searchQuery && (
              <span className="font-mono text-emerald-400">
                {displayedMessages.length} / {session?.messages.length || 0} matches
              </span>
            )}
            <button
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
              title="Close search"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {displayedMessages.length > 0 ? (
          displayedMessages.map((msg) => <MessageCard key={msg.id} message={msg} />)
        ) : searchQuery ? (
          <div className="py-12 text-center text-xs text-neutral-500 font-mono">
            No messages matching "{searchQuery}"
          </div>
        ) : (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border subtle-border flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
              <MessagesSquare size={24} />
            </div>
            <h3 className="font-semibold text-lg text-neutral-100">
              Modular AI Workspace
            </h3>
            <p className="text-xs text-neutral-400 mt-1 mb-6 leading-relaxed">
              Interact with local models, attach skills, practice exercises, and inspect scoped project files without cloud lock-in.
            </p>

            <div className="w-full space-y-2 text-left">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1 px-1">
                Suggested Prompts
              </div>
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/60 hover:bg-neutral-900 border subtle-border hover:border-neutral-700 text-xs text-neutral-300 hover:text-neutral-100 transition-all cursor-pointer group"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <ArrowRight size={13} className="text-neutral-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Generation Indicator */}
        {isGenerating && (
          <div className="p-4 rounded-xl bg-neutral-900/30 border subtle-border flex items-center space-x-3 text-xs text-neutral-400">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <span>Local model reasoning & generating response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <Composer />
    </div>
  );
};
