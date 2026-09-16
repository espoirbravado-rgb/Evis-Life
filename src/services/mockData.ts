import { ISkill, IModel, IProject, ISession, IKnowledgeItem, ITool } from '../types';

// Models are dynamically discovered from active provider hosts (Ollama & llama.cpp)
export const INITIAL_MODELS: IModel[] = [];

export const INITIAL_SKILLS: ISkill[] = [
  {
    id: 'desktop-notes',
    name: 'Notes & Bureau Linux',
    description: 'Création et gestion physique des notes et rappels directement sur votre Bureau (/home/junior/Desktop).',
    version: '1.0.0',
    icon: 'FileText',
    author: 'Evis Core',
    category: 'specialized',
    capabilities: [
      'Créer des notes physiques sur le Bureau Linux',
      'Consulter et lister les notes enregistrées',
      'Horodatage et organisation automatique des mémos',
    ],
    dependencies: ['Linux Desktop', 'Host Filesystem Bridge'],
    requiredTools: ['write_desktop_note', 'read_file'],
    optionalTools: ['list_dir'],
    permissions: [
      {
        id: 'perm-desktop-write',
        name: 'Écriture de Notes sur le Bureau',
        description: 'Autorise la création de fichiers .txt directement sur /home/junior/Desktop',
        granted: true,
      },
    ],
    systemInstructions:
      'Vous êtes le gestionnaire de notes de bureau Evis. Lorsque l’utilisateur vous demande de créer ou d’écrire une note, vous exécutez physiquement l’action sans bavardage superflu.',
    intentTriggers: ['note sur mon bureau', 'écris une note', 'crée une note sur le bureau', 'desktop note'],
    status: 'active',
  },
  {
    id: 'js-tutor',
    name: 'JavaScript Tutor',
    description: 'Structured JavaScript instruction, concepts explanation, and code evaluation.',
    version: '1.2.0',
    icon: 'Code2',
    author: 'Evis Core',
    category: 'specialized',
    capabilities: [
      'Explain JavaScript concepts',
      'Evaluate code attempts',
      'Analyze closures and async patterns',
    ],
    dependencies: ['Local AI', 'Memory'],
    requiredTools: ['save_knowledge'],
    optionalTools: ['run_command'],
    permissions: [
      { id: 'perm-read', name: 'Read Project Notes', description: 'Access project knowledge', granted: true },
      { id: 'perm-write', name: 'Save Practice Notes', description: 'Commit summary cards to vault', granted: true },
    ],
    systemInstructions: 'You are an expert JavaScript Tutor in the Evis workspace. Give clear, structured, idiomatically correct explanations with code snippets.',
    intentTriggers: ['javascript', 'js', 'closure', 'async', 'promise', 'tutor'],
    status: 'active',
  },
  {
    id: 'file-system',
    name: 'File Explorer',
    description: 'Browse, inspect, and open files strictly within the configured workspace root and Desktop.',
    version: '1.0.0',
    icon: 'FolderOpen',
    author: 'Evis Core',
    category: 'global',
    capabilities: ['Browse directory trees', 'Preview source files', 'Inspect manifests', 'Manage workspace files'],
    dependencies: ['Local Filesystem'],
    requiredTools: ['read_file', 'list_dir'],
    optionalTools: ['write_file', 'write_desktop_note'],
    permissions: [
      { id: 'fs-scope', name: 'Workspace Root Sandbox', description: 'Permit operations strictly within workspace directory', granted: true },
      { id: 'perm-desktop-write', name: 'Desktop Notes Access', description: 'Autorise l’écriture de notes sur le bureau', granted: true },
    ],
    intentTriggers: ['fichier', 'dossier', 'explorer', 'list files', 'read file', 'write file'],
    status: 'active',
  },
  {
    id: 'terminal',
    name: 'Terminal Runner',
    description: 'Execute shell commands and tests safely with live output stream.',
    version: '1.0.0',
    icon: 'Terminal',
    author: 'Evis Core',
    category: 'specialized',
    capabilities: ['Execute npm/build scripts', 'Capture stdout/stderr', 'Inspect tool diagnostics'],
    dependencies: ['Linux Shell'],
    requiredTools: ['run_command'],
    optionalTools: [],
    permissions: [
      { id: 'term-exec', name: 'Run Non-Destructive Shell Commands', description: 'Allow running safe build and inspection commands', granted: true },
    ],
    intentTriggers: ['commande', 'terminal', 'shell', 'bash', 'run script'],
    status: 'available',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'External documentation retrieval (disabled by default; requires explicit activation).',
    version: '1.0.0',
    icon: 'Globe',
    author: 'Evis Core',
    category: 'specialized',
    capabilities: ['Query web endpoints', 'Fetch online documentation'],
    dependencies: ['Internet Connection'],
    requiredTools: ['search_web'],
    optionalTools: [],
    permissions: [
      { id: 'web-perm', name: 'Outgoing Network HTTP Access', description: 'Permit web queries', granted: false },
    ],
    intentTriggers: ['web', 'internet', 'search', 'google'],
    status: 'available',
  },
  {
    id: 'memory-curator',
    name: 'Knowledge Vault Curator',
    description: 'Distill decisions and architecture notes into persistent Markdown cards.',
    version: '1.0.0',
    icon: 'Brain',
    author: 'Evis Core',
    category: 'global',
    capabilities: ['Session distillation', 'Knowledge indexing', 'Context injection'],
    dependencies: ['Local Storage'],
    requiredTools: ['save_knowledge'],
    optionalTools: [],
    permissions: [
      { id: 'mem-save', name: 'Save to Vault', description: 'Save distilled cards to local project storage', granted: true },
    ],
    intentTriggers: ['mémoire', 'vault', 'sauvegarde décision', 'connaissance'],
    status: 'active',
  },
];

