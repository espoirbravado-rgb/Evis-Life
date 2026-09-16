# EVIS — OBLIGATORY ENGINEERING RULES

## Status

**MANDATORY**

This document defines the non-negotiable rules for any AI agent working on the Evis project.

These rules apply to:

* architecture work
* implementation
* refactoring
* debugging
* optimization
* skill development
* tool development
* provider integration
* UI development
* backend development
* runtime development
* testing
* research
* documentation

These rules have priority over convenience, speed, shortcuts, or assumptions.

The objective is not simply to produce code.

The objective is to produce a **real, coherent, extensible, verifiable and maintainable system**.

---

# 1. Understand Evis Before Modifying Evis

Before modifying the project, the agent MUST understand:

* the current architecture
* the current runtime
* the existing data flow
* the current frontend/backend boundary
* existing APIs
* existing services
* existing registries
* existing skills
* existing tools
* existing providers
* existing persistence
* existing security boundaries
* existing dependencies
* existing limitations
* existing simulations
* existing temporary implementations

Never assume that a component does not exist simply because it was not mentioned in the current instruction.

Inspect the project first.

---

# 2. Starter Content Is Directive Content

The directory:

```
Starter Content/
```

contains Markdown documents used to guide the implementation of Evis.

These documents may describe:

* architecture
* workflows
* engineering rules
* implementation phases
* acceptance criteria
* design constraints
* skills
* development procedures

They are **instructions for the implementing agent**.

They are not automatically application features.

Do not blindly copy their content into the Evis runtime.

Do not implement a Markdown document as a feature merely because it exists inside `Starter Content`.

First determine what the document is asking the agent to build.

---

# 3. Never Optimize for a Quick Demonstration

A working demonstration is not automatically a working implementation.

Do not optimize for:

```
"The user can see a result."
```

Optimize for:

```
"The underlying architecture actually performs the required operation."
```

A feature is not complete because:

* the UI displays it
* a button works
* a hard-coded response appears
* a script produces the expected result
* a mock API returns expected data
* a predefined example succeeds
* a regex recognizes the user's sentence
* a fake tool call is displayed

The real execution path must exist.

---

# 4. No Simulation

The following are forbidden when they replace functionality that is supposed to be real:

* fake tools
* fake providers
* fake skills
* fake model responses
* fake tool calls
* fake search results
* fake generated files
* fake generated images
* fake execution results
* hard-coded capability responses
* hard-coded skill behavior
* hard-coded exercise selection
* regex-based agent routing
* frontend-only implementations pretending to be backend functionality

Temporary mocks may exist during isolated development when explicitly identified as mocks.

They must never be presented as completed functionality.

They must not remain silently in the production execution path.

---

# 5. Do Not Bypass the Architecture

Never bypass an architectural layer simply because another implementation is easier.

For example:

```
User
  ↓
Regex
  ↓
Script
  ↓
Result
```

is NOT an acceptable replacement for:

```
User
  ↓
Model / Runtime
  ↓
Capability Resolution
  ↓
Tool Selection
  ↓
Permission Check
  ↓
Tool Execution
  ↓
Result
  ↓
Model / Runtime
```

Scripts, shell commands, Python programs, Node programs, system APIs, etc. may absolutely be used internally by tools.

The problem is not using a script.

The problem is using a script to **bypass the runtime that was supposed to decide whether and why the operation should happen**.

---

# 6. Skills Must Not Control Every Response

An activated skill does not automatically control the next response.

Skills are capability packages.

They may provide:

* instructions
* capabilities
* tools
* resources
* knowledge
* dependencies
* configuration
* permissions

The system must determine dynamically which parts are relevant to the current request.

Example:

```
45 active skills
```

does NOT mean:

```
inject all 45 skills into every request.
```

Instead:

```
User Goal
    ↓
Required Capabilities
    ↓
Relevant Skills
    ↓
Relevant Tools
    ↓
Relevant Resources
    ↓
Model Context
```

The runtime must minimize irrelevant context.

---

# 7. Capability Comes Before Implementation

Do not begin with:

```
"Which skill did the user select?"
```

Begin with:

```
"What is the user trying to accomplish?"
```

Then determine:

```
What capabilities are required?
```

Then determine:

```
Which skills, tools, providers or external agents can provide those capabilities?
```

The resolution order should conceptually be:

