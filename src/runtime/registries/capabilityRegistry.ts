
/**
 * EVIS RUNTIME — CAPABILITY REGISTRY
 *
 * Responsibility:
 * - Register the capabilities known by the Evis runtime.
 * - Provide lookup and filtering operations.
 *
 * Architectural rules:
 * - Capability = WHAT Evis can do.
 * - This registry does not execute operations.
 * - This registry does not resolve skills.
 * - This registry does not resolve tools.
 * - This registry does not authorize operations.
 * - This registry does not grant permissions.
 * - Permission and policy decisions belong to the Policy / Permission layer.
 *
 * A capability may describe risk as domain metadata, but risk does not itself
 * authorize or deny execution.
 */

import type {
  CapabilityCategory,
  CapabilityId,
  ICapability,
  RiskLevel,
} from '../types/domain';

export class CapabilityRegistry {
  private static readonly capabilities = new Map<
    CapabilityId,
    ICapability
  >();

  private static initialized = false;

  /**
   * Initializes the standard capabilities known by Evis.
   *
   * Initialization is intentionally idempotent.
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // -------------------------------------------------------------------------
    // FILE
    // -------------------------------------------------------------------------

    this.register({
      id: 'file.read',
      name: 'Read File',
      description:
        'Read the content of a file available to Evis.',
      category: 'file',
      riskLevel: 'safe',
    });

    this.register({
      id: 'file.create',
      name: 'Create File',
      description:
        'Create a new file in an authorized filesystem location.',
      category: 'file',
      riskLevel: 'safe',
    });

    this.register({
      id: 'file.write',
      name: 'Write File',
      description:
        'Write or replace the content of an existing file.',
      category: 'file',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'file.modify',
      name: 'Modify File',
      description:
        'Apply a targeted modification to an existing file.',
      category: 'file',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'file.list',
      name: 'List Directory',
      description:
        'List files and directories available in an authorized location.',
      category: 'file',
      riskLevel: 'safe',
    });

    this.register({
      id: 'file.search',
      name: 'Search Files',
      description:
        'Search an authorized filesystem scope for files or directories.',
      category: 'file',
      riskLevel: 'safe',
    });

    this.register({
      id: 'file.delete',
      name: 'Delete File',
      description:
        'Delete a file or directory from an authorized filesystem scope.',
      category: 'file',
      riskLevel: 'dangerous',
    });

    // -------------------------------------------------------------------------
    // TERMINAL
    // -------------------------------------------------------------------------

    this.register({
      id: 'terminal.execute',
      name: 'Execute Shell Command',
      description:
        'Execute a shell command through the authorized host execution layer.',
      category: 'terminal',
      riskLevel: 'dangerous',
    });

    // -------------------------------------------------------------------------
    // CODE
    // -------------------------------------------------------------------------

    this.register({
      id: 'code.analyze',
      name: 'Analyze Code',
      description:
        'Analyze source code for syntax, types, patterns, structure, or errors.',
      category: 'code',
      riskLevel: 'safe',
    });

    this.register({
      id: 'code.execute',
      name: 'Execute Code',
      description:
        'Execute code through an authorized and appropriately isolated runtime.',
      category: 'code',
      riskLevel: 'dangerous',
    });

    this.register({
      id: 'code.test',
      name: 'Run Tests',
      description:
        'Execute a project test suite through the authorized execution layer.',
      category: 'code',
      riskLevel: 'prompt',
    });

    // -------------------------------------------------------------------------
    // MEMORY
    // -------------------------------------------------------------------------

    this.register({
      id: 'memory.read',
      name: 'Read Memory',
      description:
        'Read persisted Evis memory and knowledge available to the current context.',
      category: 'memory',
      riskLevel: 'safe',
    });

    this.register({
      id: 'memory.save',
      name: 'Save Memory',
      description:
        'Persist information selected as useful long-term Evis memory.',
      category: 'memory',
      riskLevel: 'prompt',
    });

    // -------------------------------------------------------------------------
    // WEB
    // -------------------------------------------------------------------------

    this.register({
      id: 'web.search',
      name: 'Web Search',
      description:
        'Perform a search through an available web provider.',
      category: 'web',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'web.open',
      name: 'Open Web Resource',
      description:
        'Open and retrieve an available web resource.',
      category: 'web',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'web.fetch',
      name: 'Fetch Web Content',
      description:
        'Retrieve content from an authorized HTTP or HTTPS resource.',
      category: 'web',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'web.extract',
      name: 'Extract Web Content',
      description:
        'Extract relevant structured or textual information from retrieved web content.',
      category: 'web',
      riskLevel: 'safe',
    });

    this.register({
      id: 'web.research',
      name: 'Conduct Web Research',
      description:
        'Perform multi-step web research using search, retrieval, extraction, and evaluation.',
      category: 'web',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'web.compare',
      name: 'Compare Web Sources',
      description:
        'Compare information obtained from multiple web sources.',
      category: 'web',
      riskLevel: 'safe',
    });

    this.register({
      id: 'web.verify',
      name: 'Verify Web Information',
      description:
        'Cross-check information against available web sources and evidence.',
      category: 'web',
      riskLevel: 'safe',
    });

    // -------------------------------------------------------------------------
    // MEDIA
    // -------------------------------------------------------------------------

    this.register({
      id: 'audio.transcribe',
      name: 'Speech to Text',
      description:
        'Transcribe an audio input into text.',
      category: 'media',
      riskLevel: 'safe',
    });

    this.register({
      id: 'audio.speak',
      name: 'Text to Speech',
      description:
        'Generate spoken audio from text.',
      category: 'media',
      riskLevel: 'safe',
    });

    this.register({
      id: 'image.generate',
      name: 'Generate Image',
      description:
        'Generate an image through an available image generation provider.',
      category: 'media',
      riskLevel: 'prompt',
    });

    this.register({
      id: 'image.edit',
      name: 'Edit Image',
      description:
        'Edit an existing image through an available image generation provider.',
      category: 'media',
      riskLevel: 'prompt',
    });

    // -------------------------------------------------------------------------
    // AGENT
    // -------------------------------------------------------------------------

    this.register({
      id: 'agent.communicate',
      name: 'Communicate with External Agent',
      description:
        'Exchange structured messages with an external AI agent or agent service.',
      category: 'agent',
      riskLevel: 'prompt',
    });

    // Mark initialization only after all standard capabilities have been
    // registered successfully.
    this.initialized = true;
  }

  /**
   * Registers a capability.
   *
   * Registration does not activate, authorize, or execute the capability.
   */
  static register(capability: ICapability): void {
    this.capabilities.set(capability.id, capability);
  }

