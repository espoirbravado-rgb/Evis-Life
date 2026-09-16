
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ISession,
  ISkill,
  IModel,
  IProject,
  IKnowledgeItem,
  ISystemStatus,
  IMessage,
  IAttachment,
  IToolCall,
} from '../types';
import {
  INITIAL_MODELS,
  INITIAL_PROJECTS,
  INITIAL_SESSIONS,
  INITIAL_KNOWLEDGE,
} from '../services/mockData';

import { ProviderService, IProviderInfo } from '../services/providerService';
import { PROJECT_FILES, ProjectFilePreview } from '../services/fileData';
import { FilesystemService } from '../services/filesystemService';
import { OllamaService } from '../services/ollamaService';
import { Orchestrator } from '../runtime/orchestrator/orchestrator';
import { SkillRegistry } from '../runtime/registries/skillRegistry';
import { WorkingMemory } from '../runtime/memory/workingMemory';
import { IWorkingMemoryState } from '../runtime/types/memory';
import { IMessage as RuntimeMessage } from '../runtime/types/domain';

function mapUiSkillIdsToRuntime(uiSkillIds: string[]): string[] {
  const runtimeIds = new Set<string>();

  for (const id of uiSkillIds) {
    if (
      id === 'desktop-notes' ||
      id === 'file-system' ||
      id === 'filesystem'
    ) {
      runtimeIds.add('filesystem');
    } else if (id === 'terminal') {
      runtimeIds.add('terminal');
    } else if (
      id === 'knowledge-vault' ||
      id === 'memory' ||
      id === 'memory-curator'
    ) {
      runtimeIds.add('memory');
    } else if (
      id === 'web-search' ||
      id === 'web-research'
    ) {
      runtimeIds.add('web-research');
    } else {
      runtimeIds.add(id);
    }
  }

  return Array.from(runtimeIds);
}

export type ActiveView =
  | 'chat'
  | 'projects'
  | 'skills'
  | 'knowledge'
  | 'files'
  | 'exercises'
  | 'models'
  | 'settings';

export type DrawerTab =
  | 'skills'
  | 'knowledge'
  | 'files'
  | 'terminal';

export interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  stderr?: string;
  exitCode: number;
  timestamp: string;
  cwd?: string;
}

export interface IProcessTelemetry {
  llamaCpp: {
    running: boolean;
    status: string;
    pid?: number;
    logs: string[];
  };
  ollama: {
    running: boolean;
    status: string;
  };
}

interface AppState {
  activeView: ActiveView;
  activeSessionId: string;
  activeProjectId: string;
  activeProviderId: 'ollama' | 'llama.cpp';
  sessions: ISession[];
  skills: ISkill[];
  models: IModel[];
  providers: IProviderInfo[];
  isDiscovering: boolean;
  projects: IProject[];
  knowledge: IKnowledgeItem[];
  systemStatus: ISystemStatus;
  sidebarCollapsed: boolean;
  contextDrawerOpen: boolean;
  contextDrawerTab: DrawerTab;
  isGenerating: boolean;
  activeAbortController: AbortController | null;

  terminalHistory: TerminalEntry[];

  selectedFile: ProjectFilePreview | null;

  isStartingProvider: boolean;
  providerProcessTelemetry: IProcessTelemetry | null;
  autoLaunchProviders: boolean;

  setActiveView: (view: ActiveView) => void;
  setActiveSession: (sessionId: string) => void;
  createNewSession: () => void;
  updateSessionTitle: (sessionId: string, newTitle: string) => void;
  clearSessionMessages: (sessionId: string) => void;
  setActiveProject: (projectId: string) => void;
  setActiveProvider: (
    providerId: 'ollama' | 'llama.cpp'
  ) => Promise<void>;
  toggleSkillInSession: (skillId: string) => void;
  setModelInSession: (modelId: string) => void;
  setDefaultModel: (modelId: string) => void;
  toggleWebSearchInSession: () => void;
  sendMessage: (
    content: string,
    attachments?: IAttachment[]
  ) => Promise<void>;
  editMessageAndRegenerate: (
    sessionId: string,
    messageId: string,
    newContent: string
  ) => Promise<void>;
  stopGeneration: () => void;
  toggleSidebar: () => void;
  toggleContextDrawer: (tab?: DrawerTab) => void;
  archiveSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  runTerminalCommand: (command: string) => Promise<void>;
  openFilePreview: (filename: string) => Promise<void> | void;
  closeFilePreview: () => void;
  checkOllama: () => Promise<void>;
  refreshRuntimeSkills: () => Promise<void>;
  discoverProvidersAndModels: () => Promise<void>;
  startProviderProcess: (
    providerId: 'llama.cpp' | 'ollama',
    modelId?: string,
    modelPath?: string
  ) => Promise<boolean>;
  stopProviderProcess: (
    providerId: 'llama.cpp' | 'ollama'
  ) => Promise<boolean>;
  fetchProcessTelemetry: () => Promise<void>;
  setAutoLaunchProviders: (auto: boolean) => void;
  exportWorkspaceBackup: () => string;
  importWorkspaceBackup: (jsonString: string) => boolean;
  resetWorkspaceData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeView: 'chat',
      activeSessionId:
        INITIAL_SESSIONS[0]?.id || 'sess-main',
      activeProjectId:
        INITIAL_PROJECTS[0]?.id || 'proj-evis',
      activeProviderId: 'ollama',
      sessions: INITIAL_SESSIONS,
      skills: [],
      models: INITIAL_MODELS,
      providers: [],
      isDiscovering: false,
      projects: INITIAL_PROJECTS,
      knowledge: INITIAL_KNOWLEDGE,

