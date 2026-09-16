# AUDIT COMPLET DU PROJET NEW-AG / EVIS
> Généré le 2026-09-15 — À lire avant de toucher quoi que ce soit.
> Lire dans l'ordre : GEMINI.md → DECISIONS.md → ce fichier.

---

## TABLE DES MATIÈRES

1. Vue d'ensemble de l'architecture
2. Fichiers de configuration racine
3. Couche serveur (server/)
4. Couche UI (src/components/)
5. Store global (src/store/)
6. Services (src/services/)
7. Types globaux (src/types/)
8. Runtime — Orchestrateur (src/runtime/orchestrator/)
9. Runtime — Mémoire (src/runtime/memory/)
10. Runtime — Contexte (src/runtime/context/)
11. Runtime — Environnement (src/runtime/environment/)
12. Runtime — Sécurité (src/runtime/security/)
13. Runtime — Registries (src/runtime/registries/)
14. Runtime — Types internes (src/runtime/types/)
15. Skills (skills/)
16. Documentation (starterContent/)
17. Artefacts physiques sur disque
18. Graphe de dépendances global
19. État des phases / Niveau

---

## 1. VUE D'ENSEMBLE DE L'ARCHITECTURE

```
BROWSER UI (React/Vite)
  App.tsx → AppShell → Sidebar + ConversationWorkspace
  Composer → useAppStore.executeOrchestratorInSession()
       |
  STORE (useAppStore.ts ~990 lignes)
  État: sessions, skills, models, projects
  Cycle: WM init → Orchestrator → WM persist
       |
  WorkingMemory  +  Orchestrator  +  SkillRegistry
  (Niveau 1)        |                ToolRegistry
  Nav Stack         AgentLoop        ProviderRegistry
  parentId +        CapResolver      CapabilityRegistry
  returnTarget      |                ResourceRegistry
                    |
              ContextManager
              assembleContext()
              injecte WM + Skills
                    |
              ProviderDriver
              OllamaProviderDriver
              LlamaCppProviderDriver
                    |  HTTP (via Vite proxy)
              Vite dev server
              evisBackendPlugin.ts
              Routes: /api/fs/*
                      /api/skills
                      /api/provider/*
                      /api/environment
```

### INVARIANTS ARCHITECTURAUX (mécaniques — jamais violer)

- Le programme ne parle JAMAIS à la place du modèle.
- DOCUMENTATION != RÉALITÉ DU DISQUE — toujours inspecter le disque avant de déclarer complété.
- UNKNOWN != SAFE — chemins non classifiés = interdits par défaut.
- Subtask CANNOT be created without parentId + returnTarget (le code lève une exception).
- Ollama décharge le modèle précédent AVANT d'en charger un nouveau.
- Ne jamais déclarer une phase "complète" sans preuve physique sur le disque.

---

## 2. FICHIERS DE CONFIGURATION RACINE

### package.json
- Rôle : Dépendances npm, scripts de build/dev/test.
- Scripts clés : "dev" (Vite dev server), "build" (tsc + vite build), "preview".
- Dépendances notables : react, zustand, vite, tailwindcss, lucide-react, marked.

