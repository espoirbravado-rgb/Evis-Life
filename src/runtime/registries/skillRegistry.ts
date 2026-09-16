
/**
 * EVIS RUNTIME — SKILL REGISTRY
 *
 * A Skill is a declarative capability package.
 *
 * Architectural separation:
 *
 *   SKILL.md
 *      ↓
 *   Skill Discovery
 *      ↓
 *   ISkillManifest
 *      ↓
 *   Skill Registry
 *      ├── manifest
 *      └── runtime state / resolution
 *
 * The manifest describes what a Skill declares.
 * The runtime record describes what the runtime currently knows
 * about that Skill.
 *
 * The registry does not grant permissions and does not execute tools.
 */

import type {
  ISkillManifest,
  ISkillRuntimeRecord,
  ISkillRuntimeResolution,
  ISkillDependencyResolution,
  IToolDefinition,
} from '../types/domain';

import { CapabilityRegistry } from './capabilityRegistry';
import { ToolRegistry } from './toolRegistry';

interface IDiscoveredSkillPayload {
  manifest: ISkillManifest;
  sourcePath: string;
  errors: string[];
}

export class SkillRegistry {
  /**
   * Runtime records are stored separately from declarative manifests.
   */
  private static skills: Map<string, ISkillRuntimeRecord> = new Map();

  private static initialized = false;

  /**
   * Initializes registry dependencies.
   *
   * Discovery and activation remain separate operations.
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    CapabilityRegistry.initialize();
    ToolRegistry.initialize();

    this.initialized = true;
  }

  /**
   * Loads installed Skills from the host.
   *
   * Discovery:
   * - reads declarations
   * - validates the discovery payload
   * - creates runtime records
   *
   * Discovery does NOT:
   * - grant permissions
   * - execute tools
   * - activate Skills
   */
  static async refresh(): Promise<{
    success: boolean;
    error?: string;
  }> {
    this.initialize();

    try {
      const rawSkills = await this.discoverInstalledSkills();

      const previousStates = new Map(
        Array.from(this.skills.entries()).map(
          ([id, record]) => [id, record.state]
        )
      );

      this.skills.clear();

      for (const source of rawSkills) {
        const resolution =
          this.createInitialResolution(source.manifest);

        const previousState =
          previousStates.get(source.manifest.id);

        const state =
          source.errors.length > 0
            ? 'error'
            : previousState === 'active'
              ? 'active'
              : 'inactive';

        const record: ISkillRuntimeRecord = {
          manifest: source.manifest,

          state,

          stateReason:
            source.errors.length > 0
              ? source.errors.join(' ')
              : undefined,

          resolution,

          metadata: {
            sourcePath: source.sourcePath,
          },
        };

        this.skills.set(
          source.manifest.id,
          record
        );
      }

      /**
       * Validate and resolve every discovered Skill.
       */
      for (const record of this.skills.values()) {
        if (record.state === 'error') {
          continue;
        }

        const validation =
          this.validate(record.manifest.id);

        if (!validation.valid) {
          record.state = 'error';

          record.stateReason =
            validation.errors.join(' ');

          record.resolution = {
            ...record.resolution,
            status: 'failed',
            errors: validation.errors,
          };

          continue;
        }

        const resolution =
          this.resolveDependencies(
            record.manifest.id
          );

        record.resolution = resolution;

        if (resolution.status === 'failed') {
          record.state = 'unavailable';

          record.stateReason =
            resolution.errors?.join(' ') ||
            'Skill dependencies could not be resolved.';
        } else if (
          resolution.status === 'partial'
        ) {
          record.state = 'unavailable';

          record.stateReason =
            resolution.errors?.join(' ') ||
            'Skill dependencies are not fully resolved.';
        }
      }

      return {
        success: true,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Skill discovery failed.',
      };
    }
  }