      systemStatus: {
        modelStatus: 'ready',
        modelName: 'qwen2.5-coder:1.5b',
        memoryStatus: 'ready',
        activeSkillsCount: 2,
        webSearchEnabled: false,
        terminalAvailable: true,
        contextTokensUsed: 3840,
        contextTokensLimit: 32768,
      },

      sidebarCollapsed: false,
      contextDrawerOpen: true,
      contextDrawerTab: 'skills',
      isGenerating: false,
      activeAbortController: null,
      selectedFile: null,

      isStartingProvider: false,
      providerProcessTelemetry: null,
      autoLaunchProviders: false,

      terminalHistory: [
        {
          id: 'term-init-1',
          command: 'ollama list',
          output:
            'NAME                   ID              SIZE     MODIFIED\nqwen2.5-coder:1.5b     29d8c98fa6b0    986 MB   just now',
          exitCode: 0,
          timestamp: new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }
          ),
        },
      ],

      setActiveView: (view) =>
        set({ activeView: view }),

      setActiveSession: (sessionId) => {
        const session = get().sessions.find(
          (s) => s.id === sessionId
        );

        set({
          activeSessionId: sessionId,
          activeView: 'chat',
          ...(session?.projectId
            ? { activeProjectId: session.projectId }
            : {}),
        });
      },

      createNewSession: () => {
        const activeProject = get().projects.find(
          (p) => p.id === get().activeProjectId
        );

        const newSession: ISession = {
          id: `sess-${Date.now().toString(36)}`,
          title: 'New Conversation',
          projectId: get().activeProjectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeSkillIds: [],
          activeModelId: activeProject
            ? activeProject.defaultModelId
            : 'qwen2.5-coder:1.5b',
          webSearchEnabled: false,
          messages: [],
          isArchived: false,
        };

        set((state) => ({
          sessions: [
            newSession,
            ...state.sessions,
          ],
          activeSessionId: newSession.id,
          activeView: 'chat',
        }));
      },

      updateSessionTitle: (
        sessionId,
        newTitle
      ) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  title:
                    newTitle.trim() ||
                    'Conversation',
                }
              : s
          ),
        }));
      },

      clearSessionMessages: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [],
                }
              : s
          ),
        }));
      },

      setActiveProject: (projectId) => {
        const project = get().projects.find(
          (p) => p.id === projectId
        );

        set({
          activeProjectId: projectId,
        });

        if (project) {
          const projectSession =
            get().sessions.find(
              (s) => s.projectId === projectId
            );

          if (projectSession) {
            set({
              activeSessionId:
                projectSession.id,
            });
          }
        }
      },

      toggleSkillInSession: (skillId) => {
        const {
          activeSessionId,
          sessions,
        } = get();

        const runtimeId =
          mapUiSkillIdsToRuntime([
            skillId,
          ])[0] || skillId;

        const skill =
          SkillRegistry.get(runtimeId);

        const runtimeRecord =
          SkillRegistry.getRuntimeRecord(
            runtimeId
          );

        if (
          !skill ||
          !runtimeRecord ||
          runtimeRecord.state ===
            'unavailable' ||
          runtimeRecord.state ===
            'error' ||
          runtimeRecord.state ===
            'not-configured'
        ) {
          return;
        }

        set({
          sessions: sessions.map((s) => {
            if (
              s.id !== activeSessionId
            ) {
              return s;
            }

            const normalizedList =
              mapUiSkillIdsToRuntime(
                s.activeSkillIds
              );

            const exists =
              normalizedList.includes(
                runtimeId
              );

            const updated = exists
              ? normalizedList.filter(
                  (id) =>
                    id !== runtimeId
                )
              : [
                  ...normalizedList,
                  runtimeId,
                ];

            if (exists) {
              SkillRegistry.deactivate(
                runtimeId
              );
            } else {
              const activation =
                SkillRegistry.activate(
                  runtimeId
                );

              if (!activation.success) {
                return s;
              }
            }

            return {
              ...s,
              activeSkillIds: updated,
            };
          }),
        });
      },

      setActiveProvider: async (
        providerId
      ) => {
        const {
          models,
          activeSessionId,
          sessions,
          systemStatus,
          autoLaunchProviders,
        } = get();

        const providerModels =
          models.filter(
            (m) =>
              m.provider ===
              providerId
          );

        const chosenModel =
          providerModels[0]?.id ||
          (providerId === 'ollama'
            ? 'qwen2.5-coder:14b'
            : 'qwen2.5-coder-14b-instruct');

        const isReady =
          providerModels.some(
            (m) => m.status === 'ready'
          );

        if (
          providerId === 'ollama'
        ) {
          await OllamaService.unloadAllModels();
        }

        set({
          activeProviderId:
            providerId,
          systemStatus: {
            ...systemStatus,
            modelName: chosenModel,
            modelStatus: isReady
              ? 'ready'
              : 'offline',
          },
          sessions: sessions.map(
            (s) =>
              s.id === activeSessionId &&
              chosenModel
                ? {
                    ...s,
                    activeModelId:
                      chosenModel,
                  }
                : s
          ),
        });

        if (
          autoLaunchProviders &&
          providerId ===
            'llama.cpp' &&
          !isReady
        ) {
          await get().startProviderProcess(
            providerId,
            chosenModel
          );
        }
      },

      setModelInSession: async (
        modelId
      ) => {
        const {
          activeSessionId,
          sessions,
          models,
          autoLaunchProviders,
        } = get();

        const modelObj =
          models.find(
            (m) => m.id === modelId
          );

        const provider:
          | 'ollama'
          | 'llama.cpp' =
          modelObj?.provider ===
            'llama.cpp' ||
          modelId
            .toLowerCase()
            .includes('gguf') ||
          modelId
            .toLowerCase()
            .includes(
              'instruct'
            )
            ? 'llama.cpp'
            : 'ollama';

        if (
          provider === 'ollama'
        ) {
          await OllamaService.unloadAllModels();
        }

        set({
          activeProviderId:
            provider,
          sessions: sessions.map(
            (s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    activeModelId:
                      modelId,
                  }
                : s
          ),
          systemStatus: {
            ...get().systemStatus,
            modelName: modelId,
            modelStatus:
              modelObj?.status ===
              'ready'
                ? 'ready'
                : 'offline',
          },
        });

        if (
          provider ===
            'llama.cpp' &&
          modelObj?.status !==
            'ready' &&
          autoLaunchProviders
        ) {
          await get().startProviderProcess(
            'llama.cpp',
            modelId
          );
        }
      },

      setDefaultModel: (
        modelId: string
      ) => {
        try {
          localStorage.setItem(
            'evis_default_model',
            modelId
          );
        } catch {
          // ignore
        }

        set((state) => ({
          systemStatus: {
            ...state.systemStatus,
            modelName: modelId,
          },
          projects:
            state.projects.map((p) =>
              p.id ===
              state.activeProjectId
                ? {
                    ...p,
                    defaultModelId:
                      modelId,
                  }
                : p
            ),
        }));
      },

      toggleWebSearchInSession: () => {
        const {
          activeSessionId,
          sessions,
        } = get();

        set({
          sessions: sessions.map(
            (s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    webSearchEnabled:
                      !s.webSearchEnabled,
                  }
                : s
          ),
        });
      },

      executeOrchestratorInSession:
        async (
          sessionId: string,
          prompt: string,
          assistantMsgId: string,
          previousMessages: RuntimeMessage[],
          activeSkillIds: string[],
          activeModelId?: string
        ) => {
          const {
            activeProviderId,
          } = get();

          const abortController =
            new AbortController();

          set({
            isGenerating: true,
            activeAbortController:
              abortController,
          });

          const discovery =
            await SkillRegistry.refresh();

          if (!discovery.success) {
            throw new Error(
              discovery.error ||
                'Impossible de découvrir les skills installés.'
            );
          }

          const runtimeSkillIds =
            mapUiSkillIdsToRuntime(
              activeSkillIds
            );

          for (const skill of
            SkillRegistry.getAll()) {
            if (
              runtimeSkillIds.includes(
                skill.id
              )
            ) {
              SkillRegistry.activate(
                skill.id
              );
            } else {
              SkillRegistry.deactivate(
                skill.id
              );
            }
          }

          const currentSession =
            get().sessions.find(
              (s) =>
                s.id === sessionId
            );

          const wm = new WorkingMemory(
            currentSession?.projectId ||
              'project:evis'
          );

          if (
            currentSession?.workingMemoryState
          ) {
            wm.importState(
              currentSession.workingMemoryState as IWorkingMemoryState
            );
          }

          const allTasks =
            wm.getAllTasks();

          const rootTask =
            allTasks.find(
              (t) =>
                t.parentId === null
            ) ||
            wm.createRootTask(
              currentSession?.title ||
                'Session Evis'
            );

          const parentNode =
            wm.getActiveTask() ||
            rootTask;

          const currentSubtask =
            wm.createSubTask({
              parentId:
                parentNode.id,
              objective: prompt,
              returnTarget:
                parentNode.id,
              nextAction:
                'Execute orchestrator pipeline',
            });

          const workingContext =
            wm.reconstructContext(
              currentSubtask.id
            );

          let fullText = '';

          const recordedToolCalls: IToolCall[] =
            [];

          try {
            const orchestrateResult =
              await Orchestrator.orchestrate(
                {
                  prompt,
                  conversationHistory:
                    previousMessages,
                  modelId:
                    activeModelId,
                  providerId:
                    activeProviderId,
                  targetSkillIds:
                    runtimeSkillIds,
                  workingContext,
                  onToken: (token) => {
                    fullText += token;

                    set((state) => ({
                      sessions:
                        state.sessions.map(
                          (s) =>
                            s.id ===
                            sessionId
                              ? {
                                  ...s,
                                  messages:
                                    s.messages.map(
                                      (m) =>
                                        m.id ===
                                        assistantMsgId
                                          ? {
                                              ...m,
                                              content:
                                                fullText,
                                            }
                                          : m
                                    ),
                                }
                              : s
                        ),
                    }));
                  },

                  onToolCall: (call) => {
                    const uiToolCall:
                      IToolCall = {
                        id: call.id,
                        toolName:
                          call.toolId,
                        args:
                          call.arguments,
                        status: 'running',
                      };

                    recordedToolCalls.push(
                      uiToolCall
                    );

                    set((state) => ({
                      sessions:
                        state.sessions.map(
                          (s) =>
                            s.id ===
                            sessionId
                              ? {
                                  ...s,
                                  messages:
                                    s.messages.map(
                                      (m) =>
                                        m.id ===
                                        assistantMsgId
                                          ? {
                                              ...m,
                                              toolCalls:
                                                [
                                                  ...recordedToolCalls,
                                                ],
                                            }
                                          : m
                                    ),
                                }
                              : s
                        ),
                    }));
                  },

                  onToolResult: (res) => {
                    const idx =
                      recordedToolCalls.findIndex(
                        (tc) =>
                          tc.id ===
                          res.callId
                      );

                    if (idx !== -1) {
                      recordedToolCalls[
                        idx
                      ] = {
                        ...recordedToolCalls[
                          idx
                        ],
                        status:
                          res.status ===
                          'success'
                            ? 'success'
                            : 'error',
                        stdout:
                          res.stdout,
                        stderr:
                          res.stderr,
                        durationMs:
                          res.durationMs,
                        result:
                          res.data,
                      };
                    }

                    set((state) => ({
                      sessions:
                        state.sessions.map(
                          (s) =>
                            s.id ===
                            sessionId
                              ? {
                                  ...s,
                                  messages:
                                    s.messages.map(
                                      (m) =>
                                        m.id ===
                                        assistantMsgId
                                          ? {
                                              ...m,
                                              toolCalls:
                                                [
                                                  ...recordedToolCalls,
                                                ],
                                            }
                                          : m
                                    ),
                                }
                              : s
                        ),
                    }));
                  },

                  signal:
                    abortController.signal,
                }
              );

            wm.completeTask(
              currentSubtask.id,
              (
                orchestrateResult.finalResponse ||
                fullText ||
                'Opération complétée'
              ).slice(0, 150)
            );

            wm.createCheckpoint({
              taskId:
                parentNode.id,
              stateSummary:
                `Requête traitée: "${prompt.slice(
                  0,
                  60
                )}"`,
              nextAction:
                'En attente de la prochaine action utilisateur',
            });

            const updatedMemoryState =
              wm.exportState();

            wm.saveToFile(
              `/home/junior/Desktop/New-Ag/.evis/memory/${sessionId}.json`
            ).catch(() => {});

            set((state) => ({
              isGenerating: false,
              activeAbortController:
                null,
              sessions:
                state.sessions.map(
                  (s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          workingMemoryState:
                            updatedMemoryState,
                          messages:
                            s.messages.map(
                              (m) =>
                                m.id ===
                                assistantMsgId
                                  ? {
                                      ...m,
                                      content:
                                        orchestrateResult.finalResponse ||
                                        fullText,
                                      toolCalls:
                                        recordedToolCalls.length >
                                        0
                                          ? [
                                              ...recordedToolCalls,
                                            ]
                                          : m.toolCalls,
                                      isStreaming:
                                        false,
                                    }
                                  : m
                            ),
                        }
                      : s
                ),
            }));
          } catch (err: any) {
            set((state) => ({
              isGenerating: false,
              activeAbortController:
                null,
              sessions:
                state.sessions.map(
                  (s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          messages:
                            s.messages.map(
                              (m) =>
                                m.id ===
                                assistantMsgId
                                  ? {
                                      ...m,
                                      content:
                                        "Erreur d'orchestration: " +
                                        err.message,
                                      isStreaming:
                                        false,
                                    }
                                  : m
                            ),
                        }
                      : s
                ),
            }));
          }
        },

      sendMessage: async (
        content: string,
        attachments?: IAttachment[]
      ) => {
        const {
          activeSessionId,
          sessions,
        } = get();

        const session =
          sessions.find(
            (s) =>
              s.id ===
              activeSessionId
          );

        if (
          !session ||
          (!content.trim() &&
            (!attachments ||
              attachments.length === 0))
        ) {
          return;
        }

        const userMessage: IMessage = {
          id:
            'msg-' +
            Date.now(),
          role: 'user',
          content:
            content.trim(),
          timestamp:
            new Date().toISOString(),
          ...(attachments &&
          attachments.length > 0
            ? { attachments }
            : {}),
        };

        const updatedTitle =
          session.messages.length ===
          0
            ? content.slice(0, 36) +
              (content.length > 36
                ? '...'
                : '')
            : session.title;

        const assistantMsgId =
          'msg-' +
          (Date.now() + 1);

        const assistantMessage:
          IMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp:
              new Date().toISOString(),
            activeSkillsAtGeneration:
              [
                ...session.activeSkillIds,
              ],
            toolCalls: [],
            isStreaming: true,
          };

        const previousMessages: RuntimeMessage[] =
          session.messages.map((message) => ({
            role: message.role as RuntimeMessage['role'],
            content: message.content,
          }));

        set((state) => ({
          sessions:
            state.sessions.map(
              (s) =>
                s.id ===
                activeSessionId
                  ? {
                      ...s,
                      title:
                        updatedTitle,
                      updatedAt:
                        new Date().toISOString(),
                      messages: [
                        ...s.messages,
                        userMessage,
                        assistantMessage,
                      ],
                    }
                  : s
            ),
        }));

        const messagePrompt =
          attachments &&
          attachments.length > 0
            ? content.trim() +
              '\n\n[Referenced Files: ' +
              attachments
                .map(
                  (a) => a.name
                )
                .join(', ') +
              ']'
            : content.trim();

        await (
          get() as any
        ).executeOrchestratorInSession(
          session.id,
          messagePrompt,
          assistantMsgId,
          previousMessages,
          session.activeSkillIds,
          session.activeModelId
        );
      },

      editMessageAndRegenerate:
        async (
          sessionId: string,
          messageId: string,
          newContent: string
        ) => {
          const { sessions } =
            get();

          const session =
            sessions.find(
              (s) =>
                s.id ===
                sessionId
            );

          if (
            !session ||
            !newContent.trim()
          ) {
            return;
          }

          const msgIdx =
            session.messages.findIndex(
              (m) =>
                m.id === messageId
            );

          if (msgIdx === -1) {
            return;
          }

          const userMessage:
            IMessage = {
            ...session.messages[
              msgIdx
            ],
            content:
              newContent.trim(),
            timestamp:
              new Date().toISOString(),
          };

          const trimmedMessages =
            session.messages.slice(
              0,
              msgIdx
            );

          const assistantMsgId =
            'msg-' +
            (Date.now() + 1);

          const assistantMessage:
            IMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp:
              new Date().toISOString(),
            activeSkillsAtGeneration:
              [
                ...session.activeSkillIds,
              ],
            toolCalls: [],
            isStreaming: true,
          };

          const previousMessages: RuntimeMessage[] =
            trimmedMessages.map((message) => ({
              role: message.role as RuntimeMessage['role'],
              content: message.content,
            }));

          set((state) => ({
            sessions:
              state.sessions.map(
                (s) =>
                  s.id === sessionId
                    ? {
                        ...s,
                        updatedAt:
                          new Date().toISOString(),
                        messages: [
                          ...trimmedMessages,
                          userMessage,
                          assistantMessage,
                        ],
                      }
                    : s
              ),
          }));

          await (
            get() as any
          ).executeOrchestratorInSession(
            sessionId,
            newContent.trim(),
            assistantMsgId,
            previousMessages,
            session.activeSkillIds,
            session.activeModelId
          );
        },

      stopGeneration: () => {
        const {
          activeAbortController,
        } = get();

        if (
          activeAbortController
        ) {
          activeAbortController.abort();
        }

        set({
          isGenerating: false,
          activeAbortController:
            null,
        });
      },

      toggleSidebar: () =>
        set((state) => ({
          sidebarCollapsed:
            !state.sidebarCollapsed,
        })),

      toggleContextDrawer: (
        tab
      ) =>
        set((state) => ({
          contextDrawerOpen: tab
            ? true
            : !state.contextDrawerOpen,
          ...(tab
            ? {
                contextDrawerTab:
                  tab,
              }
            : {}),
        })),

      archiveSession: (
        sessionId
      ) => {
        const {
          sessions,
          knowledge,
        } = get();

        const session =
          sessions.find(
            (s) =>
              s.id === sessionId
          );

        if (!session) {
          return;
        }

        const newKnowledgeCard:
          IKnowledgeItem = {
          id: `k-archived-${Date.now().toString(
            36
          )}`,
          title: `Résumé : ${session.title}`,
          category: 'summary',
          summary: `Synthèse archivée de la session "${session.title}" (${session.messages.length} messages).`,
          content:
            session.messages.length >
            0
              ? `Points abordés : ${session.messages
                  .filter(
                    (m) =>
                      m.role ===
                      'user'
                  )
                  .map((m) =>
                    m.content.slice(
                      0,
                      60
                    )
                  )
                  .join(
                    '; '
                  )}.`
              : 'Session archivée sans messages.',
          tags: [
            'archive',
            'distilled',
            session.projectId
              ? 'project'
              : 'general',
          ],
          projectId:
            session.projectId,
          sourceSessionId:
            session.id,
          updatedAt:
            new Date().toISOString(),
        };

        set({
          sessions:
            sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    isArchived:
                      true,
                  }
                : s
            ),
          knowledge: [
            newKnowledgeCard,
            ...knowledge,
          ],
        });
      },

      deleteSession: (
        sessionId
      ) => {
        const {
          sessions,
          activeSessionId,
        } = get();

        const remaining =
          sessions.filter(
            (s) =>
              s.id !== sessionId
          );

        set({
          sessions: remaining,
          activeSessionId:
            activeSessionId ===
            sessionId
              ? remaining[0]?.id ||
                ''
              : activeSessionId,
        });
      },

      runTerminalCommand:
        async (
          command: string
        ) => {
          const trimmed =
            command.trim();

          if (!trimmed) {
            return;
          }

          if (
            trimmed === 'clear'
          ) {
            set({
              terminalHistory: [],
            });
            return;
          }

          try {
            const res =
              await fetch(
                '/api/terminal/exec',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/json',
                  },
                  body: JSON.stringify(
                    {
                      command:
                        trimmed,
                    }
                  ),
                }
              );

            const data =
              await res.json();

            const output =
              data.stdout || '';

            const stderr =
              data.stderr || '';

            const exitCode =
              typeof data.exitCode ===
              'number'
                ? data.exitCode
                : data.error
                  ? 1
                  : 0;

            const entry:
              TerminalEntry = {
              id: `term-${Date.now()}-${Math.random()
                .toString(36)
                .substring(
                  2,
                  6
                )}`,
              command: trimmed,
              output:
                output ||
                (exitCode !==
                  0 &&
                !stderr
                  ? `Process completed with exit code ${exitCode}`
                  : ''),
              stderr,
              exitCode,
              timestamp:
                new Date().toLocaleTimeString(
                  [],
                  {
                    hour: '2-digit',
                    minute:
                      '2-digit',
                    second:
                      '2-digit',
                  }
                ),
              cwd: data.cwd,
            };

            set((state) => ({
              terminalHistory:
                [
                  ...state.terminalHistory.slice(
                    -100
                  ),
                  entry,
                ],
            }));
          } catch (err: any) {
            const entry:
              TerminalEntry = {
              id: `term-${Date.now()}`,
              command: trimmed,
              output: '',
              stderr:
                `Failed to execute: ${err.message}`,
              exitCode: 1,
              timestamp:
                new Date().toLocaleTimeString(
                  [],
                  {
                    hour: '2-digit',
                    minute:
                      '2-digit',
                    second:
                      '2-digit',
                  }
                ),
            };

            set((state) => ({
              terminalHistory:
                [
                  ...state.terminalHistory.slice(
                    -100
                  ),
                  entry,
                ],
            }));
          }
        },

      startProviderProcess:
        async (
          providerId:
            | 'llama.cpp'
            | 'ollama',
          modelId?,
          modelPath?
        ) => {
          set({
            isStartingProvider:
              true,
          });

          try {
            const res =
              await ProviderService.startProvider(
                providerId,
                modelId,
                modelPath
              );

            await get().discoverProvidersAndModels();

            const telemetry =
              await ProviderService.getProcessTelemetry();

            set({
              providerProcessTelemetry:
                telemetry,
              isStartingProvider:
                false,
            });

            return res.success;
          } catch {
            set({
              isStartingProvider:
                false,
            });

            return false;
          }
        },

      stopProviderProcess:
        async (
          providerId:
            | 'llama.cpp'
            | 'ollama'
        ) => {
          try {
            const res =
              await ProviderService.stopProvider(
                providerId
              );

            await get().discoverProvidersAndModels();

            const telemetry =
              await ProviderService.getProcessTelemetry();

            set({
              providerProcessTelemetry:
                telemetry,
            });

            return res.success;
          } catch {
            return false;
          }
        },

      fetchProcessTelemetry:
        async () => {
          const telemetry =
            await ProviderService.getProcessTelemetry();

          set({
            providerProcessTelemetry:
              telemetry,
          });
        },

      setAutoLaunchProviders: (
        auto: boolean
      ) => {
        set({
          autoLaunchProviders:
            auto,
        });
      },

      openFilePreview:
        async (
          filename: string
        ) => {
          try {
            const realFile =
              await FilesystemService.read(
                filename
              );

            if (realFile) {
              const ext =
                filename
                  .split('.')
                  .pop()
                  ?.toLowerCase() ||
                '';

              let lang =
                'plaintext';

              if (
                [
                  'ts',
                  'tsx',
                  'js',
                  'jsx',
                ].includes(ext)
              ) {
                lang =
                  'typescript';
              } else if (
                ext === 'json'
              ) {
                lang = 'json';
              } else if (
                [
                  'md',
                  'markdown',
                ].includes(ext)
              ) {
                lang =
                  'markdown';
              } else if (
                [
                  'css',
                  'html',
                ].includes(ext)
              ) {
                lang = ext;
              }

              const sizeStr =
                realFile.size <
                1024
                  ? `${realFile.size} B`
                  : realFile.size <
                      1024 *
                        1024
                    ? `${(
                        realFile.size /
                        1024
                      ).toFixed(
                        1
                      )} KB`
                    : `${(
                        realFile.size /
                        (1024 *
                          1024)
                      ).toFixed(
                        1
                      )} MB`;

              set({
                selectedFile: {
                  name:
                    filename.split(
                      '/'
                    ).pop() ||
                    filename,
                  path:
                    realFile.path,
                  size: sizeStr,
                  content:
                    realFile.content,
                  language: lang,
                },
              });

              return;
            }
          } catch {
            // ignore and fallback
          }

          const file =
            PROJECT_FILES[
              filename
            ];

          if (file) {
            set({
              selectedFile: file,
            });
          }
        },

      closeFilePreview: () =>
        set({
          selectedFile: null,
        }),

      checkOllama: async () => {
        await get().discoverProvidersAndModels();
      },

      refreshRuntimeSkills:
        async () => {
          const result =
            await SkillRegistry.refresh();

          if (!result.success) {
            console.error(
              'Failed to discover installed skills:',
              result.error
            );
            return;
          }

          const installed =
            SkillRegistry.getAll().map(
              (skill) => {
                const runtimeRecord =
                  SkillRegistry.getRuntimeRecord(
                    skill.id
                  );

                const requiredTools =
                  skill.dependencies
                    .filter(
                      (dependency) =>
                        dependency.type ===
                          'tool' &&
                        !dependency.optional
                    )
                    .map(
                      (dependency) =>
                        dependency.target
                    );

                const optionalTools =
                  skill.dependencies
                    .filter(
                      (dependency) =>
                        dependency.type ===
                          'tool' &&
                        dependency.optional
                    )
                    .map(
                      (dependency) =>
                        dependency.target
                    );

                const declaredTools =
                  skill.tools || [];

                const allRequiredTools =
                  Array.from(
                    new Set([
                      ...requiredTools,
                      ...declaredTools,
                    ])
                  );

                const permissions =
                  (
                    skill as typeof skill & {
                      permissions?: Array<{
                        id: string;
                        description: string;
                        scope?: string;
                      }>;
                    }
                  ).permissions || [];

                return {
                  id: skill.id,
                  name: skill.name,
                  description:
                    skill.purpose,
                  version:
                    skill.version,
                  author:
                    skill.author,
                  capabilities:
                    skill.capabilities,
                  dependencies:
                    skill.dependencies.map(
                      (dependency) =>
                        dependency.name
                    ),
                  requiredTools:
                    allRequiredTools,
                  optionalTools,
                  permissions:
                    permissions.map(
                      (permission) => ({
                        id: permission.id,
                        name:
                          permission.id,
                        description:
                          permission.description,
                        granted: false,
                      })
                    ),
                  systemInstructions:
                    skill.instructions,
                  status:
                    runtimeRecord?.state ===
                    'active'
                      ? 'active'
                      : runtimeRecord?.state ===
                          'unavailable' ||
                        runtimeRecord?.state ===
                          'error' ||
                        runtimeRecord?.state ===
                          'not-configured'
                        ? 'missing-dep'
                        : 'available',
                } satisfies ISkill;
              }
            );

          const installedIds =
            new Set(
              installed.map(
                (skill) =>
                  skill.id
              )
            );

          const sessionSkillIds =
            new Set(
              get()
                .sessions.flatMap(
                  (session) =>
                    mapUiSkillIdsToRuntime(
                      session.activeSkillIds
                    ).filter((id) =>
                      installedIds.has(
                        id
                      )
                    )
                )
            );

          for (const skillId of
            sessionSkillIds) {
            SkillRegistry.activate(
              skillId
            );
          }

          const runtimeStates =
            new Map(
              SkillRegistry.getAll().map(
                (skill) => [
                  skill.id,
                  SkillRegistry.getRuntimeRecord(
                    skill.id
                  )?.state,
                ]
              )
            );

          const runtimeSkills =
            installed.map(
              (skill) => ({
                ...skill,
                status:
                  runtimeStates.get(
                    skill.id
                  ) === 'active'
                    ? 'active'
                    : skill.status,
              })
            );

          set((state) => ({
            skills:
              runtimeSkills,
            sessions:
              state.sessions.map(
                (session) => ({
                  ...session,
                  activeSkillIds:
                    mapUiSkillIdsToRuntime(
                      session.activeSkillIds
                    ).filter(
                      (id) =>
                        installedIds.has(
                          id
                        )
                    ),
                })
              ),
          }));
        },

      discoverProvidersAndModels:
        async () => {
          set({
            isDiscovering: true,
          });

          try {
            const {
              models,
              providers,
            } =
              await ProviderService.discoverAllModels();

            const currentProviderId =
              get().activeProviderId ||
              'ollama';

            const providerModels =
              models.filter(
                (m) =>
                  m.provider ===
                  currentProviderId
              );

            const currentActiveModel =
              get().systemStatus
                .modelName;

            const existsInProvider =
              providerModels.some(
                (m) =>
                  m.id ===
                  currentActiveModel
              );

            const chosenModel =
              existsInProvider
                ? currentActiveModel
                : providerModels[0]
                    ?.id ||
                  models[0]?.id ||
                  currentActiveModel ||
                  '';

            const activeProviderOnline =
              providers.find(
                (p) =>
                  p.id ===
                  currentProviderId
              )?.status ===
              'active';

            set((state) => ({
              models,
              providers,
              isDiscovering:
                false,
              systemStatus: {
                ...state.systemStatus,
                modelName:
                  chosenModel,
                modelStatus:
                  activeProviderOnline
                    ? 'ready'
                    : 'offline',
              },
              sessions:
                state.sessions.map(
                  (s) => {
                    if (
                      !s.activeModelId ||
                      (providerModels.length >
                        0 &&
                        !providerModels.some(
                          (m) =>
                            m.id ===
                            s.activeModelId
                        ))
                    ) {
                      return {
                        ...s,
                        activeModelId:
                          chosenModel,
                      };
                    }

                    return s;
                  }
                ),
            }));
          } catch (err) {
            console.error(
              'Failed to discover providers and models:',
              err
            );

            set({
              isDiscovering:
                false,
            });
          }
        },

      exportWorkspaceBackup:
        () => {
          const state = get();

          const data = {
            version: 1,
            exportedAt:
              new Date().toISOString(),
            sessions:
              state.sessions,
            projects:
              state.projects,
            skills: state.skills,
            knowledge:
              state.knowledge,
            systemStatus:
              state.systemStatus,
            terminalHistory:
              state.terminalHistory,
            activeProviderId:
              state.activeProviderId,
          };

          return JSON.stringify(
            data,
            null,
            2
          );
        },

      importWorkspaceBackup:
        (
          jsonString: string
        ) => {
          try {
            const data =
              JSON.parse(
                jsonString
              );

            if (
              !data ||
              typeof data !==
                'object'
            ) {
              return false;
            }

            set((state) => ({
              sessions:
                Array.isArray(
                  data.sessions
                )
                  ? data.sessions
                  : state.sessions,

              projects:
                Array.isArray(
                  data.projects
                )
                  ? data.projects
                  : state.projects,

              skills:
                state.skills,

              knowledge:
                Array.isArray(
                  data.knowledge
                )
                  ? data.knowledge
                  : state.knowledge,

              terminalHistory:
                Array.isArray(
                  data.terminalHistory
                )
                  ? data.terminalHistory
                  : state.terminalHistory,

              activeProviderId:
                data.activeProviderId ||
                state.activeProviderId,
            }));

            return true;
          } catch {
            return false;
          }
        },

      resetWorkspaceData:
        () => {
          try {
            localStorage.removeItem(
              'evis_workspace_store_v1'
            );
          } catch {
            // ignore
          }

          set({
            sessions:
              INITIAL_SESSIONS,
            projects:
              INITIAL_PROJECTS,
            skills: [],
            knowledge:
              INITIAL_KNOWLEDGE,
            activeSessionId:
              INITIAL_SESSIONS[0]?.id ||
              'sess-main',
            activeProjectId:
              INITIAL_PROJECTS[0]?.id ||
              'proj-evis',
            activeProviderId:
              'ollama',
          });
        },
    }),

    {
      name:
        'evis_workspace_store_v1',

      storage:
        createJSONStorage(
          () => localStorage
        ),

      partialize: (state) => ({
        activeView:
          state.activeView,
        activeSessionId:
          state.activeSessionId,
        activeProjectId:
          state.activeProjectId,
        activeProviderId:
          state.activeProviderId,
        sessions:
          state.sessions,
        skills:
          state.skills,
        models:
          state.models,
        providers:
          state.providers,
        projects:
          state.projects,
        knowledge:
          state.knowledge,
        systemStatus:
          state.systemStatus,
        sidebarCollapsed:
          state.sidebarCollapsed,
        contextDrawerOpen:
          state.contextDrawerOpen,
        contextDrawerTab:
          state.contextDrawerTab,
        terminalHistory:
          state.terminalHistory,
        autoLaunchProviders:
          state.autoLaunchProviders,
      }),
    }
  )
);