### vite.config.ts (~53 lignes)
- Rôle : Configuration Vite — plugins, proxy HTTP, paths.
- Plugins : react() + evisBackendPlugin (custom plugin serveur).
- Proxy :
  - /ollama/* → http://127.0.0.1:11434 (Ollama local)
  - /llama-cpp/* → http://127.0.0.1:8080 (LlamaCpp local)
  - Les deux ont des handlers silencieux pour éviter le spam ECONNREFUSED.
- Liens : Importe server/evisBackendPlugin.ts. Consomme toutes les routes /api/*.

### tsconfig.json
- Rôle : Configuration TypeScript — strict mode, JSX react-jsx, paths.
- Liens : Utilisé par tsc --noEmit (validation) et vite build.

### index.html
- Rôle : Point d'entrée HTML unique (SPA). Monte le div #root.
- Liens : Charge src/main.tsx via <script type="module">.

### AGENTS.md
- Rôle : Instructions pour les agents IA travaillant sur le projet.
- Liens : Aucun lien technique — documentation uniquement.

### GEMINI.md (fichier gouvernant — LIRE EN PREMIER)
- Rôle : Règles absolues du projet pour l'agent Gemini. 571 lignes, 23 sections.
- Contenu : Lois architecturales, interdictions, ordre de phases, invariants, règles de vérification physique.
- Liens : Référencé dans starterContent/DECISIONS.md. DOIT être lu avant chaque session.
- ATTENTION : grep "GEMINI.md" dans /home/junior/Desktop/New-Ag/ — le fichier peut se trouver à la racine ou avoir été renommé.

### arborescence.txt
- Rôle : Snapshot de l'arborescence du projet (généré manuellement).

---

## 3. COUCHE SERVEUR (server/)

### server/evisBackendPlugin.ts (~935 lignes)
- Rôle : Plugin Vite custom qui expose un serveur Express/Connect en dev.
  S'exécute côté Node (pas dans le browser).
  C'est le SEUL point d'accès aux ressources système depuis le frontend.
- Routes exposées :
  - GET  /api/provider/status       → statut des providers (Ollama, LlamaCpp)
  - GET/POST /api/fs/*              → opérations filesystem (lecture/écriture sécurisées)
  - GET  /api/skills                → liste des skills découvertes
  - GET  /api/environment/profile   → profil environnement (OS, binaires, zones)
  - GET  /api/models/ollama         → liste des modèles Ollama installés
- BUG CONNU : /api/skills retourne du HTML (fallback SPA) au lieu de JSON.
  La route doit être enregistrée AVANT le middleware SPA fallback de Vite.
- Liens entrants : vite.config.ts (enregistrement du plugin).
- Liens sortants : server/skillDiscovery.ts (pour /api/skills).

### server/skillDiscovery.ts (~119 lignes)
- Rôle : Scanne skills/*/SKILL.md et parse chaque skill.
  Transforme le markdown en objet JSON structuré DiscoveredSkill.
- Exports :
  - interface DiscoveredSkill { id, name, version, tools, permissions, instructions, ... }
  - async function discoverSkills(skillsRoot: string): Promise<DiscoveredSkill[]>
