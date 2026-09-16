import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { IToolCall } from '../../types';

interface ToolExecutionCardProps {
  toolCall: IToolCall;
}

export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  const isSuccess = toolCall.status === 'success';

  return (
    <div className="my-2 border subtle-border rounded-lg bg-neutral-900/90 overflow-hidden text-xs font-mono">
      {/* Tool header banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800/60 transition-colors text-left select-none"
      >
        <div className="flex items-center space-x-2">
          {isSuccess ? (
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
          )}
          <Terminal size={13} className="text-neutral-400 flex-shrink-0" />
          <span className="font-semibold text-neutral-200">{toolCall.toolName}</span>
          <span className="text-[11px] text-neutral-500 truncate max-w-xs">
            {JSON.stringify(toolCall.args)}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-neutral-400">
          {toolCall.durationMs !== undefined && (
            <span className="flex items-center space-x-1 text-[10px] text-neutral-500">
              <Clock size={11} />
              <span>{toolCall.durationMs}ms</span>
            </span>
          )}
          <span className="p-0.5 hover:text-neutral-200">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </button>

      {/* Expanded tool output */}
      {expanded && (
        <div className="p-3 border-t subtle-border bg-neutral-950/90 space-y-2">
          {toolCall.args && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                Arguments:
              </div>
              <pre className="p-2 rounded bg-neutral-900 text-neutral-300 text-[11px] overflow-x-auto">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.stdout && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                Stdout:
              </div>
              <pre className="p-2 rounded bg-neutral-900/90 text-emerald-300/90 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {toolCall.stdout}
              </pre>
            </div>
          )}

          {toolCall.stderr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">
                Stderr:
              </div>
              <pre className="p-2 rounded bg-red-950/30 text-red-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {toolCall.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
