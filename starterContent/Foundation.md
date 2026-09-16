# Evis — Foundation & Core Architecture

> **Status:** FOUNDATIONAL
> **Role:** Define the initial technical foundation, domain model, core runtime, registries, boundaries, and construction order of Evis.
> **Relationship with `Obligatory.md`:** This document defines **what Evis must be structurally built around**. `Obligatory.md` defines **the rules that must govern the implementation process**.
>
> This document must not be interpreted as a collection of optional ideas. It defines the architectural baseline from which the rest of Evis must be implemented.

---

# 1. Purpose

Evis must be built as a **local-first intelligent runtime**, not as a collection of independent frontend features.

The project must have a clear separation between:

```text
Interface
Application State
Intelligence / Orchestration
Capabilities
Skills
Tools
Providers
Infrastructure
Persistence
Security / Policy
```

The purpose of this foundation is to prevent:

* duplicated implementations;
* hidden dependencies;
* frontend features pretending to be backend capabilities;
* hard-coded routing;
* skills becoming giant prompts;
* tools becoming uncontrolled scripts;
* providers being hard-coded into individual features;
* models being treated as the entire AI system;
* persistence being scattered throughout the application;
* future features requiring modifications everywhere.

The foundation must make future capabilities **additive**.

Adding a new capability should primarily mean:

```text
register capability
+
provide implementation
+
declare dependencies
+
declare permissions
+
register compatible providers/tools/skills
```

It should not require rewriting the core runtime.

---

# 2. Evis Mental Model

Evis is composed of several distinct concepts.

They must never be treated as interchangeable.

```text
User
  ↓
Request
  ↓
Goal
  ↓
Capability
  ↓
Resource Resolution
  ↓
Execution Plan
  ↓
Tool / Provider
  ↓
Real Execution
  ↓
Result
  ↓
Reasoning / Verification
  ↓
Response
```

The central principle is:

> **The model reasons about what should happen; the runtime determines what can actually happen.**

The model must not become the security boundary, filesystem boundary, network boundary, or execution boundary.

---

# 3. Core Domain Objects

The following concepts form the Evis domain model.

## 3.1 Request

A request represents what the user asked Evis to do.

Example:

```text
"Create an image of a futuristic city."
```

A request is not yet a capability.

---

## 3.2 Goal

A goal represents the intended outcome extracted from a request.

Example:

```text
Goal:
  type: create_image
  subject: futuristic city
```

The goal describes **what the user wants**, not how it should be accomplished.

---

## 3.3 Capability

A capability represents something Evis is able to accomplish.

Examples:

```text
image.generate
image.edit
file.read
file.write
file.search
web.search
terminal.execute
code.execute
code.test
audio.transcribe
```

A capability must be identifiable independently from:

* a UI button;
* a skill;
* a specific model;
* a specific provider;
* a specific implementation.

---

## 3.4 Skill

A skill is a packaged domain capability that helps Evis perform a class of tasks.

A skill may contain:

```text
metadata
instructions
knowledge
resources
capabilities
tool requirements
provider requirements
dependencies
configuration
permissions
activation state
```

A skill is **not itself an executable tool**.

A skill can tell Evis:

> "For this type of task, these capabilities, resources, tools and reasoning procedures are useful."

It must not directly obtain unauthorized access to those resources.

---

## 3.5 Tool

A tool performs an actual operation.

Examples:

```text
FilesystemTool
TerminalTool
WebTool
ImageGenerationTool
BrowserTool
DatabaseTool
```

A tool must have an explicit contract.

Example:

```text
FilesystemTool

Capabilities:
  file.read
  file.write
  file.create
  file.modify
  file.delete
  file.search
```

Tools are execution boundaries.

---

## 3.6 Provider

A provider supplies a service or execution backend.

Examples:

```text
Ollama
llama.cpp
Remote LLM API
Search API
Image API
Speech API
```

A provider is not automatically a capability.

A provider becomes useful only when it exposes compatible capabilities.

---

## 3.7 Model

A model is a reasoning or generation component provided by a provider.

Examples:

```text
qwen2.5-coder:14b
other local model
remote model
```

Models must be dynamically discoverable where the provider supports discovery.