```
USER GOAL
    ↓
CAPABILITY RESOLUTION
    ↓
RESOURCE RESOLUTION
    ↓
SKILL / TOOL / PROVIDER RESOLUTION
    ↓
DEPENDENCY RESOLUTION
    ↓
PERMISSION / POLICY CHECK
    ↓
EXECUTION
    ↓
VERIFICATION
    ↓
RESPONSE
```

Manual skill activation may influence availability and context.

It must not replace capability resolution.

---

# 8. The Model Must Not Be Bypassed

When the architecture requires the model to reason about a task, the model must actually participate.

Do not replace model reasoning with:

* regex
* keyword matching
* predefined intent tables
* hard-coded branching
* scripts that directly execute based on user text
* hidden frontend logic

If the model is supposed to decide whether to use a tool, it must actually receive the appropriate tool schema and produce a real tool call.

---

# 9. Tools Are Real Execution Boundaries

A tool represents an actual executable capability.

Examples:

```
Filesystem Tool
Web Tool
Terminal Tool
Git Tool
Image Tool
Code Execution Tool
```

Tools must have:

* identity
* purpose
* capabilities
* input schema
* output schema
* permissions
* execution logic
* error handling
* validation
* lifecycle/status where appropriate

A tool must return real execution results.

---

# 10. Skills Are Not Tools

Maintain this distinction:

## Capability

What the system can do.

Example:

```
file.write
```

## Tool

How the operation is executed.

Example:

```
FilesystemTool
```

## Skill

A capability package that provides domain-specific instructions, resources, capabilities and tools.

Example:

```
Filesystem Skill
```

## Provider

A system capable of providing a model or service.

Example:

```
Ollama
llama.cpp
cloud provider
remote agent
```

## Resource

Information or assets used during execution.

Example:

```
documentation
schema
knowledge
reference file
```

Never collapse these concepts merely because doing so makes the implementation shorter.

---

# 11. Security and Policy Must Be Independent

No skill, model, tool, provider or UI component may grant itself permission.

The system must contain an independent enforcement layer.

Conceptually:

```
Model
  ↓
Tool Call
  ↓
Validation
  ↓
Permission Check
  ↓
Policy Enforcement
  ↓
Execution
```

The policy layer must be able to block an operation even when:

* the model requested it
* the skill requested it
* the UI requested it
* the tool supports it

A permission declaration is not permission itself.

---

# 12. External Services Must Be Explicit

When Evis uses:

* APIs
* cloud models
* search providers
* external agents
* remote services

the system must explicitly represent:

* provider identity
* capability
* availability
* authentication state
* quota state where known
* rate limits where known
* errors
* configuration
* permissions
* cost implications where applicable

Never silently depend on an external service.

Never pretend that an unavailable service is available.

---

# 13. Provider Fallback Must Be Dynamic

When several providers can satisfy the same capability, the runtime may use fallback.

Example:

```
web.search
```

may have:

```
Provider A
Provider B
Provider C
Remote Agent
```

The runtime may select another provider when appropriate.

However, fallback must consider the reason for failure.

Examples:

```
QUOTA_EXHAUSTED
RATE_LIMITED
TIMEOUT
NETWORK_ERROR
AUTH_REQUIRED
UNSUPPORTED_CAPABILITY
PROVIDER_ERROR
PERMISSION_DENIED
```

Do not blindly retry every provider for every error.

Provider selection must be policy-driven.

---

# 14. External AI Delegation Must Be Structured

An external AI may be used as a provider or delegated agent.

If Evis delegates a task, it must use an explicit contract.

Conceptually:

```
Delegation Request

task_id
capability
objective
context
constraints
resources
expected_output_schema
```

The returned result should contain structured information such as:

```
task_id
status
result
artifacts
metadata
errors
verification
```

Do not rely on arbitrary natural-language responses when structured interoperability is required.

---

# 15. Research Before Implementation

When a technology, library, API, framework, protocol or tool is involved, the agent MUST verify that the proposed implementation is appropriate.

Do not automatically use:

* obsolete libraries
* deprecated APIs
* abandoned frameworks
* outdated integration methods
* unnecessary dependencies
* incompatible protocols
* old patterns merely because they are familiar

Research should consider:

* current official documentation
* current API behavior
* supported versions
* compatibility
* maintenance status
* security implications
* local environment compatibility
* project requirements

Use authoritative sources whenever possible.

---

# 16. Research Does Not Mean Endless Research

Research must have a purpose.

Use research to answer questions such as:

* Is this technology still appropriate?
* Is there a better supported approach?
* Does this provider support the required feature?
* Does this model support tool calling?
* Is this API deprecated?
* What is the correct integration method?
* Are there important limitations?

Once the required information is established, implement.

Do not spend unlimited resources searching for marginal improvements.

---

# 17. Every File Must Be Treated as Important

When implementing a file, do not treat it as disposable.

For every significant file:

1. Understand its responsibility.
2. Understand its dependencies.
3. Understand its dependents.
4. Determine its public interfaces.
5. Determine its invariants.
6. Implement the required behavior.
7. Run it.
8. Test it.
9. Inspect the result.
10. Optimize where justified.
11. Test again.
12. Verify integration.
13. Only then consider the file complete.

The mindset must be:

```
"If this file is the foundation of the next layer,
 would I trust it?"
```

---

# 18. Mandatory Implementation Loop

For each significant component:

```
RESEARCH
   ↓
UNDERSTAND
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
RUN
   ↓
TEST
   ↓
INSPECT
   ↓
OPTIMIZE
   ↓
RESEARCH AGAIN IF NECESSARY
   ↓
TEST AGAIN
   ↓
VERIFY
   ↓
MARK COMPLETE
   ↓
NEXT COMPONENT
```

Do not skip directly from:

```
IMPLEMENT → NEXT
```

unless the component is trivial and its correctness is already demonstrable.

---

# 19. Optimization Has a Boundary

Optimization must be evidence-based.

Do not endlessly optimize code that already satisfies its acceptance criteria.

A component is ready to proceed when:

* it satisfies its contract
* its tests pass
* integration works
* no forbidden shortcut exists
* no known critical issue remains
* performance is acceptable for its role
* its architecture is consistent with the project

The objective is:

```
reliable → correct → maintainable → efficient
```

Not:

```
endlessly optimized → never finished
```

---

# 20. Definition of Done Is Mandatory

A component must not be declared complete merely because it compiles.

Before declaring completion, verify:

```
[ ] Correct responsibility
[ ] Correct architecture
[ ] Correct dependencies
[ ] Real implementation
[ ] No forbidden simulation
[ ] No architectural bypass
[ ] Error handling
[ ] Required tests
[ ] Integration verified
[ ] Performance acceptable
[ ] Security constraints respected
[ ] Documentation updated where necessary
```

If an item is not satisfied, the component is not complete.

---

# 21. Dependencies Must Be Respected

Do not implement a component whose required foundation does not exist.

If:

```
Component B
    depends on
Component A
```

then A must be sufficiently complete before B is considered implementable.

If a dependency is missing:

```
STOP
    ↓
identify dependency
    ↓
report it
    ↓
implement dependency first
```

Do not create a fake version of the dependency merely to continue.

---

# 22. Build Bottom-Up

Evis must be built in dependency order.

Foundational infrastructure comes before advanced features.

For example:

```
Domain Definitions
    ↓
Registries
    ↓
Tools
    ↓
Providers
    ↓
Skills
    ↓
Permissions
    ↓
Context
    ↓
Tool Calling
    ↓
Agent Loop
    ↓
Orchestrator
    ↓
First End-to-End Skill
    ↓
Additional Skills
    ↓
Advanced Workflows
```

Do not implement advanced features merely because they are visually impressive.

---

# 23. One Complete Vertical Slice Is Better Than Ten Broken Features

Before implementing many skills, prove one complete skill from end to end.

Preferred first proof:

```
Filesystem Skill
```

Required path:

```
User
  ↓
Orchestrator
  ↓
Capability Resolution
  ↓
Skill Resolution
  ↓
Tool Resolution
  ↓
Permission
  ↓
Model Tool Call
  ↓
Tool Validation
  ↓
Real Filesystem Execution
  ↓
Tool Result
  ↓
Model
  ↓
Verification
  ↓
Final Response
```

If this complete path does not work, do not pretend that the skill architecture is complete.

---

# 24. Disabled Capability Test Is Mandatory

For every important capability, test both:

```
AVAILABLE
```

and:

```
UNAVAILABLE
```

Example:

```
Filesystem Skill enabled
    ↓
file.write available
    ↓
operation succeeds
```

Then:

```
Filesystem Skill disabled
    ↓
file.write unavailable
    ↓
tool cannot be called
    ↓
operation is blocked
    ↓
Evis explains why
```

This proves that the runtime is actually controlling capabilities.

---

# 25. Failure Must Be Honest

