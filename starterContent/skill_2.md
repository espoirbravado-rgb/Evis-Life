# Evis — Core Stabilization & Next Implementation Skill

## 1. Purpose

This skill defines the current stabilization phase of Evis.

Evis already has a functional local AI chat interface capable of sending messages to and receiving responses from locally running AI models.

The current objective is NOT to redesign the entire interface.

The objective is to:

1. identify what is actually functional;
2. identify what is only represented in the UI;
3. connect the missing backend/application capabilities;
4. make local data persistent;
5. make skills and tools actually usable by the AI;
6. make model providers and models dynamically discoverable;
7. investigate and reduce unnecessary startup latency;
8. establish a reliable foundation before adding advanced capabilities.

Do not assume that a feature is implemented simply because its UI exists.

---

# 2. Fundamental Rule

## UI state must represent real system state.

Never create:

* fake models;
* fake providers;
* fake skills;
* fake conversations;
* fake files;
* fake projects;
* fake statistics;
* fake capabilities;
* fake tool results;
* fake Internet access;
* fake memory;
* fake filesystem access.

If a capability is not connected and operational, the UI must represent it as:

* unavailable;
* inactive;
* not configured;
* loading;
* error;
* or another appropriate real state.

Never pretend that an unavailable capability works.

---

# 3. Current Known State

## 3.1 Chat

Current state:

* The UI exists.
* The user can send messages.
* A local AI model can respond.
* The application can communicate with local AI infrastructure.

This is considered an existing functional foundation.

Do not rebuild the chat unnecessarily.

---

## 3.2 Browser-Based Execution

Current state:

* Evis currently runs in a browser.
* It has NOT yet been packaged as a Linux desktop application.
* Desktop packaging is intentionally postponed.

Do not prioritize desktop packaging yet.

The browser environment is currently the development environment.

The final target remains a Linux desktop application.

---

## 3.3 Memory / Persistence

Current problem:

Conversation data is not reliably persistent.

Example:

```text
User opens Evis
        ↓
Conversation
        ↓
Messages exist in runtime memory
        ↓
Application/browser closes
        ↓
Conversation disappears
```

This must be replaced by:

```text
Conversation
        ↓
Session state
        ↓
Persistent storage
        ↓
Conversation remains available
```

### Required behavior

Evis must persist:

* conversations;
* messages;
* conversation metadata;
* timestamps;
* titles;
* selected model/provider where relevant;
* active project/context where relevant;
* references to files/knowledge where relevant.

The exact storage technology must be selected according to the architecture.

Possible local technologies include:

* SQLite;
* structured local files;
* another appropriate embedded database.

Do not choose a technology merely because it is familiar.

The storage layer must be abstracted so it can be replaced later.

---

# 4. Memory Is Not the Same as Storage

Evis must distinguish:

## Storage

Responsible for physically persisting information.

Examples:

```text
conversations
settings
projects
skills
knowledge
files
metadata
```

## Memory

Responsible for deciding what information should persist as useful context.

Example:

```text
Conversation
      ↓
important information
      ↓
memory extraction
      ↓
persistent knowledge/context
```

Therefore:

```text
Storage ≠ Memory
```

Both systems must have separate responsibilities.

---

# 5. Evis Data Root

Evis must have a defined logical data root.

Conceptually:

```text
Evis Data Root
├── conversations/
├── knowledge/
├── projects/
├── skills/
├── exercises/
├── settings/
└── cache/
```

This is a logical architecture, not necessarily the final physical directory structure.

The actual physical location must come from application configuration.

Do not hard-code arbitrary user paths into the UI.

---

# 6. Conversation Lifecycle

The conversation system must support a complete lifecycle.

```text
Create
   ↓
Active
   ↓
Continue
   ↓
Persist
   ↓
Archive
   ↓
Search / Restore
```

For large conversations:

```text
Active conversation
        ↓
Analyze
        ↓
Extract relevant information
        ↓
Create compact knowledge/context
        ↓
Archive raw conversation
        ↓
Start new conversation
        ↓
Load only relevant context
```

The raw conversation should not need to be destroyed merely because a compact summary or memory was created.

---

# 7. Filesystem Integration

## Current problem

