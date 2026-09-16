import React from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';
import { ProjectFilePreview } from '../../services/fileData';

interface FilePreviewModalProps {
  file: ProjectFilePreview | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = file.content.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-neutral-900 border subtle-border shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b subtle-border select-none">
          <div className="flex items-center space-x-2">
            <FileCode size={15} className="text-emerald-400" />
            <span className="font-semibold text-neutral-200">{file.name}</span>
            <span className="text-neutral-500 text-[10px]">({file.size})</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-950/70 text-neutral-200">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/40">
                  <td className="w-10 pr-4 text-right select-none text-neutral-600 text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre-wrap break-all text-neutral-100 leading-relaxed text-[12px]">
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
