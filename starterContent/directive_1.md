# EVIS — Real Skill & Orchestration Runtime
## Architecture, Implementation Order and Non-Simulation Rules

---

# 1. Purpose

Evis is not intended to be a chat interface that produces answers.

The goal is to build a local-first AI environment capable of understanding a user's goal, resolving the capabilities required to accomplish that goal, selecting the appropriate skill, tools and providers, executing real operations, verifying the results, and then responding to the user.

The interface is only the visible layer.

The real objective is to build the runtime underneath it.

A system that can only:

    User → Message → Model → Answer

is not enough.

A system that can:

    User
      ↓
    Understand the goal
      ↓
    Resolve required capabilities
      ↓
    Resolve active skills
      ↓
    Resolve tools/providers/resources
      ↓
    Check dependencies
      ↓
    Check permissions
      ↓
    Build an execution context
      ↓
    Give the model the available capabilities/tools
      ↓
    Let the model decide what to use
      ↓
    Execute real tool calls
      ↓
    Return real results to the model
      ↓
    Continue if necessary
      ↓
    Verify the result
      ↓
    Respond

is the actual target.

---

# 2. The Most Important Implementation Rule

## DO NOT IMPLEMENT FEATURES OUT OF ORDER.

Evis must be built from the bottom of the runtime upward.

Do not jump directly to:

- image generation
- web search
- exercise generation
- autonomous agents
- complex skills
- advanced UI
- fake tool calling
- hard-coded intent routing

before the runtime required by those features exists.

A feature is not considered implemented merely because the UI can produce a result.

For example:

    "Create a file"

must NOT be implemented as:

    detect phrase
        ↓
    execute predefined script
        ↓
    show success message

That is simulation.

The correct implementation is:

    User request
        ↓
    Model understands goal
        ↓
    Capability resolution
        ↓
    Skill resolution
        ↓
    Tool resolution
        ↓
    Permission check
        ↓
    Model receives tool schema
        ↓
    Model generates a real tool call
        ↓
    Evis validates the call
        ↓
    Evis executes the filesystem tool
        ↓
    Real filesystem result
        ↓
    Result returned to model
        ↓
    Model decides whether more action is required
        ↓
    Verification
        ↓
    Final response

---

# 3. No Simulation Rule

The implementation MUST NOT use:

- regex-based intent routing as the primary intelligence
- hard-coded responses for capabilities
- fake models
- fake tools
- fake skill execution
- fake filesystem results
- fake web results
- fake generated images
- hard-coded exercise selection
- predefined responses pretending to be model reasoning
- frontend-only implementations of backend capabilities
- scripts that bypass the model and pretend to be agent execution

Regex may be used for ordinary validation or parsing where appropriate.

It must NOT replace the model's reasoning and tool-selection process.

The model must actually participate in the agent loop.

---

# 4. Architecture

The target architecture is:

                         EVIS
                          │
                         UI
                          │
                  Session Manager
                          │
                    Orchestrator
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   Context Manager    Skill Runtime     Permission Manager
        │                 │
      Memory         Skill Registry
        │                 │
   Knowledge        Capability Registry
                          │
                      Tool Registry
                          │
                    Provider Registry
                          │
                 ┌────────┼─────────┐
                 │        │         │
             Ollama    llama.cpp   Other
                 │        │         │
              Models   Models     Providers
                          │
                       Tools
                 ┌────────┼────────┐
                 │        │        │
             Filesystem  Web    Terminal
                 │        │        │
              Real OS   Network   OS

The UI must never directly implement this logic.

React/UI components must communicate with application services.

The model provider layer must not know about React.

The filesystem, web and terminal tools must not contain UI logic.

---

# 5. Implementation Order

The following order is mandatory.

A later phase must not be considered complete if an earlier dependency is still simulated.

---

## PHASE 0 — Architecture Audit

Before changing the system:

1. Inspect the existing codebase.
2. Identify all current runtime components.
3. Identify real implementations.
4. Identify simulations.
5. Identify regex/heuristic routing.
6. Identify hard-coded data.
7. Identify duplicated responsibilities.
8. Identify current API boundaries.
9. Identify the current model execution path.
10. Identify what can be preserved.
11. Identify what must be replaced.
12. Identify missing architectural components.