The architecture must not assume that one model is permanently responsible for all tasks.

---

## 3.8 Resource

A resource is information available to the runtime.

Examples:

```text
conversation
file
project
knowledge document
skill resource
configuration
cached result
exercise
```

Resources are not necessarily executable.

---

## 3.9 Dependency

A dependency represents something required by another component.

Examples:

```text
Skill → Capability
Skill → Tool
Tool → Provider
Capability → Provider
Provider → Configuration
Tool → Permission
```

Dependencies must be explicit.

---

## 3.10 Permission

A permission determines whether an operation is allowed.

Examples:

```text
filesystem.read
filesystem.write
terminal.execute
network.access
external_ai.send_context
external_api.use
```

Permission evaluation must happen outside the model.

---

# 4. Core Registries

Evis requires registries because the runtime must discover what exists instead of relying on hard-coded knowledge.

At minimum:

```text
Capability Registry
Tool Registry
Provider Registry
Skill Registry
Resource Registry
```

Each registry is responsible for discovering and describing one category of system component.

---

# 5. Capability Registry

The Capability Registry is the authoritative catalogue of what Evis can do.

Initial structure:

```text
Capability Registry
├── file.read
├── file.write
├── file.create
├── file.modify
├── file.delete
├── file.search
├── web.search
├── web.open
├── terminal.execute
├── image.generate
├── image.edit
├── audio.transcribe
├── audio.generate
├── video.generate
├── code.analyze
├── code.execute
└── code.test
```

The registry must contain metadata describing each capability.

Conceptually:

```js
{
  id: "file.read",
  description: "Read an authorized file",
  inputSchema: {},
  outputSchema: {},
  requiredPermissions: ["filesystem.read"],
  compatibleTools: [],
  compatibleProviders: []
}
```

The exact implementation may differ.

The important requirement is that capabilities have **stable identities and contracts**.

---

# 6. Tool Registry

The Tool Registry describes actual executable tools.

Example:

```text
Filesystem Tool
Terminal Tool
Web Tool
Image Tool
Database Tool
```

A tool definition should describe:

```text
id
name
description
capabilities
input schema
output schema
permissions
dependencies
availability
execution method
```

Example:

```text
FilesystemTool
    ↓
file.read
file.write
file.create
file.modify
file.search
```

The runtime must be able to ask:

```text
Which tool can execute file.read?
```

rather than:

```text
If the user says "read file", run this script.
```

---

# 7. Provider Registry

Providers must be independent from individual features.

The registry should be capable of representing:

```text
Provider
├── identity
├── type
├── availability
├── configuration
├── capabilities
├── models
├── health
├── limits
└── errors
```

Example:

```text
Ollama
  ├── available
  ├── models
  └── supported capabilities

llama.cpp
  ├── available
  ├── loaded models
  └── supported capabilities

Remote Provider
  ├── configured / not configured
  ├── quota
  └── supported capabilities
```

Provider selection must be dynamic.

The runtime should be able to determine:

```text
What providers can perform this capability?
Which are available?
Which are configured?
Which are compatible with this request?
Which are allowed by policy?
```

---

# 8. Skill Registry

The Skill Registry describes skills available to Evis.

A skill should contain declarative information such as:

```text
id
name
version
description
capabilities
tools
providers
resources
dependencies
permissions
instructions
state
```

Example:

```text
JavaScript Tutor
    ↓
code.analyze
code.execute
knowledge/javascript
exercise resources
```

Another:

```text
Image Generation
    ↓
image.generate
image.edit
Image Tool
Compatible Providers
```

The skill registry must not force every active skill into every request.

---

# 9. Resource / Knowledge Registry

Evis must have a way to discover persistent resources.

The initial conceptual data root is:

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

The physical location of this root must be configurable.

It must not be permanently hard-coded to a single path.

The runtime should know:

```text
Where is Evis data stored?
What resources exist?
Which resources are relevant?
Which resources are accessible?
```

---

# 10. Persistence Boundary

Persistence must not be scattered through UI components.

The application requires a dedicated persistence layer.

Conceptually:

```text
UI
 ↓
Application State
 ↓
Persistence Service
 ↓
Storage Backend
```

The first implementation may use an appropriate local database or storage mechanism.