- Fonctions internes : section(), identityValue(), bulletValues(), paragraph(), parseSkill()
- Liens entrants : server/evisBackendPlugin.ts
- Liens sortants : skills/*/SKILL.md (lecture disque)

---

## 4. COUCHE UI

### src/main.tsx (10 lignes)
- Rôle : Point d'entrée React. Monte <App /> dans #root.
- Liens sortants : src/App.tsx

### src/App.tsx (18 lignes)
- Rôle : Racine React. Rend uniquement <AppShell />.
- Liens sortants : src/components/layout/AppShell.tsx

### src/index.css
- Rôle : Styles globaux Tailwind + variables CSS personnalisées.
- Liens : Importé dans main.tsx.

### src/lib/utils.ts (24 lignes)
- Rôle : Utilitaire cn() — concatène des classes Tailwind (clsx + tailwind-merge).
- Exports : function cn(...inputs)
- Liens entrants : Tous les composants UI avec classes conditionnelles.

### src/components/layout/AppShell.tsx
- Rôle : Shell principal. Compose : Header + Sidebar + zone centrale + StatusBar + ContextDrawer + CommandPalette.
- Liens entrants : App.tsx
- Liens sortants : AppHeader, Sidebar, StatusBar, ContextDrawer, CommandPalette, toutes les views, ConversationWorkspace.

### src/components/layout/AppHeader.tsx
- Rôle : Barre de navigation supérieure. Titre, bouton hamburger, commandes rapides.
- Liens sortants : useAppStore (lit session active, status système)

### src/components/layout/Sidebar.tsx
- Rôle : Navigation latérale. Vues disponibles + liste des sessions.
- Liens sortants : useAppStore (sélection de vue, sessions)

### src/components/layout/StatusBar.tsx
- Rôle : Barre de statut inférieure. Provider actif, modèle, statut Ollama/LlamaCpp.
- Liens sortants : useAppStore (systemStatus, activeSession)

### src/components/workspace/ConversationWorkspace.tsx
- Rôle : Zone centrale de conversation. Affiche messages, scroll auto, monte Composer.
- Liens sortants : MessageCard, ToolExecutionCard, Composer, useAppStore

### src/components/workspace/MessageCard.tsx
- Rôle : Carte d'affichage d'un message (user ou assistant). Rendu markdown, copy, attachments.
- Liens sortants : MarkdownRenderer, CodeBlock, useAppStore

### src/components/workspace/MarkdownRenderer.tsx
- Rôle : Rendu markdown avec "marked". Gère blocs de code, liens, tableaux.
- Liens sortants : CodeBlock

### src/components/workspace/CodeBlock.tsx
- Rôle : Bloc de code avec coloration syntaxique et bouton copier.
- Liens entrants : MessageCard, MarkdownRenderer

### src/components/workspace/ToolExecutionCard.tsx
- Rôle : Affiche l'exécution d'un tool call (nom, arguments, résultat, statut succès/échec).
- Liens entrants : ConversationWorkspace
- Liens sortants : useAppStore

### src/components/composer/Composer.tsx
- Rôle : Zone de saisie. Gère soumission, attachments, micro (speech), sélecteur skills.
- COMPORTEMENT CLÉ : Au submit → appelle useAppStore.executeOrchestratorInSession()
- Liens sortants : useAppStore, speechService

### src/components/drawer/ContextDrawer.tsx
- Rôle : Panneau latéral droit. Contexte de la session : skills actives, modèle, ressources.
- Liens sortants : useAppStore

### src/components/drawer/FilePreviewModal.tsx
- Rôle : Modal de prévisualisation d'un fichier sélectionné.
- Liens sortants : useAppStore, fileData

### src/components/common/CommandPalette.tsx
- Rôle : Palette de commandes (Ctrl+K). Recherche et exécute des actions globales.
- Liens sortants : useAppStore

### src/components/views/ProjectsView.tsx
- Rôle : Vue liste des projets. Affiche, crée, sélectionne des projets.
- Liens sortants : useAppStore

### src/components/views/SkillsHubView.tsx
- Rôle : Vue de gestion des skills. Affiche les skills, permet activer/désactiver.
- Liens sortants : useAppStore

### src/components/views/ProvidersModelsView.tsx
- Rôle : Configuration des providers (Ollama, LlamaCpp) et sélection du modèle actif.
- Liens sortants : useAppStore, providerService, ollamaService

### src/components/views/SettingsView.tsx
- Rôle : Paramètres généraux de l'application.
- Liens sortants : useAppStore

### src/components/views/KnowledgeVaultView.tsx
- Rôle : Base de connaissances (Knowledge Vault). Affiche, ajoute, cherche des items.
- Liens sortants : useAppStore

### src/components/views/FileExplorerView.tsx
- Rôle : Explorateur de fichiers du projet. Navigue dans l'arborescence.
- Liens sortants : useAppStore, FilePreviewModal

### src/components/views/ExercisesView.tsx
- Rôle : Liste des exercices (mode apprentissage).
- Liens sortants : useAppStore, ExerciseRunnerModal

### src/components/views/ExerciseRunnerModal.tsx
- Rôle : Modal d'exécution d'un exercice. Lance, évalue, affiche le résultat.
- Liens sortants : useAppStore

---

## 5. STORE GLOBAL

### src/store/useAppStore.ts (~990 lignes)
- Rôle : Cerveau de l'application. Zustand store avec persist middleware (localStorage).
  Gère tout l'état global et toutes les actions.
- État géré :
  - sessions[]          — toutes les sessions (avec workingMemoryState par session)
  - activeSessionId     — session courante
  - projects[]          — projets
  - knowledgeItems[]    — knowledge vault
  - systemStatus        — statut Ollama/LlamaCpp/providers
  - currentView         — vue UI active
- Actions clés :
  - executeOrchestratorInSession(sessionId, prompt, attachments)   [lignes ~343–500]
    CHEMIN PRINCIPAL. Cycle complet : WM init → Orchestrator → WM persist.
  - setActiveProvider(provider)     [~252]  change provider, appelle unloadAllModels()
  - setModelInSession(sid, model)   [~279]  change modèle, appelle unloadAllModels()
  - toggleSkillInSession(sid, id)   [~221]  active/désactive skill, normalise IDs
  - refreshRuntimeSkills(sid)       [~794]  resynchronise skills, mappe alias legacy
  - mapUiSkillIdsToRuntime(ids)             convertit legacy IDs → runtime IDs
- Imports clés : Orchestrator, SkillRegistry, WorkingMemory + IWorkingMemoryState, OllamaService, mockData

### CYCLE DE VIE WorkingMemory dans executeOrchestratorInSession :
  1. new WorkingMemory(projectId)
  2. wm.importState(session.workingMemoryState)   si état existant
  3. wm.createRootTask(sessionTitle)              ou réutilise root existant
  4. wm.createSubTask({ parentId, objective: prompt, returnTarget: parentId })
     --> THROWS si parentId vide, inexistant, ou returnTarget vide/inexistant
  5. wm.reconstructContext(subtask.id)            → workingContext
  6. Orchestrator.orchestrate({ ..., workingContext })
  7. wm.completeTask(subtask.id, ...) + wm.createCheckpoint(...)
  8. wm.saveToFile('.evis/memory/${sessionId}.json')   (Node uniquement)
  9. wm.exportState() → sessions[].workingMemoryState (Zustand persist → localStorage)

### MAPPING IDs (mapUiSkillIdsToRuntime) :
  Legacy UI ID      →  Runtime ID
  file-system       →  filesystem
  desktop-notes     →  filesystem
  memory-curator    →  memory
  knowledge-vault   →  memory

---

## 6. SERVICES

### src/services/mockData.ts (~203 lignes)
- Rôle : Données initiales pour le store (sessions demo, modèles, projets, skills).
- Exports : INITIAL_SESSIONS, INITIAL_MODELS, INITIAL_PROJECTS, INITIAL_KNOWLEDGE
- POINT IMPORTANT : activeSkillIds = ['filesystem', 'memory', 'terminal']
  Ce sont les runtime IDs réels. NE PAS remettre les anciens alias.
- Liens entrants : useAppStore.ts

### src/services/ollamaService.ts (~207 lignes)
- Rôle : Client HTTP pour l'API Ollama locale.
- Exports : interface OllamaModelTag, interface OllamaChatResponse, class OllamaService
- Méthodes clés :
  - listModels()           GET /api/tags
  - chat(model, msgs, tools)  POST /api/chat
  - getLoadedModels()      GET /api/ps  (modèles chargés en RAM)
  - unloadModel(name)      POST /api/generate { keep_alive: 0 }
  - unloadAllModels()      getLoadedModels() puis unloadModel() pour chacun
- URL base : Browser → /ollama (proxy Vite) | Node → http://127.0.0.1:11434
- Liens entrants : useAppStore.ts (unload), ProviderRegistry (via OllamaProviderDriver)

### src/services/llamaCppService.ts (~247 lignes)
- Rôle : Client HTTP pour l'API LlamaCpp (port 8080).
- Exports : interface LlamaCppModelResponse, class LlamaCppService
- Comportement : Vérifie /api/provider/status avant chaque probe TCP.
  Évite les ECONNREFUSED si le serveur n'est pas lancé.
- Liens entrants : useAppStore.ts, ProviderRegistry (via LlamaCppProviderDriver)

### src/services/providerService.ts (~146 lignes)
- Rôle : Service haut niveau pour la gestion des providers.
  Détermine quel provider est disponible, expose les infos à l'UI.
- Exports : interface IProviderInfo, class ProviderService
- Liens entrants : useAppStore.ts, ProvidersModelsView.tsx

### src/services/filesystemService.ts (~85 lignes)
- Rôle : Service UI pour les opérations filesystem.
  En browser, appelle /api/fs/* sur le serveur. Jamais d'accès direct au disque depuis le browser.
- Exports : interface IFSItem, class FilesystemService
- Méthodes : listDirectory(path), readFile(path), writeFile(path, content), deleteFile(path)
- Liens entrants : useAppStore.ts, FileExplorerView.tsx
- Liens sortants : server/evisBackendPlugin.ts route /api/fs/*

### src/services/intentRouter.ts (~315 lignes)
- Rôle : Analyse l'intention de l'utilisateur. Classifie le prompt :
  filesystem | memory | web | terminal | conversation générale.
- Exports : interface IIntentAnalysis, class IntentRouter
- Liens entrants : useAppStore.ts (potentiellement), Orchestrator (optionnel)

### src/services/speechService.ts (~180 lignes)
- Rôle : Reconnaissance vocale (Web Speech API). Audio micro → texte.
- Exports : class SpeechService
- Liens entrants : Composer.tsx

### src/services/toolRegistry.ts (~321 lignes)  *** ATTENTION DOUBLON ***
- Rôle : Version LEGACY du ToolRegistry (dans services/).
  Ne pas confondre avec src/runtime/registries/toolRegistry.ts (runtime).
  Ce fichier peut être obsolète → vérifier si encore importé.
- Liens entrants : À vérifier. À consolider avec la version runtime.

### src/services/fileData.ts (~117 lignes)
- Rôle : Données statiques de prévisualisation de fichiers projet (contenu factice démo).
- Exports : PROJECT_FILES, ProjectFilePreview
- Liens entrants : useAppStore.ts, FilePreviewModal.tsx

---

## 7. TYPES GLOBAUX

### src/types/index.ts (~169 lignes)
- Rôle : Types TypeScript partagés entre UI et store.
- Exports principaux :
  - RiskLevel             'safe' | 'prompt' | 'dangerous'
  - ISkillPermission, ISkill    structure d'une skill UI
  - IModel                      modèle LLM
  - ITool, IToolCall            définition et appel d'un outil
  - IAttachment                 pièce jointe dans un message
  - IMessage                    message conversation (role, content, toolCalls, attachments)
  - ISession                    session complète (messages, skills, modèle, workingMemoryState)
  - IFileNode, IProject, IKnowledgeItem
  - ISystemStatus               statut Ollama/LlamaCpp
  - IExercise, IExerciseEvaluation
- Liens entrants : useAppStore.ts, tous les composants UI, mockData.ts

---

## 8. RUNTIME — ORCHESTRATEUR

### src/runtime/orchestrator/orchestrator.ts (~283 lignes)
- Rôle : Chef d'orchestre. Reçoit IOrchestratorRequest, construit l'environnement, lance AgentLoop.
- Exports : IOrchestratorRequest, IOrchestratorResult, class Orchestrator
- Méthode principale : orchestrate(request): Promise<IOrchestratorResult>
- Ce qu'il fait :
  1. Initialise tous les registries (Capability, Tool, Provider, Skill, Resource)
  2. Résout les skills actives via SkillRegistry.activate(skillIds)
  3. Assemble le contexte via ContextManager.assembleContext() (avec workingContext si fourni)
  4. Sélectionne le provider/driver via ProviderRegistry
  5. Lance AgentLoop.run()
  6. Retourne le résultat avec messages et tool results
- Imports : Tous les registries, ContextManager, AgentLoop, CapabilityResolver, PermissionManager, IWorkingContext
- Liens entrants : useAppStore.ts

### src/runtime/orchestrator/agentLoop.ts (~244 lignes)
- Rôle : Boucle agentique principale.
  Envoie le prompt au modèle → reçoit tool calls → exécute → renvoie résultats → jusqu'à réponse finale.
- Exports : IAgentLoopOptions, IAgentLoopResult, class AgentLoop
- Méthode principale : run(options): Promise<IAgentLoopResult>
- Imports : IToolCall, IToolResult (domain), IProviderDriver (providerRegistry),
           ToolRegistry, PermissionManager, IAssembledContext
- Liens entrants : Orchestrator

### src/runtime/orchestrator/capabilityResolver.ts (~81 lignes)
- Rôle : Résout les capacités disponibles en fonction des skills actives et des permissions.
  Filtre les tools accessibles selon les droits de la session.
- Exports : class CapabilityResolver
- Liens entrants : Orchestrator

---

## 9. RUNTIME — MÉMOIRE

### src/runtime/memory/workingMemory.ts (~389 lignes)  [NIVEAU 1 — COMPLET]
- Rôle : Working Memory — navigation stack pour les tâches agentiques.
  Chaque prompt crée un subtask avec parentId + returnTarget (obligatoires).
- Exports : class WorkingMemory
- Méthodes principales :
  - createRootTask(objective)          [ligne ~35]  tâche racine (parentId=null)
  - createSubTask(params)             [ligne ~68]  THROWS si parentId vide/inexistant ou returnTarget vide/inexistant
  - completeTask(taskId, result)      [ligne ~142] pop de la nav stack
  - createCheckpoint(taskId, rt)      [ligne ~183] checkpoint de navigation
  - reconstructContext(taskId)        [ligne ~292] construit IWorkingContext (breadcrumbs, parentTask, originTask)
  - exportState() / importState(s)    [ligne ~323] sérialisation/désérialisation état complet
  - serialize() / static deserialize  [ligne ~340] JSON string
  - saveToFile(path)                  [ligne ~360] écriture disque (Node uniquement)
  - static loadFromFile(path)         [ligne ~380] lecture disque (Node uniquement)
- Imports : ITaskNode, ICheckpoint, IWorkingContext, IWorkingMemoryState (types/memory),
           node:fs + node:path (Node only, gardé par typeof window === 'undefined')
- Liens entrants : useAppStore.ts

---

## 10. RUNTIME — CONTEXTE

### src/runtime/context/contextManager.ts (~184 lignes)
- Rôle : Assemble le prompt système complet envoyé au modèle.
  Injecte : instructions des skills actives + profil environnement + contexte Working Memory.
- Exports : IAssembledContext, IContextAssemblyOptions, class ContextManager
- Méthode principale : assembleContext(options): IAssembledContext
- Injection WM [lignes ~137–155] : Si workingContext présent, ajoute section
  "## NAVIGATION & MÉMOIRE DE TRAVAIL" avec : currentTask.id, objective, parentTask, originTask, breadcrumbs.
- Liens entrants : Orchestrator

---

## 11. RUNTIME — ENVIRONNEMENT

### src/runtime/environment/environmentDetector.ts (~292 lignes)  [NIVEAU 2 — COMPLET]
- Rôle : Détecte et expose le profil environnement de la machine hôte.
  OS, user, desktop path, binaires installés, zones filesystem.
- Exports : class EnvironmentDetector
- Méthodes clés :
  - getHostOS()               [ligne ~24]  détecte OS réel (Node: os.platform(), Browser: /api/environment/profile)
  - classifyPath(path)        [ligne ~100] classifie chemin → zone (system/user/project/protected/UNKNOWN)
                                           UNKNOWN != SAFE
  - scanBinaries(names[])     [ligne ~150] vérifie présence : node, npm, git, python3, ollama, bash, curl
  - refreshProfileFromBridge()[ligne ~81]  browser : fetch /api/environment/profile
  - getEnvironmentProfile()              retourne IEnvironmentProfile complet
- Détection physique prouvée : OS=linux, distrib=Parrot Security 7.3, user=junior, desktop=/home/junior/Desktop
- Liens entrants : PermissionManager, Orchestrator

---

## 12. RUNTIME — SÉCURITÉ

### src/runtime/security/permissionManager.ts (~253 lignes)
- Rôle : Gardien des accès. Vérifie si une opération est autorisée avant exécution.
  S'appuie sur EnvironmentDetector.classifyPath().
- Exports : IPermissionCheckResult, class PermissionManager
- Méthodes clés :
  - checkPermission(operation, path, skill) → { allowed: boolean, reason: string }
  - Bloque mécaniquement les écritures vers zones "system" et "protected".
  - Log les tentatives bloquées.
- Prouvé physiquement : Bloque /etc/evil.conf et ~/.ssh/authorized_keys
- Liens entrants : AgentLoop, CapabilityResolver
- Liens sortants : EnvironmentDetector

---

## 13. RUNTIME — REGISTRIES

### src/runtime/registries/skillRegistry.ts (~344 lignes)
- Rôle : Registre central des skills. Découvre, charge, active les skills.
- Exports : class SkillRegistry
- Méthodes clés :
  - discover()             Browser: fetch('/api/skills') | Node: lit skills/*/SKILL.md directement
  - activate(skillIds[])   active les skills par ID runtime
  - getActiveSkills()      liste des skills couramment actives
