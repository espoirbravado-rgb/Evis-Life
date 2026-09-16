# UI Architecture Designer

## Purpose

This skill defines how to design the desktop user interface of a modular local AI workspace.

The goal is not to immediately implement the application.

The goal is to first design a coherent, extensible, desktop-first interface that can serve as the central control surface for:

* local AI models
* conversations
* sessions
* persistent memory
* knowledge
* projects
* skills
* exercises
* files
* terminal tools
* web search
* future external services
* future authentication
* future plugins and integrations

The interface should provide the user with a unified workspace while keeping individual capabilities modular and independently attachable.

The application is designed primarily for Linux.

---

# 1. Core Design Principle

The application must be designed as a **workspace**, not as a collection of unrelated tools.

The user should be able to open one application and interact with different capabilities without manually managing containers, APIs, model servers, databases, or internal services.

Internal infrastructure must remain behind the interface.

The user should think in terms of:

* conversation
* task
* project
* skill
* file
* knowledge
* model
* tool

and not:

* container
* endpoint
* API key
* service process
* internal port
* Docker/Podman configuration

unless the user explicitly opens a developer/system configuration area.

---

# 2. Design Inspiration

The interface may take conceptual inspiration from modern AI workspaces such as:

* ChatGPT
* Gemini
* Antigravity-style AI development environments
* modern IDEs
* knowledge-management applications
* developer tools

Do not copy their interfaces.

Extract useful interaction patterns while designing an independent interface.

Important patterns to consider:

* persistent sidebar
* conversation history
* project/workspace organization
* central conversation area
* contextual tools
* model selection
* attachments
* expandable panels
* task/session state
* command/tool execution feedback
* markdown rendering
* code blocks
* file references
* settings
* activity/status indicators

The final interface must have its own architecture and visual identity.

---

# 3. Primary User Experience

The user should be able to perform the following sequence naturally:

1. Open the application.
2. See current projects, sessions, and recent conversations.
3. Start a new conversation or task.
4. Select or activate one or more skills.
5. Select a local AI model.
6. Work normally.
7. Attach files or reference project files.
8. Allow the active skills to provide specialized instructions/tools.
9. Archive or summarize the conversation.
10. Preserve important knowledge.
11. Start a new conversation without losing relevant context.

The user should not need to understand the internal architecture to use the application.

---

# 4. High-Level Interface Architecture

The interface should be conceptually divided into the following areas:

```text
┌──────────────────────────────────────────────────────────────┐
│ Application Header                                            │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│              │                                               │
│   Sidebar    │              Main Workspace                   │
│              │                                               │
│              │                                               │
│              │                                               │
│              ├───────────────────────────────────────────────┤
│              │              Composer / Input                │
├──────────────┴───────────────────────────────────────────────┤
│ Optional Status / Activity Area                              │
└──────────────────────────────────────────────────────────────┘
```

The exact layout may evolve.

The architecture must remain flexible enough to support:

* single-panel mode
* split-panel mode
* contextual side panels
* file explorer
* skill configuration
* tool execution
* terminal
* knowledge inspection
* project navigation

---

# 5. Main UI Areas

## 5.1 Application Shell

The application shell is responsible for global navigation and persistent UI structure.

It should provide access to:

* conversations
* projects
* skills
* knowledge
* files
* exercises
* settings
* system status

The shell must not contain domain-specific logic.

It should communicate with application services through defined interfaces.

---

## 5.2 Sidebar

The sidebar is the primary navigation area.

Possible sections:

```text
Workspace
├── New Chat
├── Recent
├── Conversations
├── Projects
├── Skills
├── Knowledge
├── Exercises
└── Files
```

Additional sections may be introduced later.

The sidebar should support:

* collapsible state
* search
* recent conversations
* conversation grouping
* project grouping
* active workspace indication
* context menu actions
* archive actions

The sidebar must not assume that every skill is permanently active.

---

# 6. Conversation Interface

The conversation view is the primary interaction surface.

It should support:

* user messages
* assistant messages
* system/tool activity
* markdown
* code blocks
* syntax highlighting
* copy actions
* file references
* generated artifacts
* expandable tool results
* message regeneration
* editing user messages
* conversation branching if supported later
* message timestamps
* contextual actions

