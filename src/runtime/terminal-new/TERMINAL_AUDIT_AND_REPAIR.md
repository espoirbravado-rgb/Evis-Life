# TERMINAL AUDIT AND REPAIR

## Evis — `src/runtime/terminal-new`

**Status:** Mandatory repair specification
**Purpose:** Complete, integrate, test, and verify the existing terminal implementation.

---

# 0. PURPOSE

This document is **not a request to redesign or restart `terminal-new`**.

The existing implementation already contains substantial work across Phases 1–11.

The task is now to:

1. audit the current implementation;
2. preserve working code;
3. identify the remaining behavioral and integration gaps;
4. repair those gaps;
5. execute real tests;
6. verify the complete execution path;
7. report evidence.

Do not recreate existing modules simply because they are imperfect.

Do not create parallel implementations when an existing component can be corrected.

Do not satisfy a requirement merely by adding a class, interface, method, or test.

A feature is considered implemented only when:

```text
Declared
    ↓
Implemented
    ↓
Connected to the real execution path
    ↓
Executed
    ↓
Tested
    ↓
Observed
    ↓
Verified
```

If a component exists but is not connected to the real execution path, it is **not complete**.

---

# 1. ABSOLUTE RULES

## Rule 1 — No fake implementation

Never use:

```ts
return false;
return true;
return [];
return {};
return undefined;
throw new Error("Not implemented");
```

as a facade for a required behavior.

A fallback is acceptable only when the system explicitly represents the capability as unavailable.

Example:

```text
sandbox unavailable
```

is valid.

Pretending that sandboxing succeeded is not.

---

## Rule 2 — No ghost architecture

Every important subsystem must answer:

```text
Who calls it?
When is it called?
What input does it receive?
What output does it produce?
What behavior changes because it exists?
```

If a component cannot answer these questions, either:

* integrate it properly, or
* remove it if it is genuinely unnecessary.

Do not keep parallel unused security, metrics, policy, session, or execution systems.

---

## Rule 3 — Real execution is authoritative

Never infer execution from code structure.

Only the real process result proves execution.

A command is successful only when:

```text
process actually started
AND
process actually exited successfully
AND
exitCode === 0
```

Likewise:

```text
timeout
cancelled
denied
approval_required
failed
killed
```

must correspond to real observed states.

---

## Rule 4 — Do not declare tests passed without running them

The existence of a test file proves nothing.

For every final claim:

```text
PASS
FAIL
BLOCKED
NOT RUN
```

must be based on actual execution.

---

## Rule 5 — Preserve the global architecture

The intended architecture is:

```text
Agent
  ↓
ToolExecutor
  ↓
TerminalTool
  ↓
TerminalRuntime
  ↓
Policy
  ↓
Permission
  ↓
Approval
  ↓
Sandbox
  ↓
ProcessManager
  ↓
Process / Session / PTY
  ↓
Events
  ↓
Audit / Metrics
  ↓
Normalized Result
  ↓
Agent
```

Do not create a second independent execution pipeline.

---

# 2. GLOBAL EXECUTION CONTRACT

Every terminal operation must preserve these identifiers whenever applicable:

```text
agentId
taskId
sessionId
processId
eventId
```

At minimum:

```text
Agent
  ↓
taskId + agentId
  ↓
TerminalTool
  ↓
TerminalRuntime
  ↓
Process
```

The same identifiers must be visible in:

* process registry;
* terminal events;
* audit records;
* metrics where applicable;
* final execution result.

---

# 3. REQUIRED EXECUTION LAYERS

The final terminal path must conceptually be:

```text
ToolExecutor
    ↓
Tool definition / capability validation
    ↓
TerminalTool
    ↓
TerminalRuntime
    ↓
input validation
    ↓
TerminalPolicy
    ↓
PermissionRules
    ↓
ApprovalManager
    ↓
TerminalEnvironment
    ↓
SandboxManager
    ↓
ProcessManager
    ↓
ProcessHandle
    ↓
OutputBuffer
    ↓
Event emission
    ↓
Audit
    ↓
Metrics
    ↓
TerminalResult
```

For PTY:

```text
TerminalRuntime
    ↓
same policy/security boundary
    ↓
PTYExecutor
    ↓
PTY process
    ↓
events/audit/metrics
```

PTY must not become a security bypass.

---

# PHASE 1 — CORRECTNESS AND EXECUTION FOUNDATION

## Objective

