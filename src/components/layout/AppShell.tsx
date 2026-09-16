import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ConversationWorkspace } from '../workspace/ConversationWorkspace';
import { ContextDrawer } from '../drawer/ContextDrawer';
import { ProjectsView } from '../views/ProjectsView';
import { SkillsHubView } from '../views/SkillsHubView';
import { KnowledgeVaultView } from '../views/KnowledgeVaultView';
import { ExercisesView } from '../views/ExercisesView';
import { SettingsView } from '../views/SettingsView';
import { FileExplorerView } from '../views/FileExplorerView';
import { ProvidersModelsView } from '../views/ProvidersModelsView';

export const AppShell: React.FC = () => {
  const { activeView } = useAppStore();

  const renderActiveView = () => {
    switch (activeView) {
      case 'chat':
        return <ConversationWorkspace />;
      case 'projects':
        return <ProjectsView />;
      case 'skills':
        return <SkillsHubView />;
      case 'knowledge':
        return <KnowledgeVaultView />;
      case 'files':
        return <FileExplorerView />;
      case 'exercises':
        return <ExercisesView />;
      case 'models':
        return <ProvidersModelsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ConversationWorkspace />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* 1. Global Application Header */}
      <AppHeader />

      {/* 2. Workspace Body (Horizontal layout: Sidebar + Stage + Context Drawer) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Nav Sidebar */}
        <Sidebar />

        {/* Central Stage */}
        <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
          {renderActiveView()}
        </main>

        {/* Right Context Drawer (Skills, Knowledge, Files, Terminal) */}
        <ContextDrawer />
      </div>

      {/* 3. Global Status Bar */}
      <StatusBar />
    </div>
  );
};
