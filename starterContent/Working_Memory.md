# Evis — Working Memory & Reference Workspace

> **Status:** FOUNDATIONAL SUBSYSTEM
> **Role:** Define Evis's temporary working memory, project workspace, reference graph, context navigation, checkpoints, and lifecycle.
>
> **Relationship with other directives:**
>
> * `Obligatory.md` defines mandatory engineering rules.
> * `Foundation.md` defines the general architecture and core runtime.
> * This document defines how Evis maintains a **dynamic working representation of an ongoing task or project**.
>
> This subsystem exists because the model's context window must not be treated as the complete memory of the project.

---

# 1. Core Idea

Evis must distinguish between:

```text
What the model currently sees
```

and:

```text
Everything Evis knows about the work currently being performed.
```

The model's context is temporary.

The Working Memory Workspace is persistent for the duration of the operation or project session.

Therefore:

```text
MODEL CONTEXT
    ≠
WORKING MEMORY
```

The model may only see a subset of the workspace at a given moment.

The workspace must contain enough structured information for Evis to reconstruct the relevant context whenever necessary.

---

# 2. Why Working Memory Is Necessary

Consider a request such as:

```text
Build a complete web application.
```

The project may eventually contain:

```text
index.html
dashboard.html
login.html
style.css
dashboard.css
auth.js
app.js
api.js
database.js
server.js
...
```

The project may contain thousands or tens of thousands of lines.

It is neither necessary nor desirable to keep every line in the model's active context at every moment.

Instead, Evis should maintain:

```text
GLOBAL PROJECT STATE
        ↓
TASK STRUCTURE
        ↓
REFERENCE GRAPH
        ↓
CURRENT WORKING CONTEXT
```

The model receives the relevant portion.

When it needs something else, Evis retrieves it through references.

---

# 3. The Fundamental Principle

The fundamental principle of this subsystem is:

> **The agent must not depend on remembering where something is. The workspace must remember the relationships between things.**

This distinction is critical.

Bad architecture:

```text
Model remembers:
"I think I need to go back to app.js."
```

Better architecture:

```text
Current Task
    ↓
references
    ↓
app.js
```

The runtime does not ask the model to remember every navigation path.

The workspace records those paths explicitly.

---

# 4. Workspace vs Memory

The Working Memory Workspace is both:

```text
Workspace
```

and:

```text
Temporary structured memory
```

It provides an environment where Evis can represent:

```text
project state
tasks
files
requirements
decisions
dependencies
relationships
checkpoints
current position
next actions
verification state
```

The workspace is not the final project itself.

It is the **working representation of the project and the work being performed on it**.

---

# 5. Two Different Worlds

Evis must conceptually distinguish:

```text
PROJECT WORLD
```

from:

```text
WORKSPACE WORLD
```

### Project World

Contains the actual artifacts:

```text
source files
images
documents
configuration
database
assets
```

### Workspace World

Contains the agent's structured working representation:

```text
tasks
references
state
decisions
dependencies
checkpoints
context
plans
verification
```

Example:

```text
PROJECT WORLD
│
├── src/
│   ├── app.js
│   └── auth.js
│
└── index.html


WORKSPACE WORLD
│
├── tasks/
│   ├── T001
│   └── T002
│
├── references/
│
├── decisions/
│
└── project-state
```

The workspace points toward the real project.

It does not replace it.

---

# 6. Reference-First Architecture

References are the central mechanism of the Working Memory system.

Every important workspace object should have a stable identity.

Examples:

```text
project:evis
task:T001
task:T002
file:src/app.js
file:src/auth.js
requirement:R001
decision:D003
checkpoint:C004
resource:javascript-guide
```

These identifiers allow Evis to create relationships.

---

# 7. Reference Graph

The workspace must maintain relationships between objects.

Conceptually:

```text
PROJECT
   │
   ├── contains → TASK
   │                 │
   │                 ├── modifies → FILE
   │                 │
   │                 ├── depends_on → TASK
   │                 │
   │                 ├── requires → REQUIREMENT
   │                 │
   │                 ├── references → RESOURCE
   │                 │
   │                 └── next → TASK
   │
   └── contains → MODULE
```