Guarantee that normal command execution is real, deterministic, cancellable, and correctly represented.

---

## 1.1 Inspect

Inspect:

```text
terminalRuntime.ts
terminalTypes.ts
terminalPolicy.ts
terminalEnvironment.ts
process/processHandle.ts
process/processManager.ts
process/processRegistry.ts
streaming/outputBuffer.ts
security/permissionRules.ts
```

Trace the actual path:

```text
TerminalRuntime.execute()
    ↓
...
    ↓
child_process.spawn()
```

Do not rely on imports. Follow actual calls.

---

## 1.2 Fix PermissionRules integration

### Existing problem

`PermissionRules` exists but is not fully part of the real `TerminalRuntime` authorization path.

### Required behavior

Every command must pass through:

```text
TerminalPolicy
    ↓
PermissionRules
    ↓
ApprovalManager if required
    ↓
execution
```

### Required implementation

Modify `TerminalRuntime.execute()` or extract a dedicated authorization method:

```ts
private authorizeExecution(
  request: TerminalRequest,
  context: TerminalExecutionContext
): Promise<TerminalAuthorizationResult>
```

The method must:

1. evaluate global terminal policy;
2. evaluate permission rules;
3. resolve conflicts deterministically;
4. deny when a deny rule applies;
5. require approval when approval is required;
6. allow execution only after authorization.

Do not duplicate the rule engine inside `TerminalRuntime`.

---

## 1.3 Implement real cancellation

Add cancellation to the execution contract.

Example:

```ts
signal?: AbortSignal
```

The signal must propagate:

```text
TerminalRuntime
    ↓
ProcessManager
    ↓
ProcessHandle
```

When aborted:

```text
AbortSignal
    ↓
ProcessHandle.kill(...)
    ↓
actual process termination
    ↓
status = cancelled
```

Do not mark a process cancelled before the OS confirms termination.

The final result must distinguish:

```text
timeout
```

from:

```text
cancelled
```

---

## 1.4 ProcessHandle correctness

Verify:

```text
starting
running
stopping
exited
failed
killed
timeout
```

State transitions must be based on actual process lifecycle events.

Required tests:

```text
normal exit
non-zero exit
SIGTERM
SIGKILL
timeout
cancellation
spawn error
command not found
```

---

## 1.5 Environment

The environment pipeline must be:

```text
host environment
    ↓
filter
    ↓
safe defaults
    ↓
request overrides
    ↓
sandbox environment
    ↓
child process
```

Never:

```text
...process.env
```

directly into a privileged/sandboxed execution path without filtering.

Verify:

* secrets removed;
* CI flags deterministic;
* request variables work;
* request cannot bypass secret filtering unless explicitly authorized;
* sandbox receives the filtered environment.

---

## 1.6 Phase 1 completion criteria

All must pass:

```text
echo
stderr
exit code
command-not-found
cwd
environment
timeout
cancellation
output limit
secret redaction
permission denial
approval requirement
```

---

# PHASE 2 — REAL PERSISTENT SESSIONS

## Objective

A session must represent actual shell state, not merely metadata.

---

## 2.1 Required behavior

This sequence:

```bash
cd /tmp
pwd
```

must produce:

```text
/tmp
```

because the same shell state persists.

Also verify:

```bash
export EVIS_TEST=hello
echo $EVIS_TEST
```

and:

```bash
alias evis-test='echo works'
evis-test
```

where supported.

---

## 2.2 Required architecture

A persistent session should own:

```text
sessionId
shell process
shell PID
stdin
stdout
stderr
cwd
environment
lifecycle
active command/process state
```

The shell must not be recreated for every command.

---

## 2.3 Required methods

Verify or implement:

```ts
createSession()
executeInSession()
writeToSession()
interruptSession()
detachSession()
attachSession()
closeSession()
getSession()
```

Do not create duplicate session APIs if equivalent methods already exist.

---

## 2.4 Shell lifecycle

Implement:

```text
create
  ↓
spawn shell
  ↓
ready
  ↓
commands
  ↓
detach
  ↓
reattach
  ↓
close
```

Closing the session must terminate the owned shell/process tree.

---

## 2.5 Session tests

Test:

```text
cwd persistence
environment persistence
multiple commands
command failure without destroying session
detach
reattach
close
session isolation
two independent sessions
```

---

# PHASE 3 — EVENTS AND STREAMING

## Objective

Streaming must represent real process activity.

---

## 3.1 Event architecture

