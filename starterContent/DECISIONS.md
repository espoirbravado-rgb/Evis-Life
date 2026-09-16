# DECISIONS — Lois, Critiques et Décisions Architecturales d'Evis

> Statut : Document vivant. A lire AVANT toute action sur le projet.
> Regle : Ce fichier est une memoire permanente, pas un resume.

---

## 1. Le Declencheur

Probleme constate :
- L'implementeur (IA) sautait des blocs entiers de directive_1.md.
- Projet a moins de 40% de ses vraies specifications.
- Raccourcis statiques adoptes (hard-codage, donnees mockees, resultats simules).

Decision actee : Le Web Search est GELE.
Ne peut etre implemente qu'une fois les niveaux 1 et 2 verrouilles.

---

## 2. Les 4 Fautes Majeures

Faute 1 — Inversion des priorites : plomberie reseau AVANT la chaine fondamentale.
Regle : Ne jamais construire la couche N+1 tant que N n'a pas passe un test reel.

Faute 2 — Angle mort Environment Awareness (Niveau 2) :
- Zone systeme protegee : /etc, /usr, /root, ~/.ssh → INTERDIT
- Zone utilisateur : ~, ~/Desktop → accessible avec permission
- Zone projet : /home/junior/Desktop/New-Ag → espace principal
Regle : UNKNOWN != SAFE.

Faute 3 — Inter-Agents reduit a une simple requete HTTP.
Protocole correct : Discovery → Identity/Handshake → Session → Tache → Dialogue → Validation.
Cette couche est GELEE jusqu'aux niveaux 0-5 solides.

Faute 4 — Ordre global biaise : Web (N6) construit avant Niveaux 0-1 verrouilles.

---

## 3. Diagnostic Methodologique

DOCUMENTATION != REALITE DU DISQUE
La documentation decrit le voulu. Le disque est la preuve du reel.
Quand ils divergent : le disque gagne.

Amnesia de trajectoire (metaphore de la Maison) :
- Agent avance A→B→C→D→E. Apres 40 etapes il ne sait plus pourquoi il est ici.
- On apprend sa maison avant de tracer une route vers une autre ville.

---

## 4. L'Echelle des 8 Niveaux

Niveau 0 : Evis lui-meme          — Boucle, Invariants
Niveau 1 : Filesystem + WorkingMemory — Navigation active, parentId, returnTarget
Niveau 2 : Environnement utilisateur  — OS, frontieres (systeme/user/projet)
Niveau 3 : Applications locales       — Ollama, compilateurs
Niveau 4 : Reseau local               — Ports, IPC
Niveau 5 : Reseau externe             — Proxy, VPN
Niveau 6 : Internet / Web Search      — GELE
Niveau 7 : Services distants          — APIs cloud
Niveau 8 : Inter-Agents               — GELE

Regle absolue : Ne pas implementer Niveau N si N-1 n'est pas verrouille avec preuve physique.

---

## 5. La Vraie Nature de la Working Memory

Pas un tas de texte passif. Un systeme de navigation actif avec :

CurrentNode    : ou suis-je dans le graphe de taches ?
ParentNode     : qui m'a instancie ?
Origin         : quelle est la requete d'origine ?
Purpose        : pourquoi cette sous-tache ?
ReturnTarget   : ou retourner une fois termine ?
Checkpoint     : dernier etat sauvegardable

Le runtime doit REFUSER d'instancier une sous-tache sans parentId et returnTarget.

---

## 6. Contrainte Mecanique vs. Prompt-Engineering

Prompt-engineering seul echoue :
- T0 : IA comprend la regle.
- T5 : IA la viole apres glissement d'attention.

Les 3 niveaux :
1. Connaissance → INSUFFISANT
2. Intention    → INSUFFISANT
3. Contrainte Runtime : le code refuse physiquement → SUFFISANT

Chaine correcte : Principe → Specification → Structure → Runtime → Invariant → Test

---

## 7. L'Environnement comme Multiplicateur

"Le modele n'est pas le chef-d'oeuvre, c'est l'environnement qui est le multiplicateur."

Architecture agnostique du modele. 1.5B bien encadre > 70B dans le vide.

Taxonomie des memoires (dynamique) :
- knowledge, decision, project, capability, experience, preference

Aucune incapacite n'est absolue. image.generate=unavailable est temporaire.

---

## 8. Etat des Phases

Phase 0-13 : TOUTES COMPLETES (preuve physique : note_real_agent.txt sur Bureau)

NIVEAU 1 — Working Memory Navigation Stack : COMPLET (preuve physique: note_session_wm.txt + .evis/memory/sess-main-test.json)
NIVEAU 2 — Environment Awareness           : A IMPLEMENTER (PRIORITE IMMEDIATE)

Phase 14 — Verification UI end-to-end : Apres Niveau 2
Phase 15 — Web Skill                  : GELE
Phase 16 — Terminal Skill             : Apres Niveau 2

---

## 9. Bugs fixes (ne pas reuvrir)

- Programme parlait a la place du modele → Supprime dans orchestrator.ts
- setInterval 15s sur ports → Supprime de App.tsx
- ECONNREFUSED spam Vite → Proxy silencieux + pre-check llamaCppService.ts
- 14b + 1.5b simultanes RAM → OllamaService.unloadAllModels() dans useAppStore.ts
- SkillRegistry syntaxe → Retablie
- IDs stale mockData.ts → mapUiSkillIdsToRuntime() corrige

---

## 10. Ce qui ne doit JAMAIS etre fait

- Simuler une execution d'outil et la presenter comme reelle.
- Declarer une phase complete sans preuve physique sur le disque.
- Construire N+1 si N n'est pas verrouille.
- Injecter une reponse codee en dur a la place du modele.
- Creer une sous-tache sans parentId et returnTarget.
- Modifier une zone inconnue sans permission explicite.
- Confondre documentation et realite du disque.

---

Derniere mise a jour : 2026-09-15
Source : Auto-reconnaissance transcript.jsonl etapes 2631-2732