- IDs runtime réels : filesystem, terminal, memory, web-research
- IDs legacy UI (ne plus utiliser) : file-system, desktop-notes, memory-curator, knowledge-vault
- BUG CONNU : /api/skills retourne HTML au lieu de JSON → fix requis dans evisBackendPlugin.ts
- Liens entrants : Orchestrator, useAppStore.ts

### src/runtime/registries/toolRegistry.ts (~550 lignes)
- Rôle : Registre de tous les tools disponibles.
  Maintient la liste, valide les appels, exécute avec vérification de permission.
- Exports : class ToolRegistry
- Méthodes clés :
  - register(toolDef)                    enregistre un outil
  - execute(toolCall, permissionManager) exécute avec check permission
  - getDefinitions()                     retourne schémas JSON pour le modèle
- Liens entrants : Orchestrator, AgentLoop

### src/runtime/registries/providerRegistry.ts (~646 lignes)
- Rôle : Registre des providers LLM. Contient les drivers Ollama et LlamaCpp.
- Exports :
  - IProviderGenerateOptions, IProviderGenerateResult, IProviderDriver
  - function parseToolCallsFromContent(content)   parse tool calls du texte du modèle
  - class OllamaProviderDriver implements IProviderDriver  [ligne ~145]
  - class LlamaCppProviderDriver implements IProviderDriver [ligne ~353]
  - class ProviderRegistry  [ligne ~565]  sélectionne le driver actif
