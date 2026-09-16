/**
 * EVIS RUNTIME — PERMISSION SYSTEM
 *
 * Central authorization boundary for tool execution.
 *
 * Architectural rules:
 * - A skill declaring a permission DOES NOT grant that permission.
 * - Authorization is evaluated independently from skill activation.
 * - Tool execution must pass through this manager before physical execution.
 * - UNKNOWN filesystem zones are denied by default.
 * - System/protected filesystem zones cannot be modified.
 * - Confirmation is an authorization state, not an implicit allow.
 *
 * This class decides authorization only.
 * It does not execute tools and does not grant permissions to skills.
 */

import {
  IAuthorizationResult,
  IPermissionRequirement,
} from '../types/domain';
import { ToolRegistry } from '../registries/toolRegistry';
import { EnvironmentDetector } from '../environment/environmentDetector';

interface IPermissionPolicy extends IPermissionRequirement {
  granted: boolean;
  requiresConfirmation: boolean;
}

export class PermissionManager {
  private static permissions: Map<string, IPermissionPolicy> = new Map();
  private static initialized = false;

  /**
   * Initializes the default Evis permission policies.
   *
   * These are runtime policies, not permissions declared by skills.
   */
  static initialize(): void {
    if (this.initialized) return;

    this.register({
      id: 'filesystem.read',
      description: 'Autorise la lecture des fichiers dans les zones autorisées.',
      scope: 'workspace',
      granted: true,
      requiresConfirmation: false,
    });

    this.register({
      id: 'filesystem.write',
      description: 'Autorise la création et la modification de fichiers dans les zones autorisées.',
      scope: 'workspace',
      granted: true,
      requiresConfirmation: false,
    });

    this.register({
      id: 'filesystem.delete',
      description: 'Autorise la suppression définitive de fichiers.',
      scope: 'workspace',
      granted: false,
      requiresConfirmation: true,
    });

    this.register({
      id: 'terminal.execute',
      description: 'Autorise l’exécution de commandes sur le système hôte.',
      scope: 'system',
      granted: true,
      requiresConfirmation: false,
    });

    this.register({
      id: 'network.outbound',
      description: 'Autorise les requêtes HTTP/HTTPS vers l’extérieur.',
      scope: 'network',
      granted: true,
      requiresConfirmation: false,
    });

    this.register({
      id: 'memory.read',
      description: 'Autorise la lecture de la mémoire persistante.',
      scope: 'workspace',
      granted: true,
      requiresConfirmation: false,
    });

    this.register({
      id: 'memory.write',
      description: 'Autorise l’écriture dans la mémoire persistante.',
      scope: 'workspace',
      granted: true,
      requiresConfirmation: false,
    });

    this.initialized = true;
  }

  /**
   * Registers or replaces a runtime permission policy.
   */
  static register(permission: IPermissionPolicy): void {
    this.permissions.set(permission.id, permission);
  }

  /**
   * Retrieves a permission policy by ID.
   */
  static get(id: string): IPermissionPolicy | undefined {
    this.initialize();
    return this.permissions.get(id);
  }

  /**
   * Returns all known permission policies.
   */
  static getAll(): IPermissionPolicy[] {
    this.initialize();
    return Array.from(this.permissions.values());
  }

  /**
   * Explicitly grants a runtime permission.
   */
  static grant(id: string): void {
    this.initialize();

    const permission = this.permissions.get(id);

    if (permission) {
      permission.granted = true;
    }
  }

  /**
   * Explicitly revokes a runtime permission.
   */
  static revoke(id: string): void {
    this.initialize();

    const permission = this.permissions.get(id);

    if (permission) {
      permission.granted = false;
    }
  }

  /**
   * Configures whether a permission requires user confirmation.
   */
  static setRequiresConfirmation(
    id: string,
    requiresConfirmation: boolean
  ): void {
    this.initialize();

    const permission = this.permissions.get(id);

    if (permission) {
      permission.requiresConfirmation = requiresConfirmation;
    }
  }

  /**
   * Checks a collection of permission requirements.
   *
   * The result distinguishes:
   * - allow
   * - deny
   * - confirm
   */
  static checkPermissions(
    permissionIds: string[]
  ): IAuthorizationResult {
    this.initialize();

    const missingPermissions: string[] = [];
    let requiresConfirmation = false;

    for (const permissionId of permissionIds) {
      const permission = this.permissions.get(permissionId);

      if (!permission || !permission.granted) {
        missingPermissions.push(permissionId);
        continue;
      }

      if (permission.requiresConfirmation) {
        requiresConfirmation = true;
      }
    }

    if (missingPermissions.length > 0) {
      return {
        decision: 'deny',
        reason: `Permissions not granted: ${missingPermissions.join(', ')}`,
        missingPermissions,
        requiresConfirmation: false,
      };
    }

    if (requiresConfirmation) {
      return {
        decision: 'confirm',
        reason: 'User confirmation is required before this operation can execute.',
        missingPermissions: [],
        requiresConfirmation: true,
      };
    }

    return {
      decision: 'allow',
      reason: 'All required permissions are granted.',
      missingPermissions: [],
      requiresConfirmation: false,
    };
  }

