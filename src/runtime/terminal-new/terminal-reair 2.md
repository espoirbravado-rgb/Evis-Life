## Écarts déjà confirmés dans le code actuel

J’ai commencé la vérification dans `terminalRuntime.ts` et `pty/ptyExecutor.ts`. Voici des constats précis, pas des déductions tirées du rapport.

1. L’autorisation PTY ne suit pas encore le flux complet exigé. `spawnPty()` évalue la politique et les règles de permission, mais ne traite explicitement que l’action `deny`. Si l’une des couches renvoie `require_approval`, le code montré continue vers le lancement du PTY sans appeler `ApprovalManager`. La méthode ne passe pas non plus par `SandboxManager`.

terminalRuntime.ts

ptyExecutor.ts

2. Le PTY utilise bien l’option `shell`, mais cela ne prouve pas que le reste de la configuration est honoré. `PtyExecutor` transmet `options.shell` au script Python et construit son environnement à partir d’un petit socle, puis des variables fournies. Il faut vérifier le bridge et ses tests avant de conclure sur l’exécution réelle ou le filtrage des secrets.

ptyExecutor.ts

3. Les sessions persistent actuellement une partie de l’état par simulation. `execute()` traite `cd` et `export` comme des commandes intégrées qui modifient les métadonnées de `TerminalSession`, tandis que les commandes ordinaires sont lancées par `ProcessManager.spawn()`. Cela ne correspond pas à la possession d’un shell persistant décrite dans le blueprint.

terminalRuntime.ts

Je poursuis maintenant avec les composants de sécurité, de processus et les tests pour déterminer lesquels de ces écarts sont déjà couverts, lesquels ont été corrigés ailleurs et lesquels doivent réellement figurer dans le Markdown de réparation.


J’ai relevé un autre écart important, qui mérite d’être intégré à la comparaison :

- Le fallback sandbox n’est pas un échec bloquant. Lorsque Bubblewrap est demandé mais indisponible, `SandboxManager.initialize()` bascule vers `LocalDriver`, marque l’initialisation comme réussie et renvoie un avertissement. Or le contrat du nouvel audit demande, dans le cas d’une sandbox obligatoire, un échec explicite et aucune création de processus. Il faudra donc vérifier si le niveau de politique permet réellement de rendre l’isolation obligatoire, puis si le runtime respecte cette exigence.

sandboxManager.ts

Je n’inscris pas encore cela comme un défaut universel : le fallback local est annoncé comme volontaire dans le code. L’écart dépend de la différence entre sandbox facultative et sandbox exigée.

Je continue à examiner les assertions des tests et les autres chemins d’exécution avant de rédiger la liste finale des réparations.


Merci ! Je continue en m’appuyant bien sur le connecteur GitHub et en vérifiant les implémentations réelles, pas seulement les affirmations du rapport. Je garde les écarts déjà établis et je poursuis la vérification des fichiers et des tests pour distinguer les défauts confirmés de ceux qui restent à démontrer.


Je poursuis. J’ai confirmé via GitHub que le dossier PTY contient bien `ptyBridge.py`, `ptyExecutor.ts` et `ptyTypes.ts`. Je vais maintenant vérifier le pont Python et les autres sous-systèmes à partir de l’arborescence réelle, puis consolider les constats dans le document de réparation sans modifier le dépôt.

### Vérification supplémentaire : PTY et gestion des processus

Le pont Python confirme un point important : il crée une session PTY et lance la commande via le shell demandé, mais son arrêt et sa surveillance restent centrés sur le PID du processus enfant direct. Il ne met pas lui-même en place une terminaison explicite de tout l’arbre de processus.

ptyBridge.py

Autre constat concret : `ProcessHandle` conserve les sorties brutes dans ses buffers, puis applique le nettoyage et la rédaction des secrets lorsqu’il retourne les logs. C’est une protection sur ce chemin de lecture, mais cela ne prouve pas que les autres chemins d’événements, d’erreurs et d’audit sont également protégés.

processHandle.ts


### Nouveau écart confirmé : filtrage des variables d’environnement

Dans `terminalEnvironment.ts`, les variables de base, persistantes et de session passent par le filtre des clés sensibles. En revanche, les variables spécifiques à une requête (`requestEnv`) sont copiées directement dans l’environnement, sans appliquer ce même blocage. Elles peuvent donc réintroduire une clé que le filtre aurait normalement exclue.

terminalEnvironment.ts

Je retiens ce point comme un défaut concret à corriger : le filtrage doit être cohérent à toutes les étapes de fusion, et pas seulement sur l’environnement hérité.

Je continue l’audit en gardant cette distinction : ce qui est visible dans le code est confirmé ; ce qui dépend encore des tests ou de l’intégration sera marqué comme tel.
Je poursuis l’audit du dépôt `espoirbravado-rgb/Evis-Life` sur GitHub.