The workspace therefore behaves as a graph.

Example:

```text
task:T023
    │
    ├── modifies → file:src/core/resolver.js
    ├── requires → capability-registry
    ├── depends_on → task:T021
    ├── references → requirement:R014
    ├── follows → task:T022
    └── next → task:T024
```

This graph is more important than simply storing large amounts of text.

---

# 8. Reference Types

The initial reference system should support relationships such as:

```text
contains
references
depends_on
requires
implements
modifies
creates
reads
blocks
blocked_by
follows
next
previous
derived_from
verified_by
related_to
```

The system should remain extensible.

New relationship types must not require rewriting the entire memory system.

---

# 9. Project State

Every active project should have a global state.

Conceptually:

```json
{
  "projectId": "project:evis",
  "status": "in_progress",
  "currentTask": "task:T023",
  "previousTask": "task:T022",
  "nextTask": "task:T024",
  "activeContext": [],
  "checkpoints": [],
  "updatedAt": "..."
}
```

The exact data model may differ.

The important requirement is that Evis can answer:

```text
Where am I?
What am I doing?
What have I completed?
What remains?
What should happen next?
What do I need to load?
```

without relying exclusively on the conversational context.

---

# 10. Task Representation

Large projects must be decomposable into tasks.

A task should contain enough structured information to reconstruct its working context.

Conceptually:

```json
{
  "id": "task:T023",
  "objective": "Implement capability resolution",
  "status": "in_progress",
  "files": [],
  "dependencies": [],
  "requirements": [],
  "references": [],
  "decisions": [],
  "nextTasks": [],
  "verification": [],
  "checkpoint": null
}
```

A task is not merely a TODO item.

It is a **contextual unit of work**.

---

# 11. Task Hierarchy

Tasks may be hierarchical.

Example:

```text
PROJECT
│
└── Authentication
    │
    ├── Design authentication architecture
    │
    ├── Implement login
    │
    ├── Implement session handling
    │
    └── Test authentication
```

This allows Evis to move between:

```text
global project
    ↓
module
    ↓
task
    ↓
subtask
    ↓
specific file
```

and return upward when necessary.

---

# 12. Navigation

The workspace must allow Evis to navigate between contexts.

Example:

```text
PROJECT
 ↓
MODULE
 ↓
TASK
 ↓
FILE
 ↓
FUNCTION
```

and back:

```text
FUNCTION
 ↑
FILE
 ↑
TASK
 ↑
MODULE
 ↑
PROJECT
```

The navigation relationship must be represented explicitly.

The model should not have to rediscover the project hierarchy every time it changes context.

---

# 13. Current Working Context

At any moment, Evis has a limited active context.

Conceptually:

```text
Working Context
├── current task
├── parent task
├── relevant files
├── relevant requirements
├── relevant decisions
├── relevant dependencies
├── immediate next actions
└── required tool information
```

The context should be small enough to remain useful to the selected model.

---

# 14. Context Loading

When Evis enters a new task, the Context Manager should use workspace references to determine what to load.

Example:

```text
task:T023
    ↓
references
    ↓
resolver.js
capability-registry
requirement:R014
decision:D003
task:T021
```

The Context Manager loads the relevant objects.

It does not need to load:

```text
every file
every conversation
every skill
every task
every historical decision
```

---

# 15. Context Expansion

The model may discover that additional information is required.

For example:

```text
Current Task:
modify resolver.js

Model:
I need to inspect capability definitions.
```

The runtime follows:

```text
resolver.js
    ↓
references
    ↓
capability-registry
```

and loads the referenced resource.

This creates controlled context expansion.

---

# 16. Context Contraction

The opposite operation is equally important.

When Evis leaves a context, information that is no longer necessary should be removed from the active model context.

The information is not necessarily deleted.

Instead:

```text
ACTIVE CONTEXT
      ↓
STORE / INDEX
      ↓
REFERENCE
```