The architecture must make the storage backend replaceable.

The rest of Evis should not depend directly on:

```text
localStorage
SQLite
filesystem JSON
```

as an implementation detail.

The application should depend on a persistence interface.

Example conceptual interface:

```js
conversationRepository.save()
conversationRepository.get()
conversationRepository.list()

projectRepository.save()
projectRepository.get()

memoryRepository.save()
memoryRepository.search()
```

The exact repository design may evolve, but persistence must have a clear boundary.

---

# 11. Memory Boundary

Memory is not simply storage.

Storage answers:

> Where is information saved?

Memory answers:

> What information should influence future reasoning?

Therefore:

```text
Persistence
    ↓
Stored Data

Memory System
    ↓
Relevant Context
```

The memory system must eventually be able to:

```text
store
retrieve
rank
filter
summarize
forget / expire where appropriate
```

The model should not receive the entire historical database on every request.

---

# 12. Context Manager

The Context Manager prepares the information that should be available to the model.

It must combine only relevant context.

Potential sources:

```text
current request
conversation history
relevant memory
relevant skills
relevant knowledge
project context
tool definitions
provider information
execution results
```

Conceptually:

```text
Context Manager
├── Request Context
├── Conversation Context
├── Memory Context
├── Skill Context
├── Knowledge Context
├── Project Context
├── Tool Context
└── Execution Context
```

The Context Manager must prevent unnecessary context injection.

If 45 skills are active, Evis must not automatically inject all 45 into every request.

Only relevant resources should enter the active context.

---

# 13. Permission / Policy Engine

The Permission Engine is a foundational security boundary.

It must operate independently from:

```text
model
skill
UI
provider
tool
```

Example:

```text
Model requests:
terminal.execute

        ↓

Policy Engine

        ↓

Allowed / Denied / Requires Confirmation
```

A skill must never be able to grant itself permission.

A model must never be able to bypass policy.

A UI checkbox must not be treated as the complete security system.

---

# 14. Capability Resolution

Capability resolution is one of the central functions of Evis.

Given:

```text
User request
```

the runtime must determine:

```text
What capability is required?
```

Example:

```text
"Create an image"

        ↓

Goal:
create_image

        ↓

Capability:
image.generate
```

The resolution mechanism must be extensible.

It must not become a giant collection of:

```js
if (text.includes("image")) ...
if (text.includes("search")) ...
if (text.includes("file")) ...
```

Simple deterministic rules may exist for legitimate system purposes, but they must not replace the intelligence/runtime architecture.

---

# 15. Resource Resolution

Once capabilities are known, Evis must determine what resources can satisfy them.

Example:

```text
Capability:
image.generate

        ↓

Possible skills
Possible tools
Possible providers
Possible models
Dependencies
Permissions
```

The runtime then chooses a valid execution path.

---

# 16. Dependency Resolution

Dependencies must be checked before execution.

Example:

```text
Image Generation Skill
        ↓
image.generate
        ↓
Image Tool
        ↓
Provider
        ↓
Configured API/model
```

If a required dependency is missing:

```text
DO NOT SIMULATE SUCCESS
```

Instead:

```text
identify missing dependency
        ↓
determine whether it can be configured
        ↓
ask user when necessary
        ↓
or report unavailable
```

---

# 17. Execution Plan

The runtime should represent the intended operation as an execution plan.

Conceptually:

```text
ExecutionPlan

goal
requiredCapabilities
selectedSkills
selectedTools
selectedProviders
dependencies
permissions
steps
verification
```

Example:

```text
Goal:
create image

Capabilities:
image.generate

Skill:
Image Generation

Tool:
ImageGenerationTool

Provider:
Available compatible provider

Permissions:
network / external service if required

Execution:
generate image

Verification:
confirm successful output
```

The plan is an internal runtime object.

It must not become a prewritten script for individual user requests.

---

# 18. Execution Context

ExecutionContext represents the state of a running operation.

It may contain:

```text
request
goal
plan
conversation
selected resources
selected tools
selected provider
permissions
tool results
errors
intermediate reasoning state
verification state
```

This allows multi-step operations without storing temporary state inside arbitrary UI components.

---

# 19. Tool Call Contract

