---
name: filesystem
description: Manage files and directories in the authorized Evis workspace. Use when the user asks to create, read, inspect, modify, search, move, copy, rename, append to, or delete files and directories. Do not use for arbitrary shell commands, system administration, or operations outside the authorized filesystem scope.
version: 1.0.0
license: proprietary
tags:
  - filesystem
  - files
  - directories
  - workspace
  - local-storage

---

# Filesystem & Workspace Manager

## Identity

- **ID**: filesystem
- **Name**: Filesystem & Workspace Manager
- **Version**: 1.0.0
- **Author**: Evis Core Team

## Purpose

Provide Evis with controlled capabilities for interacting with files and directories in authorized local workspace locations.

The Skill is responsible for filesystem operations, while authorization, policy enforcement, execution, and runtime state remain responsibilities of the Evis runtime.

## Scope

The Skill covers authorized local filesystem operations including:

- reading files
- creating files
- writing files
- appending to files
- modifying files
- searching files
- listing directory contents
- creating directories
- inspecting filesystem metadata
- checking file or directory existence
- copying files
- moving files
- renaming files
- deleting files

The Skill does not define authorization by itself and does not grant access to protected system locations.

## Triggers

### When to Use

Use this Skill when the user's request requires direct interaction with files or directories, including:

- creating a file
- reading a file
- inspecting a file
- modifying a file
- searching workspace files
- creating a directory
- listing directory contents
- moving or renaming files
- copying files
- deleting files
- checking filesystem state

### Do Not Use For

Do not use this Skill as the primary capability for:

- arbitrary shell command execution
- package management
- process execution
- system administration
- network access
- Git operations
- web research

Those responsibilities belong to other Skills or runtime capabilities.

## Capabilities

The Filesystem Skill provides the following capabilities:

- `file.read`
- `file.write`
- `file.create`
- `file.modify`
- `file.append`
- `file.list`
- `file.search`
- `file.mkdir`
- `file.stat`
- `file.exists`
- `file.copy`
- `file.move`
- `file.rename`
- `file.delete`

## Tools

- `filesystem`

The Skill requires filesystem tools capable of executing its declared filesystem operations.

Tool resolution is performed by the Evis runtime.

The Skill does not assume a specific provider implementation.

## Dependencies

### Runtime

- **Type**: runtime
- **ID**: evis-runtime
- **Name**: Evis Runtime
- **Target**: filesystem-capability-runtime
- **Optional**: false

### Filesystem

- **Type**: filesystem
- **ID**: authorized-filesystem
- **Name**: Authorized Local Filesystem
- **Target**: configured-workspace
- **Optional**: false

## Permissions

The Skill requires authorization for filesystem operations.

Required permission categories include:

- `filesystem.read`
- `filesystem.write`

Additional authorization may be required by individual operations or paths.

The Skill declares permission requirements but never grants permissions itself.

## Constraints

- Operate only within filesystem locations authorized by the runtime.
- Do not bypass filesystem policy.
- Do not access protected system locations unless explicitly authorized by the runtime.
- Do not execute shell commands as a substitute for filesystem operations.
- Do not expose sensitive file contents unnecessarily.
- Do not claim that an operation succeeded unless the runtime reports successful execution.
- Preserve actual filesystem errors and report them honestly.
- Destructive operations must follow the runtime's authorization and confirmation policy.

## Inputs

Filesystem operations may require inputs such as:

- operation
- path
- destination path
- file content
- search query
- directory path
- operation-specific options

The exact input schema belongs to the corresponding runtime capability and tool contract.

## Outputs

Filesystem operations may produce:

- file contents
- directory listings
- search results
- filesystem metadata
- operation status
- created resource references
- structured errors

The Skill must preserve meaningful runtime results rather than replacing them with simulated responses.

## Resources

The Skill may provide or reference resources such as:

- filesystem operation schemas
- path conventions
- filesystem safety guidance
- workspace configuration
- operation-specific references
- deterministic filesystem helper scripts

Resources are loaded only when required.

## Instructions

When a user request requires filesystem interaction:

1. Determine the required filesystem capability.
2. Resolve the corresponding runtime tool.
3. Provide the required operation inputs.
4. Allow the runtime to perform authorization and policy evaluation.
5. Execute the operation through the registered filesystem tool.
6. Inspect the actual result.
7. Report the result accurately.
8. Preserve relevant errors rather than hiding or replacing them.

Do not simulate filesystem operations.

Do not invent files, paths, contents, metadata, or operation results.

Do not perform arbitrary filesystem access outside the runtime's authorized boundary.

## Configuration

The Skill may depend on runtime configuration including:

- authorized workspace paths
- filesystem access policy
- protected path rules
- operation restrictions
- confirmation requirements
- default workspace
- filesystem provider configuration

Configuration values are supplied by the Evis runtime and are not embedded as secrets in the Skill manifest.

## Metadata

- **Category**: filesystem
- **Stability**: core
- **Tags**:

  - filesystem
  - workspace
  - files
  - directories
  - local
- **Execution Model**: runtime-mediated
- **Security Model**: policy-mediated
- **State**: runtime-managed