Every process must emit lifecycle events:

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
```

Session events:

```text
session_created
session_closed
```

---

## 3.2 Event identity

Every event must contain, when applicable:

```text
eventId
timestamp
agentId
taskId
sessionId
processId
```

IDs must be generated once and propagated, not regenerated inconsistently by downstream layers.

---

## 3.3 Output authority

Raw output is authoritative.

Parsing may add:

```text
structuredOutput
```

but must never replace:

```text
raw stdout
raw stderr
```

Test:

```text
ANSI
partial UTF-8 chunks
Unicode
partial escape sequences
large output
truncation
```

---

## 3.4 Backpressure

Do not allow unlimited output to accumulate in memory.

Use:

```text
maxOutputBytes
bounded buffers
stream consumers
truncation metadata
```

A truncated result must explicitly say:

```text
truncated = true
```

and provide enough information to understand what happened.

---

# PHASE 4 — BACKGROUND PROCESSES

## Objective

Background processes must be first-class managed processes.

---

## 4.1 Required behavior

Implement and verify:

```text
startBackground()
getProcess()
getLogs()
sendSignal()
kill()
wait()
listProcesses()
```

---

## 4.2 Registry

Every process must be indexed by:

```text
processId
pid
sessionId
taskId
```

When a process exits:

```text
live registry
    ↓
final state
    ↓
retention policy
```

must be deterministic.

---

## 4.3 Process tree

Killing a process must not leave unintended descendants.

Test:

```text
parent
  ├── child
  └── grandchild
```

Then kill the parent and verify descendants terminate.

Use platform-specific mechanisms where required.

Never silently claim cross-platform support if only Linux is implemented.

---

## 4.4 Metrics

When a background process starts/ends, call the actual metrics collector.

Do not merely define:

```ts
recordBackgroundJob()
```

It must be invoked.

---

# PHASE 5 — PTY

## Objective

PTY must provide real terminal behavior without bypassing security.

---

## 5.1 PTY execution path

Required:

```text
TerminalRuntime
    ↓
Policy
    ↓
Permission
    ↓
Approval
    ↓
Environment
    ↓
Sandbox
    ↓
PTYExecutor
```

Do not allow:

```text
TerminalRuntime
    ↓
PTYExecutor
```

to bypass authorization.

---

## 5.2 PTY implementation

The Python PTY bridge may remain if it is reliable.

Verify:

```text
spawn
stdin
stdout
stderr/raw stream
exit
signal
resize
cleanup
```

---

## 5.3 Environment

PTY must use the same filtered environment mechanism as normal execution.

Never directly use:

```ts
{
  ...process.env
}
```

unless that environment has already passed through the approved environment builder.

---

## 5.4 Shell option

If:

```ts
shell?: string
```

exists, either:

1. actually use it, or
2. remove the option.

Do not expose configuration that has no effect.

---

## 5.5 PTY tests

At minimum:

```text
interactive shell
input/output
Ctrl-C
resize
exit
environment filtering
approval
sandbox
session association
cleanup
```

---

# PHASE 6 — INTERACTIVE AUTOMATION

## Objective

Prompt detection and response must be safe and policy-controlled.

---

## 6.1 Detector

`PromptDetector` should only detect/classify.

It must not authorize.

Output should contain information such as:

```text
prompt type
matched text
confidence
sensitive
```

---

## 6.2 Responder

`PromptResponder` may generate a proposed response.

It must not independently grant permission.

Required flow:

```text
prompt
 ↓
detect
 ↓
classify
 ↓
permission
 ↓
approval if required
 ↓
respond
```

---

## 6.3 Never automatically answer dangerous prompts

At minimum require explicit authorization for:

```text
password
passphrase
credential
SSH host verification
delete
overwrite
force push
hard reset
destructive confirmation
privileged operation
```

---

## 6.4 Tests

Test:

```text
[y/N]
[Y/n]
password:
passphrase:
Are you sure?
delete confirmation
git push --force
git reset --hard
SSH host verification
```

The test must prove that dangerous prompts cannot be silently answered.

---

# PHASE 7 — SECURITY AND APPROVAL

## Objective

Security must be behavioral.

---

## 7.1 Permission precedence

Define deterministic precedence:

```text
explicit deny
    >
approval requirement
    >
explicit allow
    >