The AI does not yet appear to have genuine access to Evis's filesystem.

A UI element called "Files" or "File Explorer" is not sufficient.

The AI must have an actual filesystem capability exposed through an application/tool layer.

Expected architecture:

```text
AI
 ↓
Orchestrator
 ↓
Filesystem Tool
 ↓
Filesystem Service
 ↓
Evis Data Root
```

The UI must not directly expose unrestricted filesystem access to the model.

---

# 8. File Explorer

File Explorer must be a real file-management workspace.

It must NOT open a conversation.

Expected behavior:

```text
User selects Files
        ↓
File Explorer workspace
        ↓
Evis Data Root
        ↓
Folders / files
```

Potential operations:

* browse;
* open;
* read;
* create;
* rename;
* move;
* copy;
* delete;
* search;
* inspect metadata.

Operations must respect permissions.

---

# 9. Tool Architecture

Skills cannot magically give models capabilities.

A skill definition alone does not provide Internet, filesystem, terminal, or other access.

The correct architecture is:

```text
User
 ↓
UI
 ↓
Session
 ↓
Orchestrator
 ↓
Skill
 ↓
Tool
 ↓
Tool implementation
 ↓
External/local resource
```

Examples:

```text
Web Skill
   ↓
Web Search Tool
   ↓
Internet
```

```text
Coding Skill
   ↓
Filesystem Tool
   ↓
Project files
```

```text
Linux Skill
   ↓
Terminal Tool
   ↓
Linux environment
```

---

# 10. Current Web Problem

If the user asks the local model:

> Search the Internet for X.

and the model simply answers:

> I do not have Internet access.

this must NOT automatically be interpreted as a model limitation.

First verify whether:

```text
Web Skill
      ↓
Web Tool
      ↓
Web provider
      ↓
Orchestrator
```

is actually connected.

A model cannot use an external capability that has not been exposed to it through the application.

---

# 11. Skill System

A skill definition stored on disk is not enough.

Evis must have a real skill lifecycle:

```text
Discover
   ↓
Load
   ↓
Validate
   ↓
Resolve dependencies
   ↓
Activate
   ↓
Provide instructions/tools/context
   ↓
Execute
   ↓
Deactivate
```

A skill should be able to declare:

* purpose;
* scope;
* instructions;
* dependencies;
* required tools;
* optional tools;
* permissions;
* configuration;
* resources;
* supported operations.

---

# 12. Skill Activation

Skills must have explicit states.

Possible states:

```text
available
active
inactive
loading
unavailable
not-configured
error
```

A skill shown in the interface must correspond to actual application state.

---

# 13. Global Skills vs Specialized Skills

Evis should support two broad categories.

## Global / General Skills

These improve general interaction.

Examples:

```text
memory
conversation management
knowledge management
general research
```

They may participate in normal conversations when relevant.

---

## Specialized Skills

These are activated for a specific purpose.

Examples:

```text
JavaScript Tutor
Python Tutor
Linux Administration
Graphic Design
Photoshop
Prompt Engineering
Video Editing
Finance
```

When a specialized skill is active, it should influence the model's behavior and available resources according to that skill's scope.

Example:

```text
JavaScript Tutor active
        ↓
Learning objective
        ↓
JavaScript-focused context
        ↓
Programming exercises
        ↓
Hints
        ↓
Validation
        ↓
Progression
```

The specialized skill must not merely change the model's personality.

It must define an actual workflow.

---

# 14. Exercise System

Exercises must NEVER be automatically created simply because an exercise-related skill exists.

The user must explicitly request exercise generation or activate an exercise workflow.

Correct:

```text
User:
"Start my JavaScript training."

        ↓

Exercise Skill
        ↓
Check current level
        ↓
Select appropriate concept
        ↓
Generate exercise
```

Incorrect:

```text
Exercise section exists
        ↓
AI automatically creates exercises
```

The Exercise Skill should eventually define:

* learning objective;
* current level;
* prerequisite concepts;
* difficulty;
* exercise generation;
* hint levels;
* validation;
* solution disclosure rules;
* progression;
* history;
* mastery tracking.

---

# 15. Model Provider Architecture

Current known providers:

```text
Ollama
llama.cpp
```

Providers must be separated from individual models.