- Liens entrants : Orchestrator, AgentLoop
- Liens sortants : OllamaService, LlamaCppService

### src/runtime/registries/capabilityRegistry.ts (~275 lignes)
- Rôle : Registre des capacités déclarées par les skills. Lie skills ↔ tools ↔ permissions.
- Exports : class CapabilityRegistry
- Liens entrants : Orchestrator

### src/runtime/registries/resourceRegistry.ts (~159 lignes)
- Rôle : Registre des ressources connues (fichiers, URLs, dossiers) exposées aux skills.
- Exports : class ResourceRegistry
- Liens entrants : Orchestrator

---

## 14. RUNTIME — TYPES INTERNES

### src/runtime/types/memory.ts (~124 lignes)
- Rôle : Types TypeScript pour le Working Memory (Niveau 1).
- Exports :
  - ReferencePrefix / ReferenceId / ReferenceRelation   système de référence par préfixe (task:, file:, dir:, ...)
  - IReferenceEdge            lien entre deux références
  - TaskStatus                'pending' | 'active' | 'completed' | 'failed' | 'suspended'
  - ITaskNode                 nœud de tâche (id, parentId, returnTarget, status, breadcrumbs, ...)
  - ICheckpoint               point de sauvegarde de navigation
  - IWorkingContext            contexte assemblé pour le modèle (currentTask, parentTask, originTask, breadcrumbs)
  - IWorkingMemoryState        état complet sérialisable (tasks Map, checkpoints, navStack, rootTaskId)