### Écart confirmé supplémentaire : arrêt de l’arbre des processus

La fonction `ProcessTree.killTree()` découvre les descendants via `/proc` (avec un repli sur `pgrep`) et envoie un signal aux descendants puis au PID racine. Toutefois, la découverte est faite à un instant donné : le code ne garantit pas qu’un descendant créé au même moment ou réadopté sera également arrêté.

processTree.ts

Je garde donc le point « arrêt robuste des processus descendants » à vérifier et à renforcer, plutôt que de considérer la présence de `killTree()` comme une garantie complète.

Je continue l’examen. Quand j’aurai terminé la comparaison du code, des tests et du rapport, je te le signalerai clairement, puis je préparerai le prochain Markdown de réparation.

Je continue l’audit du dépôt GitHub sans modifier les fichiers. Je vérifie maintenant les écarts entre les garanties annoncées dans le rapport et ce que le code applique réellement, en particulier le sandbox, les chemins d’exécution et les tests.


### Écart supplémentaire confirmé : terminaison du PTY

Le pont Python lance le shell dans un processus enfant avec `fork()` puis `exec`. Il communique son PID à Node, mais le code présenté ne met pas en place de boucle de terminaison des descendants ni de gestion explicite des signaux reçus par le pont. Cela ne suffit donc pas, à lui seul, à garantir l’arrêt de tout l’arbre de processus lors d’une annulation.

ptyBridge.py

Je poursuis la vérification des tests et des autres modules avant de consolider les constats dans le prochain Markdown.


D’accord. Je termine la vérification ciblée, puis nous passons au manifeste de réparation : un document clair, fondé sur les écarts réellement constatés, avec les priorités et les critères permettant de vérifier chaque correction.

Je garde une distinction importante : une fonction présente, un test déclaré et une correction effectivement validée sont trois choses différentes. Je ne présenterai donc pas les affirmations du rapport comme vérifiées sans les confronter au code et aux tests.


# Audit terminé — passons au manifeste

J’ai terminé la vérification statique des points prioritaires déjà examinés dans `src/runtime/terminal-new`. Les écarts ci-dessous sont suffisamment étayés pour constituer une première base de réparation. Je n’ai pas exécuté la suite de tests : la configuration de test est identifiée, mais les 149 tests annoncés dans le rapport ne sont pas validés par cette lecture seule.

Voici le manifeste à utiliser comme base de travail. Il est volontairement orienté vers les exigences et les preuves attendues, pas vers une implémentation improvisée.

EVIS — MANIFESTE DE RÉPARATION DU TERMINAL RUNTIME

# EVIS — MANIFESTE DE RÉPARATION DU TERMINAL RUNTIME

## 1. Objectif

Réparer et fiabiliser `src/runtime/terminal-new` afin que les garanties de sécurité, d'exécution, d'annulation et d'observabilité annoncées correspondent au comportement réel du code.

Ce manifeste définit les exigences à respecter avant de considérer le runtime comme fiable.

Il ne constitue pas une preuve que les corrections sont déjà réalisées.

## 2. Règles obligatoires

1. Lire le code existant avant toute modification.

2. Identifier les dépendances et les points d'entrée concernés.

3. Ne pas créer de fonctions, d'exports ou de fichiers inutilisés.

4. Ne pas remplacer une fonctionnalité réelle par une simulation présentée comme complète.

5. Ne pas déclarer une correction terminée sans test correspondant.

6. Ne pas affirmer qu'un test passe sans l'avoir exécuté.

7. Préserver les comportements déjà valides, sauf décision explicitement documentée.

8. Ne pas masquer une limitation technique par un commentaire, un type ou un résultat artificiel.

9. Traiter les chemins d'exécution normaux, en arrière-plan et PTY séparément.

10. Après chaque modification : vérifier les imports, les appels, les types, les tests et les effets de bord.

## 3. Priorité P0 — Sécurité et contrôle d'exécution

### 3.1. Sandbox : échec fermé lorsque l'isolation est obligatoire

**Constat d'audit :** le gestionnaire de sandbox peut retomber sur une exécution locale lorsque Bubblewrap est indisponible. Les types décrivent également certaines limites comme informatives.

**Exigences :**

* Distinguer explicitement le mode sans isolation du mode où l'isolation est obligatoire.

* Si l'isolation requise ne peut pas être appliquée, refuser l'exécution.

* Ne jamais présenter un fallback local comme une exécution sandboxée.

* Renvoyer un résultat structuré indiquant le mode réellement appliqué et les limites restantes.

* Vérifier que les restrictions de fichiers, de réseau et d'environnement sont effectivement appliquées par le driver choisi.

