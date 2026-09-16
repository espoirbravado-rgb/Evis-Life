# Evis — Espace de Travail IA Local Modulaire pour Linux

**Evis** est une interface desktop moderne, modulaire et locale pour interagir avec des modèles d'intelligence artificielle locaux (Ollama, llama.cpp), attacher dynamiquement des compétences (*skills*), exécuter des outils sécurisés et pérenniser la mémoire de vos projets, selon les règles définies dans `skill_1.md`.

---

## 🚀 1. Lancement Rapide

Le serveur de développement est actif :
👉 **[http://127.0.0.1:5173](http://127.0.0.1:5173)**

*(Pour relancer manuellement : `cd ~/Desktop/New-Ag && npm run dev`)*.

---

## 💎 2. Fonctionnalités Réelles Conformes à `skill_1.md`

1. **Fournisseurs d'IA Dynamiques & Réels** :
   - **Ollama** : Détecté automatiquement sur `http://127.0.0.1:11434` avec le modèle réel `qwen2.5-coder:1.5b`.
   - **llama.cpp** : Présenté comme fournisseur distinct (Actuellement "Non configuré", configurable dans Settings).
   - **Téléchargeur de Modèles** : Formulaire dans les paramètres pour télécharger n'importe quel modèle depuis le registre Ollama avec barre de progression en temps réel.
2. **Surfaces Vocales Intégrées** :
   - **Entrée Vocale (🎤)** : Bouton microphone dans la zone de saisie (Composer) pour dicter vos messages avec retour visuel d'écoute et de transcription.
   - **Synthèse Vocale (Read Aloud)** : Bouton écoute sur les messages de l'assistant pour faire lire les réponses à haute voix.
3. **Sélection et Copie de Texte Naturelles** :
   - Vous pouvez librement sélectionner, surligner et copier du texte et du code dans toute l'application.
4. **Gestionnaire de Fichiers Dédié (File Explorer)** :
   - Accessible depuis la barre latérale, avec racine définie (`/home/junior/Desktop/New-Ag`) et visualiseur de code intégré.
5. **En-tête Épuré (Pas de Duplication)** :
   - Les compétences actives sont gérées directement au niveau du Composer sans duplication inutile dans l'en-tête de la discussion.
6. **Raccourcis Clavier Natifs** :
   - `Ctrl+K` : Palette de commandes globale
   - `Ctrl+B` : Replier/Déplier la barre latérale
   - `Ctrl+J` : Afficher/Masquer le tiroir contextuel
   - `Ctrl+N` : Nouvelle conversation