Later it can be restored.

Therefore:

```text
context removal
    ≠
information deletion
```

---

# 17. Working Memory Eviction

The workspace must support controlled removal of information from active context.

Possible reasons:

```text
context too large
task changed
information no longer relevant
new higher-priority information required
model context limit
resource cost
```

Eviction should be based on relevance rather than arbitrary deletion.

Potential priority levels:

```text
CRITICAL
HIGH
NORMAL
LOW
ARCHIVED
```

---

# 18. Reconstruction

A fundamental capability of Working Memory is **context reconstruction**.

Suppose:

```text
Task T023
```

was active yesterday.

The model does not need to remember it.

Evis should be able to reconstruct:

```text
T023
 ↓
parent task
 ↓
project
 ↓
required files
 ↓
requirements
 ↓
decisions
 ↓
dependencies
 ↓
previous results
 ↓
next action
```

and create a new working context.

This is what makes the workspace more powerful than simple conversation history.

---

# 19. Checkpoints

A checkpoint represents a stable state of work.

Conceptually:

```text
Checkpoint C003

project state
current task
completed work
modified files
important decisions
verification results
known problems
next task
references
```

Example:

```text
T023 completed
 ↓
C003 created
 ↓
next = T024
```

Checkpoints allow Evis to pause safely.

---

# 20. Pause and Resume

Evis must support controlled pauses.

Example:

```text
Agent working
      ↓
checkpoint
      ↓
state persisted
      ↓
pause
      ↓
user confirmation
```

Later:

```text
resume
   ↓
load checkpoint
   ↓
reconstruct context
   ↓
continue task
```

The model does not need to remember the entire previous context.

The workspace reconstructs it.

---

# 21. Intermediate State

Evis must distinguish:

```text
completed
```

from:

```text
in_progress
```

and:

```text
blocked
```

and:

```text
failed
```

and:

```text
paused
```

Example:

```text
task:T023
status: paused
checkpoint:C003
nextAction: inspect resolver tests
```

This prevents the system from falsely assuming that a partially completed task is finished.

---

# 22. Large Project Decomposition

For sufficiently large projects, Evis may determine that the entire project should not be treated as one active context.

Instead:

```text
PROJECT
│
├── SECTION A
│
├── SECTION B
│
├── SECTION C
│
└── SECTION D
```

Each section becomes a manageable working domain.

Example:

```text
Project
│
├── Architecture
├── Frontend
├── Backend
├── Database
└── Testing
```

The workspace keeps the global references between them.

---

# 23. Global Context Must Survive Decomposition

Decomposition must never mean losing the global project.

If Evis is currently inside:

```text
Frontend
```

it must still be able to reach:

```text
Project
Architecture
Backend dependencies
Global requirements
```

through references.

Therefore:

```text
LOCAL CONTEXT
    ↕
REFERENCE GRAPH
    ↕
GLOBAL PROJECT STATE
```

The local working context is a window into the larger project.

---

# 24. Global vs Local Context

Evis should conceptually maintain:

```text
GLOBAL CONTEXT
```

and:

```text
LOCAL CONTEXT
```

### Global Context

Contains:

```text
project objective
major architecture
global requirements
major decisions
overall progress
global constraints
```

### Local Context

Contains:

```text
current task
current files
local requirements
local dependencies
immediate decisions
next operations
```

The model normally receives a combination of both:

```text
Relevant Global Context
+
Local Working Context
```

not the entire project.

---

# 25. Memory Priority

Not every information has equal value.

The workspace should classify information according to its importance.

Example:

```text
CRITICAL
  architecture decisions
  security constraints
  irreversible decisions
  active task state

HIGH
  current dependencies
  relevant requirements
  current file relationships

NORMAL
  recent tool results
  recent intermediate reasoning

LOW
  obsolete temporary information
  redundant historical context
```

This allows context construction to prioritize what matters.

---

# 26. Tool Results and Working Memory

Tool results should be integrated into the workspace when they matter for future work.

Example:

```text
Filesystem Tool
 ↓
reads resolver.js
 ↓
result
 ↓
Task T023
 ↓
workspace reference
```

Not every tool result must be permanently retained.

The runtime should determine whether the result is:

```text
temporary
relevant
important
checkpoint-worthy
project state
```

---

# 27. Decisions

Important decisions should be represented explicitly.

Example:

```json
{
  "id": "decision:D003",
  "decision": "Use provider registry instead of hard-coded provider selection",
  "reason": "...",
  "relatedTasks": ["task:T021", "task:T023"],
  "status": "active"
}
```

This prevents Evis from repeatedly rediscovering the same architectural decisions.

---

# 28. Requirements

Requirements should also have stable identities.

Example:

```text
requirement:R014
```

A task can then reference it:

```text
task:T023
    ↓
requires
    ↓
requirement:R014
```

This allows Evis to verify whether the implementation still satisfies the original requirement.

---

# 29. Verification State

The workspace should retain verification information.

Example:

```text
task:T023
    ↓
implemented
    ↓
tested
    ↓
verified
```

A more detailed state could be:

```text
implementation: complete
tests: passed
integration: passed
verification: passed
```

This prevents a model from treating:

```text
"I wrote the code."
```

as equivalent to:

```text
"The feature is verified."
```

---

# 30. Reference Integrity

References must be validated.

A reference should not silently point to an object that no longer exists.

If:

```text
task:T023
    ↓
references
    ↓
file:src/resolver.js
```

and the file is renamed:

```text
src/core/resolver.js
```

the workspace must update or invalidate the relationship.

Broken references must be detectable.

---

# 31. File Identity

Physical file paths and logical file identities should be distinguishable.

Example:

```text
Logical identity:
file:resolver

Physical path:
src/core/resolver.js
```

This allows the workspace to survive controlled file moves or refactoring.

The exact identity mechanism must be designed carefully before implementation.

---

# 32. Workspace Storage

The workspace must have a dedicated storage boundary.

Conceptually:

```text
Evis Data Root
│
└── workspaces/
    │
    └── project-evis/
        │
        ├── state
        ├── tasks
        ├── references
        ├── decisions
        ├── checkpoints
        └── indexes
```

The exact format may be:

```text
database
structured files
hybrid storage
```

The implementation must be selected according to actual requirements.

The architecture must not assume that thousands of independent files are automatically the best storage mechanism.

---

# 33. In-Memory Cache

During an active operation, frequently accessed workspace objects may be cached in memory.

Conceptually:

```text
Persistent Workspace
        ↓
Memory Cache
        ↓
Active Working Context
        ↓
Model
```

This provides fast navigation without making the persistent workspace itself the model context.

The cache is temporary.

---

# 34. Cache Lifecycle

The cache should support:

```text
load
use
update
evict
reconstruct
flush
clear
```

Information should be removed from the cache when it is no longer useful.

But clearing the cache must not destroy persistent project state.

---

# 35. Workspace Lifecycle

The working workspace should follow a clear lifecycle:

```text
CREATE
  ↓
INITIALIZE
  ↓
POPULATE
  ↓
ACTIVE
  ↓
CHECKPOINT
  ↓
RESUME / CONTINUE
  ↓
COMPLETE
  ↓
FINALIZE
  ↓
RELEASE TEMPORARY WORKING MEMORY
```

---

# 36. End of Project

The temporary working memory exists to help complete the project.

When the project reaches its final completion state:

```text
Project
 ↓
verified
 ↓
completed
 ↓
workspace finalized
```

The temporary working memory should be released.

This does **not** mean deleting valuable project information.

The following may remain:

```text
final project
important decisions
final architecture
relevant knowledge
final documentation
project history where required
```

Temporary execution structures may be removed.

---

# 37. Memory Cleanup

The system must distinguish between:

```text
temporary working state
```

and:

```text
valuable persistent knowledge
```

At project completion:

```text
Temporary:
  active context
  transient tool results
  temporary navigation state
  intermediate execution data
```

may be released.

