import React, { useState } from 'react';
import { BrainCircuit, Search, Tag, Calendar, Folder } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDate } from '../../lib/utils';

export const KnowledgeVaultView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { knowledge, projects } = useAppStore();

  const filteredKnowledge = knowledge.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b subtle-border pb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <BrainCircuit className="text-blue-400" size={22} />
              <span>Knowledge Vault</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Persistent memory and distilled technical decisions extracted from conversation sessions.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border subtle-border rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredKnowledge.map((item) => {
            const project = projects.find((p) => p.id === item.projectId);

            return (
              <div
                key={item.id}
                className="p-5 rounded-xl border subtle-border bg-neutral-900/40 hover:bg-neutral-900/70 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-neutral-100">{item.title}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800/50 text-blue-300 text-[10px] uppercase font-mono">
                      {item.category}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                    {item.content}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-400 font-mono"
                      >
                        <Tag size={9} />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t subtle-border flex items-center justify-between text-[11px] text-neutral-500">
                  <div className="flex items-center space-x-2">
                    <Folder size={11} />
                    <span>{project?.name || 'Global'}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Calendar size={11} />
                    <span>{formatDate(item.updatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