- Liens entrants : workingMemory.ts, contextManager.ts, orchestrator.ts, useAppStore.ts

### src/runtime/types/domain.ts (~264 lignes)
- Rôle : Types TypeScript du domaine runtime (capabilities, providers, tools, skills, plans).
- Exports :
  - CapabilityCategory, ICapability, IPermission, IDependency, IResource
  - IToolParameterSchema, IToolDefinition, IToolCall, IToolResult
  - SkillLifecycleState, ISkillManifest
  - ProviderState, IProviderCapabilities, IProvider, IModelInfo
  - IExecutionStep, IExecutionPlan, IExecutionContext
- Liens entrants : Tous les registries runtime, AgentLoop, Orchestrator

### src/runtime/types/environment.ts (~55 lignes)
- Rôle : Types TypeScript pour l'environnement (Niveau 2).
- Exports :
  - IHostOS                    OS, version, user, paths
  - FilesystemZoneType         'system' | 'user' | 'project' | 'protected' | 'unknown'
  - IPathClassification        zone + canRead + canWrite
  - IInstalledBinary           nom + path + version
  - IEnvironmentProfile        profil complet (OS, binaries, zones connues)
- Liens entrants : EnvironmentDetector, PermissionManager

---

## 15. SKILLS

Les skills sont des fichiers skills/<id>/SKILL.md.
Chaque SKILL.md déclare : id, name, version, tools, permissions, instructions.

