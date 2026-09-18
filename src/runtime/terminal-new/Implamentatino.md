# Evis — Terminal-New Implementation Blueprint

## 0. Objective

`src/runtime/terminal-new/` is the next-generation terminal runtime for Evis.

Its responsibility is to provide a real agentic execution environment capable of:

* one-shot command execution
* persistent terminal sessions
* process lifecycle management
* background processes
* interactive terminal support
* PTY execution
* streaming output
* command/output parsing
* approval and permission control
* sandbox integration
* secret redaction
* checkpoints and rollback
* observability
* structured results and events

The implementation must be real.

No class, interface, method, event, sandbox, PTY, process state, or security mechanism should exist only as a placeholder.

A capability is considered implemented only when:

1. its contract exists;
2. its runtime behavior exists;
3. it is connected to `TerminalRuntime`;
4. it has tests;
5. its result is observable;
6. failure behavior is explicit.

---

# 1. Current Status

## Already structurally present

The new tree already contains:

```text
terminal-new/
├── checkpoint/
├── interactive/
├── observability/
├── parser/
├── process/
├── pty/
├── sandbox/
├── security/
├── session/
├── streaming/
├── terminalEnvironment.ts
├── terminalPolicy.ts
├── terminalRuntime.ts
├── terminalTypes.ts
├── index.ts
└── tests/
```

This architecture should be preserved unless an implementation discovery proves that a component belongs elsewhere.

---

# 2. Critical Problems Found During Audit

## 2.1 `TerminalRuntime` is not yet a real session runtime

`execute()` creates or retrieves a `TerminalSession`, but every command still creates a new child process.

Therefore:

```bash
cd project
```

does not actually establish shell state for:

```bash
npm test
```

The session currently stores cwd/environment as metadata, but it does not own a persistent shell process.

### Required change

Introduce two execution modes:

```text
one-shot
persistent session
```

One-shot:

```text
execute(command)
    -> spawn
    -> collect
    -> result
```

Persistent:

```text
session
    -> shell/PTY process
    -> write command
    -> receive events
    -> maintain state
```

---

# 3. `terminalTypes.ts`

## Current role

Defines:

* `ProcessId`
* `SessionId`
* `CommandExecutionOptions`
* `CommandOutputChunk`
* `CommandResult`
* `ProcessSpawnConfig`

## Required implementation

Expand the contracts to represent the actual runtime.

Add concepts for:

```text
TerminalRequest
TerminalResult
TerminalEvent
ProcessState
ProcessHandleSnapshot
SessionSnapshot
PTY configuration
background execution
approval context
sandbox context
resource limits
```

The type system must distinguish:

```text
command result
process state
session state
terminal event
```

Do not overload `CommandResult` to represent every possible terminal state.

### Important

`background`, `interactive`, `allowElevated`, etc. must not remain unused fields.

Every exposed option must have a defined runtime meaning.

---

# 4. `terminalPolicy.ts`

## Current implementation

Already contains:

* default timeout
* maximum timeout
* output limit
* background flag
* blocked commands
* restricted patterns
* concurrent process limit

## Problems

`isRestricted()` exists but is not actually integrated into `TerminalRuntime`.

`allowBackground` exists but `execute()` does not use it.

The policy is mostly command-pattern based.

## Required implementation

Turn this into the central execution-policy layer.

It should evaluate:

```text
command
cwd
session
execution mode
background
interactive
network requirement
elevation requirement
resource limits
agent identity
```

Return a structured decision:

```text
allow
deny
require_approval
```

Do not make security decisions independently in several unrelated files.

---

# 5. `terminalEnvironment.ts`

## Current implementation

It:

* inherits `process.env`
* applies session variables
* applies custom variables
* injects non-interactive variables

## Problems

It currently exposes the host environment by default.

There is no real allowlist/blocklist mechanism here.

## Required implementation

Implement explicit environment policies:

```text
inheritProcessEnv
allowedEnvKeys
blockedEnvKeys
sessionEnv
requestEnv
```