The conversation renderer must be independent from the AI model.

The interface must not care whether the response came from:

* Ollama
* another local model
* a remote API
* a future provider

The model provider must be abstracted behind an interface.

---

# 7. Composer

The message composer should support future extensibility.

Potential controls:

```text
[ + ] [ Skill ] [ Model ] [ Tools ] [ Attach ]       [ Send ]
```

Possible capabilities:

* text input
* file attachment
* image attachment
* code attachment
* skill activation
* model selection
* tool selection
* web-search toggle
* execution permission
* context selection

The composer should remain simple by default.

Advanced controls may be hidden behind expandable menus.

---

# 8. Skill System UI

Skills are modular capabilities.

A skill is not necessarily an AI model.

A skill may contain:

* instructions
* domain knowledge
* workflows
* tools
* dependencies
* configuration
* input requirements
* output requirements
* permissions

Example:

```text
Skill: JavaScript Tutor

Purpose:
Provide structured JavaScript practice.

Dependencies:
- Local AI
- Memory

Optional:
- Web Search
- File System

Capabilities:
- generate exercises
- explain concepts
- evaluate attempts
- track progression
```

The UI must allow the user to:

* browse available skills
* inspect a skill
* activate a skill
* deactivate a skill
* inspect dependencies
* inspect required permissions
* configure a skill
* see which skills are active in the current session

---

# 9. Active Skills

The current session should expose its active skills.

Example:

```text
Current Session

Active Skills
─────────────
✓ JavaScript Tutor
✓ File System
○ Web Search
○ Terminal
```

Only active skills should normally contribute their specialized instructions and tools.

The system may automatically recommend a skill based on the current task, but automatic activation should respect user permissions and configuration.

The user must always be able to see which capabilities are active.

---

# 10. Skill Interface Contract

Every skill should expose a predictable interface.

Conceptually:

```text
Skill
├── id
├── name
├── description
├── version
├── instructions
├── capabilities
├── dependencies
├── required_tools
├── optional_tools
├── configuration
├── permissions
├── input_contract
└── output_contract
```

The UI should be able to inspect this metadata without knowing the internal implementation of the skill.

This allows new skills to be added without redesigning the entire application.

---

# 11. Project Workspace

Projects represent persistent areas of work.

Example:

```text
Projects

JavaScript Learning
├── Conversations
├── Exercises
├── Knowledge
├── Files
└── Progress

AI Assistant
├── Architecture
├── Conversations
├── Documentation
└── Source
```

A project may have:

* its own conversations
* its own files
* its own knowledge
* its own active/default skills
* its own configuration
* its own history

The project system should not be coupled to a specific programming language or domain.

---

# 12. Knowledge Interface

Knowledge is persistent information extracted from conversations and other sources.

The UI should distinguish between:

```text
Conversation
     ↓
Temporary interaction

Knowledge
     ↓
Persistent information
```

Knowledge may include:

* notes
* decisions
* summaries
* technical information
* project state
* learning progress
* unresolved problems
* important constraints

The interface should allow the user to:

* browse knowledge
* search knowledge
* inspect source conversation
* update knowledge
* archive knowledge
* remove obsolete knowledge

---

# 13. Conversation Archiving

The application must support a workflow such as:

```text
Active Conversation
       ↓
Archive
       ↓
Analyze Conversation
       ↓
Extract Important Information
       ↓
Create Persistent Knowledge
       ↓
Create Conversation Summary
       ↓
Mark Conversation Archived
```

The system should not blindly copy the entire conversation into future context.

Instead, it should create compact contextual representations.

Example:

```text
conversation/
    conversation.jsonl

knowledge/
    javascript-classes.md

summaries/
    session-014.md
```

The original conversation may remain available for historical inspection.

Future sessions should preferentially use the extracted context rather than the complete conversation history.

---

# 14. File System Integration

The application may eventually interact with the local file system.

The interface should provide a file explorer capable of:

* browsing directories
* opening files
* creating files
* editing files
* renaming files
* deleting files
* creating directories
* attaching files to conversations

File operations must be permission-aware.