Tool calls must be structured.

Conceptually:

```js
{
  type: "tool_call",
  tool: "filesystem",
  operation: "read",
  arguments: {
    path: "/authorized/path/file.txt"
  }
}
```

The exact protocol may change.

The architectural requirement does not:

```text
Model decision
        ↓
Runtime validation
        ↓
Permission check
        ↓
Tool execution
        ↓
Real result
        ↓
Model / orchestrator
```

Never:

```text
User message
        ↓
Regex
        ↓
Script
        ↓
Fake result
```

---

# 20. Tool Result Contract

Tool results must be returned in a structured form.

Conceptually:

```js
{
  success: true,
  tool: "filesystem",
  operation: "read",
  data: "...",
  metadata: {},
  error: null
}
```

Failure must also be structured.

Example:

```js
{
  success: false,
  error: {
    code: "PERMISSION_DENIED",
    message: "Filesystem access was denied."
  }
}
```

The runtime must preserve the distinction between:

```text
successful execution
failed execution
unavailable capability
missing dependency
permission denial
invalid request
provider failure
```

---

# 21. Orchestrator

The Orchestrator is the central coordinator.

It does not perform every operation itself.

Its responsibility is to coordinate:

```text
request
goal
capabilities
skills
tools
providers
dependencies
permissions
context
execution
verification
```

Conceptually:

```js
async function orchestrate(request) {
  const goal = await understandGoal(request)

  const capabilities =
    await resolveCapabilities(goal)

  const skills =
    await resolveSkills(capabilities)

  const tools =
    await resolveTools(capabilities, skills)

  const providers =
    await resolveProviders(goal, capabilities)

  const dependencies =
    await resolveDependencies(
      skills,
      tools,
      providers
    )

  const permissions =
    await resolvePermissions(
      request,
      capabilities,
      tools
    )

  validateExecutionState({
    capabilities,
    skills,
    tools,
    providers,
    dependencies,
    permissions
  })

  const context =
    await buildContext({
      request,
      goal,
      skills,
      capabilities,
      tools,
      providers
    })

  return runAgentLoop(context)
}
```

This is a conceptual contract.

The implementation must respect the separation of responsibilities.

---

# 22. Agent Loop

Evis must support iterative model/tool interaction.

Conceptually:

```text
Model
 ↓
Decision
 ↓
Tool Call?
 ├── No → Final Response
 │
 └── Yes
       ↓
Runtime Validation
       ↓
Permission Check
       ↓
Tool Execution
       ↓
Tool Result
       ↓
Model
       ↓
Continue / Finish
```

Conceptual implementation:

```js
while (!finished) {
  const response = await model.generate(context)

  if (response.type === "final") {
    verify(response)
    return response
  }

  if (response.type === "tool_call") {
    validateToolCall(response)
    checkPermission(response)

    const result =
      await executeTool(response)

    context =
      appendToolResult(
        context,
        result
      )

    continue
  }

  handleUnexpectedResponse()
}
```

The agent loop must be compatible with the actual capabilities of the selected provider/model.

---

# 23. Provider Compatibility

Different providers and models may support different features.

Evis must therefore distinguish:

```text
Provider available
Provider configured
Model available
Model compatible
Tool calling supported
Structured output supported
Streaming supported
Multimodal input supported
```

Do not assume that because a model can generate text, it can reliably perform tool calling.

Compatibility must be tested.

The provider layer should expose capabilities rather than forcing the orchestrator to guess.

---

# 24. Provider Fallback

Provider fallback must be capability-aware.

Example:

```text
Provider A
   ↓
RATE_LIMITED
   ↓
Provider B
   ↓
SUCCESS
```

But not every error should trigger fallback.

Potential error classes:

```text
QUOTA_EXHAUSTED
RATE_LIMITED
TIMEOUT
NETWORK_ERROR
AUTH_REQUIRED
UNSUPPORTED_CAPABILITY
PROVIDER_ERROR
PERMISSION_DENIED
```

The provider router must decide whether fallback is appropriate.

Never blindly execute:

```text
try provider A
try provider B
try provider C
try provider D
```

without understanding the failure.

---

# 25. External AI / Remote Agent Delegation