Environment precedence should be documented and deterministic.

Recommended order:

```text
safe base environment
    ↓
session environment
    ↓
request environment
    ↓
runtime enforced variables
```

Secrets must not automatically become visible to the agent.

---

# 6. `terminalRuntime.ts`

## This is the central integration layer.

It should NOT become a 500-line implementation containing every subsystem's logic.

Its responsibility should be orchestration:

```text
request
 ↓
policy
 ↓
permission
 ↓
approval
 ↓
sandbox
 ↓
session/process selection
 ↓
execution
 ↓
events
 ↓
output processing
 ↓
audit/metrics
 ↓
structured result
```

## Required capabilities

### One-shot

```ts
execute(...)
```

### Session

```ts
createSession(...)
getSession(...)
closeSession(...)
```

### Process

```ts
listProcesses(...)
inspectProcess(...)
killProcess(...)
signalProcess(...)
```

### Background

```ts
startBackground(...)
```

### Interactive

```ts
write(...)
resize(...)
```

### Observability

```ts
subscribe(...)
```

### Security

```ts
requestApproval(...)
```

The runtime must also propagate:

```text
sessionId
processId
actorId
taskId
```

through the execution lifecycle.

---

# 7. `process/processHandle.ts`

## Current implementation

Already wraps `ChildProcess`.

It supports:

* pid
* status
* exit code
* duration
* kill
* stdin

## Problems

The process state machine is too simplistic.

`kill()` immediately changes the state to `killed`, even though the OS process may still be alive.

## Required implementation

Define real lifecycle:

```text
created
starting
running
stopping
exited
failed
killed
timeout
```

Track:

```text
startedAt
finishedAt
exitCode
signal
pid
parentPid
command
cwd
sessionId
```

Add:

```text
wait()
signal()
kill()
write()
snapshot()
```

Do not report `killed` before the actual process lifecycle confirms termination.

---

# 8. `process/processManager.ts`

## Current implementation

Provides:

* spawn
* registry
* killProcess
* cleanup

## Required implementation

Become the authoritative process manager.

Add:

```text
start
get
list
wait
kill
signal
cleanup
```

Support:

```text
foreground
background
session-owned
detached
```

Enforce:

```text
maxConcurrentProcesses
```

and eventually:

```text
maxProcessesPerSession
maxProcessesPerTask
```

The manager must know which process belongs to which session/task.

---

# 9. `process/processRegistry.ts`

## Current implementation

Keeps processes in memory.

## Required implementation

Add indexes by:

```text
processId
pid
sessionId
taskId
```

Support queries such as:

```text
listAll()
listActive()
listBySession()
listByTask()
```

Process cleanup must be explicit.

Completed processes should not stay forever in memory.

Introduce retention policy or bounded history.

---

# 10. `process/processSignals.ts`

## Current implementation

Supports:

```text
SIGINT
SIGTERM
SIGKILL
SIGHUP
SIGQUIT
```

## Required implementation

Add platform-aware behavior.

The runtime must distinguish:

```text
signal process
signal process group
terminate tree
force kill tree
```

The public API should not assume that every platform behaves like Linux.

Linux behavior can be the first supported implementation.

---

# 11. `process/processTree.ts`

## Current implementation

Uses:

```bash
pgrep -P
```

## Problems

This is Linux/Unix-specific and relies on spawning another command.

## Required implementation

Create a process-tree abstraction.

At minimum:

```text
getChildren(pid)
getDescendants(pid)
killTree(pid)
```

Document platform support.

Avoid recursive shell command execution through the same terminal runtime.

This subsystem must not accidentally create recursive terminal execution.

---

# 12. `session/terminalSession.ts`

## Current implementation

Stores:

* cwd
* env
* history
* timestamps

## Required implementation

The session must own actual execution state.

It should eventually contain:

```text
sessionId
cwd
environment
shell
shellPid
pty/process handle
history
activeProcesses
createdAt
lastActiveAt
```