The AI must not automatically receive unrestricted access to the entire operating system.

Access should be scoped where possible.

Example:

```text
Project Root
    ↓
AI has access

Home directory
    ↓
Not automatically accessible
```

---

# 15. Terminal Integration

Terminal functionality should be treated as a separate capability.

Possible UI:

```text
Terminal
────────────────────────────

$ npm test

✓ 18 tests passed

────────────────────────────
```

The terminal skill should be independently activatable.

Commands executed by an AI should provide:

* command
* working directory
* execution state
* output
* exit status
* permission requirement

Potentially destructive operations must require explicit confirmation.

---

# 16. Web Search

Web access must be treated as an optional skill/tool.

The local model should remain functional without Internet access.

Conceptually:

```text
Local Model
    │
    ├── Offline → answer from available knowledge
    │
    └── Online → invoke Web Search skill when required
```

The UI should clearly indicate when external information is being requested.

Example:

```text
● Local
● Web enabled
```

or:

```text
Tools
✓ Local files
✓ Memory
✓ JavaScript Tutor
✓ Web Search
```

Web access must not be silently assumed.

---

# 17. Model Selection

The interface should abstract AI providers.

Example:

```text
Model

Ollama
├── qwen2.5-coder
├── llama
└── other local models

Remote
├── Provider A
├── Provider B
└── Provider C
```

The architecture must not depend on a single provider.

The user should be able to configure providers later without redesigning the UI.

Local models should remain first-class citizens.

---

# 18. System Status

The application should expose system state without overwhelming the user.

Possible indicators:

```text
Model      ● Ready
Memory     ● Ready
Skills     ● 2 active
Web        ○ Offline
Terminal   ● Available
Files      ● Available
```

The user should be able to inspect detailed diagnostics when necessary.

Normal operation should not require technical knowledge.

---

# 19. Settings

Settings should be separated from the main workspace.

Potential categories:

```text
Settings
├── General
├── Appearance
├── Models
├── Skills
├── Memory
├── Files
├── Terminal
├── Web
├── Privacy
├── Permissions
└── Advanced
```

Do not expose implementation details unless necessary.

---

# 20. Permissions

Capabilities involving the operating system must have explicit permission boundaries.

Examples:

```text
File System
[✓] Read project files
[✓] Create project files
[ ] Access home directory

Terminal
[✓] Run safe commands
[ ] Execute privileged commands

Web
[ ] Access Internet
```

Permissions should be understandable to a normal user.

---

# 21. Desktop-First Requirements

The initial target is Linux desktop.

The interface should prioritize:

* keyboard navigation
* mouse interaction
* resizable panels
* native desktop window behavior
* efficient use of screen space
* dark/light themes
* persistent workspace state
* file-system integration
* local operation
* low resource overhead where possible

Mobile support is not a priority for the initial architecture.

---

# 22. Architecture Before Implementation

Before writing production UI code, the designer/agent must produce:

1. high-level architecture
2. component hierarchy
3. navigation structure
4. data flow
5. skill integration flow
6. conversation lifecycle
7. memory lifecycle
8. file/tool interaction flow
9. model-provider abstraction
10. permission boundaries

Do not begin by generating large amounts of UI code.

First establish the architecture.

---

# 23. Required Architectural Questions

Before implementation, answer:

### UI

* What are the primary screens?
* Which screens are persistent?
* Which panels are contextual?
* Which components are reusable?

### Skills

* How is a skill discovered?
* How is it activated?
* How is it deactivated?
* How are dependencies resolved?
* How are permissions exposed?

### AI

* How does the UI communicate with the AI layer?
* Can the model provider be replaced?
* How are streaming responses handled?

### Memory

* Where are conversations stored?
* Where is persistent knowledge stored?
* How is old context summarized?
* How is relevant knowledge retrieved?

### Tools

* How are tools registered?
* How does a skill request a tool?
* How are tool permissions checked?
* How are tool results returned to the model?

### Internet

* How is Web access enabled?
* What happens when Internet access is unavailable?
* How are external sources represented?

### Projects

* How are project contexts isolated?
* How are project files connected to conversations?
* Can a project define default skills?

---

# 24. Design Rule: Separation of Concerns