**Validation attendue :**

* Test avec Bubblewrap disponible.

* Test avec Bubblewrap indisponible et isolation obligatoire.

* Test avec mode explicitement non isolé.

* Vérification qu'aucune commande n'est exécutée sur l'hôte lorsqu'une isolation obligatoire échoue.

### 3.2. Variables d'environnement et secrets

**Constat d'audit :** le chemin `requestEnv` ne semble pas appliquer le même filtrage que les autres sources de variables d'environnement.

**Exigences :**

* Appliquer une politique cohérente à toutes les sources d'environnement.

* Examiner les variables héritées, persistantes, propres à la session et celles fournies par la requête.

* Définir explicitement les exceptions autorisées.

* Éviter que les secrets soient exposés dans les événements, erreurs, journaux, métriques ou résultats.

* Centraliser la redaction avant toute sortie observable.

**Validation attendue :**

* Tests pour chaque source d'environnement.

* Tests de variables sensibles connues et de secrets personnalisés.

* Vérification des sorties normales, erreurs, événements et processus en arrière-plan.

* Vérification qu'une variable interdite ne peut pas être réintroduite par une autre source.

### 3.3. Autorisations et approbations

**Constat d'audit :** l'approbation est liée à la commande et à un contexte, mais certains contrôles de contexte ne sont appliqués que lorsque les champs sont présents des deux côtés. Le chemin PTY ne traite pas explicitement le résultat `require_approval` comme le chemin normal.

**Exigences :**

* Définir les champs obligatoires pour lier une approbation à son contexte.

* Refuser une approbation dont le contexte est incomplet ou différent.

* Garantir l'usage unique et l'expiration de l'approbation.

* Appliquer les mêmes règles d'autorisation aux exécutions normales, en arrière-plan et PTY.

* Ne jamais laisser le PTY continuer lorsqu'une approbation est requise mais absente.

**Validation attendue :**

* Approbation valide, expirée, réutilisée et de contexte différent.

* Tests de refus et d'approbation sur chaque chemin d'exécution.

* Test de changement de répertoire, session, tâche ou agent entre demande et consommation.

## 4. Priorité P0 — Annulation et processus

### 4.1. Arrêt robuste des processus

**Constat d'audit :** l'arrêt des descendants s'appuie sur une découverte ponctuelle des PID. Le pont PTY lance un processus enfant, mais le code examiné ne démontre pas à lui seul une terminaison complète de l'arbre lors de l'annulation.

**Exigences :**

* Définir un mécanisme de suivi et de terminaison cohérent pour les processus enfants.

* Gérer les signaux et la fermeture du pont PTY.

* Ne pas considérer l'arrêt du seul processus racine comme une preuve que tous les descendants sont arrêtés.

* Définir le comportement si un processus ne répond pas au premier signal.

* Nettoyer les ressources et les références après terminaison.

**Validation attendue :**

* Annulation d'une commande simple.

* Annulation d'une commande lançant plusieurs descendants.

* Annulation pendant la création de descendants.

* Vérification qu'aucun processus orphelin ne subsiste.

* Vérification des états finaux et de la libération des ressources.

## 5. Priorité P1 — Cohérence du runtime

### 5.1. Environnement d'exécution et shell

**Constat d'audit :** le chemin normal utilise un shell codé en dur, tandis que le PTY accepte un shell configuré.

**Exigences :**

* Définir une politique unique et documentée de sélection du shell.

* Vérifier que les options déclarées sont réellement respectées.

* Distinguer les options non prises en charge des options appliquées.

* Éviter les différences de comportement silencieuses entre exécution normale, arrière-plan et PTY.

**Validation attendue :**

* Tests avec shell par défaut et shell explicitement configuré.

* Vérification des options réellement transmises.

* Tests de cohérence entre les différents modes.

### 5.2. Commandes de session

**Constat d'audit :** `cd` et `export` sont simulés par des mutations de métadonnées de session, sans démonstration d'un shell persistant unique.

**Exigences :**

* Définir précisément ce que signifie une session terminal.

* Distinguer l'état simulé de l'état réellement conservé par un processus shell.

* Garantir que les commandes suivantes observent le comportement documenté.

* Ne pas annoncer une persistance shell si elle n'existe pas.

**Validation attendue :**

* Tests de `cd` suivi d'une autre commande.

* Tests de `export` suivi d'une autre commande.

* Tests de séparation entre sessions.

* Tests de cohérence entre historique, métadonnées et état réel.

## 6. Priorité P1 — Redaction et observabilité

### 6.1. Sorties et erreurs

**Constat d'audit :** des événements peuvent recevoir des sorties brutes avant redaction ; des chemins d'erreur peuvent également transmettre des messages non nettoyés.

**Exigences :**

* Identifier toutes les sorties du runtime.