External AI systems may eventually be treated as remote providers or agents.

They must not be special hard-coded exceptions.

Conceptually:

```text
Evis
 ↓
Delegation Resolver
 ↓
Remote Provider / Agent
 ↓
Structured Request
 ↓
Remote Execution
 ↓
Structured Result
 ↓
Evis
```

A delegation request should define:

```text
task
required output
context
constraints
permissions
expected format
```

The result should define:

```text
success
output
metadata
provider
errors
```

Sending information to an external AI must pass through policy.

Evis must know what information is being transmitted and whether external transmission is allowed.

---

# 26. Filesystem as the First Vertical Slice

The first complete end-to-end capability should be filesystem interaction.

Reason:

Filesystem access validates almost the entire architecture without requiring a complex external API.

Target path:

```text
User
 ↓
Request
 ↓
Goal
 ↓
Capability Resolver
 ↓
file.read
 ↓
Tool Resolver
 ↓
Filesystem Tool
 ↓
Permission Engine
 ↓
Real filesystem
 ↓
Tool Result
 ↓
Model / Orchestrator
 ↓
Response
```

This must be a genuine vertical slice.

The filesystem UI must not be considered complete until it is connected to the actual runtime.

---

# 27. First Filesystem Capabilities

The initial filesystem capability set should be limited and explicit:

```text
file.list
file.read
file.write
file.create
file.modify
file.search
```

Destructive operations such as:

```text
file.delete
file.move
```

must have explicit policy handling.

Filesystem access must be restricted to authorized locations.

---

# 28. Skill Activation

A skill can exist without being active.

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

The runtime must distinguish:

```text
Skill exists
```

from:

```text
Skill is currently active
```

If a request requires an available but inactive skill, Evis may ask the user to activate it when appropriate.

Example:

```text
User:
Create a programming exercise.

Evis:
A compatible exercise-generation skill is available but inactive.
Activate it?
```

If the skill is unavailable entirely:

```text
Do not pretend it exists.
```

---

# 29. Dynamic Skill Selection

Active skills are resources.

They are not mandatory controllers of every response.

For each request:

```text
Request
 ↓
Relevant capabilities
 ↓
Relevant skills
 ↓
Relevant tools
 ↓
Relevant context
```

Therefore:

```text
45 active skills
```

does not mean:

```text
45 skill prompts injected into every request
```

The runtime must resolve only what is relevant.

---

# 30. UI Boundary

The UI is responsible for:

```text
presentation
user interaction
state visualization
configuration
confirmation
progress
errors
results
```

The UI must not become the authoritative execution engine.

Avoid:

```text
Button
 ↓
Direct privileged operation
```

Prefer:

```text
UI
 ↓
Application request
 ↓
Runtime
 ↓
Policy
 ↓
Tool
 ↓
Result
 ↓
UI
```

The UI should reflect actual runtime state.

It must not display:

```text
"Web search available"
```

when no web provider is configured.

It must not display:

```text
"Skill active"
```

when the runtime has not actually activated it.

---

# 31. Current Project Structure

The project should gradually converge toward a structure that reflects the architecture.

A conceptual structure:

```text
evis/
├── app/
│   ├── ui/
│   ├── application/
│   └── session/
│
├── core/
│   ├── orchestrator/
│   ├── agent/
│   ├── context/
│   ├── capabilities/
│   ├── permissions/
│   └── execution/
│
├── skills/
│   ├── registry/
│   ├── loader/
│   ├── resolver/
│   └── runtime/
│
├── tools/
│   ├── registry/
│   ├── filesystem/
│   ├── terminal/
│   ├── web/
│   └── ...
│
├── providers/
│   ├── registry/
│   ├── ollama/
│   ├── llamacpp/
│   └── remote/
│
├── storage/
│   ├── repositories/
│   └── adapters/
│
├── memory/
│
├── resources/
│
├── security/
│
├── config/
│
└── tests/
```

This is a target architectural model.

The existing project must be inspected before files are moved or duplicated.

Do not recreate systems that already exist without first determining whether they can be adapted.

---

# 32. Initial Runtime Dependency Graph

The core dependency direction should be approximately:

