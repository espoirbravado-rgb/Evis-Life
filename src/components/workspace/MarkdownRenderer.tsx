import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple, robust markdown chunk parser for headings, code blocks, lists, and paragraphs
  const renderFormatted = () => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const firstLineEnd = part.indexOf('\n');
        const lang = part.slice(3, firstLineEnd).trim() || 'javascript';
        const code = part.slice(firstLineEnd + 1, -3);
        return <CodeBlock key={index} code={code} language={lang} />;
      }

      // Format normal markdown text (headings, bullet points, paragraphs, inline code)
      const lines = part.split('\n');
      return (
        <div key={index} className="space-y-2 text-sm leading-relaxed text-neutral-200">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={lIdx} className="h-1" />;

            if (trimmed.startsWith('#### ')) {
              return (
                <h4 key={lIdx} className="font-semibold text-neutral-200 text-sm mt-3 mb-1">
                  {trimmed.replace('#### ', '')}
                </h4>
              );
            }
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={lIdx} className="font-bold text-neutral-100 text-base mt-4 mb-2">
                  {trimmed.replace('### ', '')}
                </h3>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h2 key={lIdx} className="font-bold text-neutral-100 text-lg mt-5 mb-2 border-b subtle-border pb-1">
                  {trimmed.replace('## ', '')}
                </h2>
              );
            }
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <li key={lIdx} className="ml-4 list-disc text-neutral-300 text-xs sm:text-sm">
                  {renderInlineFormatting(trimmed.substring(2))}
                </li>
              );
            }
            if (/^\d+\.\s/.test(trimmed)) {
              return (
                <li key={lIdx} className="ml-4 list-decimal text-neutral-300 text-xs sm:text-sm">
                  {renderInlineFormatting(trimmed.replace(/^\d+\.\s/, ''))}
                </li>
              );
            }

            return (
              <p key={lIdx} className="text-neutral-200 text-xs sm:text-sm">
                {renderInlineFormatting(line)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  const renderInlineFormatting = (text: string): React.ReactNode => {
    // Process inline code `foo` and bold **bar**
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((chunk, i) => {
      if (chunk.startsWith('`') && chunk.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono text-[12px] border border-neutral-700/60"
          >
            {chunk.slice(1, -1)}
          </code>
        );
      }
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-neutral-100">
            {chunk.slice(2, -2)}
          </strong>
        );
      }
      if (chunk.startsWith('*') && chunk.endsWith('*')) {
        return (
          <em key={i} className="italic text-neutral-300">
            {chunk.slice(1, -1)}
          </em>
        );
      }
      return chunk;
    });
  };

  return <div className="space-y-2">{renderFormatted()}</div>;
};