default policy
```

or another documented deterministic hierarchy.

The important requirement is that the hierarchy is explicit and tested.

---

## 7.2 Approval binding

An approval must be bound to:

```text
command
cwd
sessionId
taskId
agentId
```

where available.

An approval for:

```text
rm fileA
```

must not authorize:

```text
rm fileB
```

or:

```text
rm -rf /
```

---

## 7.3 Approval lifecycle

Verify:

```text
pending
approved
rejected
expired
consumed
```

Approval tokens must be:

```text
single-use
time-limited
context-bound
```

---

## 7.4 Secret redaction

Redact secrets in:

```text
stdout
stderr
logs
audit
errors
events
```

when those channels can contain sensitive data.

Never assume that because `TerminalResult.stdout` is redacted, the raw value cannot leak elsewhere.

Audit the entire path.

---

# PHASE 8 — SANDBOX

## Objective

Sandbox claims must correspond to actual OS isolation.

---

## 8.1 Bubblewrap

Keep the real Bubblewrap backend.

Verify:

```text
network namespace
PID namespace
filesystem restrictions
environment clearing
environment reinjection
process cleanup
```

---

## 8.2 Initialization

If `SandboxManager` requires:

```ts
initialize()
```

then initialization must happen before the first production execution.

Do not leave:

```text
new SandboxManager()
```

followed by:

```text
wrapCommand()
```

without initialization.

---

## 8.3 Environment propagation

Required path:

```text
TerminalEnvironment.buildEnvironment()
    ↓
SandboxManager.wrapCommand(..., filteredEnv)
    ↓
BubblewrapDriver
    ↓
--clearenv
    ↓
--setenv allowed variables
```

The actual production execution must use this path.

---

## 8.4 Failure behavior

If Bubblewrap is unavailable and the requested policy requires it:

```text
sandbox unavailable
```

must be returned.

Do not silently execute unsandboxed and report success.

Only fallback to unsandboxed execution when the caller explicitly selected an unsandboxed policy.

---

## 8.5 Tests

Verify actual execution:

```text
network blocked
network allowed
host filesystem inaccessible where required
allowed cwd writable
host secrets absent
PID isolation
process cleanup
```

---

# PHASE 9 — CHECKPOINTS AND ROLLBACK

## Objective

Rollback means restoring the actual state represented by the checkpoint.

Not merely applying a patch.

---

## 9.1 Snapshot semantics

Every checkpoint must identify:

```text
checkpointId
type
root
createdAt
metadata
state identity
```

---

## 9.2 Directory snapshots

A directory snapshot must capture enough information to restore:

```text
created files
modified files
deleted files
directories
```

Rollback must remove files created after the snapshot.

Example:

```text
Snapshot:
A.txt

After:
A.txt
B.txt
C.txt

Rollback:
A.txt
```

Not:

```text
A.txt
B.txt
C.txt
```

---

## 9.3 Git checkpoints

Do not confuse:

```text
commit SHA
```

with:

```text
stash reference
```

If the implementation uses Git stash:

```text
stashId
```

must be stored explicitly.

Never call:

```text
git stash apply <HEAD SHA>
```

as if a commit SHA were a stash.

---

## 9.4 Exact rollback

A Git checkpoint must restore the intended state deterministically.

Handle:

```text
clean repository
dirty repository
untracked files
modified files
deleted files
new files
stash
commit
rollback conflict
```

---

## 9.5 Never use "latest stash"

Never implement rollback using:

```text
git stash pop
```

or:

```text
git stash apply
```

without an exact checkpoint identity.

Always use the stored checkpoint/stash reference.

---

## 9.6 Concurrency

Two checkpoints must not interfere.

Test:

```text
checkpoint A
changes A

checkpoint B
changes B

rollback A
```

and verify deterministic behavior.

---

# PHASE 10 — OBSERVABILITY

## Objective

Audit and metrics must describe the actual execution.

---

# 10.1 Audit

Every terminal execution should produce an audit record containing, where applicable:

```text
eventId
agentId
taskId
sessionId
processId
command
cwd
policy decision
permission decision
approval
sandbox
status
exitCode
signal
duration
timestamp
```

---

## 10.2 Audit redaction

Never write raw secrets to audit.

Before persistence:

```text
command
stdout-derived fields
stderr-derived fields
error messages
environment-derived values
```

must pass through the appropriate secret-redaction mechanism.

Test explicitly:

```text
Bearer token
GitHub token
AWS secret
password in URI
private key
custom registered secret
```

---

## 10.3 Metrics

Metrics must be connected to real execution events.

At minimum:

```text
success
failure
timeout
cancelled
denied
approval
background jobs
PTY sessions
active processes
sandbox failures
output truncation
execution latency
```

Do not only create methods such as:

```ts
recordTimeout()
```

Call them from the actual runtime path.

---

## 10.4 Metrics consistency

Verify:

```text
execution begins
    ↓