While:

```text
Persistent:
  project
  final architecture
  important decisions
  final requirements
  final documentation
```

may remain.

---

# 38. No Arbitrary Memory Explosion

The Working Memory system must not create unbounded data simply because the project is large.

The system should prefer:

```text
references
indexes
summaries
structured state
existing project files
```

over duplicating entire files unnecessarily.

For example, if a 50 KB file already exists in the project, the workspace should generally reference it rather than create another permanent 50 KB copy merely to remember it.

---

# 39. Memory Budget

The workspace should eventually expose configurable limits such as:

```text
maximum active context
maximum cache size
maximum temporary workspace size
maximum retained tool results
```

The exact values should not be hard-coded prematurely.

The system should measure actual usage before introducing arbitrary limits.

---

# 40. Automatic Context Management

Evis should eventually be able to determine:

```text
What should remain active?
What can be evicted?
What should be retrieved?
What should be summarized?
What should remain only as a reference?
```

This decision should combine:

```text
relevance
task dependency
recency
importance
current goal
model context capacity
verification needs
```

---

# 41. Example: Five-Thousand-Line Project

Suppose a project contains:

```text
5,000 lines
```

Evis does not necessarily load all 5,000 lines.

It may construct:

```text
GLOBAL
├── architecture
├── requirements
└── task graph

LOCAL
├── current task
├── current files
├── related files
└── current verification
```

When another file becomes relevant:

```text
reference
 ↓
retrieve
 ↓
active context
```

When it becomes irrelevant:

```text
active context
 ↓
evict
 ↓
reference remains
```

---

# 42. Example: Ten-Thousand-Line Project

For a larger project:

```text
10,000+ lines
```

Evis may create sections:

```text
Project
│
├── Architecture
├── Frontend
├── Backend
├── Database
├── Infrastructure
└── Testing
```

The active context may contain only:

```text
Current Section
+
Current Task
+
Relevant Global Context
+
Referenced Dependencies
```

The remaining sections stay represented in the workspace graph.

---

# 43. Example of Autonomous Navigation

Suppose Evis is implementing:

```text
index.html
```

The workspace contains:

```text
task:T010
    │
    ├── modifies → file:index.html
    ├── references → requirement:R004
    ├── depends_on → task:T006
    └── next → task:T011
```

During implementation, Evis discovers that `index.html` depends on:

```text
style.css
app.js
```

Those relationships are added:

```text
file:index.html
    ├── references → file:style.css
    └── references → file:app.js
```

When `T010` is completed:

```text
T010
 ↓
verification
 ↓
completed
 ↓
next = T011
```

Evis can move to `T011` without relying on conversational memory to remember what comes next.

---

# 44. Returning to the Global Architecture

Suppose Evis is deep inside:

```text
function
 ↓
file
 ↓
task
 ↓
frontend
```

but discovers a contradiction with the global architecture.

The reference graph must allow:

```text
function
 ↑
file
 ↑
task
 ↑
frontend
 ↑
project
 ↑
architecture
```

Evis can therefore retrieve the architectural context and reconsider the implementation.

This is essential.

Local optimization must never permanently isolate the agent from global project intent.

---

# 45. Reference-Driven Continuation

At every meaningful task transition, the workspace should know:

```text
current
previous
parent
dependencies
related
next
blocked
```

Therefore the agent can navigate:

```text
current task
    ↓
finish
    ↓
verification
    ↓
next reference
    ↓
new task
```

rather than relying on:

```text
"I hope the model remembers what it wanted to do next."
```

---

# 46. Interaction with the Orchestrator

The Working Memory subsystem does not replace the Orchestrator.

The relationship is:

```text
Orchestrator
      │
      ├── asks Working Memory:
      │      "What is the current state?"
      │
      ├── asks Context Manager:
      │      "What context should be loaded?"
      │
      └── updates Working Memory:
             "This task changed state."
```

The Orchestrator coordinates execution.

Working Memory maintains the structured state of the work.

---

# 47. Interaction with Context Manager

