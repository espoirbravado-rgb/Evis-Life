import React, { useState, useEffect } from 'react';
import {
  Files,
  FileCode,
  FolderOpen,
  Folder,
  Copy,
  Check,
  Eye,
  RotateCcw,
  ArrowLeft,
  Search,
  Plus,
} from 'lucide-react';
import { FilesystemService, IFSItem } from '../../services/filesystemService';
import { ProjectFilePreview } from '../../services/fileData';
import { FilePreviewModal } from '../drawer/FilePreviewModal';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'sh':
      return 'bash';
    default:
      return 'text';
  }
}

export const FileExplorerView: React.FC = () => {
  const [currentDir, setCurrentDir] = useState<string>('');
  const [items, setItems] = useState<IFSItem[]>([]);
  const [rootDir, setRootDir] = useState<string>('/home/junior/Desktop/New-Ag');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<ProjectFilePreview | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadFiles = async (dir: string = currentDir) => {
    setIsLoading(true);
    const res = await FilesystemService.list(dir);
    setItems(res.items);
    setCurrentDir(res.currentDir);
    if (res.rootDir) setRootDir(res.rootDir);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFiles(currentDir);
  }, [currentDir]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleOpenItem = async (item: IFSItem) => {
    if (item.isDirectory) {
      setCurrentDir(item.path);
    } else {
      const fileData = await FilesystemService.read(item.path);
      if (fileData) {
        setSelectedFile({
          name: item.name,
          path: `${rootDir}/${item.path}`,
          size: formatBytes(fileData.size),
          content: fileData.content,
          language: getLanguage(item.name),
        });
      }
    }
  };

  const handleNavigateUp = () => {
    if (!currentDir) return;
    const parts = currentDir.split('/');
    parts.pop();
    setCurrentDir(parts.join('/'));
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const targetRelPath = currentDir ? `${currentDir}/${newFileName.trim()}` : newFileName.trim();
    const ok = await FilesystemService.write(targetRelPath, '// Created with Evis Workspace\n');
    if (ok) {
      setNewFileName('');
      setShowCreateModal(false);
      await loadFiles(currentDir);
    } else {
      alert('Échec de la création du fichier.');
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-100 font-sans">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b subtle-border pb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <Files className="text-emerald-400" size={22} />
              <span>Explorateur de Fichiers Système Réel</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Espace de travail connecté au système de fichiers Linux réel, borné au dossier racine Evis.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadFiles(currentDir)}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs border subtle-border transition-colors cursor-pointer"
              title="Recharger le répertoire"
            >
              <RotateCcw size={12} className={isLoading ? 'animate-spin text-emerald-400' : ''} />
              <span>Actualiser</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
            >
              <Plus size={13} />
              <span>Nouveau Fichier</span>
            </button>
          </div>
        </div>

        {/* Path Bar & Breadcrumbs */}
        <div className="flex items-center justify-between bg-neutral-900/70 border subtle-border rounded-xl px-3 py-2 text-xs font-mono">
          <div className="flex items-center space-x-2 truncate">
            {currentDir && (
              <button
                onClick={handleNavigateUp}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                title="Dossier parent"
              >
                <ArrowLeft size={13} />
              </button>
            )}

            <div className="flex items-center space-x-1 text-neutral-400 text-[11px] truncate">
              <button
                onClick={() => setCurrentDir('')}
                className="hover:text-emerald-400 hover:underline cursor-pointer"
              >
                root
              </button>
              {currentDir.split('/').filter(Boolean).map((part, index, arr) => {
                const stepPath = arr.slice(0, index + 1).join('/');
                return (
                  <React.Fragment key={stepPath}>
                    <span>/</span>
                    <button
                      onClick={() => setCurrentDir(stepPath)}
                      className="hover:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {part}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
            <span className="truncate max-w-[200px] hidden md:inline text-neutral-500">
              {rootDir}/{currentDir}
            </span>
            <button
              onClick={() => handleCopyPath(`${rootDir}/${currentDir}`)}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              title="Copier le chemin absolu"
            >
              {copiedPath ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Search filter toolbar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les fichiers dans ce dossier..."
            className="w-full bg-neutral-900 border subtle-border rounded-lg pl-9 pr-3 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Real File Listing */}
        <div className="rounded-xl border subtle-border bg-neutral-900/50 overflow-hidden font-mono text-xs">
          <div className="px-4 py-2.5 bg-neutral-900 border-b subtle-border flex items-center justify-between text-neutral-400 text-[11px]">
            <div className="flex items-center space-x-2">
              <FolderOpen size={14} className="text-amber-400" />
              <span className="font-semibold text-neutral-200">
                {currentDir ? `Dossier: ${currentDir}` : 'Racine du Projet'}
              </span>
            </div>
            <span>{filteredItems.length} élément{filteredItems.length > 1 ? 's' : ''}</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs">
                {isLoading ? 'Lecture du disque en cours...' : 'Aucun fichier ou dossier trouvé.'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleOpenItem(item)}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-neutral-800/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center space-x-3 truncate pr-4">
                    {item.isDirectory ? (
                      <Folder size={16} className="text-amber-400 flex-shrink-0" />
                    ) : (
                      <FileCode size={16} className="text-emerald-400 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <span className={`font-semibold text-xs ${item.isDirectory ? 'text-amber-300' : 'text-neutral-200'} group-hover:underline`}>
                        {item.name}
                      </span>
                      {item.isDirectory && (
                        <span className="text-neutral-500 text-[10px] ml-1.5 font-sans">/</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className="text-neutral-500 text-[11px]">
                      {item.isDirectory ? 'Dossier' : formatBytes(item.size)}
                    </span>
                    {!item.isDirectory && (
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-400 uppercase">
                        {getLanguage(item.name)}
                      </span>
                    )}
                    {!item.isDirectory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenItem(item);
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-800/50 border subtle-border text-neutral-300 text-xs transition-all cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Aperçu</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New File Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-neutral-900 border subtle-border shadow-2xl p-5 space-y-4">
            <h3 className="font-semibold text-sm text-neutral-100 flex items-center space-x-2">
              <Plus size={16} className="text-emerald-400" />
              <span>Créer un nouveau fichier</span>
            </h3>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="text-neutral-400 text-xs block mb-1">
                  Nom du fichier (dans <code className="text-emerald-400 font-mono">{currentDir || 'root'}</code>) :
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="ex: notes.md, test.ts, config.json..."
                  autoFocus
                  className="w-full bg-neutral-950 border subtle-border rounded-lg px-3 py-2 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Code preview modal with live content */}
      <FilePreviewModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </div>
  );
};