When something cannot be done, Evis must report the real reason.

Examples:

```
capability unavailable
provider unavailable
dependency missing
permission denied
quota exhausted
authentication required
model incompatible
network unavailable
tool execution failed
```

Never transform:

```
"I cannot perform this operation"
```

into:

```
"Operation completed successfully"
```

Never create a fake artifact to hide a failure.

---

# 26. Do Not Hide Incomplete Architecture

If a feature works only because of a temporary shortcut, say so.

If a subsystem is partially implemented, say so.

If a provider lacks a required feature, say so.

If the current architecture prevents correct implementation, stop and report it.

The agent must prefer:

```
"This cannot correctly be implemented yet because X is missing."
```

over:

```
"I created a workaround that makes it appear to work."
```

---

# 27. Preserve Working Components

Do not rewrite working infrastructure unnecessarily.

Before replacing something:

1. Understand why it exists.
2. Verify whether it already satisfies the required contract.
3. Identify the exact deficiency.
4. Modify only what is necessary where possible.

Avoid large rewrites merely because a different implementation appears cleaner.

---

# 28. Avoid Unnecessary Dependencies

Before adding a dependency, ask:

* Is it necessary?
* Is it maintained?
* Is it compatible?
* Is there already an equivalent dependency?
* Does the standard library already provide the required functionality?
* Does it introduce unnecessary complexity?

Do not add libraries merely to avoid writing a small amount of understandable code.

---

# 29. Do Not Duplicate Existing Systems

Before creating:

* a new registry
* a new provider manager
* a new API client
* a new filesystem service
* a new state manager
* a new skill loader

inspect the project for an existing implementation.

If an existing component can be extended correctly, prefer extending it.

Duplicate systems create conflicting sources of truth.

---

# 30. Frontend Is Not the Runtime

The UI may:

* display state
* request actions
* display results
* display permissions
* display skills
* display providers
* display progress
* request confirmation

The UI must not secretly implement:

* capability resolution
* tool execution
* provider routing
* filesystem execution
* terminal execution
* agent loops
* security enforcement

Those belong to the runtime/backend architecture.

---

# 31. User Interaction Must Reflect Real Runtime State

If the UI says:

```
Skill: Active
```

the runtime should actually consider that skill active.

If the UI says:

```
Provider: Available
```

the provider should actually be available.

If the UI says:

```
Tool: Ready
```

the tool must actually be usable.

Do not display states that are merely visual simulations.

---

# 32. Do Not Create Features Solely Because They Are Easy to Demonstrate

Easy:

```
button → hard-coded response
```

Correct:

```
button → application request → runtime → real operation → result
```

Easy:

```
skill checkbox → prompt injection
```

Correct:

```
skill activation → registry → validation → capability availability → runtime
```

Easy:

```
search button → static results
```

Correct:

```
search request → provider resolution → real search → real results
```

The second form is required.

---

# 33. Agent Work Must Be Measurable

For substantial tasks, the agent should maintain an explicit implementation state.

Conceptually:

```
CURRENT COMPONENT
CURRENT PHASE
DEPENDENCIES
TEST STATUS
KNOWN ISSUES
ACCEPTANCE CRITERIA
COMPLETION STATUS
```

This prevents the agent from wandering through unrelated parts of the project.

---

# 34. Do Not Waste Context or Quota

The agent must avoid unnecessary work.

Do not repeatedly:

* reread unchanged files
* rediscover the same architecture
* rewrite correct code
* regenerate unchanged documentation
* perform broad research for a local problem
* modify unrelated components
* restart completed analysis

Use focused inspection.

Use the smallest context required for the current task.

---

# 35. Changes Must Be Traceable

For important architectural changes, the agent should be able to explain:

```
What changed?
Why?
Which layer owns the change?
What dependencies were affected?
What tests were performed?
What remains incomplete?
```

Avoid unexplained large-scale modifications.

---

# 36. Never Confuse Output With Correctness

The existence of an output does not prove that the system works.

For example:

```
File created
```

does not prove that the agent architecture works.

You must verify:

```
Who requested the operation?
Why was the capability selected?
Which skill provided it?
Which tool executed it?
Was permission checked?
Did the model produce the tool call?
Was the call validated?
Was the real file created?
Was the result returned to the model?
Was the final state verified?
```

The execution path matters.

---

# 37. Architecture Invariants

The following are mandatory Evis invariants.

1. The UI does not directly execute privileged tools.