### skills/filesystem/SKILL.md
- ID runtime : filesystem
- Rôle : Permet au modèle de lire/écrire/lister des fichiers sur le disque.
- Tools déclarés : filesystem (action: read/write/list/delete, path: alias ou chemin absolu)
- Alias de chemin : desktop: → /home/junior/Desktop/,  project: → /home/junior/Desktop/New-Ag/

### skills/memory/SKILL.md
- ID runtime : memory
- Rôle : Permet au modèle de créer/lire des notes en mémoire persistante.
- Tools déclarés : memory (action: save/load/list)

### skills/terminal/SKILL.md
- ID runtime : terminal
- Rôle : Permet au modèle d'exécuter des commandes shell (avec restrictions PermissionManager).
- Tools déclarés : terminal (command: string)

### skills/web-research/SKILL.md
- ID runtime : web-research
- Rôle : Recherche web.
- STATUT : GELÉ — ne pas activer avant Phase 14 validée.

---

## 16. DOCUMENTATION (starterContent/)

### starterContent/DECISIONS.md (~148 lignes)  *** CRITIQUE ***
- Rôle : Journal de décisions architecturales.
  Capture : lois mécaniques, 4 fautes majeures de sessions précédentes,
  statut de chaque phase/niveau, bugs connus.
- À lire APRÈS GEMINI.md à chaque nouvelle session.

### starterContent/directive_1.md (~1323 lignes)
- Rôle : Directive d'implémentation complète.
  Décrit l'ordre exact d'implémentation de toutes les phases (0–16+).
  Référence primaire pour "que faire ensuite".

### starterContent/Foundation.md
- Rôle : Document fondation. Vision, principes, pourquoi du projet.

### starterContent/Working_Memory.md
- Rôle : Spécification détaillée du Working Memory (Niveau 1).
  Algorithme de navigation, invariants, structures de données.

### starterContent/Obligatory.md
- Rôle : Règles obligatoires (complément de GEMINI.md).

### starterContent/Evis_Web_Research.md
- Rôle : Spécification du skill web-research (GELÉ).

### starterContent/skill.md, skill_1.md, skill_2.md
- Rôle : Exemples / templates de skills.

---

## 17. ARTEFACTS PHYSIQUES SUR DISQUE

