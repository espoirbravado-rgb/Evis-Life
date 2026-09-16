export interface ProjectFilePreview {
  name: string;
  path: string;
  size: string;
  language: string;
  content: string;
}

export const PROJECT_FILES: Record<string, ProjectFilePreview> = {
  'README.md': {
    name: 'README.md',
    path: '/home/junior/Desktop/New-Ag/README.md',
    size: '3.4 KB',
    language: 'markdown',
    content: `# New-Ag — Espace de Travail IA Local Modulaire pour Linux

New-Ag est une interface desktop moderne, modulaire et locale pour interagir avec des modèles d'intelligence artificielle locaux (Ollama), attacher dynamiquement des compétences (skills), exécuter des outils sécurisés et pérenniser la mémoire de vos projets.

- Port : http://127.0.0.1:5173
- Local-first & offline par défaut.`,
  },
  'skill.md': {
    name: 'skill.md',
    path: '/home/junior/Desktop/New-Ag/skill.md',
    size: '20.9 KB',
    language: 'markdown',
    content: `# UI Architecture Designer

## Purpose
This skill defines how to design the desktop user interface of a modular local AI workspace.
The application is designed primarily for Linux.

Core Design Principle:
The application must be designed as a workspace, not as a collection of unrelated tools.
The user should think in terms of:
* conversation
* task
* project
* skill
* file
* knowledge
* model
* tool`,
  },
  'package.json': {
    name: 'package.json',
    path: '/home/junior/Desktop/New-Ag/package.json',
    size: '0.7 KB',
    language: 'json',
    content: `{
  "name": "new-ag",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}`,
  },
  'skill_1.md': {
    name: 'skill_1.md',
    path: '/home/junior/Desktop/New-Ag/skill_1.md',
    size: '22.4 KB',
    language: 'markdown',
    content: `# Evis UI — Interface Behavior & Integration Skill

## Purpose
This skill defines the UI behavior, interaction model, dynamic integrations, feature surfaces, and rules required to make the interface behave like a real application rather than a static mockup.

Fundamental Rule:
The UI must represent the real state of the system.
Never invent: AI models, installed providers, installed skills, exercises, projects, files, tools, integrations, permissions, capabilities.`,
  },
  'vite.config.ts': {
    name: 'vite.config.ts',
    path: '/home/junior/Desktop/New-Ag/vite.config.ts',
    size: '0.5 KB',
    language: 'typescript',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\\/ollama/, ''),
      },
    },
  },
});`,
  },
  'src/types/index.ts': {
    name: 'src/types/index.ts',
    path: '/home/junior/Desktop/New-Ag/src/types/index.ts',
    size: '3.3 KB',
    language: 'typescript',
    content: `export interface ISkill {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  dependencies: string[];
  requiredTools: string[];
  optionalTools: string[];
  permissions: ISkillPermission[];
}`,
  },
};

