import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  Play,
  Trophy,
  ArrowRight,
  Plus,
  Sparkles,
  Archive,
  Ban,
  HelpCircle,
} from 'lucide-react';
import { IExercise, ExerciseStatus } from '../../types';
import { ExerciseRunnerModal } from './ExerciseRunnerModal';

const TOPIC_PRESETS = [
  { id: 'classes', name: 'JavaScript Classes & Encapsulation', difficulty: 'Intermediate' as const },
  { id: 'closures', name: 'Lexical Closures & Scope Chain', difficulty: 'Intermediate' as const },
  { id: 'async', name: 'Promises, Async/Await & Microtasks', difficulty: 'Advanced' as const },
  { id: 'dom', name: 'DOM Events & Event Delegation', difficulty: 'Beginner' as const },
  { id: 'debounce', name: 'Debounce & Throttle Optimization', difficulty: 'Intermediate' as const },
];

export const ExercisesView: React.FC = () => {
  const [exercises, setExercises] = useState<IExercise[]>(() => {
    try {
      const saved = localStorage.getItem('evis_exercises');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeExercise, setActiveExercise] = useState<IExercise | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(TOPIC_PRESETS[0].name);
  const [customTopic, setCustomTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [objective, setObjective] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('evis_exercises', JSON.stringify(exercises));
    } catch {
      // ignore
    }
  }, [exercises]);

  const completedCount = exercises.filter((e) => e.status === 'completed').length;
  const activeCount = exercises.filter((e) => e.status === 'active' || e.status === 'generated').length;

  const handleComplete = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, status: 'completed' as ExerciseStatus } : e))
    );
  };

  const handleArchive = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, status: 'archived' as ExerciseStatus } : e))
    );
  };

  const handleAbandon = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, status: 'abandoned' as ExerciseStatus } : e))
    );
  };

  const handleRequestExercise = () => {
    const topic = customTopic.trim() || selectedTopic;
    if (!topic) return;

    setIsGenerating(true);

    // Pedagogical generator respecting Section 12-13
    setTimeout(() => {
      let title = `Pratique : ${topic}`;
      let description = `Mettez en œuvre les concepts fondamentaux de ${topic}. Écrivez une solution modulaire, testez-la dans la console, et demandez une évaluation par l'IA ou un indice pédagogique.`;
      let starterCode = `// Pratique Evis : ${topic}\n// Définissez votre solution ci-dessous :\n\nfunction solution() {\n  // Votre code ici\n  return true;\n}\n\nconsole.log("Test initial :", solution());`;

      if (topic.toLowerCase().includes('class')) {
        title = 'Encapsulation avec Classes ES6';
        description = 'Créez une classe UserProfile avec des champs privés (#email, #passwordHash), un constructeur validé, et un getter public sécurisé sans exposer le mot de passe.';
        starterCode = `class UserProfile {\n  #email;\n  #passwordHash;\n\n  constructor(email, password) {\n    if (!email.includes('@')) throw new Error('Email invalide');\n    this.#email = email;\n    this.#passwordHash = btoa(password);\n  }\n\n  get email() {\n    return this.#email;\n  }\n}\n\nconst user = new UserProfile('junior@parrot.local', 'secret123');\nconsole.log('Email:', user.email);`;
      } else if (topic.toLowerCase().includes('async') || topic.toLowerCase().includes('promise')) {
        title = 'Chaîne Asynchrone avec Gestion d\'Erreurs';
        description = 'Implémentez une fonction fetchWithRetry(taskFn, maxRetries, delayMs) qui réessaie une promesse asynchrone jusqu\'à maxRetries en cas d\'échec.';
        starterCode = `async function fetchWithRetry(taskFn, maxRetries = 3, delayMs = 200) {\n  let lastError;\n  for (let attempt = 1; attempt <= maxRetries; attempt++) {\n    try {\n      return await taskFn();\n    } catch (err) {\n      lastError = err;\n      if (attempt < maxRetries) {\n        await new Promise((r) => setTimeout(r, delayMs));\n      }\n    }\n  }\n  throw lastError;\n}\n\n// Test :\nlet count = 0;\nconst flakyTask = () => (++count < 3 ? Promise.reject(new Error('Temporarily down')) : Promise.resolve('Success!'));\nfetchWithRetry(flakyTask).then(console.log).catch(console.error);`;
      } else if (topic.toLowerCase().includes('closure')) {
        title = 'Module de Compteur Privé (Closure)';
        description = 'Construisez une factory createCounter(initialValue) avec increment(), decrement(), et getValue() préservant l\'état via la portée lexicale.';
        starterCode = `function createCounter(initial = 0) {\n  let count = initial;\n  return {\n    increment: () => ++count,\n    decrement: () => --count,\n    getValue: () => count,\n  };\n}\n\nconst counter = createCounter(5);\ncounter.increment();\nconsole.log('Valeur:', counter.getValue());`;
      }

      const newExercise: IExercise = {
        id: `ex-${Date.now()}`,
        title,
        topic,
        difficulty,
        status: 'active',
        description: objective ? `${description}\nObjectif ciblé : ${objective}` : description,
        starterCode,
        starterPrompt: `J'ai demandé un exercice sur "${topic}". Peux-tu me guider pas à pas sans donner la solution brute ?`,
        createdAt: new Date().toISOString(),
      };

      setExercises((prev) => [newExercise, ...prev]);
      setIsGenerating(false);
      setRequestModalOpen(false);
      setCustomTopic('');
      setObjective('');
    }, 400);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header banner */}
        <div className="flex items-center justify-between border-b subtle-border pb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <GraduationCap className="text-emerald-400" size={22} />
              <span>Exercise Skill & Practice</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              On-demand learning lifecycle (§12-13) : <em>Problem → Attempt → Evaluation → Hint → Retry → Solution</em>.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutral-900 border subtle-border text-xs text-neutral-300 font-mono">
              <Trophy size={13} className="text-emerald-400" />
              <span>{completedCount} Completed • {activeCount} Active</span>
            </div>

            <button
              onClick={() => setRequestModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Request Exercise (§12)</span>
            </button>
          </div>
        </div>

        {/* Request Modal / Inline Generator Panel */}
        {requestModalOpen && (
          <div className="p-5 rounded-xl border border-emerald-800/60 bg-neutral-900/90 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b subtle-border pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-sm text-neutral-100">
                  Request an Exercise from Exercise Skill
                </h3>
              </div>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Topic or Presets
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-neutral-950 border subtle-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  {TOPIC_PRESETS.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.difficulty})
                    </option>
                  ))}
                  <option value="">Custom Topic (Specify below)...</option>
                </select>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Or enter custom topic (e.g., WebSockets, Regex, Data Structures)..."
                  className="w-full bg-neutral-950 border subtle-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Difficulty Progression
                </label>
                <div className="flex space-x-2">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                        difficulty === d
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-neutral-950 text-neutral-400 border subtle-border hover:bg-neutral-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Specific Learning Goal (Optional)
                  </label>
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="e.g., Focus on private variables or edge cases"
                    className="w-full bg-neutral-950 border subtle-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleRequestExercise}
                disabled={isGenerating}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Sparkles size={13} />
                <span>{isGenerating ? 'Generating Exercise...' : 'Generate On-Demand Exercise'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Exercises List or Empty State */}
        {exercises.length === 0 ? (
          <div className="p-8 rounded-2xl border subtle-border bg-neutral-900/30 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border subtle-border mx-auto flex items-center justify-center text-emerald-400 shadow-inner">
              <HelpCircle size={24} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-semibold text-base text-neutral-100">
                No Exercises Auto-Populated (§12)
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                In Evis, exercises are strictly generated on demand according to your learning goals rather than arbitrarily invented. Request your first exercise or ask <strong>JavaScript Tutor</strong> directly in chat.
              </p>
            </div>
            <button
              onClick={() => setRequestModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Request Exercise Now</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="p-5 rounded-xl border subtle-border bg-neutral-900/40 hover:bg-neutral-900/70 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-semibold text-sm text-neutral-100">{ex.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium font-mono ${
                        ex.difficulty === 'Beginner'
                          ? 'bg-blue-950 text-blue-300'
                          : ex.difficulty === 'Intermediate'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-purple-950 text-purple-300'
                      }`}
                    >
                      {ex.difficulty}
                    </span>

                    {/* Real Lifecycle Status Pill (§13) */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                        ex.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                          : ex.status === 'active'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800/50'
                          : ex.status === 'abandoned'
                          ? 'bg-red-950 text-red-300 border border-red-800/50'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      Status: {ex.status}
                    </span>

                    {ex.status === 'completed' && (
                      <span className="flex items-center space-x-1 text-emerald-400 text-[11px] font-mono">
                        <CheckCircle2 size={12} />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-neutral-400 font-mono">
                    Topic: {ex.topic}
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed pt-1">
                    {ex.description}
                  </p>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 self-start md:self-center">
                  <button
                    onClick={() => setActiveExercise(ex)}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Play size={12} />
                    <span>{ex.status === 'completed' ? 'Review' : 'Open Playground'}</span>
                    <ArrowRight size={12} />
                  </button>

                  {ex.status !== 'archived' && (
                    <button
                      onClick={() => handleArchive(ex.id)}
                      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      title="Archive exercise"
                    >
                      <Archive size={14} />
                    </button>
                  )}

                  {ex.status === 'active' && (
                    <button
                      onClick={() => handleAbandon(ex.id)}
                      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Abandon exercise"
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Playground & AI Evaluation Modal */}
      <ExerciseRunnerModal
        exercise={activeExercise}
        onClose={() => setActiveExercise(null)}
        onComplete={handleComplete}
      />
    </div>
  );
};