DO NOT IMPLEMENT FEATURES DURING THIS PHASE.

Produce an architecture report first.

---

# PHASE 1 — Core Domain Definitions

Create the foundational types/interfaces/entities.

The runtime needs explicit definitions for:

- Skill
- Capability
- Tool
- Provider
- Model
- Resource
- Dependency
- Permission
- ToolCall
- ToolResult
- ExecutionPlan
- ExecutionContext
- SkillState
- ProviderState

These definitions must exist before building the higher-level runtime.

---

# PHASE 2 — Capability Registry

Create a real Capability Registry.

Example:

    Capability Registry

    file.read
    file.write
    file.create
    file.modify
    file.delete
    file.move
    file.search

    web.search
    web.open

    terminal.execute

    image.generate
    image.edit

    audio.transcribe
    audio.generate

    code.analyze
    code.execute
    code.test

A capability describes WHAT Evis can do.

It does not itself perform the operation.

Example:

    file.create

means:

    Evis has the capability of creating files.

The registry must be queryable by the runtime.

---

# PHASE 3 — Tool Registry

Create a real Tool Registry.

A tool describes HOW a capability is actually performed.

Example:

    Filesystem Tool

    capabilities:
        file.read
        file.write
        file.create
        file.modify
        file.delete
        file.move
        file.search

    permissions:
        filesystem.read
        filesystem.write

    input schema:
        path
        content

    output schema:
        success
        path
        metadata

Tools must expose machine-readable schemas.

The model must eventually receive these schemas when the corresponding tools are available.

---

# PHASE 4 — Provider Registry

Create a Provider Registry.

Example:

    Ollama Provider
        ↓
    discovered models

    llama.cpp Provider
        ↓
    discovered models

Providers must not be hard-coded into the UI.

The runtime must be able to:

1. discover configured providers
2. determine provider availability
3. discover models
4. expose model metadata
5. determine supported capabilities
6. select a model/provider
7. execute inference
8. handle streaming
9. report provider errors

The UI should consume this information from the runtime.

---

# PHASE 5 — Skill Registry

Create the real Skill Registry.

A skill is NOT simply a system prompt.

A skill is a capability package.

A skill can contain:

    SKILL.md
    instructions/
    resources/
    knowledge/
    scripts/
    schemas/
    configuration/

The runtime should discover skills rather than relying on a hard-coded list.

---

# 6. Real Skill Structure

A skill should conceptually look like:

    skills/
    └── filesystem/
        ├── SKILL.md
        ├── resources/
        ├── knowledge/
        ├── schemas/
        ├── scripts/
        └── config/

The exact physical structure may evolve, but the runtime representation must contain the following information.

Example:

    {
        id: "filesystem",
        name: "Filesystem",
        version: "1.0.0",

        purpose: "...",

        scope: "...",

        capabilities: [
            "file.read",
            "file.write",
            "file.create",
            "file.modify",
            "file.search"
        ],

        tools: [
            "filesystem"
        ],

        requiredTools: [
            "filesystem"
        ],

        dependencies: [],

        permissions: [
            "filesystem.read",
            "filesystem.write"
        ],

        inputs: [...],

        outputs: [...],

        resources: [...],

        configuration: {...}
    }

The skill does not execute itself.

It declares what it provides and what it requires.

The runtime decides when and how it is used.

---

# 7. Skill Lifecycle

Every skill must have a real lifecycle.

    DISCOVER
        ↓
    LOAD
        ↓
    VALIDATE
        ↓
    RESOLVE DEPENDENCIES
        ↓
    CHECK CONFIGURATION
        ↓
    ACTIVATE
        ↓
    PROVIDE CAPABILITIES
        ↓
    EXECUTE
        ↓
    VERIFY
        ↓
    DEACTIVATE

Possible states:

    available
    loading
    active
    inactive
    unavailable
    not-configured
    error

A skill must never appear active if its required dependencies are unavailable.

---

# PHASE 6 — Resource / Knowledge Registry

Create a registry for resources used by skills.

Resources may include:

- documentation
- examples
- schemas
- reference files
- local knowledge
- skill-specific instructions
- executable resources

The runtime must distinguish:

    instructions
    knowledge
    resources
    tools
    capabilities

These are not interchangeable.

---

# PHASE 7 — Permission System

Before executing real tools, implement permission resolution.

Example:

    filesystem.read
    filesystem.write
    terminal.execute
    web.access
    destructive.operation

Permissions must be evaluated before tool execution.

A skill declaring a permission does not automatically grant that permission.

The runtime must determine:

    Is this operation allowed?

---

# PHASE 8 — Context Manager

Create a Context Manager responsible for assembling the context given to the model.

It may contain:

    conversation
    relevant memory
    active skill instructions
    relevant knowledge
    available capabilities
    available tools
    tool schemas
    provider/model information
    current execution state
    tool results

Do not blindly inject every skill, every resource and every tool into every request.

Context must be resolved according to the current task.

---

# PHASE 9 — Real Tool Calling

This is one of the most important phases.

The selected model must actually receive tool definitions.

The runtime must support:

    Model
      ↓
    tool_call
      ↓
    Evis
      ↓
    validate
      ↓
    permission check
      ↓
    execute
      ↓
    ToolResult
      ↓
    Model

The system must NOT do:

    User message
      ↓
    regex
      ↓
    predefined function
      ↓
    fake AI response

The model must actually generate the tool call.

---

# PHASE 10 — Orchestrator

The Orchestrator is the central runtime responsible for coordinating the system.

It should NOT itself implement filesystem, web, terminal or image generation.

Its job is coordination.

Conceptually:

    Orchestrator
        │
        ├── understand goal
        │
        ├── resolve capabilities
        │
        ├── resolve skills
        │
        ├── resolve tools
        │
        ├── resolve providers
        │
        ├── resolve resources
        │
        ├── resolve dependencies
        │
        ├── check permissions
        │
        ├── assemble context
        │
        ├── call model
        │
        ├── receive tool call
        │
        ├── validate tool call
        │
        ├── execute tool
        │
        ├── return tool result to model
        │
        ├── continue loop if necessary
        │
        ├── verify result
        │
        └── produce final response

A simplified runtime should look like:

    async function orchestrate(request) {

        const goal =
            await understandGoal(request);

        const capabilities =
            await resolveCapabilities(goal);

        const skills =
            await resolveSkills(capabilities);

        const tools =
            await resolveTools(capabilities, skills);

        const providers =
            await resolveProviders(goal, capabilities);

        const dependencies =
            await resolveDependencies(
                skills,
                tools,
                providers
            );

        const permissions =
            await resolvePermissions(
                request,
                capabilities,
                tools
            );

        validateExecutionState(
            capabilities,
            skills,
            tools,
            providers,
            dependencies,
            permissions
        );

        const context =
            await buildContext({
                request,
                goal,
                skills,
                capabilities,
                tools,
                providers
            });

        return await runAgentLoop(context);
    }

The actual implementation may use different names and abstractions.

The architecture must preserve these responsibilities.

---

# PHASE 11 — Agent Loop

The agent loop must be real.

Conceptually:

    while (!finished) {

        response =
            await model.generate(context);

        if (response.type === "final") {
            verify(response);
            return response;
        }

        if (response.type === "tool_call") {

            validateToolCall(response);

            checkPermission(response);

            result =
                await executeTool(response);

            context =
                appendToolResult(
                    context,
                    result
                );

            continue;
        }

        handleUnexpectedResponse();
    }

The exact protocol depends on the provider/model.

The architecture must support multiple tool-calling formats.

---

# PHASE 12 — Provider Compatibility

Do not assume every local model/provider supports tool calling identically.

Test each provider/model combination.

For each combination document:

    provider
    model
    streaming support
    tool calling support
    structured output support
    context limitations
    known limitations

If a model cannot perform reliable tool calling, the runtime must know that.

Do not silently pretend that it supports the feature.

---

# PHASE 13 — First Real Proof: Filesystem Skill

Do NOT implement ten skills simultaneously.

Use one skill to prove the complete architecture.