  /**
   * Checks whether a capability exists.
   */
  static has(id: CapabilityId): boolean {
    this.initialize();
    return this.capabilities.has(id);
  }

  /**
   * Retrieves one capability.
   */
  static get(id: CapabilityId): ICapability | undefined {
    this.initialize();
    return this.capabilities.get(id);
  }

  /**
   * Returns every registered capability.
   */
  static getAll(): ICapability[] {
    this.initialize();
    return Array.from(this.capabilities.values());
  }

  /**
   * Returns capabilities belonging to a category.
   */
  static getByCategory(
    category: CapabilityCategory
  ): ICapability[] {
    this.initialize();

    return Array.from(this.capabilities.values()).filter(
      (capability) => capability.category === category
    );
  }

  /**
   * Returns capabilities classified at a given risk level.
   *
   * Risk classification is informational domain metadata.
   * Authorization remains the responsibility of the policy layer.
   */
  static getByRiskLevel(
    level: RiskLevel
  ): ICapability[] {
    this.initialize();

    return Array.from(this.capabilities.values()).filter(
      (capability) => capability.riskLevel === level
    );
  }

  /**
   * Resolves capability identifiers against the registry.
   *
   * This only resolves capability identity.
   * It does not resolve skills, tools, providers, dependencies,
   * permissions, or execution plans.
   */
  static resolveCapabilities(
    capabilityIds: CapabilityId[]
  ): {
    resolved: ICapability[];
    missing: CapabilityId[];
  } {
    this.initialize();

    const resolved: ICapability[] = [];
    const missing: CapabilityId[] = [];

    for (const id of capabilityIds) {
      const capability = this.capabilities.get(id);

      if (capability) {
        resolved.push(capability);
      } else {
        missing.push(id);
      }
    }

    return {
      resolved,
      missing,
    };
  }

  /**
   * Clears the registry.
   *
   * Intended for controlled runtime reset/testing.
   */
  static reset(): void {
    this.capabilities.clear();
    this.initialized = false;
  }
}