Architecture:

```text
Provider
   ↓
Provider Adapter
   ↓
Available Models
```

Example:

```text
Ollama
├── actual installed model A
├── actual installed model B
└── actual installed model C
```

```text
llama.cpp
├── actual configured model A
└── actual configured model B
```

Do NOT hard-code model names into the UI.

---

# 16. Dynamic Model Discovery

When Evis starts or refreshes provider state:

```text
Evis
 ↓
Provider detection
 ↓
Ollama / llama.cpp
 ↓
Query actual available models
 ↓
Return model list
 ↓
Display real models
```

If the user installs or removes a model outside Evis, Evis should eventually be able to refresh its model list.

The UI must never claim that an uninstalled model exists.

---

# 17. Provider Selection

The user must control provider selection.

Example:

```text
Provider:
[ Ollama ▼ ]

Model:
[ actual discovered model ▼ ]
```

If the user changes:

```text
Ollama
```

to:

```text
llama.cpp
```

the available model list must update.

The user may optionally define a default provider/model.

The default must remain configurable.

---

# 18. Model Router

The application should introduce a model routing abstraction.

Conceptually:

```text
UI
 ↓
Model Service
 ↓
Provider Adapter
 ↓
Provider
 ↓
Selected Model
```

React components must NOT directly contain Ollama or llama.cpp implementation details.

This makes the system replaceable.

Future providers can be added without rewriting the UI.

---

# 19. Context Manager

Before sending a request to a model, Evis should eventually construct relevant context from:

```text
Current conversation
+
Active skills
+
Relevant memory
+
Current project
+
Selected files
+
Knowledge
+
Tool results
```

It must NOT blindly send the entire Evis database to every model request.

---

# 20. Startup Performance Problem

Evis currently appears slow to start, particularly when Internet access is unavailable.

Do not assume the cause.

Investigate first.

Potential causes include:

```text
External network requests
DNS resolution
HTTP timeout
Remote fonts
Remote assets
CDN dependencies
Provider detection
Retry loops
Web APIs
Model discovery
Filesystem scanning
Large JavaScript bundles
Large assets
Development tooling
```

The application must be profiled.

Expected investigation:

```text
Startup
 ↓
Measure
 ↓
Identify blocking operations
 ↓
Classify:
   local
   network
   filesystem
   provider
   rendering
 ↓
Remove unnecessary blocking work
 ↓
Retest offline
```

---

# 21. Offline-First Requirement

Core Evis functionality should work without Internet.

Offline capabilities should include, when configured locally:

* opening Evis;
* conversations;
* local models;
* local memory;
* local knowledge;
* local projects;
* local files;
* installed skills;
* exercises;
* settings.

Internet should be an optional capability, not a prerequisite for launching the application.

---

# 22. Network Isolation

No nonessential network request should block startup.

Prefer:

```text
Application starts
        ↓
Local interface becomes usable
        ↓
Optional services initialize asynchronously
```

rather than:

```text
Application starts
        ↓
Wait for Internet
        ↓
Wait for timeout
        ↓
Finally show UI
```

---

# 23. Loading Strategy

Heavy or optional capabilities should be loaded when needed.

Potential strategy:

```text
Startup
├── Core UI
├── Session
├── Storage
└── Local configuration

On demand
├── Skill
├── Web
├── Terminal
├── Research
├── Media
└── Other tools
```

Do not initialize every possible service at application startup.

---

# 24. Search

Search must remain inside the current workspace.

When the user searches:

```text
Current conversation
        ↓
Search
        ↓
Results update inline
```

Do not:

* replace the entire conversation;
* hide the workspace;
* block the application;
* use decorative search results.

Search can eventually cover:

```text
conversations
projects
knowledge
files
skills
exercises
```

---

# 25. Current UI Features That Should Be Preserved

Do not unnecessarily redesign existing functional UI.

The current interface already provides the basic chat interaction.

Future corrections should focus on:

* real integrations;
* persistence;
* state management;
* tool execution;
* skill activation;
* model discovery;
* performance;
* reliability.

---

# 26. Modern Interaction Requirements

The interface should eventually support:

* text selection;
* copy;
* paste;
* cut;
* keyboard navigation;
* keyboard shortcuts;
* hover states;
* focus states;
* active states;
* disabled states;
* loading states;
* error states;
* success states;
* empty states;
* tooltips;
* expandable sections;
* collapsible panels;
* resizable panels where appropriate;
* drag-and-drop where useful;
* message actions;
* code-block copy;
* file selection;
* model selection;
* provider selection;
* skill selection.

These behaviors must be implemented generically.

Do not create special hard-coded logic for every individual message or component.

---

# 27. Code Copy

AI-generated code blocks should provide an automatic copy action.

Expected behavior:

```text
Code block
   ↓
Copy
   ↓
Clipboard
   ↓
Temporary "Copied" state
   ↓
Return to normal
```

Do not use blocking dialogs.

---

# 28. Voice Input

The composer should eventually support:

```text
Microphone
    ↓
Listening
    ↓
Transcribing
    ↓
Text inserted into composer
    ↓
User reviews
    ↓
User sends
```

Voice input must NOT automatically send the message unless explicitly configured.

---

# 29. Text-to-Speech

AI responses should eventually support:

```text
AI response
    ↓
Play
    ↓
Text-to-Speech service
    ↓
Audio output
```

Speech generation is a separate capability from text generation.

---

# 30. Active Skills UI

The active skills are already represented near the composer.

Do not duplicate the same active skill information in a large additional header.

Keep the conversation header minimal.

---

# 31. Security Is Not Yet the Current Priority

Security architecture is important, but it should be introduced after the fundamental runtime architecture is understood.

Future security work must cover:

* filesystem permissions;
* terminal permissions;
* web permissions;
* tool authorization;
* secret handling;
* process isolation;
* destructive action confirmation;
* skill trust levels;
* provider configuration;
* data protection.

Do not give AI unrestricted OS access by default.

---

# 32. Immediate Implementation Priority

The current implementation should proceed in this order.

## Priority 1 — Persistence

Implement:

```text
Storage Service
 ↓
Conversation persistence
 ↓
Conversation loading
 ↓
Conversation history
```

---

## Priority 2 — Evis Data Root

Define:

```text
logical root
physical path configuration
directory lifecycle
```

---

## Priority 3 — Filesystem Service

Implement controlled:

```text
list
read
write
create
rename
move
delete
search
```

according to permissions.

---

## Priority 4 — Provider Service

Implement:

```text
Provider interface
Ollama adapter
llama.cpp adapter
```

---

## Priority 5 — Dynamic Model Discovery

Implement:

```text
provider
 ↓
discover models
 ↓
return actual models
 ↓
UI selection
```

No hard-coded models.

---

## Priority 6 — Tool System

Create a generic tool interface.

Examples:

```text
Filesystem Tool
Web Search Tool
Terminal Tool
```

Tools must be callable through the application layer.

---

## Priority 7 — Skill Loader

Implement:

```text
discover
validate
load
activate
deactivate
```

for real skill definitions.

---

## Priority 8 — Orchestrator

Connect:

```text
User
 ↓
Session
 ↓
Orchestrator
 ↓
Skills
 ↓
Tools
 ↓
Model
 ↓
Response
```

This is where the current "skills exist only as definitions" problem should be resolved.

---

## Priority 9 — Memory

After persistence is reliable:

```text
Conversation
 ↓
Memory extraction
 ↓
Persistent memory
 ↓
Context retrieval
```

---

## Priority 10 — Startup Optimization

Measure and fix:

* blocking network calls;
* unnecessary initialization;
* large bundles;
* unnecessary assets;
* provider initialization;
* filesystem scanning;
* synchronous operations.

---

# 33. Second Phase — Capabilities To Implement After Stabilization

Once the above foundation works reliably, Evis can progressively receive specialized skills.

Recommended first group:

```text
Coding
Programming Tutor
Exercise System
Web Search
Web Reader
Research
Filesystem
Linux Terminal
Git
Code Review
Debugging
Documentation
```

Then:

```text
Prompt Engineering
Image Generation
Image Editing
Graphic Design
Photoshop
Video Generation
Video Editing
Audio
Voice
```

Then:

```text
Data Analysis
Database
Business Analysis
Market Research
Finance
Investing
Project Management
Product Management
```