active process count +1
    ↓
execution ends
    ↓
active process count -1
    ↓
success/failure/timeout/cancelled recorded
```

Counters must not drift.

---

# PHASE 11 — AGENT INTEGRATION

## Objective

The agent must use the real terminal runtime through the central tool execution architecture.

---

## 11.1 Required path

The integration test must exercise:

```text
ToolExecutor.execute()
    ↓
ToolRegistry
    ↓
capability validation
    ↓
PermissionManager
    ↓
TerminalTool
    ↓
TerminalRuntime
    ↓
real OS process
    ↓
real result
```

Do not test only:

```text
TerminalTool.execute()
```

and call that an agent integration test.

---

## 11.2 TerminalTool

`TerminalTool` must:

1. validate arguments;
2. extract execution context;
3. preserve agent/task/session identity;
4. call `TerminalRuntime`;
5. return normalized terminal result;
6. never fabricate success.

---

## 11.3 Permission architecture

Avoid having two unrelated permission systems.

There are currently:

```text
PermissionManager
PermissionRules
TerminalPolicy
ApprovalManager
```

Document exactly what each layer controls.

Required separation:

```text
Tool-level authorization
        ↓
Terminal command authorization
        ↓
Approval
        ↓
OS execution
```

No layer may silently bypass another.

---

## 11.4 Agent identity

Propagate:

```text
agentId
taskId
sessionId
processId
```

from the agent/tool context into the terminal execution.

The final audit must be able to answer:

> Which agent caused this process?

---

# PHASE 12 — PUBLIC API AND DEAD CODE

## Objective

The public API must describe real capabilities.

---

## 12.1 Inspect `index.ts`

Every export must point to a real implementation.

No:

```text
ghost export
renamed class that does not exist
obsolete implementation
duplicate implementation
```

---

## 12.2 Options must be meaningful

For every public option:

```text
background
interactive
allowElevated
shell
signal
sessionId
taskId
agentId
```

answer:

```text
Where is it read?
What behavior does it change?
Is that behavior tested?
```

If an option has no effect:

* implement it,
* or remove it.

---

# PHASE 13 — TEST INFRASTRUCTURE

## Objective

The repository must have a trustworthy test command.

---

## 13.1 Fix `package.json`

The test command must be inside:

```json
"scripts": {
  ...
}
```

It must target:

```text
src/runtime/terminal-new/tests
```

not the old:

```text
src/runtime/terminal/tests
```

---

## 13.2 Required commands

Provide working scripts for:

```bash
npm run build
npm test
```

and preferably:

```bash
npm run test:terminal
```

if useful.

---

## 13.3 Full test suite

The terminal test suite must execute:

```text
phase1
phase2
phase3
phase4
phase5
phase6
phase7
phase8
phase9
phase10
phase11
```

plus any integration tests.

---

# PHASE 14 — INTEGRATION TEST

Create one end-to-end test that proves the complete architecture.

The test should demonstrate:

```text
Agent context
    ↓
ToolExecutor
    ↓
TerminalTool
    ↓
TerminalRuntime
    ↓
Policy
    ↓
Permission
    ↓
Approval if necessary
    ↓
Environment
    ↓
Sandbox
    ↓
ProcessManager
    ↓
ProcessHandle
    ↓
stdout/stderr
    ↓
events
    ↓
audit
    ↓
metrics
    ↓