Chemin                                                        | Taille  | Contenu
--------------------------------------------------------------|---------|--------------------------------------------------
/home/junior/Desktop/note.txt                                 | 22 oct  | "This is a sample note."
/home/junior/Desktop/note_session_wm.txt                      | 52 oct  | "Niveau 1 Working Memory opérationnel et persistant."
/home/junior/Desktop/New-Ag/.evis/memory/test_session_memory.json | ~2027 oct | WM state sérialisé (test)
/home/junior/Desktop/New-Ag/.evis/memory/sess-main-test.json  | ~2294 oct | WM state après E2E complet
/home/junior/Desktop/New-Ag/starterContent/DECISIONS.md       | 148 lg  | Décisions architecturales
/home/junior/Desktop/New-Ag/AUDIT.md                          | CE FICHIER | Audit complet du projet

---

## 18. GRAPHE DE DÉPENDANCES GLOBAL

src/main.tsx
  └── src/App.tsx
        └── src/components/layout/AppShell.tsx
              ├── AppHeader.tsx, Sidebar.tsx, StatusBar.tsx
              ├── CommandPalette.tsx, ContextDrawer.tsx
              ├── views/*.tsx (6 views)
              └── workspace/ConversationWorkspace.tsx
                    ├── workspace/MessageCard.tsx
                    │     └── MarkdownRenderer.tsx → CodeBlock.tsx
                    ├── workspace/ToolExecutionCard.tsx
                    └── composer/Composer.tsx
                          └── useAppStore.executeOrchestratorInSession()

src/store/useAppStore.ts
  ├── src/types/index.ts
  ├── src/services/mockData.ts
  ├── src/services/providerService.ts
  ├── src/services/fileData.ts
  ├── src/services/filesystemService.ts → server/evisBackendPlugin.ts (/api/fs/*)
  ├── src/services/ollamaService.ts → Ollama HTTP (via proxy /ollama → :11434)
  ├── src/runtime/memory/workingMemory.ts
  │     └── src/runtime/types/memory.ts
  └── src/runtime/orchestrator/orchestrator.ts
        ├── runtime/registries/capabilityRegistry.ts
        ├── runtime/registries/toolRegistry.ts
        ├── runtime/registries/providerRegistry.ts
        │     ├── services/ollamaService.ts
        │     └── services/llamaCppService.ts
        ├── runtime/registries/skillRegistry.ts
        │     └── /api/skills (browser) | skills/*/SKILL.md (Node)
        ├── runtime/registries/resourceRegistry.ts
        ├── runtime/security/permissionManager.ts
        │     └── runtime/environment/environmentDetector.ts
        ├── runtime/context/contextManager.ts
        ├── runtime/orchestrator/agentLoop.ts
        └── runtime/orchestrator/capabilityResolver.ts

server/ (Node — Vite plugin):
  evisBackendPlugin.ts
    └── server/skillDiscovery.ts → skills/*/SKILL.md

---

## 19. ÉTAT DES PHASES / NIVEAU

Phase / Niveau                          | Statut          | Preuve physique
----------------------------------------|-----------------|------------------------------------------
Phases 0–13                             | COMPLET         | Build passe, tsc 0 erreurs
Niveau 1 — Working Memory Nav Stack     | COMPLET         | .evis/memory/sess-main-test.json (2294 oct)
                                        |                 | note_session_wm.txt (52 oct)
Niveau 2 — Environment Awareness        | COMPLET         | environmentDetector détecte linux/junior/Desktop
                                        |                 | Bloque /etc/ et ~/.ssh/ mécaniquement
Phase 14 — UI End-to-End               | NON DÉMARRÉ     | Test navigateur requis
Phase 15 — Web Skill                    | GELÉ            | Après Phase 14
Phase 16 — Terminal Skill (test réel)   | APRÈS Phase 14  | —

---

## PROCHAINE ÉTAPE : PHASE 14

1. Lancer : cd /home/junior/Desktop/New-Ag && npm run dev
2. Ouvrir http://localhost:5173 dans le navigateur
3. Activer skills : filesystem + memory + terminal
4. Taper : "Écris-moi une note sur mon bureau nommée test_ui_e2e.txt"
5. Vérifier physiquement : ls /home/junior/Desktop/test_ui_e2e.txt
6. Vérifier : cat /home/junior/Desktop/New-Ag/.evis/memory/sess-main.json
7. Si OK → Phase 14 COMPLÈTE → Phase 16

## BUG CONNU À CORRIGER AVANT PHASE 14

GET /api/skills retourne du HTML (fallback SPA Vite) au lieu de JSON.
Fix : Dans server/evisBackendPlugin.ts, la route /api/skills doit être enregistrée
AVANT le middleware SPA fallback de Vite.
Ou vérifier que le handler de la route termine avec res.json() et non next().

---
Fin de l'audit — /home/junior/Desktop/New-Ag/AUDIT.md