A persistent session must actually preserve shell state.

---

# 13. `session/sessionManager.ts`

## Current implementation

Can:

* create session
* get session
* get/create
* close
* list

## Required implementation

Add lifecycle management:

```text
create
attach
detach
close
cleanup
list
```

Closing a session must define what happens to its processes.

Possible policy:

```text
close session
    ↓
terminate session-owned processes
    ↓
wait grace period
    ↓
force kill
    ↓
destroy session
```

---

# 14. `session/sessionState.ts`

Expand the snapshot.

It should describe:

```text
session
shell
cwd
environment metadata
active process IDs
PTY state
last activity
history metadata
```

Do not serialize secrets into session snapshots.

---

# 15. `pty/ptyTypes.ts`

## Current implementation

The interface is already conceptually good:

```text
pid
onData
onExit
write
resize
kill
```

## Required implementation

Add:

```text
sessionId
cwd
shell
env
process state
exit signal
```

Define whether `onData` represents:

```text
raw terminal bytes
```

or:

```text
decoded text
```

Prefer raw PTY output at this layer.

Parsing belongs elsewhere.

---

# 16. `pty/ptyExecutor.ts`

## Current state

This is a placeholder.

It explicitly returns:

```text
false
```

for PTY availability and throws an error when spawning.

## Required implementation

Add the actual PTY backend.

Preferred first implementation:

```text
node-pty
```

Capabilities:

```text
spawn
write
resize
kill
onData
onExit
```

If native PTY support is unavailable:

```text
PTY unavailable
```

must be an explicit runtime capability.

Do not pretend that stdio is a PTY.

---

# 17. `interactive/interactiveRules.ts`

## Current implementation

Contains default prompt patterns.

## Critical issue

Automatically answering:

```text
Are you sure?
```

with:

```text
yes
```

is dangerous for an autonomous agent.

## Required implementation

Separate:

```text
detected prompt
```

from:

```text
authorized response
```

Default rules should never silently approve destructive actions.

Especially:

```text
sudo
password
SSH host confirmation
git push
git reset
rm
package installation
```

must be governed by policy/approval.

---

# 18. `interactive/promptDetector.ts`

Keep the detector focused on detection.

It should return structured information:

```text
prompt type
matched text
confidence
sensitive flag
```

It should NOT decide whether the agent is allowed to answer.

---

# 19. `interactive/promptResponder.ts`

This component should only send input after policy authorization.

Flow:

```text
prompt detected
    ↓
classify
    ↓
policy
    ↓
approval if required
    ↓
response
```

Never:

```text
prompt detected
    ↓
automatically "yes"
```

for dangerous operations.

---

# 20. `parser/ansiCleaner.ts`

Current implementation is acceptable as a starting point.

Required:

* test common ANSI sequences
* test partial/chunked sequences
* preserve normal text
* avoid corrupting Unicode

The parser must not assume that every chunk contains a complete escape sequence.

---

# 21. `parser/outputParser.ts`

Current implementation is mostly a utility.

Required architecture:

```text
raw output
    ↓
ANSI normalization
    ↓
stream parser
    ↓
structured parser
    ↓
agent-facing representation
```

Structured parsing must never replace the raw output.

The agent should be able to receive:

```text
raw
+
structured
```

when available.

---

# 22. `parser/structuredCommands.ts`

Current implementation supports only:

```text
git status
ls
```

Do NOT build a giant collection of fragile parsers.

Instead create a registry:

```text
command pattern
    ↓
parser
    ↓
structured result
```

Only add parsers when they provide real value.

Potential future parsers:

```text
git status
git diff --stat
git branch
npm test
tsc
pytest
```

But raw output remains authoritative.

---

# 23. `streaming/outputBuffer.ts`

## Current implementation

Already limits output.

## Bug to fix

The limit is measured in bytes, but truncation uses:

```ts
chunk.substring(...)
```

which counts JavaScript characters rather than UTF-8 bytes.

This can break the exact byte limit with multibyte Unicode.

