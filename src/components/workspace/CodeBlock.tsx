import React, { useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'javascript' }) => {
  const [copied, setCopied] = useState(false);
  const { toggleContextDrawer } = useAppStore();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    toggleContextDrawer('terminal');
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border subtle-border bg-neutral-950 text-neutral-200 font-mono text-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/90 border-b subtle-border text-[11px] text-neutral-400 select-none">
        <span className="font-semibold text-neutral-300">{language}</span>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleRun}
            className="flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-emerald-400 transition-colors"
            title="Execute in embedded terminal"
          >
            <Play size={11} />
            <span>Run</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code content */}
      <pre className="p-3 overflow-x-auto leading-relaxed whitespace-pre font-mono text-[12px] text-neutral-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};
