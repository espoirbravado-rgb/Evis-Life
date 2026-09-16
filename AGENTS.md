# Gemini.md

## Purpose

This file defines **how the implementing AI must work on this repository**.

It does **not** define Evis architecture, Evis capabilities, Evis components, or Evis runtime behavior.

The project's architecture and technical requirements are defined by the dedicated project documents.

Your responsibility here is to follow a disciplined implementation process that preserves context, prevents loss of objectives, maintains recoverable navigation through the work, and reduces avoidable implementation errors.

---

# 1. Inspect Before Acting

Never modify, create, delete, or declare a component complete before inspecting the relevant repository state.

Before acting, determine:

* what already exists;
* what is actually implemented;
* what is partially implemented;
* what is missing;
* what depends on the current area;
* what depends on the current area;
* what the current task is expected to change;
* whether another implementation already solves part of the problem.

Do not assume that the repository matches the documentation.

Documentation describes intended behavior.

The repository is evidence of current behavior.

When they differ, identify the discrepancy before deciding what to do.

---

# 2. Do Not Replace Work With Summaries

A summary is not a substitute for inspection or implementation.

If a document or source file is long, do not read it once, compress it into a short mental summary, and then work from that summary.

For large files:

1. identify the relevant section;
2. inspect its surrounding context;
3. inspect the dependencies and related sections when necessary;
4. understand the local objective;
5. perform the work;
6. reread the affected area after modification;
7. preserve a reference to the parent objective before moving elsewhere.

If the user asks you to work on a document, the document itself is the object of work.

Do not convert a 2,000-line or 10,000-line document into a short summary and treat that summary as equivalent to the original.

---

# 3. Preserve the Initial Objective

At every stage of the work, maintain awareness of:

* the original objective;
* the current task;
* why the current task exists;
* how the current task relates to the larger objective;
* what must happen after the current task.

A local discovery must not silently replace the original objective.

If a new problem appears, determine whether it is:

* part of the current task;
* a child task;
* a dependency;
* a blocking issue;
* or a genuinely new scope.

Do not silently change the project's direction.

---

# 4. Maintain a Recoverable Path

Whenever you enter a substantial subtask, preserve enough information to return to the point from which you came.

A working reference should identify, when applicable:

```text
Parent task
Origin
Current objective
Current target
Reason for entering this branch
Relevant files/sections
Dependencies
Current state
Next action
Return target
```

The purpose is not to create unnecessary documentation.

The purpose is to prevent the work from becoming a collection of disconnected explorations.

Every significant branch of work must have a clear way back to its parent.

---

# 5. Never Lose the Return Path

Before moving deeply into another file, subsystem, document, investigation, or problem:

1. identify where you currently are;
2. identify why you are leaving it;
3. identify what you must return to;
4. record the relevant reference if the context may be lost.

When the subtask is finished:

1. record what was discovered or changed;
2. record unresolved issues;
3. return to the parent task;
4. continue from the recorded next action.

Do not assume that remembering the previous context internally will always be sufficient.

---

# 6. Work Hierarchically

Treat complex work as a hierarchy:

```text
Global Objective
    ↓
Task
    ↓
Subtask
    ↓
Local Work
```

A subtask exists in relation to its parent.

Do not allow a local investigation to become the new global objective merely because it is technically interesting or easier to work on.

When a discovery requires additional work, create a child task mentally or explicitly and preserve the parent task.

After completing the child task, return to the parent.

---

# 7. Use Checkpoints

Create a checkpoint before major context changes.

A checkpoint should make it possible to reconstruct:

```text
Where am I?
What was I trying to accomplish?
What have I already done?
What did I discover?
What remains?
Where should I return?
What is the next action?
```

Checkpoints are especially important when:

* switching between major files;
* investigating an unexpected problem;
* changing implementation direction;
* working on a large document;
* starting a new subsystem;
* pausing and resuming work;
* the current context has become large.

---

# 8. Do Not Assume Context Is Permanent

Do not rely exclusively on the current conversation context or internal memory.

Important information that affects future work should be recoverable from the project state, relevant documentation, references, checkpoints, or other appropriate project artifacts.

However, stored context is not automatically truth.

When resuming work:

1. recover the relevant reference;
2. inspect the repository state;
3. verify that the previous assumption is still valid;
4. continue only after reconciliation.

---

# 9. Read Relevant Context, Not Everything

Do not automatically load every document, skill, source file, or project resource for every task.

Resolve additional context when the current task requires it.

At the same time, do not under-read a file simply because a small excerpt appears sufficient.

The rule is:

> Read enough context to make the current decision correctly, but do not consume unrelated context merely to create the appearance of completeness.

For a large file, inspect the relevant section and enough surrounding structure to understand its role.

---

# 10. Respect Existing Intent

Before modifying existing work, determine:

* why it exists;
* what problem it solves;
* what depends on it;
* what assumptions it makes;
* what behavior must remain unchanged;
* what behavior is intentionally being changed.

Do not optimize code merely because another implementation looks cleaner.

An optimization is valid only if it preserves the intended behavior and improves the relevant property.

Do not remove complexity without first understanding why that complexity exists.

---

# 11. Do Not Invent Missing Context

When the repository does not provide enough information to make a safe architectural or implementation decision:

Do not silently invent the missing requirement.

Instead:

1. identify the ambiguity;
2. determine whether existing documentation resolves it;
3. inspect the relevant implementation;
4. if still unresolved, state the ambiguity;
5. choose a solution only when it can be justified by the available project context.

A confident guess is not a substitute for evidence.

---

# 12. Implementation Cycle

For each meaningful component or task, follow this cycle:

```text
RESEARCH
↓
UNDERSTAND
↓
INSPECT
↓
PLAN
↓
IMPLEMENT
↓
RUN
↓
TEST
↓
INSPECT RESULTS
↓
FIX
↓
RETEST
↓
VERIFY
↓
RECORD STATE
↓
RETURN TO PARENT
↓
CONTINUE
```

Do not skip the verification stages merely because the implementation appears correct.

---

# 13. Reread After Modification

After modifying a file:

1. inspect the resulting code;
2. reread the affected section;
3. inspect the surrounding context;
4. inspect the diff when applicable;
5. verify that the modification did not unintentionally alter related behavior.

Do not treat successful editing as proof of correctness.

The final file must be inspected as it actually exists after the change.

---

# 14. Execute What You Implement

Whenever execution is possible, execute the relevant implementation.

Do not assume:

```text
code written = feature working
```

Instead:

```text
code written
↓
executed
↓
observed
↓
tested
↓
verified
```

If something cannot be executed, explicitly identify that limitation.

---

# 15. Never Simulate Success

Never claim that something works when it has only been:

* designed;
* typed;
* mocked;
* stubbed;
* simulated;
* visually represented;
* partially connected.

Distinguish clearly between:

```text
designed
implemented
executed
tested
integrated
verified
```

A UI indicating success is not evidence of successful backend execution.

A function existing is not evidence that it works.

A test that never executes the real path is not evidence that the real path works.

---

# 16. Do Not Bypass the Real System

Do not create shortcuts whose purpose is to make a feature appear functional while avoiding the actual architecture being implemented.

Do not replace a real capability with:

* hard-coded responses;
* fake providers;
* fake statistics;
* regex-based behavior that bypasses the intended reasoning path;
* static success messages;
* mocked results presented as real results;
* hidden shortcuts around the runtime.

Internal scripts are acceptable when they are legitimate implementation mechanisms behind the appropriate runtime/tool boundary.

They are not acceptable when they are used to bypass the system being implemented.

---

# 17. Evidence Before Completion

Before declaring a task complete, identify the evidence supporting completion.

At minimum, determine:

```text
What changed?
What was executed?
What was tested?
What was observed?
What remains unverified?
```

If a requirement has not been verified, do not silently mark it complete.

Use precise status descriptions.

For example:

```text
Implemented
Implemented and tested
Implemented but integration incomplete
Blocked
Not yet verified
Unable to execute in current environment
```

---

# 18. Do Not Move Forward Prematurely

Do not move to the next component merely because the current implementation exists.

Move forward only when the current task has:

* been implemented;
* been executed where possible;
* been tested;
* been inspected;
* had discovered problems corrected;
* been retested;
* been verified against its objective;
* had its state recorded.

If a task is blocked, record the blocker rather than hiding it by moving forward.

---

# 19. Recover When Lost

If you realize that the current context no longer clearly connects to the original objective:

**Stop.**

Do not continue based on assumptions.

Recover the path by checking:

1. the current task;
2. the parent task;
3. the relevant checkpoint;
4. the repository state;
5. the modified files;
6. the relevant project documentation;
7. the recorded next action.

Reconstruct the path before continuing.

---

# 20. Verify Before Trusting Memory

Previous conclusions are useful references, not permanent truth.

Before relying on an old conclusion, verify it against the current repository when the state may have changed.

The rule is:

```text
Previous understanding
        ↓
Current repository inspection
        ↓
Reconciliation
        ↓
Continue
```

Do not let an outdated mental model control the implementation.

---

# 21. Keep Global and Local Views Connected

During detailed work, maintain two levels of awareness:

```text
GLOBAL VIEW
What is the larger objective?

LOCAL VIEW
What exactly am I working on right now?
```

Switch deliberately between them.

After completing a local task, ask:

```text
How does this change affect the larger objective?
What is the parent task?
What is the next action?
Where should I return?
```

Never allow detailed implementation work to permanently replace the global project view.

---

# 22. Completion Record

Before leaving a significant task, record:

```text
Objective:
What was this task supposed to accomplish?

Work performed:
What was changed?

Evidence:
What was executed and tested?

Result:
What is confirmed to work?

Limitations:
What remains uncertain or incomplete?

Next action:
What should happen next?

Return target:
Where does the work continue?
```

This record must be sufficient for the work to be resumed without reconstructing the entire investigation from scratch.

---

# 23. Final Working Principle

Your job is not to remember everything indefinitely.

Your job is to maintain a **recoverable path through the work**.

Do not rely on memory when a reference, checkpoint, repository state, or explicit record can preserve the information more reliably.

Do not optimize for appearing finished.

Optimize for:

```text
UNDERSTANDING
+
TRACEABILITY
+
RECOVERABILITY
+
EVIDENCE
+
CORRECTNESS
```

Work deeply on the current task.

Preserve the path back to the larger objective.

Verify before claiming completion.

Then continue.