Then advanced agent capabilities:

```text
Planning
Tool Discovery
Verification
Error Recovery
Browser Automation
Computer Use
Deep Research
```

These should be added progressively, not all at once.

---

# 34. Specialized Skill Architecture

Every serious skill should eventually have a structure similar to:

```text
skill-name/
├── SKILL.md
├── knowledge/
├── resources/
├── examples/
├── scripts/
└── configuration/
```

Not every skill needs every directory.

The skill should explicitly declare:

```text
name
version
purpose
scope
instructions
dependencies
required tools
optional tools
permissions
configuration
```

---

# 35. Definition of Done for the Stabilization Phase

The stabilization phase is complete when:

* conversations survive application restart;
* Evis has a defined data root;
* File Explorer opens the filesystem workspace;
* filesystem access is implemented through a real service/tool;
* Ollama is detected correctly;
* llama.cpp is detected/configured correctly;
* actual models are discovered dynamically;
* models are not hard-coded;
* provider selection works;
* model selection works;
* skills can actually be discovered and loaded;
* skills can actually be activated;
* tools can actually be exposed to skills;
* the orchestrator can use skills and tools;
* Web access is genuinely connected when configured;
* the AI no longer falsely claims lack of a capability that Evis actually provides;
* offline startup does not unnecessarily wait for network timeouts;
* startup performance has been measured;
* core functionality works without Internet;
* the system does not invent unavailable capabilities.

---

# 36. Important Architectural Principle

Do not confuse:

```text
UI representation
```

with:

```text
system capability
```

For example:

```text
[Web Search]
```

being visible in the UI does NOT mean Web Search exists.

The actual capability exists only when:

```text
UI
 ↓
Application
 ↓
Skill
 ↓
Tool
 ↓
Provider
 ↓
Result
```

is operational.

The same principle applies to:

* memory;
* filesystem;
* models;
* skills;
* exercises;
* projects;
* knowledge;
* terminal;
* Internet;
* voice;
* media.

---

# 37. Development Principle

Before adding a new feature, answer:

1. Where does the feature live?
2. Who owns its state?
3. What service implements it?
4. What tool does it require?
5. What skill uses it?
6. What data does it persist?
7. What permissions does it require?
8. What happens when it is unavailable?
9. What happens offline?
10. How does the UI know its real state?

If these questions cannot be answered, the feature is not architecturally ready.

---

# 38. Current Strategic Goal

The immediate goal is NOT:

> "Make Evis have as many AI features as possible."

The immediate goal is:

> "Make Evis a reliable local AI runtime in which models, skills, tools, memory, storage and projects are actually connected."

Only after this foundation is reliable should Evis grow into a large personal AI environment.

---

# 39. Stabilization Implementation Status & Audit

Below is the verified implementation status of Evis core stabilization components:

| Component | Target State | Current Implementation | Real System Backing |
|---|---|---|---|
| **Chat Interaction** | Functional streaming | Operational (Ollama + llama.cpp) | Direct SSE stream from localhost endpoints |
| **Local Persistence** | Universal across categories | Operational (`useAppStore` + `localStorage`) | `evis_workspace_store_v1` + JSON backup/restore |
| **Offline Startup** | < 100ms, zero network block | Operational | CDN fonts removed, native CSS font stack, 1.2s timeouts |
| **Provider Segregation** | Ollama vs llama.cpp separated | Operational | Scoped provider models, dynamic dropdown switching |
| **Dynamic Discovery** | Real host endpoints probed | Operational | `/ollama/api/tags` & `/llama-cpp/v1/models` |
| **Provider Process Control** | Background launch & monitoring | Operational | `evisBackendPlugin.ts` (`POST /api/provider/start`, `/stop`) |
| **Terminal Integration** | Real Linux bash execution | Operational | `POST /api/terminal/exec` on Linux Parrot host |
| **Filesystem Service** | Real workspace read/write | Under implementation | `server/evisBackendPlugin.ts` `/api/fs/*` |
| **File Explorer Workspace** | Real directory & file navigation | Under implementation | Connect UI to real `/api/fs/list` & `/api/fs/read` |
| **Tool Execution Engine** | Model-callable tools | Under implementation | Orchestrator loop for terminal & fs tools |
| **Voice Input** | Continuous stable transcription | In stabilization | Web Speech API speech service tuning |