2. The model does not directly bypass the runtime.

3. Skills do not grant themselves permissions.

4. Tools do not define their own authorization policy.

5. Capability resolution is independent from manual skill selection.

6. Relevant skills are resolved dynamically.

7. Tool calls are real when tool calling is required.

8. Tool results return to the model when additional reasoning is required.

9. Disabled skills cannot expose their protected capabilities.

10. Missing capabilities cannot be simulated.

11. Providers are replaceable.

12. Tools are replaceable.

13. Skills are extensible.

14. Security enforcement remains independent.

15. The system must be able to report failure honestly.

16. Advanced features cannot bypass foundational runtime layers.

17. No single feature may become the hidden source of truth for the entire system.

---

# 38. Before Implementing a New File

The agent MUST answer internally or document where appropriate:

```
What is this file responsible for?

What does it depend on?

What depends on it?

What interface does it expose?

What state does it own?

What state must it NOT own?

What errors can occur?

What security constraints apply?

What tests prove that it works?

What existing implementation could conflict with it?
```

Only then implement.

---

# 39. Before Moving to the Next File

The current file/component must satisfy its acceptance criteria.

Required sequence:

```
Implement
   ↓
Run
   ↓
Test
   ↓
Inspect
   ↓
Fix
   ↓
Verify
   ↓
Complete
   ↓
Next
```

Do not leave partially implemented foundations behind while building higher-level features.

---

# 40. When Requirements Are Ambiguous

Do not silently invent behavior when the ambiguity affects architecture.

Instead:

1. identify the ambiguity
2. determine whether the existing architecture resolves it
3. if not, state the assumption
4. choose the smallest architecture-consistent interpretation
5. continue only if the assumption does not compromise the system

Do not silently introduce a fundamentally different architecture.

---

# 41. When a Better Architecture Is Discovered

The agent may discover a better implementation.

It must not silently replace the specified architecture.

Instead:

```
Existing requirement
    ↓
Proposed improvement
    ↓
Explain trade-offs
    ↓
Verify compatibility
    ↓
Obtain approval when architectural behavior changes
```

Optimization is allowed.

Silent architectural substitution is not.

---

# 42. Completion Has Meaning

The words:

```
COMPLETE
IMPLEMENTED
WORKING
SUPPORTED
```

must only be used when the corresponding functionality has actually been verified.

If only the interface exists:

```
say "UI implemented"
```

If only the backend exists:

```
say "backend implemented"
```

If the integration is missing:

```
say "integration incomplete"
```

If the capability is simulated:

```
say "simulation"
```

Do not use "complete" for partially connected systems.

---

# 43. Final Engineering Principle

The goal is not to make Evis appear intelligent.

The goal is to make Evis **actually operate as an intelligent runtime**.

Therefore:

```
Do not fake capability.
Do not bypass reasoning.
Do not bypass orchestration.
Do not bypass security.
Do not confuse skills with prompts.
Do not confuse tools with capabilities.
Do not confuse output with correctness.
Do not confuse a demonstration with an implementation.
```

Build the foundation.

Verify the foundation.

Then build upon it.

---

# 44. Final Required Workflow

For every substantial Evis task, follow this sequence:

```
1. INSPECT
   Understand the current system.

2. RESEARCH
   Verify relevant technologies and approaches.

3. DEFINE
   Identify responsibilities, dependencies and acceptance criteria.

4. PLAN
   Determine the smallest correct implementation.

5. IMPLEMENT
   Modify only the required layer.

6. RUN
   Execute the real system.

7. TEST
   Test expected and failure cases.

8. INSPECT
   Verify that the actual execution path matches the architecture.

9. OPTIMIZE
   Improve only where justified.

10. VERIFY AGAIN
    Ensure optimization did not break behavior.

11. COMPLETE
    Mark the component complete only if its contract is satisfied.

12. PROCEED
    Only then move to the next dependency.
```

---

# 45. The Rule Above All Rules

If satisfying a request quickly conflicts with building Evis correctly:

**Build Evis correctly.**

If a shortcut produces the desired output but violates the architecture:

**Do not use the shortcut.**

If a required capability does not exist:

**Do not simulate it.**

If a dependency is missing:

**Build the dependency first.**

If the implementation cannot currently be correct:

**Stop, explain what is missing, and do not pretend that it is complete.**

Evis is intended to become a real extensible AI runtime.

Every implementation decision must move the project toward that objective.