normalized result
```

The test must execute a real command.

It must verify:

```text
agentId
taskId
processId
stdout
stderr
exitCode
status
audit record
metrics
```

---

# PHASE 15 — MANDATORY NEGATIVE TESTS

The system must also prove that dangerous or invalid operations do not execute.

Test:

```text
forbidden rm
fork bomb pattern
mkfs
dd destructive target
shutdown
reboot
unauthorized sudo
expired approval
wrong-command approval
wrong-session approval
secret leakage
sandbox unavailable
invalid cwd
invalid command
timeout
cancellation
```

For every denied operation verify:

```text
process was NOT spawned
```

Do not only check:

```text
status === "denied"
```

Also prove that the OS process was never created.

---

# PHASE 16 — FINAL VERIFICATION

Before declaring the implementation complete, execute:

```bash
npm run build
npm test
```

Then run the terminal-specific tests independently if necessary.

Record:

```text
command
exit code
tests passed
tests failed
tests skipped
environment limitations
```

---

# 17. NO FALSE "DONE"

The implementation must NOT be reported as complete if any of the following remain:

```text
[ ] PermissionRules unused
[ ] cancellation missing
[ ] persistent shell missing
[ ] PTY bypasses security
[ ] sandbox environment not propagated
[ ] sandbox initialization unreliable
[ ] rollback not deterministic
[ ] Git SHA confused with stash ID
[ ] directory rollback leaves newly-created files
[ ] audit stores secrets
[ ] metrics are not connected
[ ] agentId lost
[ ] ToolExecutor pipeline not tested
[ ] npm test points to old test directory
[ ] public API exposes non-functional options
[ ] build failing
[ ] terminal tests failing
```

---

# 18. REQUIRED IMPLEMENTATION REPORT

When finished, do NOT simply say:

```text
Implementation complete.
```

Return a structured report:

```text
## Phase 1
Status:
Files modified:
Functions created:
Functions modified:
Behavior implemented:
Tests executed:
Tests passed:
Tests failed:
Evidence:

## Phase 2
...

## Phase 11
...

## Integration
Status:
Execution path verified:
Agent ID propagated:
Task ID propagated:
Process ID propagated:
Audit verified:
Metrics verified:

## Build
Command:
Exit code:
Result:

## Tests
Command:
Exit code:
Passed:
Failed:
Skipped:

## Remaining limitations
...

## Final status
COMPLETE
or
INCOMPLETE
```

`COMPLETE` is allowed only if every mandatory criterion is actually verified.

---

# 19. IMPLEMENTATION DISCIPLINE

For every modification:

```text
Inspect
  ↓
Understand existing implementation
  ↓
Identify exact missing behavior
  ↓
Plan minimal modification
  ↓
Implement
  ↓
Run targeted test
  ↓
Inspect result
  ↓
Fix
  ↓
Run broader tests
  ↓
Verify integration
```

Do not make large speculative rewrites.

Do not create new abstractions merely because they sound architecturally elegant.

Prefer fixing the existing architecture.

---

# 20. FINAL DEFINITION OF DONE

`terminal-new` is complete only when all of the following are true:

```text
[ ] Real one-shot execution
[ ] Real stdout/stderr
[ ] Real exit codes
[ ] Real cwd
[ ] Controlled environment
[ ] Timeout
[ ] Cancellation
[ ] Output limits
[ ] Persistent shell sessions
[ ] Session lifecycle
[ ] Process registry
[ ] Process tree handling
[ ] Background processes
[ ] Streaming events
[ ] Real PTY
[ ] PTY security integration
[ ] Interactive prompt detection
[ ] Interactive approval
[ ] PermissionRules integrated
[ ] Approval lifecycle
[ ] Secret redaction
[ ] Real sandbox
[ ] Sandbox environment propagation
[ ] Deterministic checkpoints
[ ] Deterministic rollback
[ ] Audit
[ ] Metrics
[ ] Agent integration
[ ] Agent/task/session/process traceability
[ ] ToolExecutor integration
[ ] Correct public exports
[ ] Correct test scripts
[ ] Build passes
[ ] Full terminal test suite passes
[ ] End-to-end integration test passes
[ ] Negative security tests pass
```

---

# 21. FINAL RULE

The objective is not to make the repository **look complete**.

The objective is to make the terminal **behave correctly under real execution**.

If the code says a capability exists but the real execution path does not use it:

```text
NOT COMPLETE
```

If a test exists but was not executed:

```text
NOT VERIFIED
```

If a test passes only because the implementation is bypassed:

```text
NOT VALID
```

If a security component exists but can be bypassed:

```text
NOT SECURE
```

If a sandbox claims isolation without actual OS isolation:

```text
NOT SANDBOXED
```

If rollback does not restore the actual checkpoint state:

```text
NOT ROLLBACK
```

If an agent can execute a terminal command but the command cannot be traced back to:

```text
agentId
taskId
sessionId
processId
```

then:

```text
NOT FULLY INTEGRATED
```

The final goal is:

```text
REAL
+
CONNECTED
+
SAFE
+
TRACEABLE
+
TESTED
+
VERIFIED
```

Only then may the terminal be declared complete.