```text
UI
 ↓
Application
 ↓
Orchestrator
 ↓
Resolvers
 ↓
Registries
 ↓
Tools / Providers
 ↓
Infrastructure
```

Supporting systems:

```text
Persistence
Memory
Policy
Configuration
```

must remain independently accessible through defined interfaces.

Lower layers must not depend upward on the UI.

For example:

```text
Filesystem Tool
```

must not import:

```text
React component
```

to function.

---

# 33. Initial Construction Order

The architecture must be constructed from the foundation upward.

## Phase 1 — Existing Architecture Audit

Determine:

```text
What already exists?
What is real?
What is simulated?
What is duplicated?
What is coupled?
What can be reused?
What must be replaced?
```

No large rewrite should begin before this understanding exists.

---

## Phase 2 — Domain Contracts

Define stable contracts for:

```text
Capability
Skill
Tool
Provider
Model
Resource
Dependency
Permission
ToolCall
ToolResult
ExecutionPlan
ExecutionContext
```

These contracts become the vocabulary of the runtime.

---

## Phase 3 — Registries

Implement:

```text
Capability Registry
Tool Registry
Provider Registry
Skill Registry
Resource Registry
```

The registries should support discovery rather than hard-coded feature lists spread throughout the application.

---

## Phase 4 — Configuration and Persistence

Establish:

```text
Evis Data Root
Configuration
Persistence abstraction
Repository layer
```

Remove architectural dependence on temporary browser-only state where persistent application data is required.

---

## Phase 5 — Policy Engine

Implement the authorization boundary before exposing powerful tools.

At minimum:

```text
filesystem.read
filesystem.write
terminal.execute
network.access
external_ai.send_context
```

must have explicit policy representation.

---

## Phase 6 — Tool Runtime

Implement the actual tool execution boundary.

Start with:

```text
Filesystem Tool
```

Then expand.

---

## Phase 7 — Capability Resolution

Implement:

```text
Goal
 ↓
Capability
 ↓
Tool
 ↓
Provider
```

resolution.

---

## Phase 8 — Context Manager

Implement relevant context construction.

It must support:

```text
conversation
memory
skills
knowledge
tools
providers
execution results
```

without blindly injecting everything.

---

## Phase 9 — Orchestrator

Connect:

```text
Goal
Capabilities
Skills
Tools
Providers
Dependencies
Permissions
Context
```

into a coherent execution process.

---

## Phase 10 — Agent Loop

Implement the real:

```text
Model
 ↓
Tool Call
 ↓
Runtime
 ↓
Tool
 ↓
Result
 ↓
Model
```

cycle.

---

## Phase 11 — First Vertical Slice

Complete:

```text
User asks to read a file
 ↓
Evis understands request
 ↓
file.read capability
 ↓
Filesystem Tool
 ↓
permission check
 ↓
real filesystem
 ↓
real result
 ↓
model receives result
 ↓
response
```

Test the entire chain.

---

## Phase 12 — UI Integration

Only after the runtime path is functional should the UI expose the corresponding controls.

The UI should consume the runtime rather than invent its own execution logic.

---

# 34. Expansion Order

Once the filesystem vertical slice is stable:

```text
Filesystem
 ↓
Code / Terminal
 ↓
Knowledge
 ↓
Memory
 ↓
Web
 ↓
External Providers
 ↓
Image / Audio / Video
 ↓
Advanced Skills
```

The exact order may change if dependency analysis demonstrates a better sequence.

The architectural principle does not change:

> **Foundational runtime before feature accumulation.**

---

# 35. Testing the Architecture

Testing must verify behavior at the architectural boundaries.

Minimum tests should include:

### Capability Resolution

```text
request
→ expected capability
```

### Tool Resolution

```text
capability
→ compatible tool
```

### Permission

```text
allowed operation
→ execution

denied operation
→ blocked
```

### Disabled Skill

```text
inactive skill
→ protected capability unavailable
```

### Missing Dependency

```text
missing provider/tool
→ honest failure
```

### Real Tool Execution

```text
tool call
→ actual external operation
→ actual result
```

### Agent Loop

```text
model
→ tool call
→ tool result
→ model
→ final response
```

### Provider Failure

```text
provider unavailable
→ correct fallback or honest failure
```

### UI Synchronization