  /**
   * Evaluates whether a specific tool call is authorized.
   *
   * This method performs:
   * 1. Tool existence validation.
   * 2. Required permission evaluation.
   * 3. Filesystem perimeter checks.
   *
   * It never executes the tool.
   */
  static evaluateToolCall(
    toolId: string,
    args: Record<string, unknown>
  ): IAuthorizationResult {
    this.initialize();
    ToolRegistry.initialize();

    const tool = ToolRegistry.get(toolId);

    if (!tool) {
      return {
        decision: 'deny',
        reason: `Tool "${toolId}" is not registered in ToolRegistry.`,
        missingPermissions: [],
        requiresConfirmation: false,
      };
    }

    const permissionsToCheck = this.getRequiredPermissions(toolId, args);

    const perimeterDecision = this.evaluateFilesystemPerimeter(
      toolId,
      args
    );

    if (perimeterDecision) {
      return perimeterDecision;
    }

    return this.checkPermissions(permissionsToCheck);
  }

  /**
   * Resolves the runtime permissions required by a tool call.
   *
   * Permission requirements are derived from the capability/tool operation,
   * not from skill declarations.
   */
    private static getRequiredPermissions(
      toolId: string,
      args: Record<string, unknown>
    ): string[] {
      const permissions: string[] = [];

      switch (toolId) {
        case 'filesystem': {
          const action = this.getFilesystemAction(args);

          if (
            [
              'read',
              'list',
              'search',
              'stat',
              'exists',
            ].includes(action)
          ) {
            permissions.push('filesystem.read');
          }

          if (
            [
              'write',
              'create',
              'modify',
              'append',
              'mkdir',
              'rename',
            ].includes(action)
          ) {
            permissions.push('filesystem.write');
          }

          if (action === 'move') {
            permissions.push('filesystem.write');
          }

          if (action === 'copy') {
            permissions.push('filesystem.read');
            permissions.push('filesystem.write');
          }

          if (action === 'delete') {
            permissions.push('filesystem.delete');
          }

          break;
        }

        case 'terminal':
          permissions.push('terminal.execute');
          break;

        case 'memory':
          this.resolveMemoryPermissions(args, permissions);
          break;

        case 'web-search':
        case 'web':
          permissions.push('network.outbound');
          break;

        default:
          break;
      }

      return [...new Set(permissions)];
    }

  /**
   * Resolves memory permissions from the requested operation.
   */
  private static resolveMemoryPermissions(
    args: Record<string, unknown>,
    permissions: string[]
  ): void {
    const operation = String(
      args.operation ?? args.action ?? ''
    ).toLowerCase();

    if (
      operation === 'read' ||
      operation === 'get' ||
      operation === 'load' ||
      operation === 'search'
    ) {
      permissions.push('memory.read');
      return;
    }

    if (
      operation === 'write' ||
      operation === 'save' ||
      operation === 'create' ||
      operation === 'update' ||
      operation === 'delete'
    ) {
      permissions.push('memory.write');
    }
  }

  /**
   * Evaluates filesystem perimeter rules independently from permissions.
   *
   * UNKNOWN is never treated as safe.
   */
  private static evaluateFilesystemPerimeter(
    toolId: string,
    args: Record<string, unknown>
  ): IAuthorizationResult | undefined {
    if (toolId !== 'filesystem') {
      return undefined;
    }

    const action = this.getFilesystemAction(args);

    const inputPath = args.path;

    if (
      typeof inputPath !== 'string' ||
      inputPath.length === 0
    ) {
      return undefined;
    }

    const classification =
      EnvironmentDetector.classifyPath(inputPath);

    const modifyingActions = [
      'write',
      'create',
      'modify',
      'append',
      'mkdir',
      'delete',
      'rename',
      'move',
      'copy',
    ];

    const isModifying =
      modifyingActions.includes(action);

    if (isModifying && !classification.canWrite) {
      return {
        decision: 'deny',
        reason:
          `Filesystem operation denied (${classification.zone}): ${classification.reason}`,
        missingPermissions: [],
        requiresConfirmation: false,
      };
    }

    if (
      !isModifying &&
      !classification.canRead
    ) {
      return {
        decision: 'deny',
        reason:
          `Filesystem read denied (${classification.zone}): ${classification.reason}`,
        missingPermissions: [],
        requiresConfirmation: false,
      };
    }

    /*
    * Move and copy affect a second filesystem location.
    * The source has already been checked above.
    */
    if (
      action === 'move' ||
      action === 'copy'
    ) {
      const destination =
        args.destination;

      if (
        typeof destination !== 'string' ||
        destination.length === 0
      ) {
        return undefined;
      }

      const destinationClassification =
        EnvironmentDetector.classifyPath(
          destination
        );

      if (
        !destinationClassification.canWrite
      ) {
        return {
          decision: 'deny',
          reason:
            `Filesystem destination denied (${destinationClassification.zone}): ${destinationClassification.reason}`,
          missingPermissions: [],
          requiresConfirmation: false,
        };
      }
    }

    return undefined;
  }
  /**
   * Extracts the filesystem operation from the tool arguments.
   */
  private static getFilesystemAction(
    args: Record<string, unknown>
  ): string {
    return String(
      args.operation ?? args.action ?? ''
    ).toLowerCase();
  }
}