export const AVAILABLE_TOOLS: ITool[] = [
  { id: 'write_desktop_note', name: 'Write Desktop Note', description: 'Crée physiquement une note textuelle sur le bureau Linux (/home/junior/Desktop)', riskLevel: 'safe', category: 'file', requiredPermission: 'perm-desktop-write' },
  { id: 'write_file', name: 'Write Workspace File', description: 'Écrit un fichier texte dans le projet', riskLevel: 'prompt', category: 'file', requiredPermission: 'fs-scope' },
  { id: 'read_file', name: 'Read File', description: 'Lit le contenu d’un fichier projet ou bureau', riskLevel: 'safe', category: 'file', requiredPermission: 'fs-scope' },
  { id: 'list_dir', name: 'List Directory', description: 'Liste les fichiers d’un répertoire', riskLevel: 'safe', category: 'file', requiredPermission: 'fs-scope' },
  { id: 'run_command', name: 'Run Command', description: 'Exécute une commande bash Linux', riskLevel: 'prompt', category: 'terminal', requiredPermission: 'term-exec' },
  { id: 'save_knowledge', name: 'Save Knowledge Card', description: 'Commit persistent fact to memory vault', riskLevel: 'safe', category: 'memory', requiredPermission: 'mem-save' },
  { id: 'search_web', name: 'Web Search', description: 'Recherche documentaire sur Internet', riskLevel: 'prompt', category: 'web', requiredPermission: 'web-perm' },
];

export const INITIAL_PROJECTS: IProject[] = [
  {
    id: 'proj-evis',
    name: 'Evis Workspace',
    description: 'Modular local AI workspace on Linux with dynamic provider integration.',
    rootPath: '/home/junior/Desktop/New-Ag',
    defaultSkillIds: ['file-system', 'desktop-notes', 'terminal', 'memory-curator'],
    defaultModelId: 'qwen2.5-coder:1.5b',
    conversationCount: 1,
    knowledgeCount: 2,
    createdAt: '2026-09-13T16:00:00Z',
  },
];

export const INITIAL_KNOWLEDGE: IKnowledgeItem[] = [
  {
    id: 'k-evis-1',
    title: 'Evis UI Behavior Rules (skill_1.md)',
    category: 'decision',
    summary: 'The UI must represent the real state of the system without inventing models, providers, or fake statistics.',
    content: 'Evis connects directly to detected local providers (Ollama on 11434, llama.cpp). It avoids fake models or placeholder statistics.',
    tags: ['evis', 'architecture', 'rule'],
    projectId: 'proj-evis',
    updatedAt: '2026-09-13T17:40:00Z',
  },
  {
    id: 'k-evis-2',
    title: 'Speech & Selection Capabilities',
    category: 'note',
    summary: 'Voice input and text-to-speech operate as non-blocking native services alongside natural text selection.',
    content: 'Users can freely select and copy text. Voice input reserves a microphone control in the composer; AI responses support read-aloud playback.',
    tags: ['speech', 'ui', 'interaction'],
    projectId: 'proj-evis',
    updatedAt: '2026-09-13T17:42:00Z',
  },
];

export const INITIAL_SESSIONS: ISession[] = [
  {
    id: 'sess-main',
    title: 'Evis Workspace Introduction',
    projectId: 'proj-evis',
    createdAt: '2026-09-13T17:40:00Z',
    updatedAt: '2026-09-13T17:42:00Z',
    activeSkillIds: ['filesystem', 'memory', 'terminal'],
    activeModelId: 'qwen2.5-coder:1.5b',
    webSearchEnabled: false,
    isArchived: false,
    messages: [
      {
        id: 'm-init-1',
        role: 'assistant',
        content: `Bienvenue dans **Evis**, votre espace de travail IA local modulaire pour Linux.\n\n* **Modèle local actif** : \`qwen2.5-coder:1.5b\` détecté via Ollama.\n* **Fournisseurs** : Ollama (Connecté), llama.cpp (Non configuré).\n* **Contrôles vocaux** : Entrée microphone 🎤 et synthèse vocale *Read aloud* disponibles.\n\nPosez une question ou demandez une tâche technique pour commencer.`,
        timestamp: '2026-09-13T17:40:00Z',
        activeSkillsAtGeneration: ['file-system'],
      },
    ],
  },
];