The Context Manager consumes Working Memory.

```text
Working Memory
      ↓
Reference Resolution
      ↓
Relevant Objects
      ↓
Context Construction
      ↓
Model
```

The Context Manager decides what should enter the model's context.

Working Memory determines what exists and how it is related.

---

# 48. Interaction with Tools

Tools should be able to produce results that the workspace can reference.

Example:

```text
Filesystem Tool
 ↓
file.read
 ↓
Tool Result
 ↓
Working Memory
 ↓
task:T023
```

The workspace can record:

```text
task:T023
    ↓
observed
    ↓
file:resolver.js
```

This allows future reasoning to know that the file was previously inspected.

---

# 49. Interaction with Skills

Skills may declare useful workspace behavior.

For example:

```text
Software Engineering Skill
    ↓
uses:
  project tasks
  file references
  requirements
  verification state
```

But the skill must not become the owner of Working Memory.

Working Memory is a core runtime subsystem.

---

# 50. Interaction with Persistence

Working Memory uses persistence but is not identical to persistence.

```text
Persistence
    ↓
stores data

Working Memory
    ↓
organizes active work
```

Persistence answers:

```text
Can I retrieve this later?
```

Working Memory answers:

```text
What does this information mean for the current work?
What is connected to it?
What should I load next?
```

---

# 51. Interaction with Long-Term Memory

Long-term memory and Working Memory must remain distinct.

```text
Long-Term Memory
    ↓
stable information across work

Working Memory
    ↓
temporary state of current work
```

At project completion, valuable information may be promoted from Working Memory into long-term project knowledge.

Temporary navigation state should not automatically become permanent memory.

---

# 52. State Promotion

Potential lifecycle:

```text
Temporary observation
        ↓
Task information
        ↓
Important decision
        ↓
Project knowledge
```

For example:

```text
Tool Result
 ↓
"Provider A does not support this capability."
 ↓
Decision D014
 ↓
Project architecture knowledge
```

Only information that has lasting value should be promoted.

---

# 53. Recovery

If the application crashes during:

```text
task:T023
```

Evis should be able to recover from the latest valid checkpoint or persisted state.

Recovery should determine:

```text
last known state
current task
modified files
known results
next safe action
```

It must not blindly assume that the last operation succeeded.

---

# 54. Crash Safety

Workspace updates involving critical state should be written atomically or through a mechanism that prevents partial state corruption.

For example:

```text
update task state
update current pointer
update checkpoint
```

must not leave the system believing:

```text
task completed
```

when the associated implementation was never committed or verified.

The exact transactional mechanism must be selected during implementation.

---

# 55. Consistency

The workspace is a representation of reality.

Therefore it must not become a fictional description of the project.

If the workspace says:

```text
task:T023 = completed
```

there must be evidence supporting that state.

If:

```text
file:resolver.js
```

does not exist anymore, its references must be updated.

If a provider becomes unavailable, provider-related workspace state must not continue to claim that it is available.

---

# 56. No Fake Memory

The following are not sufficient implementations:

```text
a giant system prompt
```

```text
one JSON blob containing everything
```

```text
conversation history pretending to be project state
```

```text
hard-coded next task
```

```text
regex-based navigation
```

```text
a list of filenames without relationships
```

```text
random summaries without stable references
```

The workspace must contain **structured state and relationships**.

---

# 57. No Forced Full Reload

Evis must not solve context limitations by repeatedly loading the entire project.

Bad:

```text
Every operation
 ↓
read every project file
 ↓
send everything to model
```

Preferred:

```text
current task
 ↓
references
 ↓
relevant resources
 ↓
load only what is needed
```

Full-project analysis may be performed when explicitly required and when resources permit it, but it must not be the default strategy.

---

# 58. Reference Resolution Performance

Reference navigation should be efficient enough for frequent use.

The implementation should consider:

```text
indexes
caching
lookup tables
database indexes
dependency graphs
```

The exact optimization should follow measured bottlenecks.

Do not prematurely create a complex graph database merely because the architecture contains a graph.