  /**
   * Loads Skills through the server-side discovery implementation.
   */
  private static async discoverInstalledSkills(): Promise<
    IDiscoveredSkillPayload[]
  > {
    if (typeof window === 'undefined') {
      try {
        const { discoverSkills } =
          await import(
            '../../../server/skillDiscovery'
          );

        const path =
          await import('node:path');

        const skillsDir =
          path.join(
            process.cwd(),
            'skills'
          );

        return await discoverSkills(
          skillsDir
        );
      } catch {
        const response =
          await fetch(
            'http://127.0.0.1:5173/api/runtime/skills'
          );

        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ||
              `Skill discovery failed (${response.status}).`
          );
        }

        return this.normalizeDiscoveryPayload(
          payload.skills
        );
      }
    }

    const response =
      await fetch(
        '/api/runtime/skills'
      );

    const payload =
      await response.json();

    if (!response.ok) {
      throw new Error(
        payload.error ||
          `Skill discovery failed (${response.status}).`
      );
    }

    return this.normalizeDiscoveryPayload(
      payload.skills
    );
  }

  /**
   * Ensures the discovery result follows the canonical
   * discovery contract.
   */
  private static normalizeDiscoveryPayload(
    payload: unknown
  ): IDiscoveredSkillPayload[] {
    if (!Array.isArray(payload)) {
      throw new Error(
        'No valid skills payload received.'
      );
    }

    return payload.map((entry) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('manifest' in entry)
      ) {
        throw new Error(
          'Invalid skill discovery entry.'
        );
      }

      const candidate =
        entry as Partial<IDiscoveredSkillPayload>;

      if (
        !candidate.manifest ||
        typeof candidate.manifest !== 'object'
      ) {
        throw new Error(
          'Skill discovery entry is missing its manifest.'
        );
      }

      return {
        manifest:
          candidate.manifest,

        sourcePath:
          typeof candidate.sourcePath === 'string'
            ? candidate.sourcePath
            : '',

        errors:
          Array.isArray(candidate.errors)
            ? candidate.errors
            : [],
      };
    });
  }

  /**
   * Creates the initial runtime resolution object.
   *
   * Dependency satisfaction is runtime state and therefore does not
   * belong to ISkillManifest.
   */
  private static createInitialResolution(
    manifest: ISkillManifest
  ): ISkillRuntimeResolution {
    const dependencies:
      ISkillDependencyResolution[] =
      manifest.dependencies.map(
        (dependency) => ({
          dependencyId: dependency.id,
          status: 'unresolved',
          reason:
            'Dependency has not yet been resolved.',
        })
      );

    return {
      status:
        dependencies.length > 0
          ? 'partial'
          : 'unresolved',

      dependencies,

      resolvedCapabilities: [],

      resolvedTools: [],
    };
  }

  /**
   * Registers a declarative Skill.
   *
   * Runtime state is created separately.
   */
  static register(
    manifest: ISkillManifest
  ): void {
    this.initialize();

    this.skills.set(
      manifest.id,
      {
        manifest,

        state: 'inactive',

        resolution:
          this.createInitialResolution(
            manifest
          ),
      }
    );
  }

  /**
   * Retrieves a Skill manifest.
   */
  static get(
    id: string
  ): ISkillManifest | undefined {
    this.initialize();

    return this.skills.get(id)?.manifest;
  }

  /**
   * Returns all registered Skill manifests.
   */
  static getAll(): ISkillManifest[] {
    this.initialize();

    return Array.from(
      this.skills.values()
    ).map(
      (record) => record.manifest
    );
  }

  /**
   * Retrieves the complete runtime record.
   */
  static getRuntimeRecord(
    id: string
  ): ISkillRuntimeRecord | undefined {
    this.initialize();

    return this.skills.get(id);
  }

  /**
   * Returns all runtime records.
   */
  static getAllRuntimeRecords():
    ISkillRuntimeRecord[] {
    this.initialize();

    return Array.from(
      this.skills.values()
    );
  }

  /**
   * Returns all currently active Skills.
   */
  static getActive(): ISkillManifest[] {
    this.initialize();

    return Array.from(
      this.skills.values()
    )
      .filter(
        (record) =>
          record.state === 'active'
      )
      .map(
        (record) =>
          record.manifest
      );
  }

  /**
   * Finds Skills declaring a capability.
   */
  static findSkillsForCapability(
    capabilityId: string
  ): ISkillManifest[] {
    this.initialize();

    return Array.from(
      this.skills.values()
    )
      .filter((record) =>
        record.manifest.capabilities.includes(
          capabilityId
        )
      )
      .map(
        (record) =>
          record.manifest
      );
  }

  /**
   * Validates declarations against currently registered
   * capabilities and tools.
   *
   * This does not grant permissions.
   */
  static validate(
    id: string
  ): {
    valid: boolean;
    errors: string[];
  } {
    this.initialize();

    const record =
      this.skills.get(id);

    if (!record) {
      return {
        valid: false,
        errors: [
          `Skill "${id}" is not registered.`,
        ],
      };
    }

    const errors: string[] = [];

    for (
      const capabilityId
      of record.manifest.capabilities
    ) {
      if (
        !CapabilityRegistry.get(
          capabilityId
        )
      ) {
        errors.push(
          `Declared capability "${capabilityId}" does not exist in CapabilityRegistry.`
        );
      }
    }

    for (
      const toolId
      of record.manifest.tools
    ) {
      if (
        !ToolRegistry.has(toolId)
      ) {
        errors.push(
          `Declared tool "${toolId}" does not exist in ToolRegistry.`
        );
      }
    }

    return {
      valid:
        errors.length === 0,

      errors,
    };
  }

  /**
   * Resolves dependencies that the current runtime can actually verify.
   *
   * Tool dependencies are resolved through ToolRegistry.
   *
   * Other dependency types remain unresolved until their dedicated
   * runtime resolvers exist.
   *
   * The registry deliberately does not invent dependency state.
   */
  static resolveDependencies(id: string): ISkillRuntimeResolution {
  this.initialize();

  const record = this.skills.get(id);

  if (!record) {
    return {
      status: 'failed',
      dependencies: [],
      resolvedCapabilities: [],
      resolvedTools: [],
      errors: [`Skill "${id}" not found.`],
    };
  }

  const manifest = record.manifest;
  const dependencies: ISkillDependencyResolution[] = [];
  const errors: string[] = [];

  let hasFailedDependency = false;
  let hasUnresolvedRequiredDependency = false;

  for (const dependency of manifest.dependencies) {
    switch (dependency.type) {
      case 'tool': {
        const available = ToolRegistry.has(dependency.target);

        if (available) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'resolved',
          });
          continue;
        }

        if (dependency.optional) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'unresolved',
            reason: `Optional tool "${dependency.target}" is unavailable.`,
          });
          continue;
        }

        dependencies.push({
          dependencyId: dependency.id,
          status: 'failed',
          reason: `Required tool "${dependency.target}" is unavailable.`,
        });

        hasFailedDependency = true;
        errors.push(
          `Missing required tool dependency: ${dependency.target}.`,
        );
        continue;
      }

      case 'runtime': {
        /*
         * A runtime dependency on evis-runtime is satisfied when this
         * SkillRegistry itself is executing inside the Evis runtime.
         */
        if (
          dependency.target === 'evis-runtime' ||
          dependency.target === 'filesystem-capability-runtime'
        ) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'resolved',
          });
          continue;
        }

        if (dependency.optional) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'unresolved',
            reason: `Optional runtime dependency "${dependency.target}" is unavailable.`,
          });
          continue;
        }

        dependencies.push({
          dependencyId: dependency.id,
          status: 'failed',
          reason: `Required runtime dependency "${dependency.target}" is unavailable.`,
        });

        hasFailedDependency = true;
        errors.push(
          `Missing required runtime dependency: ${dependency.target}.`,
        );
        continue;
      }

      case 'filesystem': {
        /*
         * The filesystem dependency is satisfied only when the real
         * filesystem tool and its filesystem capabilities exist.
         */
        const filesystemTool = ToolRegistry.get('filesystem');

        const requiredFilesystemCapabilities = [
          'file.read',
          'file.write',
          'file.create',
          'file.modify',
          'file.append',
          'file.list',
          'file.search',
          'file.mkdir',
          'file.stat',
          'file.exists',
          'file.copy',
          'file.move',
          'file.rename',
          'file.delete',
        ];

        const filesystemAvailable =
          Boolean(filesystemTool) &&
          requiredFilesystemCapabilities.every((capabilityId) =>
            filesystemTool?.capabilities.includes(capabilityId),
          );

        if (filesystemAvailable) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'resolved',
          });
          continue;
        }

        if (dependency.optional) {
          dependencies.push({
            dependencyId: dependency.id,
            status: 'unresolved',
            reason: `Optional filesystem dependency "${dependency.target}" is unavailable.`,
          });
          continue;
        }

        dependencies.push({
          dependencyId: dependency.id,
          status: 'failed',
          reason: `Required filesystem dependency "${dependency.target}" is unavailable.`,
        });

        hasFailedDependency = true;
        errors.push(
          `Missing required filesystem dependency: ${dependency.target}.`,
        );
        continue;
      }

      default: {
        dependencies.push({
          dependencyId: dependency.id,
          status: 'unresolved',
          reason: `No resolver is currently registered for dependency type "${dependency.type}".`,
        });

        if (!dependency.optional) {
          hasUnresolvedRequiredDependency = true;
        }

        continue;
      }
    }
  }

  const resolvedTools = manifest.tools.filter((toolId) =>
    ToolRegistry.has(toolId),
  );

  const resolvedCapabilities = manifest.capabilities.filter((capabilityId) =>
    Boolean(CapabilityRegistry.get(capabilityId)),
  );

  const unresolvedCapabilities = manifest.capabilities.filter(
    (capabilityId) => !CapabilityRegistry.get(capabilityId),
  );

  if (unresolvedCapabilities.length > 0) {
    for (const capabilityId of unresolvedCapabilities) {
      errors.push(`Declared capability "${capabilityId}" is unavailable.`);
    }

    hasFailedDependency = true;
  }

  if (resolvedTools.length !== manifest.tools.length) {
    for (const toolId of manifest.tools) {
      if (!ToolRegistry.has(toolId)) {
        errors.push(`Declared tool "${toolId}" is unavailable.`);
      }
    }

    hasFailedDependency = true;
  }

  if (hasFailedDependency) {
    return {
      status: 'failed',
      dependencies,
      resolvedCapabilities,
      resolvedTools,
      errors,
    };
  }

  if (hasUnresolvedRequiredDependency) {
    return {
      status: 'partial',
      dependencies,
      resolvedCapabilities,
      resolvedTools,
      errors,
    };
  }

  return {
    status: 'resolved',
    dependencies,
    resolvedCapabilities,
    resolvedTools,
  };
}
  /**
   * Activates a Skill only when its declarations and
   * currently resolvable runtime requirements are valid.
   *
   * Permission declarations are NOT grants.
   */
  static activate(
    id: string
  ): {
    success: boolean;
    reason?: string;
  } {
    this.initialize();

    const record =
      this.skills.get(id);

    if (!record) {
      return {
        success: false,
        reason:
          `Skill "${id}" not found.`,
      };
    }

    const validation =
      this.validate(id);

    if (!validation.valid) {
      record.state =
        'error';

      record.stateReason =
        validation.errors.join(
          '; '
        );

      record.resolution = {
        ...record.resolution,

        status:
          'failed',

        errors:
          validation.errors,
      };

      return {
        success: false,
        reason:
          record.stateReason,
      };
    }

    const resolution =
      this.resolveDependencies(id);

    record.resolution =
      resolution;

    if (
      resolution.status !==
      'resolved'
    ) {
      record.state =
        'unavailable';

      record.stateReason =
        resolution.errors?.join(
          '; '
        ) ||
        'Skill requirements are not fully resolved.';

      return {
        success: false,

        reason:
          record.stateReason,
      };
    }

    record.state =
      'active';

    record.stateReason =
      undefined;

    return {
      success: true,
    };
  }

  /**
   * Deactivates a Skill.
   */
  static deactivate(
    id: string
  ): {
    success: boolean;
  } {
    this.initialize();

    const record =
      this.skills.get(id);

    if (!record) {
      return {
        success: false,
      };
    }

    record.state =
      'inactive';

    record.stateReason =
      undefined;

    return {
      success: true,
    };
  }

  /**
   * Returns tools belonging to currently active Skills.
   *
   * Inactive or unavailable Skills do not expose their tools.
   */
  static getActiveTools():
    IToolDefinition[] {
    this.initialize();

    const toolIds =
      new Set<string>();

    for (
      const record
      of this.skills.values()
    ) {
      if (
        record.state !==
        'active'
      ) {
        continue;
      }

      for (
        const toolId
        of record.manifest.tools
      ) {
        toolIds.add(
          toolId
        );
      }
    }

    const tools:
      IToolDefinition[] =
      [];

    for (
      const toolId
      of toolIds
    ) {
      const tool =
        ToolRegistry.get(
          toolId
        );

      if (tool) {
        tools.push(
          tool
        );
      }
    }

    return tools;
  }

  /**
   * Returns capabilities provided by active Skills.
   */
  static getActiveCapabilities():
    string[] {
    this.initialize();

    const capabilities =
      new Set<string>();

    for (
      const record
      of this.skills.values()
    ) {
      if (
        record.state !==
        'active'
      ) {
        continue;
      }

      for (
        const capability
        of record.manifest.capabilities
      ) {
        capabilities.add(
          capability
        );
      }
    }

    return Array.from(
      capabilities
    );
  }

  /**
   * Returns instructions from active Skills.
   *
   * Instructions are contextual guidance only.
   * They do not grant capabilities or permissions.
   */
  static getActiveInstructions():
    string[] {
    this.initialize();

    return Array.from(
      this.skills.values()
    )
      .filter(
        (record) =>
          record.state ===
          'active'
      )
      .map(
        (record) =>
          record.manifest
            .instructions
      )
      .filter(
        (
          instruction
        ): instruction is string =>
          Boolean(
            instruction &&
              instruction.trim()
                .length > 0
          )
      );
  }
}

