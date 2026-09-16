import React from 'react';
import { FolderTree, Folder, Plus, ArrowRight, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ProjectsView: React.FC = () => {
  const { projects, activeProjectId, setActiveProject, setActiveView, skills } = useAppStore();

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b subtle-border pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <FolderTree className="text-emerald-400" size={22} />
              <span>Project Workspaces</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Isolated workspace directories with dedicated memory vaults, conversations, and skill sets.
            </p>
          </div>

          <button
            onClick={() => alert('Create New Project: Specify project directory path and default skills.')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => {
            const isSelected = project.id === activeProjectId;
            const projectSkills = project.defaultSkillIds
              .map((id) => skills.find((s) => s.id === id)?.name)
              .filter(Boolean);

            return (
              <div
                key={project.id}
                onClick={() => {
                  setActiveProject(project.id);
                  setActiveView('chat');
                }}
                className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-neutral-900/90 border-emerald-600 shadow-lg shadow-emerald-950/20'
                    : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                        <Folder size={16} />
                      </div>
                      <h3 className="font-semibold text-sm text-neutral-100">{project.name}</h3>
                    </div>

                    {isSelected && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold">
                        <Check size={11} />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400 my-2 leading-relaxed">
                    {project.description}
                  </p>

                  <div className="p-2 rounded bg-neutral-950 font-mono text-[11px] text-neutral-400 truncate mb-3 border subtle-border">
                    {project.rootPath}
                  </div>

                  {/* Skills associated */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500">Default Skills:</span>
                    <div className="flex flex-wrap gap-1">
                      {projectSkills.map((skName, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-purple-950/50 border border-purple-800/40 text-[10px] text-purple-300">
                          {skName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t subtle-border flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center space-x-3">
                    <span>{project.conversationCount} chats</span>
                    <span>•</span>
                    <span>{project.knowledgeCount} notes</span>
                  </div>

                  <span className="flex items-center space-x-1 text-emerald-400 font-medium group">
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