The following layers should remain conceptually separate:

```text
UI
 ↓
Application / Session Layer
 ↓
Skill System
 ↓
Orchestrator
 ↓
AI Provider / Tool Layer
 ↓
Infrastructure
```

Do not allow the UI to directly depend on:

* Ollama internals
* database implementation
* filesystem implementation
* Web API implementation
* terminal implementation

The UI communicates through application interfaces.

---

# 25. Design Rule: Everything Should Be Replaceable

The architecture should allow:

```text
Ollama
   ↓
replaceable

SQLite
   ↓
replaceable

Web Search Provider
   ↓
replaceable

Terminal Backend
   ↓
replaceable

Skill
   ↓
installable / removable
```

Do not create unnecessary hard dependencies between components.

---

# 26. Design Rule: Local First

The application must remain useful without Internet access.

Offline functionality should include at minimum:

* conversations
* local models
* local memory
* projects
* files
* installed skills
* knowledge
* exercises

Online functionality should be additive.

---

# 27. Design Rule: Progressive Complexity

The interface should expose complexity progressively.

Default:

```text
Chat
Projects
Skills
Files
```

Advanced:

```text
Tools
Permissions
Model configuration
Memory configuration
System diagnostics
Provider configuration
```

The user should not be forced to understand the architecture merely to have a conversation.

---

# 28. Skill Development Workflow

When creating a new skill:

```text
1. Define purpose
2. Define responsibilities
3. Define inputs
4. Define outputs
5. Define dependencies
6. Define required tools
7. Define optional tools
8. Define permissions
9. Define UI requirements
10. Define integration interface
11. Test independently
12. Register with Skill Manager
```

A skill should be independently understandable and testable.

---

# 29. UI Development Workflow

When asked to design or implement a feature, follow this order:

```text
Requirement
    ↓
Use Case
    ↓
Component
    ↓
Interface Contract
    ↓
Data Flow
    ↓
Dependency Analysis
    ↓
Architecture
    ↓
Implementation
    ↓
Integration
    ↓
Testing
```

Do not skip directly from requirement to code.

---

# 30. Output Requirements for the UI Architect

When designing the application, produce artifacts in this order:

### A. Architecture Diagram

Show:

* UI
* application layer
* skill manager
* orchestrator
* memory
* AI provider
* tools
* storage
* Web access

### B. Screen Map

Example:

```text
Application
├── Home
├── Chat
├── Projects
├── Skills
├── Knowledge
├── Files
├── Exercises
└── Settings
```

### C. Component Tree

Show the major reusable UI components.

### D. Data Flow

Show how information travels between:

```text
User
→ UI
→ Session
→ Skills
→ Orchestrator
→ Model
→ Tools
→ Response
→ Memory
```

### E. Skill Integration Map

For every skill:

```text
Skill
├── purpose
├── dependencies
├── tools
├── permissions
├── UI surface
└── data flow
```

### F. Implementation Plan

Only after the architecture is accepted should implementation begin.

---

# 31. Current Priority

The current objective is **not** to implement every feature.

The immediate objective is:

> Design the complete UI architecture and establish clean interfaces between the UI and future capabilities.

The first implementation should therefore focus on:

```text
Application Shell
        ↓
Sidebar
        ↓
Conversation Workspace
        ↓
Composer
        ↓
Skill Selector
        ↓
Model Selector
        ↓
Project Context
```

Future functionality may initially appear as inactive or placeholder capabilities.

Example:

```text
Skills
──────────────
✓ JavaScript Tutor
○ Web Search       [not configured]
○ Terminal         [not configured]
○ File Manager     [available]
○ Cybersecurity    [not installed]
```

The interface must be designed so that these capabilities can later be connected without redesigning the entire application.

---

# 32. Final Principle

The application is not a collection of features.

It is a **modular AI workspace**.

The UI is the user's control surface.

Skills provide specialized capabilities.

The orchestrator coordinates those capabilities.

The model provides reasoning and generation.

Memory preserves continuity.

Tools provide interaction with the local and external environment.

The architecture must make these relationships explicit.

Do not hide architectural problems with UI code.

**Understand the system first. Design the interfaces second. Implement third.**