---

# 40. Host Process Bridge & Backend Architecture

To allow the browser runtime to manage native Linux OS processes without compromising security or requiring a heavy second server:

```text
Browser (React + Zustand)
       │
       ▼ HTTP /api/*
Vite Server Middleware (evisBackendPlugin.ts)
  ├── /api/terminal/exec   ──> child_process.exec (bash, cwd: /home/junior/Desktop/New-Ag)
  ├── /api/provider/start  ──> child_process.spawn (llama-server / ollama)
  ├── /api/provider/stop   ──> SIGTERM / PID termination
  ├── /api/provider/status ──> Process telemetry & live stderr/stdout logs
  └── /api/fs/*            ──> fs/promises (real workspace file operations)
       │
       ▼ Proxy /ollama & /llama-cpp
Local AI Hosts (:11434 & :8080)
```

### Key Principles:
1. **Process Independence**: Local AI hosts run as independent child processes that can be inspected with standard Linux tools (`ps aux`, `htop`, `kill`).
2. **Crash & Exit Detection**: The backend bridge listens to child `exit` events, updates the provider status, and notifies the UI on next status query.
3. **Log Ring Buffer**: The backend retains the last 100 lines of process logs for live diagnostic inspection in the UI.

---

# 41. Real Filesystem Service & Data Root Specification

### 41.1 Logical Data Root
Evis maintains a logical data structure within the workspace:

```text
/home/junior/Desktop/New-Ag/
├── conversations/    # Append-only conversation session archives
├── knowledge/        # Markdown knowledge cards and distilled decisions
├── projects/         # Project manifests and scoped contexts
├── skills/           # Modular skill packages (SKILL.md, prompts)
├── data/             # Persistent application state
└── src/              # Source code and application assets
```

### 41.2 Filesystem API Contract
The backend bridge exposes:

- `GET /api/fs/list?dir=<relative_path>`
  - Returns directory items: `{ name: string, path: string, isDirectory: boolean, size: number, modifiedAt: string }[]`
  - Prevents directory traversal outside workspace root (`path.resolve` boundary check).
- `GET /api/fs/read?path=<relative_path>`
  - Returns UTF-8 file content: `{ content: string, path: string, size: number }`
- `POST /api/fs/write`
  - Body: `{ path: string, content: string }`
  - Safely writes file and returns `{ success: boolean, size: number }`
- `POST /api/fs/mkdir`
  - Body: `{ path: string }`
  - Creates directory recursively (`{ recursive: true }`)
- `POST /api/fs/delete`
  - Body: `{ path: string }`
  - Deletes file or directory.

---

# 42. Unified Tool Architecture & Orchestration

Models alone cannot interact with the operating system or retrieve external information without application tools:

```text
User Request
    │
    ▼
Orchestrator
    │
    ├── 1. Gathers Active Skills System Prompts
    ├── 2. Injects Available Tool Schemas (Terminal, Filesystem, Web)
    │
    ▼
Local AI Model (Qwen2.5-Coder / Llama / Mistral)
    │
    ├── Generates text response OR
    └── Emits Tool Call: <tool_call>{"tool": "fs_read_file", "path": "package.json"}</tool_call>
    │
    ▼
Application Tool Dispatcher
    ├── Executes tool natively via /api/*
    └── Returns Tool Result: <tool_result>{...}</tool_result>
    │
    ▼
Model synthesizes final response with verified real data
```

---

# 43. Stabilization Phase Completion Checklist

- [x] Conversations persist across browser reloads.
- [x] Startup is 100% offline with zero external network blocking.
- [x] Ollama models detected dynamically.
- [x] llama.cpp detected dynamically on port 8080.
- [x] Background provider launching and process control implemented.
- [x] Real Linux terminal console connected to host bash shell.
- [ ] Real filesystem API implemented (`/api/fs/*`).
- [ ] File Explorer view switched from static mock data to real filesystem service.
- [ ] Tool orchestrator loop connected for model filesystem inspection.
- [ ] Voice input recording tuned to prevent cutoffs and disorderly text insertion.

