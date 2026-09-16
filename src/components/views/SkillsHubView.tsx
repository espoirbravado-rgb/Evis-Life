import React from 'react';
import { Sparkles, ShieldCheck, Check, Plus, AlertTriangle, Layers } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ISkill } from '../../types';

export const SkillsHubView: React.FC = () => {
  const { skills, activeSessionId, sessions, toggleSkillInSession, setActiveView } = useAppStore();
  const currentSession = sessions.find((s) => s.id === activeSessionId);
  const activeSkillIds = currentSession?.activeSkillIds || [];

  // Categorize skills according to §9 and §30
  const activeSkills = skills.filter((s) => activeSkillIds.includes(s.id));
  const installedSkills = skills.filter((s) => !activeSkillIds.includes(s.id) && s.status === 'active');
  const availableSkills = skills.filter((s) => !activeSkillIds.includes(s.id) && s.status === 'available');
  const unavailableSkills = skills.filter((s) => s.status === 'missing-dep' || s.status === 'not-installed');

  const renderSkillCard = (skill: ISkill, isActive: boolean) => {
    const isMissingDep = skill.status === 'missing-dep';

    return (
      <div
        key={skill.id}
        className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
          isActive
            ? 'bg-neutral-900/90 border-purple-800/60 shadow-lg shadow-purple-950/20'
            : isMissingDep
            ? 'bg-neutral-900/30 border-amber-900/40 opacity-75'
            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  isActive
                    ? 'bg-purple-950/70 border-purple-700 text-purple-300'
                    : isMissingDep
                    ? 'bg-amber-950/50 border-amber-800/50 text-amber-400'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
              >
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-neutral-100">{skill.name}</h3>
                <span className="text-[10px] text-neutral-500 font-mono">
                  v{skill.version} • {skill.author || 'Evis Core'}
                </span>
              </div>
            </div>

            {isMissingDep ? (
              <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-mono">
                <AlertTriangle size={12} />
                <span>Missing Dep</span>
              </span>
            ) : (
              <button
                onClick={() => toggleSkillInSession(skill.id)}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60 hover:bg-purple-800/60'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                }`}
              >
                {isActive ? (
                  <>
                    <Check size={13} className="text-purple-300" />
                    <span>Active in Chat</span>
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    <span>Attach Skill</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-neutral-300 my-3 leading-relaxed">
            {skill.description}
          </p>

          {/* Capabilities */}
          <div className="space-y-1.5 my-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Core Capabilities:
            </span>
            <ul className="space-y-1">
              {skill.capabilities.map((cap, i) => (
                <li key={i} className="text-[11px] text-neutral-300 flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-purple-400" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools & Dependencies badges (§30) */}
          <div className="pt-3 border-t subtle-border space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Dependencies:</span>
              <span className="text-neutral-300 font-mono">
                {skill.dependencies.join(', ') || 'None'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Permissions Required:</span>
              <span className="text-neutral-300 font-mono flex items-center space-x-1">
                <ShieldCheck size={11} />
                <span>{skill.permissions.length} declared</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header banner */}
        <div className="flex items-center justify-between border-b subtle-border pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <Sparkles className="text-purple-400" size={22} />
              <span>Skill Hub & Capability Registry</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Discover and manage modular capabilities. Categorized by lifecycle state (§9, §30).
            </p>
          </div>

          <button
            onClick={() => setActiveView('chat')}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors cursor-pointer"
          >
            Back to Chat
          </button>
        </div>

        {/* Section 1: Active in Current Session */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-400 border-b border-purple-900/40 pb-1.5">
            <Layers size={14} />
            <span>Active in Current Session ({activeSkills.length})</span>
          </div>

          {activeSkills.length === 0 ? (
            <div className="p-4 rounded-xl bg-neutral-900/30 border subtle-border text-xs text-neutral-500 font-mono">
              No skills currently attached to active chat session.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSkills.map((s) => renderSkillCard(s, true))}
            </div>
          )}
        </div>

        {/* Section 2: Installed & Ready */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 border-b border-emerald-900/40 pb-1.5">
            <Check size={14} />
            <span>Installed & Ready to Attach ({installedSkills.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {installedSkills.map((s) => renderSkillCard(s, false))}
          </div>
        </div>

        {/* Section 3: Available Skills */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 border-b subtle-border pb-1.5">
            <Plus size={14} />
            <span>Available Skills ({availableSkills.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableSkills.map((s) => renderSkillCard(s, false))}
          </div>
        </div>

        {/* Section 4: Unavailable (if any) */}
        {unavailableSkills.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-500 border-b border-amber-900/40 pb-1.5">
              <AlertTriangle size={14} />
              <span>Unavailable (Missing Dependencies) ({unavailableSkills.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unavailableSkills.map((s) => renderSkillCard(s, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