The first proof should be the Filesystem Skill because the filesystem backend already exists.

Required flow:

    User:
    "Create notes.md in my project and put these informations inside."

        ↓

    Session Manager

        ↓

    Orchestrator

        ↓

    Capability Resolution

        ↓

    file.create
    file.write

        ↓

    Skill Resolution

        ↓

    Filesystem Skill

        ↓

    Tool Resolution

        ↓

    Filesystem Tool

        ↓

    Permission Check

        ↓

    Model receives filesystem tool schema

        ↓

    Model decides:

    filesystem.create(...)

        ↓

    Evis validates the call

        ↓

    Filesystem Tool executes

        ↓

    Real file created on disk

        ↓

    Tool result returned to model

        ↓

    Model verifies/continues

        ↓

    Final response

This is the first acceptance test.

---

# 14. Disabled Skill Test

The opposite case is equally important.

If the Filesystem Skill is disabled:

    User request
        ↓
    Capability required
        ↓
    Filesystem Skill unavailable
        ↓
    Filesystem Tool not exposed
        ↓
    Model cannot call filesystem
        ↓
    Evis reports the missing capability

The system must NOT execute the filesystem operation anyway.

This proves that the skill system actually controls capability availability.

---

# 15. Missing Capability Resolution

When a capability is unavailable:

    Required capability
          ↓
    Is it available?
          │
       NO │
          ↓
    Can Evis discover/configure/install it?
          │
       ┌──┴──┐
      YES    NO
       │      │
       ↓      ↓
    Ask user  Explain exactly
    / propose what is missing

Never pretend that a capability exists.

Example:

    "Image generation is requested."

If no image-generation provider exists:

    Evis must say that image generation is currently unavailable
    and identify the missing provider/capability.

It must not return a fake image or pretend that an image was generated.

---

# 16. Example: Image Generation

Once the runtime exists:

    User:
    "Create an image of a futuristic city."

        ↓

    Orchestrator

        ↓

    Capability Resolution

        ↓

    image.generate

        ↓

    Provider Resolution

        ↓

    Available image-generation providers

        ↓

    Dependency Check

        ↓

    Permission Check

        ↓

    Model/Agent Plan

        ↓

    Image Tool / Provider

        ↓

    Real generation

        ↓

    Real image output

        ↓

    Verification

        ↓

    Final response

The image feature itself should therefore be relatively small compared with the runtime required to support it.

---

# 17. Example: File Modification

For:

    "Modify this JavaScript file and fix the bug."

The runtime should be able to resolve:

    file.read
    code.analyze
    file.modify

Potential flow:

    read file
        ↓
    analyze code
        ↓
    produce modification
        ↓
    modify file
        ↓
    optionally test
        ↓
    verify
        ↓
    report

The system must not simply run a hard-coded replacement script.

---

# 18. Example: Web Search

The Web Skill should eventually resolve:

    web.search
    web.open

Flow:

    User goal
        ↓
    Capability resolution
        ↓
    Web Skill
        ↓
    Web Tool
        ↓
    Permission
        ↓
    Search
        ↓
    Results
        ↓
    Model
        ↓
    Additional searches if necessary
        ↓
    Synthesis
        ↓
    Final answer

The search process must be real.

---

# 19. Skill ≠ Tool ≠ Capability

This distinction must remain explicit.

## Capability

WHAT Evis can do.

Example:

    file.create

## Tool

HOW the operation is executed.

Example:

    FilesystemTool

## Skill

A package that provides domain-specific instructions, capabilities, tools, resources and dependencies.

Example:

    Filesystem Skill

## Provider

WHO/WHAT provides a model or external capability.

Example:

    Ollama
    llama.cpp
    image provider

## Resource

Information or assets used during execution.

Example:

    documentation
    schema
    local knowledge
    reference file

---

# 20. UI Integration Comes After the Runtime

The UI should consume the runtime.

The UI should not contain the intelligence responsible for:

- capability resolution
- tool execution
- provider routing
- skill execution
- filesystem operations
- agent loops

For example:

    UI
      ↓
    Session API
      ↓
    Orchestrator
      ↓
    Runtime

The selected skill in the UI should influence runtime state.