---

# 59. Workspace Size

The workspace must remain bounded and manageable.

The system should monitor:

```text
workspace size
cache size
active context size
reference count
temporary result count
```

Large project size alone must not cause uncontrolled duplication.

---

# 60. Completion and Cleanup

When a project is truly complete:

```text
all required tasks
        ↓
verified
        ↓
project complete
```

Evis should:

```text
finalize project state
create final checkpoint if useful
promote important knowledge
release temporary working cache
release temporary execution structures
```

The project itself remains intact.

The workspace is then either:

```text
archived
```

or:

```text
cleaned while retaining necessary project metadata
```

according to the chosen persistence policy.

---

# 61. Session End vs Project End

These are different events.

### Session End

The user closes Evis or pauses work.

The workspace must remain recoverable.

```text
session ends
 ↓
workspace persists
```

### Project End

The project is genuinely completed.

Temporary working memory can be released.

```text
project completed
 ↓
workspace finalized
 ↓
temporary working memory released
```

Never confuse the two.

---

# 62. Minimum Core Components

The initial Working Memory implementation should eventually contain:

```text
WorkingMemoryManager
WorkspaceStore
ReferenceGraph
TaskManager
ProjectStateManager
ContextLoader
ContextCache
CheckpointManager
WorkspaceRecovery
```

These names are conceptual.

Existing project architecture must be inspected before creating duplicate implementations.

---

# 63. Minimum Interfaces

Conceptually, the system should expose operations similar to:

```js
workspace.create()
workspace.load()
workspace.close()

project.getState()
project.updateState()

task.create()
task.get()
task.update()
task.complete()
task.pause()

reference.create()
reference.resolve()
reference.remove()
reference.related()

context.load()
context.expand()
context.release()

checkpoint.create()
checkpoint.load()
checkpoint.list()

workspace.recover()
workspace.finalize()
```

The actual interfaces may differ after architecture inspection.

---

# 64. First Implementation Target

Do not attempt to build the entire memory system simultaneously.

The first vertical slice should prove:

```text
Create project
 ↓
Create task
 ↓
Create file reference
 ↓
Create task → file relationship
 ↓
Set current task
 ↓
Load relevant context
 ↓
Update task state
 ↓
Create checkpoint
 ↓
Resume from checkpoint
```

If this works, the foundation of Working Memory exists.

---

# 65. First Reference Test

A minimal test scenario:

```text
Project:
Evis Test Project

Tasks:
T001
T002
T003

Files:
index.html
style.css
app.js
```

Relationships:

```text
T001
 ↓
creates → index.html
 ↓
next → T002

T002
 ↓
modifies → style.css
 ↓
next → T003

T003
 ↓
modifies → app.js
```

The runtime must be able to:

```text
start T001
complete T001
resolve next
load T002
complete T002
resolve next
load T003
```

without hard-coded task navigation.

---

# 66. Large Context Test

Create a test project large enough that loading everything into the model context is undesirable.

Verify that Evis can:

```text
identify relevant section
load relevant references
work locally
return to global context
continue to another section
```

without losing project state.

---

# 67. Resume Test

Test:

```text
start task
 ↓
modify project
 ↓
checkpoint
 ↓
stop application
 ↓
restart
 ↓
recover workspace
 ↓
reconstruct context
 ↓
continue
```

The result must demonstrate that continuation does not depend on the previous model conversation remaining active.

---

# 68. Reference Integrity Test

Test:

```text
create reference
 ↓
move/rename referenced file
 ↓
update identity/path
 ↓
resolve reference
```

Then test a deleted object.

The system must detect:

```text
broken reference
```

rather than silently producing incorrect context.

---

# 69. Memory Eviction Test

Test:

```text
load context A
 ↓
switch to context B
 ↓
evict A from active cache
 ↓
return to A
 ↓
reconstruct A
```

The information should remain recoverable.

---

# 70. Completion Test

Test:

```text
project starts
 ↓
tasks created
 ↓
tasks completed
 ↓
verification
 ↓
project marked complete
 ↓
temporary workspace state released
```

