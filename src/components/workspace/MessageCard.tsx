import React, { useState } from 'react';
import { Bot, User, Sparkles, Clock, FileCode, Volume2, VolumeX, Copy, Check, Pencil, X } from 'lucide-react';
import { IMessage } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolExecutionCard } from './ToolExecutionCard';
import { formatTime } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { TextToSpeechService } from '../../services/speechService';

interface MessageCardProps {
  message: IMessage;
}

export const MessageCard: React.FC<MessageCardProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const { skills, toggleContextDrawer, activeSessionId, editMessageAndRegenerate, isGenerating } = useAppStore();
  const isUser = message.role === 'user';

  // Get active skill names that participated
  const activeSkillsList = message.activeSkillsAtGeneration
    ? message.activeSkillsAtGeneration
        .map((id) => skills.find((s) => s.id === id)?.name || id)
        .filter(Boolean)
    : [];

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      TextToSpeechService.stop();
      setIsSpeaking(false);
    } else {
      const started = TextToSpeechService.speak(
        message.content,
        () => setIsSpeaking(false),
        () => setIsSpeaking(false)
      );
      if (started) {
        setIsSpeaking(true);
      }
    }
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || isGenerating) return;
    editMessageAndRegenerate(activeSessionId, message.id, editContent);
    setIsEditing(false);
  };

  return (
    <div
      className={`p-4 rounded-xl transition-all select-text ${
        isUser
          ? 'bg-neutral-900/60 border subtle-border ml-8 md:ml-16'
          : 'bg-neutral-900/20 mr-4 md:mr-12'
      }`}
    >
      {/* Header bar: Avatar, Name, Time, Skills, Actions */}
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold ${
              isUser
                ? 'bg-neutral-800 text-neutral-300'
                : 'bg-emerald-950 border border-emerald-800/60 text-emerald-400'
            }`}
          >
            {isUser ? <User size={13} /> : <Bot size={14} />}
          </div>

          <span className="font-semibold text-xs text-neutral-200">
            {isUser ? 'You' : 'Evis Assistant'}
          </span>

          {/* Active skills attribution badge */}
          {!isUser && activeSkillsList.length > 0 && (
            <div className="flex items-center space-x-1">
              {activeSkillsList.map((skillName, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleContextDrawer('skills')}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-[10px] font-medium hover:bg-purple-900/60 transition-colors cursor-pointer"
                  title="Click to inspect active skill in Context Drawer"
                >
                  <Sparkles size={10} />
                  <span>{skillName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Message Actions: Edit (for user), Copy, Read Aloud, Time */}
        <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
          {isUser && !isEditing && (
            <button
              onClick={() => {
                setEditContent(message.content);
                setIsEditing(true);
              }}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              title="Edit prompt and regenerate"
            >
              <Pencil size={12} />
            </button>
          )}

          {!isUser && message.content && (
            <button
              onClick={handleToggleSpeech}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isSpeaking
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
              title={isSpeaking ? 'Stop reading aloud' : 'Read aloud (Text-to-Speech)'}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          )}

          <button
            onClick={handleCopyMessage}
            className="flex items-center space-x-1 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Copy message content"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied && <span className="text-[10px] text-emerald-400">Copied</span>}
          </button>

          <div className="flex items-center space-x-1 text-neutral-500 font-mono pl-1">
            <Clock size={11} />
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Attached files if any */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 my-2">
          {message.attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center space-x-1.5 px-2 py-1 bg-neutral-800/90 rounded border subtle-border text-xs text-neutral-300 font-mono"
            >
              <FileCode size={12} className="text-emerald-400" />
              <span>{att.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Message content or Inline Editor */}
      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 resize-y min-h-[80px]"
            rows={3}
            autoFocus
          />
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors cursor-pointer"
            >
              <X size={12} />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editContent.trim() || isGenerating}
              className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Check size={12} />
              <span>Save & Regenerate</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1 text-neutral-100 select-text">
          <MarkdownRenderer content={message.content} />
        </div>
      )}

      {/* Tool Call Cards */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-3 space-y-2">
          {message.toolCalls.map((tc) => (
            <ToolExecutionCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
};