It should NOT merely add text such as:

    "### Skill: JavaScript Tutor"

to the prompt and call that a skill system.

---

# 21. Active Skills

When a user activates a skill:

    UI
      ↓
    Skill Manager
      ↓
    Skill Registry
      ↓
    Validate skill
      ↓
    Resolve dependencies
      ↓
    Activate skill
      ↓
    Runtime exposes its capabilities

The important point is:

ACTIVATING A SKILL MUST HAVE RUNTIME CONSEQUENCES.

It must not only change the visual UI.

---

# 22. Implementation Discipline

After every phase:

1. Test it.
2. Verify it is actually connected.
3. Remove temporary simulations.
4. Verify previous phases still work.
5. Only then continue.

Do not implement Phase 1, Phase 2, Phase 3, Phase 8 and Phase 13 simultaneously.

Do not skip foundational phases because a later feature is easier to demonstrate.

A working isolated feature is not evidence that the architecture works.

---

# 23. Definition of Done

Evis should not be considered to have a real skill runtime until all of the following are true:

- Skills are dynamically discovered.
- Skills have structured manifests.
- Skills have lifecycle states.
- Capabilities are explicitly registered.
- Tools are explicitly registered.
- Providers are explicitly registered.
- Resources are explicitly represented.
- Dependencies are resolved.
- Permissions are checked.
- Context is assembled dynamically.
- Tool schemas can be supplied to the model.
- The model can produce real tool calls.
- Tool calls are validated.
- Tools execute real operations.
- Tool results return to the model.
- The agent can continue after a tool call.
- Results can be verified.
- Missing capabilities are detected.
- Disabled skills actually prevent their tools from being used.
- No regex router bypasses the model.
- No hard-coded response pretends to be an agent.
- No fake tool execution exists.

---

# 24. Required Development Strategy

The implementation order must therefore be:

    0. Architecture Audit
            ↓
    1. Core Domain Definitions
            ↓
    2. Capability Registry
            ↓
    3. Tool Registry
            ↓
    4. Provider Registry
            ↓
    5. Skill Registry
            ↓
    6. Resource / Knowledge Registry
            ↓
    7. Permission System
            ↓
    8. Context Manager
            ↓
    9. Real Tool Calling
            ↓
    10. Orchestrator
            ↓
    11. Agent Loop
            ↓
    12. Provider Compatibility
            ↓
    13. Filesystem Skill
            ↓
    14. End-to-End Verification
            ↓
    15. Web Skill
            ↓
    16. Terminal Skill
            ↓
    17. Code Skill
            ↓
    18. Research Skill
            ↓
    19. Image Skill
            ↓
    20. Audio / Voice Skills
            ↓
    21. Exercise Skill
            ↓
    22. Memory / Knowledge expansion
            ↓
    23. Advanced autonomous workflows

The exact ordering after the first complete proof may change according to dependencies, but foundational runtime components must not be skipped.

---

# 25. Critical Instruction to the Implementing AI

DO NOT optimize for "showing a result quickly."

Optimize for building the runtime correctly.

If a capability cannot yet be implemented because its required infrastructure does not exist, STOP and report the missing infrastructure.

Do not create a shortcut merely to demonstrate the final feature.

Do not create a simulation and label it as complete.

Do not skip a foundational component because another feature appears easier to implement.

If an existing implementation conflicts with this architecture:

    identify it
    explain it
    propose the minimal correction
    preserve working components where possible
    replace simulations where necessary

Before implementing a major architectural component, explain:

    what it is
    why it is required
    what it depends on
    what depends on it
    how it will be tested

Then implement it.

---

# 26. Final Principle

Evis should behave like a real runtime, not a collection of demonstrations.

The objective is not:

    "Can Evis make this particular request work?"

The objective is:

    "Can Evis determine what is required to accomplish an arbitrary supported goal,
     resolve the required capabilities,
     activate the appropriate skills,
     select real tools/providers,
     execute them safely,
     return their results to the model,
     and verify the outcome?"

Once this foundation exists, adding new skills becomes an extension of the system rather than another isolated implementation.

That is the reason the architecture must be built first.