* Appliquer la redaction avant émission ou persistance.

* Éviter de conserver une copie brute accessible par les interfaces de logs.

* Documenter les données autorisées dans les audits et métriques.

**Validation attendue :**

* Tests de fuite par stdout et stderr.

* Tests de fuite par événements et erreurs.

* Tests pour les processus en arrière-plan.

* Vérification que les logs récupérés et les logs émis appliquent la même politique.

### 6.2. Audit et métriques

**Exigences :**

* Définir les événements attendus pour succès, refus, approbation, annulation et échec.

* Garantir la cohérence des identifiants de session, tâche, agent et processus.

* Ne pas inclure de secrets dans les champs de diagnostic.

* Distinguer une action demandée d'une action réellement exécutée.

**Validation attendue :**

* Tests de chaque transition.

* Vérification des événements manquants et dupliqués.

* Vérification de la cohérence des identifiants et des états finaux.

## 7. Priorité P1 — PTY

**Exigences :**

* Appliquer la politique d'autorisation complète avant le lancement.

* Appliquer le sandbox si le mode d'exécution le requiert.

* Filtrer l'environnement avec la même politique que les autres chemins.

* Gérer proprement les signaux, la fermeture du pont et les erreurs de démarrage.

* Éviter les constructions ambiguës de commande et d'arguments.

* Documenter les limites propres au PTY.

**Validation attendue :**

* Refus d'une commande interdite.

* Demande d'approbation correctement bloquante.

* Vérification du sandbox appliqué.

* Annulation et fermeture avec descendants.

* Gestion des erreurs de lancement et du pont absent.

## 8. Priorité P2 — Qualité et maintenance

### 8.1. Types et options

* Chaque option publique doit être appliquée, rejetée explicitement ou documentée comme non prise en charge.

* Les types ne doivent pas promettre une garantie que le driver ne fournit pas.

* Les capacités des drivers doivent être explicites.

### 8.2. Tests

* Chaque exigence de ce manifeste doit correspondre à un ou plusieurs tests.

* Les tests négatifs doivent vérifier l'absence d'action non autorisée.

* Les tests doivent couvrir les chemins normal, arrière-plan et PTY.

* Les tests doivent être exécutés, pas seulement déclarés.

* Les résultats doivent être rapportés avec les commandes réellement exécutées.

### 8.3. Documentation

* Documenter les garanties effectives, pas les intentions.

* Mentionner les limitations de chaque driver.

* Mettre à jour la documentation après validation des corrections.

* Ne pas déclarer une phase terminée sur la seule base de la présence de fichiers ou de fonctions.

## 9. Ordre d'exécution

1. Cartographier les points d'entrée et les dépendances.

2. Corriger les contrôles de sécurité communs.

3. Corriger le sandbox et les variables d'environnement.

4. Unifier les autorisations et approbations sur tous les chemins.

5. Corriger l'annulation et la terminaison des processus.

6. Corriger les sorties, erreurs et redaction.

7. Aligner les options et comportements de session.

8. Ajouter ou compléter les tests ciblés.

9. Exécuter les tests et le contrôle TypeScript.

10. Réexaminer les diffs et les régressions.

11. Mettre à jour la documentation avec les résultats vérifiés.

## 10. Définition de « terminé »

Une tâche ne peut être déclarée terminée que si :

* le code concerné a été inspecté ;

* les modifications sont limitées et cohérentes ;

* les tests ciblés existent et passent ;

* les contrôles de types passent ;

* les chemins négatifs ont été vérifiés ;

* les garanties annoncées correspondent au comportement observé ;

* les limitations restantes sont explicitement documentées ;

* aucun test ou résultat n'est inventé ou présenté comme exécuté sans preuve.

## 11. État initial de ce manifeste

Les points listés proviennent d'un audit statique ciblé du dépôt. Ils constituent des exigences de réparation et de validation, pas un rapport d'exécution des tests.

Les résultats d'exécution, les corrections effectuées et les éventuels nouveaux écarts devront être consignés séparément au fur et à mesure du travail.

L’audit est terminé pour cette étape. Tu peux maintenant relire ce manifeste et décider si tu veux le conserver tel quel comme base, ou le retravailler avant de le transmettre à l’agent qui implémentera les corrections.
Ce sont les retours de l'autre intelligence artificielle que j'avais utilisée pour analyser tout le répertoire. Bon, je ne sais pas trop tout ce qu'il a dit, si c'est forcément vrai ou non, c'est pour ça que je te renvoie tout. Parce que lui-même se perd dans ses analyses souvent. C'est pour ça, si tu vois bien, j'ai pris plusieurs réponses pour les assembler et envoyer. Analyse et essaie de voir si il a raison. S'il a raison, alors on corrige. 