## Required implementation

Implement byte-safe truncation.

Also consider:

```text
rolling buffer
maximum retained output
stream output
final output
```

---

# 24. `streaming/terminalEvents.ts`

## Current implementation

Events:

```text
stdout
stderr
prompt_detected
exit
```

## Required implementation

Add structured lifecycle events:

```text
process_created
process_started
stdout
stderr
prompt_detected
approval_required
process_signal
process_timeout
process_exited
process_failed
session_created
session_closed
```

Every event should contain relevant identifiers:

```text
eventId
timestamp
sessionId
processId
taskId
```

The event layer becomes the bridge between:

```text
runtime
UI
agent
memory
observability
```

---

# 25. `security/approvalManager.ts`

## Current implementation

Only:

```text
handler(command, reason)
```

## Required implementation

Build a real approval lifecycle.

An approval request should contain:

```text
requestId
command
cwd
sessionId
process mode
reason
requested permissions
createdAt
expiresAt
```

Support:

```text
pending
approved
rejected
expired
consumed
```

Approval must be bound to the original request.

An approval for:

```text
git status
```

must never authorize:

```text
git push
```

---

# 26. `security/permissionRules.ts`

This should evolve into a real permission engine.

Current model:

```text
block
ask_approval
```

Target:

```text
allow
deny
ask_approval
```

Rules should be able to match:

```text
command
command prefix
cwd
session
tool
agent
subagent
resource
network
elevation
```

Priority must be deterministic.

Explicit deny should override broad allow.

---

# 27. `security/secretRedactor.ts`

Current implementation is a good first layer.

Required improvements:

* support configurable patterns
* avoid false positives
* redact before logs when appropriate
* redact before agent context
* support environment-secret mapping
* never store raw secrets in audit records

Important distinction:

```text
secret detection
```

is not the same as:

```text
secret access policy
```

Both must exist.

---

# 28. `sandbox/sandboxTypes.ts`

The abstraction is correct.

But:

```text
none
chroot
docker
microvm
```

are currently only labels.

The type should also represent:

```text
filesystem policy
network policy
resource limits
working directory
environment
```

---

# 29. `sandbox/sandboxPolicy.ts`

## Current state

It only stores:

```text
isolationLevel
maxMemoryMb
networkAllowed
```

## Required implementation

Represent real restrictions:

```text
filesystem
network
CPU
memory
disk
process count
working directory
environment
```

A sandbox policy must be enforceable by a driver.

---

# 30. `sandbox/sandboxManager.ts`

## Current state

`LocalSandboxDriver` does nothing.

`wrapCommand()` simply returns the command.

Therefore:

> There is currently NO sandbox.

This must be documented explicitly.

## Required implementation

Keep the driver architecture but implement at least one real backend.

Potential first backend on Linux:

```text
bubblewrap
```

or another appropriately isolated mechanism.

Later:

```text
Docker
microVM
```

can become additional drivers.

The manager must initialize and clean up drivers.

---

# 31. `checkpoint/snapshotManager.ts`

## Current implementation

Uses:

```text
git stash
```

## Critical architectural warning

A Git stash is not a general filesystem snapshot.

It only works meaningfully inside a Git repository and can interact badly with concurrent changes/stashes.

## Required implementation

Define exactly what a checkpoint means.

Possible levels:

```text
git checkpoint
workspace snapshot
filesystem snapshot
```

Do not call Git stash a universal snapshot.

---

# 32. `checkpoint/gitStashAdapter.ts`

Keep it as a Git-specific adapter.

Improve:

* verify repository
* capture exact stash reference
* avoid ambiguous `stash pop`
* avoid popping the wrong stash
* handle concurrent stashes
* return structured failure
* detect conflicts

Rollback should use the exact checkpoint reference.

---

# 33. `checkpoint/rollbackEngine.ts`

Current implementation:

```text
pop latest stash
```

is insufficient.

Required:

```text
rollback(snapshotId)
```

must restore that specific checkpoint.

