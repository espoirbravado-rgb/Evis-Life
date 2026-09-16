---

name: terminal
description: Execute authorized operating-system commands and processes through the permanent Evis terminal runtime. Use for shell commands, scripts, builds, tests, package operations, development tooling, process inspection, and other operations that genuinely require command execution. Terminal is a core runtime capability and is always available to the execution layer; the planner does not control whether the terminal capability exists.
version: 2.0.0
license: proprietary
tags:

  - terminal
  - shell
  - command-execution
  - process
  - execution
  - runtime
  - linux
  - development

---

# Terminal Command Runner

## Identity

- **ID**: terminal
- **Name**: Terminal Command Runner
- **Version**: 2.0.0
- **Author**: Evis Core Team
- **Category**: runtime-core
- **Stability**: core
- **Availability**: permanent
- **Execution Model**: runtime-mediated
- **Security Model**: policy-mediated

## Purpose

Provide Evis with a controlled and observable mechanism for executing operating-system commands and processes through the host environment.

The Terminal capability is a foundational runtime capability.

It must remain available to the execution layer regardless of whether the Planner explicitly includes `terminal.execute` in its capability selection.

The Planner may identify when a terminal operation is required, but it must not be responsible for creating, activating, or making the Terminal capability exist.

The runtime is responsible for:

- command execution
- process creation
- working-directory handling
- environment handling
- timeout and cancellation
- stdout/stderr capture
- exit-code reporting
- authorization
- policy enforcement
- execution state
- structured errors
- observability

The Skill describes the terminal capability and its usage contract. It does not itself execute commands.

## Scope

The Terminal Skill covers authorized operating-system command execution, including:

- executing shell commands
- executing scripts
- running development tools
- running project commands
- running tests
- running builds
- running package-manager commands
- inspecting process state
- inspecting command output
- executing deterministic helper commands
- invoking installed CLI tools
- executing commands with a specified working directory
- executing commands with controlled environment variables
- terminating or cancelling supported processes
- collecting structured execution results

The exact set of permitted commands and environments is determined by the runtime policy.

The Skill does not grant unrestricted operating-system access.

## Triggers

### When to Use

Use this capability when execution of an operating-system process or command is genuinely required, including:

- running a shell command
- executing a script
- running a test suite
- running a build
- running a compiler
- running a development server
- installing project dependencies
- invoking package managers
- invoking Git or other development CLIs
- inspecting processes
- inspecting command-line environment state
- executing deterministic project automation
- performing an operation for which no higher-level registered tool exists
- executing backend helpers used by another runtime capability

Examples:

```text
npm install
npm test
npm run build
git status
python script.py
node script.js
bash script.sh
```

### Do Not Use as the Primary Capability For

Do not use Terminal as a substitute for a higher-level capability when that capability is explicitly available and appropriate.

Examples:

- ordinary filesystem operations should prefer `filesystem`
- web retrieval should use the Web subsystem
- model inference should use the model/provider subsystem
- memory operations should use Working Memory
- UI manipulation should use UI/runtime capabilities

However, the existence of a higher-level capability must not be interpreted as meaning that Terminal is unavailable.

Terminal remains a permanent runtime capability.

## Capabilities

The Terminal Skill provides:

- `terminal.execute`

Future capabilities may include:

- `terminal.spawn`
- `terminal.session`
- `terminal.stdin`
- `terminal.signal`
- `terminal.inspect`

Only capabilities actually registered by the runtime may be exposed as executable capabilities.

## Permanent Runtime Status

Terminal is a core runtime capability.

The following rule is mandatory:

```text
Terminal exists independently of Planner capability selection.
```

Therefore:

```text
User Request
    ↓
Planner
    ↓
Capability requirements
    ↓
Execution Plan
    ↓
Runtime
    ├── permanent Terminal capability
    ├── resolved task-specific tools
    └── other runtime capabilities
```

The Planner must not be required to explicitly request the existence of Terminal.

Incorrect:

```text
Planner
 ↓
terminal.execute not requested
 ↓
Terminal unavailable
```

Correct:

```text
Planner
 ↓
Terminal is permanently registered
 ↓
Execution layer can resolve terminal.execute whenever required
```

The Planner may still identify `terminal.execute` as a requirement for a particular operation.

That requirement controls task planning, not Terminal existence.

## Tools

- `terminal`

The Skill requires a registered Terminal Tool capable of executing authorized commands.

Tool resolution is performed by the Evis runtime.

The Skill does not assume a specific shell implementation.

Possible runtime implementations include:

```text
node:child_process
spawn
exec
execFile
platform-specific process APIs
sandboxed execution provider
container execution provider
```

The implementation is replaceable as long as it satisfies the Terminal Tool contract.

## Dependencies

### Runtime

- **Type**: runtime
- **ID**: evis-runtime
- **Name**: Evis Runtime
- **Target**: terminal-capability-runtime
- **Optional**: false

### Terminal Execution Engine

- **Type**: execution-engine
- **ID**: terminal-execution-engine
- **Name**: Authorized Terminal Execution Engine
- **Target**: host-process-execution
- **Optional**: false

### Policy

- **Type**: security
- **ID**: policy-engine
- **Name**: Evis Policy Engine
- **Target**: terminal-execution-policy
- **Optional**: false

### Permission Manager

-**Type**: security
-**ID**: permission-manager
-**Name**: Evis Permission Manager
-**Target**: terminal-permissions
-**Optional**: false

The Terminal Skill does not depend on the Filesystem Skill.

This prevents a circular dependency:

```text
terminal
  ↕
filesystem
```

Filesystem implementations may internally use the Terminal runtime when appropriate, but Terminal itself remains an independent foundational capability.

## Permissions

The Terminal Skill requires authorization for command execution.

Required permission category:

-`terminal.execute`

Additional permissions may be required depending on:

-command
-working directory
-target files
-network access
-process lifetime
-environment variables
-privileged operations
-destructive operations
-external services

The Skill declares permission requirements but never grants permissions itself.

## Constraints

-Operate only within runtime-authorized execution boundaries.
-Do not bypass the Policy Engine.
-Do not bypass the Permission Manager.
-Do not execute privileged operations without explicit authorization.
-Do not silently elevate privileges.
-Do not expose credentials or secrets unnecessarily.
-Do not leak environment secrets through command output.
-Do not claim execution succeeded unless the runtime reports success.
-Preserve actual stdout, stderr, exit code, and execution errors.
-Respect configured timeouts.
-Respect cancellation requests.
-Respect configured working-directory restrictions.
-Respect environment-variable restrictions.
-Respect process/resource limits.
-Destructive operations must follow runtime authorization and confirmation policy.
-Commands originating from untrusted model output must pass through the runtime security boundary.
-Shell metacharacters and command composition must be treated as security-sensitive.
-Never treat command text as inherently safe merely because it was generated by an AI model.
-Never silently replace a failed command with a fabricated successful result.

When shell execution is used, the runtime must treat the command string as executable code and apply appropriate policy and validation. Node's own documentation warns against passing unsanitized input to shell-enabled execution APIs because shell metacharacters can result in arbitrary command execution.

## Inputs

A Terminal execution request may contain:

-`command`
-`args`
-`cwd`
-`env`
-`shell`
-`timeout`
-`signal`
-`stdin`
-execution options
-request metadata
-authorization context

Conceptually:

```typescript
{
  command: string,
  args?: string[],
  cwd?: string,
  env?: Record<string, string>,
  shell?: boolean | string,
  timeout?: number,
  stdin?: string,
  options?: object
}
```

The exact schema belongs to the registered Terminal Tool contract.

The Skill must not invent or hard-code provider-specific schemas.

## Command Execution Modes

The runtime may support different execution modes.

### Direct Process Execution

Prefer direct executable invocation when the operation does not require shell semantics.

Conceptually:

```text
command
args[]
 ↓
process
```

This avoids unnecessary shell interpretation.

### Shell Execution

Use shell execution when shell functionality is genuinely required.

Examples:

```text
pipes
redirection
shell operators
shell scripts
environment expansion
globbing
```

Conceptually:

```text
command string
 ↓
authorized shell
 ↓
process
```

Shell execution is security-sensitive and must remain policy-mediated.

### Script Execution

Scripts may be executed through the appropriate interpreter.

Examples:

```text
bash script.sh
python script.py
node script.js
```

The interpreter and script path must remain subject to runtime authorization.

## Outputs

A successful Terminal operation should produce structured execution data.

Conceptually:

```typescript
{
  success: boolean,
  exitCode: number | null,
  stdout: string,
  stderr: string,
  command: string,
  cwd: string,
  startedAt: string,
  finishedAt: string,
  durationMs: number,
  signal?: string | null
}
```

The exact runtime schema may differ.

The important requirement is that the result preserves meaningful execution state.

Possible outcomes include:

```text
SUCCESS
NON_ZERO_EXIT
TIMEOUT
CANCELLED
COMMAND_NOT_FOUND
PERMISSION_DENIED
WORKING_DIRECTORY_NOT_FOUND
POLICY_DENIED
AUTH_REQUIRED
EXECUTION_ERROR
RESOURCE_LIMIT
```

## Error Handling

The Terminal runtime must normalize execution failures.

Provider/runtime-specific errors may be retained as metadata.

At minimum, the runtime should distinguish:

```text
command could not start
command started but failed
command timed out
command was cancelled
command was denied by policy
command was denied by permissions
working directory was invalid
command was not found
process terminated by signal
output exceeded configured limits
```

A non-zero exit code is an actual execution result.

It must not be converted into a generic success/failure message that hides the process result.

## Working Directory

Terminal execution must support an explicit working directory where authorized.

Example:

```text
cwd:
  /home/user/project
```

The runtime must verify that the requested directory is permitted and exists before execution.

If no `cwd` is supplied, the runtime may use its configured default execution directory.

The Skill must not assume a fixed filesystem location.

## Environment

The runtime may provide a controlled environment to the process.

Environment handling must consider:

```text
PATH
HOME
project variables
runtime variables
provider variables
credentials
secrets
```

Secrets must not be exposed to the model or logs unnecessarily.

The Skill does not embed secrets.

## Timeout and Cancellation

Long-running commands must support runtime-controlled cancellation.

Possible flow:

```text
execute
  ↓
process running
  ↓
timeout / cancellation
  ↓
terminate process
  ↓
collect final state
  ↓
structured result
```

The runtime should prefer asynchronous process execution so that long-running commands do not block the application event loop.

Node's synchronous child-process APIs block the event loop, while asynchronous process APIs support timeout and `AbortSignal` cancellation.

## Interactive Execution

Interactive terminal sessions are a future extension unless the runtime already implements them.

A future implementation may provide:

```text
terminal.session
terminal.stdin
terminal.stdout
terminal.stderr
terminal.signal
terminal.close
```

The current `terminal.execute` capability should remain sufficient for deterministic command execution.

Interactive sessions must not be simulated by concatenating commands into a fake terminal transcript.

## Filesystem Relationship

Filesystem and Terminal are separate capabilities.

```text
Filesystem
    ↓
file.read
file.write
file.create
file.modify
...

Terminal
    ↓
terminal.execute
```

However, the runtime implementation may internally use Terminal execution for filesystem operations when appropriate.

Therefore:

```text
Filesystem Skill
    ↓
Filesystem Tool
    ↓
runtime filesystem implementation
    ↓
Terminal runtime
    ↓
OS
```

may be a valid implementation path.

The reverse dependency is not required:

```text
Terminal
    ✕
Filesystem Skill
```

Terminal must remain independently usable.

This separation prevents the capability graph from confusing:

```text
"this operation manipulates files"
```

with:

```text
"this operation requires arbitrary shell execution"
```

The runtime chooses the appropriate implementation path.

## Instructions

When a request requires terminal execution:

1. Determine whether command execution is genuinely required.
2. Resolve `terminal.execute` through the runtime.
3. Preserve the user's intended command or the runtime-approved command representation.
4. Resolve the execution context.
5. Resolve the working directory.
6. Resolve required permissions.
7. Run Policy evaluation.
8. Execute through the registered Terminal Tool.
9. Collect actual stdout, stderr, exit code, timing, and process state.
10. Inspect the actual result.
11. Determine whether the operation succeeded.
12. Preserve meaningful errors.
13. Return the structured result to the Agent/Orchestrator.
14. Allow the model to reason about the actual result.
15. Never fabricate command execution.

The Skill must not itself:

```text
spawn processes
run shell commands
modify the filesystem
grant permissions
bypass policy
```

Those are runtime/tool responsibilities.

## Terminal Availability Rule

Terminal availability is not a Planner decision.

The runtime must register Terminal independently of the request-specific capability plan.

Conceptually:

```text
Runtime Initialization
        ↓
Register Core Capabilities
        ↓
Terminal registered
        ↓
Filesystem registered
        ↓
Other capabilities registered
        ↓
Planner / Agent Loop
```

The Planner may later produce:

```text
requiredCapabilities:
[
  "file.write"
]
```

without mentioning:

```text
terminal.execute
```

and Terminal must still exist as a runtime capability.

If the Filesystem implementation internally requires Terminal, that dependency is resolved by the runtime/tool implementation rather than by forcing the Planner to invent `terminal.execute`.

Conversely, when the user explicitly requests:

```text
run npm test
```

the Planner may produce:

```text
terminal.execute
```

and the same permanent Terminal capability is used.

## Interaction With Other Skills

### Filesystem

Filesystem handles high-level filesystem semantics.

Terminal handles process/command execution.

Do not collapse the two skills.

### Web Research

Web Research may use Terminal for local helper scripts only when the runtime plan explicitly requires such execution.

Web access itself remains governed by the Web subsystem.

### Memory

Terminal execution results may be stored in Working Memory when they are relevant to the current task.

The memory system should preserve:

```text
command
cwd
result
exitCode
relevant output
error
reference
```

rather than storing unnecessary raw output indefinitely.

### Git

Git operations may be executed through Terminal when Git has not been implemented as a dedicated capability/tool.

If a dedicated Git capability exists, it should be preferred for Git-specific semantics while Terminal remains available.

## Resources

The Skill may provide or reference:

-command execution schemas
-runtime execution rules
-shell compatibility documentation
-process lifecycle documentation
-environment conventions
-working-directory conventions
-timeout configuration
-command safety guidance
-platform-specific execution guidance
-deterministic helper scripts

Resources are loaded only when required.

## Configuration

The Skill may depend on runtime configuration including:

-default working directory
-authorized working directories
-allowed commands
-denied commands
-shell executable
-environment policy
-timeout limits
-output limits
-process limits
-cancellation policy
-privileged-command policy
-confirmation requirements
-sandbox configuration
-execution provider configuration

Configuration values are supplied by the Evis runtime.

Secrets must never be embedded in the Skill manifest.

## Security Model

Terminal is a high-impact capability because it can potentially invoke arbitrary operating-system functionality.

Therefore the execution chain must remain:

```text
Request
  ↓
Goal
  ↓
Capability
  ↓
Terminal Tool
  ↓
Permission Manager
  ↓
Policy Engine
  ↓
Execution Engine
  ↓
Operating System
```

The Skill itself is not a security boundary.

The runtime is the security boundary.

The model must not receive unrestricted direct access to the operating system.

Node's security guidance explicitly places responsibility on the application to validate untrusted input, establish access-control boundaries, and avoid exposing dangerous low-level APIs directly to untrusted users.

## Observability

Every meaningful Terminal execution should have an execution record containing, where permitted:

```text
requestId
executionId
capability
command
cwd
provider/tool
startedAt
finishedAt
durationMs
exitCode
signal
stdout metadata
stderr metadata
policy decision
permission decision
error
```

Sensitive command arguments, credentials, tokens, and environment values must not be logged unnecessarily.

## Result Provenance

The runtime should preserve the relationship:

```text
request
 ↓
terminal execution
 ↓
command
 ↓
process
 ↓
result
```

This allows the Agent/Orchestrator to understand what actually happened.

Example:

```text
execution:E017
    ├── request:R014
    ├── capability:terminal.execute
    ├── cwd:/project
    ├── command:npm test
    ├── exitCode:0
    └── result:success
```

## No Simulation

The following are explicitly invalid:

```text
fake terminal output
fake command execution
hard-coded command responses
prewritten stdout
pretending a process ran
pretending a build succeeded
pretending tests passed
simulated exit codes
```

A Terminal operation is complete only when the runtime has actually executed the process and returned its real result.

## No Hidden Execution

No Skill may silently execute arbitrary commands outside the Terminal Tool boundary.

If a component needs operating-system execution:

```text
component
    ↓
Terminal capability
    ↓
Terminal Tool
    ↓
Policy / Permission
    ↓
Execution Engine
```

must remain observable to the runtime.

This includes internal helper operations.

## Example: Explicit Terminal Request

User:

```text
Run the project's tests.
```

Runtime:

```text
Request
 ↓
Goal
 ↓
terminal.execute
 ↓
Policy
 ↓
Permission
 ↓
Terminal Tool
 ↓
npm test
 ↓
actual stdout/stderr
 ↓
exit code
 ↓
Agent
 ↓
response
```

## Example: Filesystem Operation

User:

```text
Create a file called notes.md on the Desktop.
```

The Planner may determine that the semantic capability is:

```text
file.create
file.write
```

The Planner does not need to invent:

```text
terminal.execute
```

merely because the underlying filesystem implementation may use Terminal internally.

Runtime:

```text
Request
 ↓
Filesystem capability
 ↓
Filesystem Tool
 ↓
authorized filesystem implementation
 ↓
Terminal runtime if required internally
 ↓
OS filesystem
 ↓
actual result
```

The Terminal capability remains available throughout the operation.

## Example: Terminal Operation Used Internally

```text
Filesystem Tool
      ↓
needs implementation primitive
      ↓
Terminal runtime
      ↓
authorized process
      ↓
filesystem change
      ↓
Filesystem result
```

This is an implementation detail of the runtime and must not be confused with Planner capability selection.

## Example: Failed Execution

```text
terminal.execute
      ↓
npm test
      ↓
exitCode:1
      ↓
stderr
      ↓
Agent
      ↓
"Tests failed."
```

The model must receive the actual failure information.

It must not receive:

```text
"Tests passed."
```

unless the runtime actually reports success.

## Definition of Done

The Terminal Skill is correctly implemented when:

```text
[ ] SKILL.md follows the complete Evis manifest architecture.
[ ] Terminal is registered as a core runtime capability.
[ ] Terminal availability does not depend on Planner output.
[ ] terminal.execute is registered.
[ ] A real Terminal Tool exists.
[ ] Terminal execution passes through Policy.
[ ] Terminal execution passes through Permission Manager.
[ ] Commands are actually executed.
[ ] stdout is captured.
[ ] stderr is captured.
[ ] exit codes are preserved.
[ ] process errors are preserved.
[ ] working directories are supported.
[ ] controlled environment variables are supported.
[ ] timeout is supported.
[ ] cancellation is supported.
[ ] execution state is observable.
[ ] secrets are not unnecessarily exposed.
[ ] shell execution is treated as security-sensitive.
[ ] no fake command execution exists.
[ ] no fake output exists.
[ ] no fake success exists.
[ ] Terminal does not depend on Filesystem Skill.
[ ] Filesystem may use Terminal internally without changing its semantic capability contract.
[ ] Terminal remains available even when Planner does not request terminal.execute.
[ ] Explicit terminal requests resolve terminal.execute correctly.
[ ] Actual execution results reach the Agent Loop.
```

## Metadata

-**Category**: runtime-core
-**Stability**: core
-**Tags**:

  -terminal
  -shell
  -process
  -execution
  -runtime
  -linux
  -development
-**Execution Model**: runtime-mediated
-**Security Model**: policy-mediated
-**Availability**: permanent
-**Planner Controlled Availability**: false
-**Permission Controlled Execution**: true
-**State**: runtime-managed
-**Version**: 2.0.0