```text
runtime state
→ UI state
```

The UI must never be the sole proof that a feature works.

---

# 36. Architectural Completion Criteria

The foundation is not complete merely because directories or classes exist.

The following must be true:

```text
[ ] Core domain concepts exist as explicit contracts.
[ ] Registries can discover system components.
[ ] Capabilities have stable identities.
[ ] Tools have explicit execution contracts.
[ ] Providers are independently represented.
[ ] Skills are separate from tools.
[ ] Permissions are independent from skills and models.
[ ] Persistence has a dedicated boundary.
[ ] Memory is separated conceptually from raw storage.
[ ] Context is assembled dynamically.
[ ] Capability resolution is not a giant regex router.
[ ] Tool calls pass through runtime validation.
[ ] Tool execution produces real results.
[ ] The model is not bypassed.
[ ] Provider compatibility is represented.
[ ] Agent/tool iteration is supported.
[ ] The filesystem vertical slice works end-to-end.
[ ] Failure states are represented honestly.
[ ] UI reflects runtime state.
[ ] Existing functionality is preserved where compatible.
```

---

# 37. What Must Never Become Part of the Foundation

The following approaches must not become architectural foundations:

```text
regex-based request routing
hard-coded feature selection
fake tool calls
prewritten AI responses
setTimeout-based simulated AI
frontend-only feature implementations
browser localStorage as the hidden universal database
one model hard-coded everywhere
one provider hard-coded everywhere
skills injected indiscriminately into every request
UI buttons directly executing privileged operations
scripts replacing the model/runtime decision process
fake provider fallback
fake web search
fake exercise generation
fake capability availability
```

Scripts are allowed when they are legitimate implementations of tools.

For example:

```text
Terminal Tool
 ↓
validated command
 ↓
OS process
 ↓
real result
```

is valid.

But:

```text
User request
 ↓
regex
 ↓
prewritten script
 ↓
pretend AI understood
```

is not the Evis architecture.

---

# 38. The First Principle of the Core

Evis must remain understandable as a system.

For any operation, an engineer should be able to answer:

```text
Who requested it?
What goal was identified?
What capability was required?
Which skill contributed?
Which tool executed it?
Which provider was used?
Which permissions allowed it?
What dependencies were required?
What actually happened?
What result came back?
How was the result verified?
```

If these questions cannot be answered, the architecture is hiding behavior.

---

# 39. Final Architectural Model

The target architecture is:

```text
                           EVIS
                            │
                     ┌──────┴──────┐
                     │     UI      │
                     └──────┬──────┘
                            │
                     Application
                            │
                     Session Manager
                            │
                     ┌──────┴──────┐
                     │ Orchestrator│
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
           Context       Resolver       Policy
           Manager          │           Engine
              │             │
              │      ┌──────┼──────┐
              │      │      │      │
              │   Skills  Tools Providers
              │
           Memory
              │
         Persistence
              │
         Infrastructure
```

The runtime execution path is:

```text
USER REQUEST
      ↓
GOAL UNDERSTANDING
      ↓
CAPABILITY RESOLUTION
      ↓
RESOURCE RESOLUTION
      ↓
DEPENDENCY RESOLUTION
      ↓
PERMISSION / POLICY
      ↓
EXECUTION PLAN
      ↓
CONTEXT
      ↓
MODEL
      ↓
TOOL CALL
      ↓
VALIDATION
      ↓
REAL TOOL EXECUTION
      ↓
REAL RESULT
      ↓
MODEL
      ↓
VERIFY
      ↓
FINAL RESPONSE
```

This is the foundation upon which future Evis capabilities must be built.

---

# 40. Foundation Rule

Every future feature must be able to answer:

```text
Which capability does this provide?
Which runtime component owns it?
Which tool actually performs it?
Which provider supplies the required service?
Which dependencies does it require?
Which permissions does it require?
How is it discovered?
How is it invoked?
How does it fail?
How is it tested?
```

If a feature cannot answer these questions, it is not yet properly integrated into Evis.

The goal is not to build the largest interface.

The goal is to build a runtime in which new capabilities can be added **without destroying the architecture that already exists**.

> **Evis should grow by composition, not by accumulation of special cases.**

