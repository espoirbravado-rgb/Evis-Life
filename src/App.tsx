import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './store/useAppStore';

export const App: React.FC = () => {
  const discoverProvidersAndModels = useAppStore((s) => s.discoverProvidersAndModels);
  const refreshRuntimeSkills = useAppStore((s) => s.refreshRuntimeSkills);

  useEffect(() => {
    // Initial probe on startup
    discoverProvidersAndModels();
    refreshRuntimeSkills();
  }, [discoverProvidersAndModels, refreshRuntimeSkills]);

  return <AppShell />;
};

export default App;