Rollback should return:

```text
success
conflict
not_found
not_supported
failed
```

---

# 34. `observability/terminalAudit.ts`

Current implementation records:

```text
command
cwd
timestamp
duration
exitCode
status
```

Expand to:

```text
eventId
actorId
agentId
taskId
sessionId
processId
command
cwd
decision
approval
sandbox
exitCode
signal
duration
```

Do NOT record sensitive output by default.

Audit records should remain useful for debugging without becoming a secret-storage system.

---

# 35. `observability/metricsCollector.ts`

Current metrics are a good beginning.

Add:

```text
successful commands
failed commands
timeouts
cancellations
approvals
denials
background jobs
active processes
PTY sessions
average execution duration
output truncations
sandbox failures
```

Avoid turning metrics into business logic.

---

# 36. `tests/terminal.test.ts`

The current tests only cover:

* instantiation
* echo
* blocked command
* secret redaction
* non-interactive environment

This is far too small for the new architecture.

Tests must eventually cover every capability.

## Minimum test groups

### Execution

```text
echo
stderr
exit code
command failure
command not found
cwd
environment
stdin
timeout
cancellation
output limit
```

### Sessions

```text
create session
reuse session
persistent cwd
persistent env
history
close session
```

### Processes

```text
spawn
list
inspect
signal
kill
process tree
cleanup
concurrency limit
```

### Background

```text
start background
observe
list
kill
cleanup
```

### PTY

```text
availability
spawn
write
resize
exit
kill
```

### Security

```text
allow
deny
approval
approval expiry
approval reuse
approval scope
secret redaction
```

### Sandbox

```text
driver selection
policy
filesystem restriction
network restriction
resource limits
```

### Streaming

```text
stdout events
stderr events
exit event
prompt event
process lifecycle events
```

### Checkpoints

```text
create
identify
rollback
conflict
missing checkpoint
```

---

# 37. `index.ts`

The current export file is structurally good.

Keep it as the public surface.

However:

* every exported class must actually work;
* no placeholder implementation should be exposed as production-ready;
* exports should not expose internal implementation details unnecessarily.

The final public API should make it possible for the rest of Evis to consume:

```text
TerminalRuntime
terminal types
session APIs
process APIs
events
security
sandbox
```

without importing internal files directly.

---

# 38. Integration Rule

`terminal-new` must eventually become the only terminal runtime consumed by the agent layer.

Do NOT maintain two competing implementations indefinitely:

```text
terminal/
terminal-new/
```

Once `terminal-new` is verified, integration should happen deliberately:

```text
old terminal
     ↓
migration
     ↓
terminal-new
     ↓
old terminal removed/deprecated
```

Do not silently route some commands through one runtime and others through another.

---

# 39. Implementation Order

## Phase 1 — Correctness

Implement and test:

```text
terminalTypes
terminalPolicy
terminalEnvironment
processHandle
processManager
processRegistry
terminalRuntime
```

Goal:

```text
real one-shot execution
real process lifecycle
real policy
real results
```

---

## Phase 2 — Sessions

Implement:

```text
terminalSession
sessionManager
sessionState
```

Goal:

```text
persistent cwd
persistent environment
persistent shell state
```

---

## Phase 3 — Events and streaming

Implement:

```text
terminalEvents
outputBuffer
```

Goal:

```text
live stdout
live stderr
lifecycle events
bounded output
```

---

## Phase 4 — Background processes

Implement:

```text
processManager
processRegistry
processTree
processSignals
```

Goal:

```text
start
observe
signal
kill
wait
cleanup
```

---

## Phase 5 — PTY

Implement:

```text
ptyTypes
ptyExecutor
```

Goal:

```text
real interactive terminal
```

No fake PTY fallback.

---

## Phase 6 — Interactive automation

Implement:

```text
promptDetector
interactiveRules
promptResponder
```

with security-first behavior.

---

## Phase 7 — Security

Implement:

```text
permissionRules
approvalManager
secretRedactor
```

with:

```text
allow
deny
approval
expiration
scope
audit
```

---

## Phase 8 — Sandbox

Implement:

```text
sandboxTypes
sandboxPolicy
sandboxManager
real sandbox driver
```

The first actual backend should be selected according to Evis's supported platform.

---

## Phase 9 — Checkpoints

Implement:

```text
snapshotManager
gitStashAdapter
rollbackEngine
```

only after defining exact checkpoint semantics.

---

## Phase 10 — Observability

Complete:

```text
terminalAudit
metricsCollector
```

and connect them to every lifecycle event.

---

## Phase 11 — Agent Integration

Only after the runtime itself passes its tests:

```text
Agent
   ↓
Terminal capability
   ↓
TerminalRuntime
   ↓
structured events/results
   ↓
Agent observation
```

The agent must never bypass:

```text
policy
permission
approval
sandbox
audit
```

---

# 40. Non-Negotiable Rules

## Rule 1 — No fake implementations

This is forbidden:

```ts
return false;
```

for a capability advertised as implemented.

This is also forbidden:

```ts
throw new Error("requires dependency")
```

if the feature is supposed to be available in production.

---

## Rule 2 — No unused architecture

Do not create:

```text
ProcessManager
SandboxManager
PTY
SessionManager
```

and then leave them disconnected.

Every subsystem must have a concrete caller.

---

## Rule 3 — No security by naming

This:

```ts
class SandboxManager {}
```

does not mean sandboxing exists.

This:

```ts
isolationLevel: "docker"
```

does not mean Docker isolation exists.

The implementation must enforce the declared behavior.

---

## Rule 4 — No automatic dangerous approval

Interactive prompts must never become an accidental bypass around:

```text
permission
approval
security
```

---

## Rule 5 — Raw output remains authoritative

Structured parsing is an additional representation.

Never throw away raw stdout/stderr because a parser exists.

---

## Rule 6 — Every process must be traceable

A running process should be traceable through:

```text
sessionId
processId
taskId
agentId
```

when those contexts exist.

---

## Rule 7 — Every operation must produce an honest result

The runtime must distinguish:

```text
implemented
started
running
completed
failed
cancelled
timed out
denied
approval required
sandbox rejected
```

Never convert an unknown state into success.

---

# 41. Definition of Done

`terminal-new` is ready for Evis integration only when:

```text
[ ] One-shot commands work
[ ] stderr works
[ ] exit codes work
[ ] cwd works
[ ] environment works
[ ] stdin works
[ ] timeout works
[ ] cancellation works
[ ] output limits work
[ ] sessions are genuinely persistent
[ ] process registry works
[ ] process lifecycle is accurate
[ ] process tree handling works
[ ] background jobs work
[ ] streaming works
[ ] PTY works when supported
[ ] interactive prompts are policy-controlled
[ ] permissions work
[ ] approval lifecycle works
[ ] secrets are redacted
[ ] sandbox enforcement is real
[ ] checkpoints are deterministic
[ ] rollback targets the correct checkpoint
[ ] audit records are complete
[ ] metrics work
[ ] tests cover every subsystem
[ ] TypeScript build passes
[ ] terminal-new is actually integrated
[ ] old terminal path is removed/deprecated
```

---

# 42. Final Architecture Target

```text
                    EVIS AGENT
                        │
                        ▼
               Terminal Capability
                        │
                        ▼
                ┌───────────────┐
                │ Terminal      │
                │ Runtime       │
                └───────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Policy       Permission     Approval
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                    Sandbox
                        │
                        ▼
                 Process Manager
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       One-shot      Sessions       PTY
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 Process Registry
                        │
                        ▼
                Event / Streaming
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Parser         Audit        Metrics
          │
          ▼
      Agent Result
```

The important point is that **this document is an implementation contract, not a list of files to fill arbitrarily**.

The current `terminal-new` tree is a good structural skeleton. The next work should be to make **Phase 1 actually correct**, then progressively activate each layer and test it before moving upward.
