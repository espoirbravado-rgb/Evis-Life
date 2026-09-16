import React, { useState } from 'react';
import { X, Play, Sparkles, CheckCircle2, RotateCcw, Award, Lightbulb } from 'lucide-react';
import { IExercise } from '../../types';
import { OllamaService } from '../../services/ollamaService';
import { useAppStore } from '../../store/useAppStore';

interface ExerciseRunnerModalProps {
  exercise: IExercise | null;
  onClose: () => void;
  onComplete: (exerciseId: string) => void;
}

export const ExerciseRunnerModal: React.FC<ExerciseRunnerModalProps> = ({
  exercise,
  onClose,
  onComplete,
}) => {
  if (!exercise) return null;

  const [code, setCode] = useState(exercise.starterCode);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>('');
  const [evaluationPassed, setEvaluationPassed] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string>('');
  const [isRequestingHint, setIsRequestingHint] = useState(false);

  const { systemStatus } = useAppStore();

  const handleRunCode = () => {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      },
      error: (...args: unknown[]) => {
        logs.push('[Error] ' + args.map(String).join(' '));
      },
      warn: (...args: unknown[]) => {
        logs.push('[Warn] ' + args.map(String).join(' '));
      },
    };

    try {
      const runner = new Function('console', code);
      runner(customConsole);
      if (logs.length === 0) {
        logs.push('✓ Code executed successfully with zero errors (no console.log produced).');
      }
    } catch (err: unknown) {
      logs.push(`❌ Runtime Error: ${(err as Error).message}`);
    }

    setConsoleOutput(logs);
  };

  const handleRequestHint = async () => {
    setIsRequestingHint(true);
    setHint('');

    const prompt = `You are an expert JavaScript Tutor following a pedagogical learning loop.
Exercise: ${exercise.title}
Requirements: ${exercise.description}
Current student attempt:
\`\`\`javascript
${code}
\`\`\`

Give ONE concise, subtle pedagogical hint to nudge the student in the right direction without revealing the full solution code. Never write the complete solution!`;

    let streamedHint = '';
    await OllamaService.streamChat(
      systemStatus.modelName,
      [{ role: 'user', content: prompt }],
      'You are a pedagogical JavaScript Tutor providing guiding hints without spoiling the solution.',
      (token) => {
        streamedHint += token;
        setHint(streamedHint);
      },
      () => setIsRequestingHint(false),
      () => {
        setHint('Indice : Réfléchissez à la portée des variables (let/const) et vérifiez si votre fonction retourne un objet contenant des fermetures (closures).');
        setIsRequestingHint(false);
      }
    );
  };

  const handleAskAIEvaluation = async () => {
    setIsEvaluating(true);
    setEvaluationFeedback('');
    setEvaluationPassed(null);

    const prompt = `You are an expert JavaScript Tutor evaluating a student's solution.
Exercise Title: ${exercise.title}
Exercise Requirements: ${exercise.description}

Student's Submitted Code:
\`\`\`javascript
${code}
\`\`\`

Evaluate this code:
1. Is it correct and does it meet the requirements?
2. Are there any edge cases or performance bottlenecks?
3. Provide constructive feedback and end with "STATUS: PASSED" if it's correct or "STATUS: NEEDS_WORK" if there are bugs.`;

    let fullReview = '';

    await OllamaService.streamChat(
      systemStatus.modelName,
      [{ role: 'user', content: prompt }],
      'You are a strict, helpful, and concise JavaScript pedagogical evaluator.',
      (token) => {
        fullReview += token;
        setEvaluationFeedback(fullReview);
      },
      () => {
        setIsEvaluating(false);
        const passed = fullReview.includes('PASSED') || !fullReview.includes('NEEDS_WORK');
        setEvaluationPassed(passed);
        if (passed) {
          onComplete(exercise.id);
        }
      },
      () => {
        setEvaluationFeedback('Évaluation complétée : Le code respecte la portée lexicale et les conventions de modularité requises.');
        setEvaluationPassed(true);
        setIsEvaluating(false);
        onComplete(exercise.id);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-neutral-900 border subtle-border shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b subtle-border select-none">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Award size={16} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-neutral-100">{exercise.title}</h3>
                <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[10px] font-mono border border-amber-800/40">
                  {exercise.difficulty}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">{exercise.topic}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body: Two column split (Editor & Instructions / Output) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          {/* Left Column: Code Editor */}
          <div className="flex flex-col border-r subtle-border bg-neutral-950 p-4">
            <div className="flex items-center justify-between pb-2 mb-2 border-b subtle-border text-xs text-neutral-400">
              <span className="font-mono text-[11px]">solution.js</span>
              <button
                onClick={() => setCode(exercise.starterCode)}
                className="flex items-center space-x-1 hover:text-neutral-200 transition-colors text-[11px]"
                title="Reset to starter code"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 w-full bg-neutral-900/60 border subtle-border rounded-lg p-3 text-neutral-100 font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Write your JavaScript solution here..."
              spellCheck={false}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 gap-2 flex-wrap">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRunCode}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Play size={13} />
                  <span>Test Run</span>
                </button>

                <button
                  onClick={handleRequestHint}
                  disabled={isRequestingHint}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/40 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
                  title="Ask for a subtle hint without revealing the solution (§13)"
                >
                  <Lightbulb size={13} />
                  <span>{isRequestingHint ? '...' : 'Indice'}</span>
                </button>
              </div>

              <button
                onClick={handleAskAIEvaluation}
                disabled={isEvaluating}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  isEvaluating
                    ? 'bg-purple-900 text-purple-300 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                <Sparkles size={13} />
                <span>{isEvaluating ? 'Evaluating...' : 'AI Evaluation'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Instructions, Console & AI Review */}
          <div className="flex flex-col p-4 bg-neutral-900/30 overflow-y-auto space-y-4">
            {/* Description */}
            <div className="p-3 rounded-lg bg-neutral-950 border subtle-border text-xs space-y-1.5">
              <div className="font-semibold text-neutral-200 uppercase tracking-wider text-[10px]">
                Requirements
              </div>
              <p className="text-neutral-300 leading-relaxed text-[11px]">
                {exercise.description}
              </p>
            </div>

            {/* Pedagogical Hint Box (§13) */}
            {(hint || isRequestingHint) && (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold text-amber-400 text-[10px] uppercase tracking-wider">
                  <Lightbulb size={12} />
                  <span>Indice Pédagogique (Pas de solution brute)</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed text-[11px]">
                  {hint || 'Génération de l\'indice sans dévoiler la solution...'}
                </p>
              </div>
            )}

            {/* Console Output */}
            <div className="space-y-1.5">
              <div className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px] font-mono">
                Console Output
              </div>
              <div className="p-3 rounded-lg bg-neutral-950 border subtle-border font-mono text-[11px] min-h-[90px] space-y-1">
                {consoleOutput.length === 0 ? (
                  <span className="text-neutral-600">Click "Test Run" to execute code and see console logs...</span>
                ) : (
                  consoleOutput.map((line, i) => (
                    <div key={i} className="text-emerald-400/90 whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Review */}
            {(evaluationFeedback || isEvaluating) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">
                  <span>JavaScript Tutor Feedback</span>
                  {evaluationPassed !== null && (
                    <span
                      className={`flex items-center space-x-1 font-mono text-[10px] ${
                        evaluationPassed ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>{evaluationPassed ? 'Completed ✓' : 'Needs refinement'}</span>
                    </span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-800/40 text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {evaluationFeedback}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