Verify that the final project remains intact.

---

# 71. Definition of Done

The Working Memory subsystem is not complete because:

```text
a memory folder exists
```

or:

```text
a database contains JSON objects
```

It is complete only when Evis can genuinely:

```text
[ ] Represent an active project.
[ ] Represent tasks and subtasks.
[ ] Assign stable identities.
[ ] Create relationships between objects.
[ ] Navigate those relationships.
[ ] Maintain global project state.
[ ] Maintain local working state.
[ ] Load relevant context.
[ ] Expand context through references.
[ ] Release irrelevant active context.
[ ] Reconstruct previous context.
[ ] Create checkpoints.
[ ] Resume from checkpoints.
[ ] Recover after application restart.
[ ] Track task state honestly.
[ ] Track verification state.
[ ] Detect broken references.
[ ] Avoid unnecessary duplication.
[ ] Keep the model context smaller than the entire project when appropriate.
[ ] Preserve access to global project intent from local contexts.
[ ] Finalize and release temporary working memory when the project is complete.
```

---

# 72. Final Model

The complete concept can be represented as:

```text
                         EVIS PROJECT
                              │
                       GLOBAL PROJECT STATE
                              │
                    ┌─────────┴─────────┐
                    │                   │
               TASK GRAPH          KNOWLEDGE
                    │
          ┌─────────┼─────────┐
          │         │         │
       Task A    Task B    Task C
          │         │         │
       refs      refs      refs
          │         │         │
       Files     Files     Files
          │         │         │
          └─────────┼─────────┘
                    │
              REFERENCE GRAPH
                    │
             CURRENT WORKSPACE
                    │
          ┌─────────┴─────────┐
          │                   │
    Global Context       Local Context
          │                   │
          └─────────┬─────────┘
                    │
              CONTEXT MANAGER
                    │
                    ↓
                  MODEL
                    │
              TOOL / PROVIDER
                    │
                    ↓
                 RESULT
                    │
                    ↓
             WORKING MEMORY
                    │
          UPDATE STATE / REFS
                    │
                    ↓
               NEXT ACTION
```

---

# 73. Final Principle

The Working Memory system must not attempt to make the model **remember everything**.

It must make Evis capable of **finding anything relevant when it needs it**.

The distinction is fundamental:

```text
Bad goal:

"Make the model remember the entire project."

Better goal:

"Make the project understandable and navigable through structured state and references."
```

The model should be able to move:

```text
GLOBAL
  ↓
SECTION
  ↓
TASK
  ↓
FILE
  ↓
DETAIL
  ↑
FILE
  ↑
TASK
  ↑
SECTION
  ↑
GLOBAL
```

without losing the larger objective.

The workspace therefore acts as an external working memory, while the reference graph acts as the navigation system connecting its pieces.

The model does not need to carry the entire project.

**Evis carries the structure.**

The model reasons over the relevant portion of that structure.

---

# 74. Architectural Invariant

The following invariant must remain true:

> **No important continuation of work should depend solely on the model remembering something that can be represented as structured project state or a reference.**

If Evis needs to know:

```text
what comes next
what depends on this
what file belongs to this task
why this decision was made
what was completed
what remains
where to return
what context must be loaded
```

the answer should exist in the workspace or be recoverable through its references.

This is the purpose of Working Memory.

---

# 75. End State

The final objective is not to create a giant temporary database.

It is to create a **small, structured, navigable working representation of a potentially enormous project**.

```text
Huge Project
     ↓
Structured Workspace
     ↓
References
     ↓
Relevant Context
     ↓
Model
     ↓
Action
     ↓
Result
     ↓
Workspace Update
     ↓
Next Reference
     ↓
Next Context
```

The workspace grows according to the complexity of the work, not according to the amount of text that can be blindly copied.

When the project is finished:

```text
work completed
     ↓
state finalized
     ↓
important knowledge retained
     ↓
temporary working memory released
```

The project survives.

The temporary cognitive workspace does not need to.
