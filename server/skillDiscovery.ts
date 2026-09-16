
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  IDependency,
  IPermissionRequirement,
  IResourceReference,
  ISkillConfigurationEntry,
  ISkillConstraint,
  ISkillIOField,
  ISkillManifest,
  ISkillTriggerDefinition,
} from '../src/runtime/types/domain';

export interface DiscoveredSkill {
  manifest: ISkillManifest;
  sourcePath: string;
  errors: string[];
}

function section(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(
      `^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
      'mi'
    )
  );

  return match?.[1]?.trim() || '';
}

function identityValue(markdown: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(`^-\\s+\\*\\*${escaped}\\*\\*:\\s*(.+)$`, 'mi')
  );

  return match?.[1]?.trim() || '';
}

function bulletValues(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function paragraph(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function parseFrontMatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);

  if (!match) {
    return {};
  }

  const metadata: Record<string, unknown> = {};

  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);

    if (!entry) {
      continue;
    }

    const [, key, rawValue] = entry;

    if (rawValue === '') {
      metadata[key] = '';
      continue;
    }

    if (rawValue === 'true') {
      metadata[key] = true;
      continue;
    }

    if (rawValue === 'false') {
      metadata[key] = false;
      continue;
    }

    metadata[key] = rawValue.replace(/^["']|["']$/g, '');
  }

  return metadata;
}

function frontMatterValue(
  frontMatter: Record<string, unknown>,
  key: string
): string {
  const value = frontMatter[key];

  return typeof value === 'string' ? value.trim() : '';
}

function structuredBulletValues(content: string): string[] {
  return bulletValues(content).map((value) => value.replace(/`/g, '').trim());
}

function parseTriggers(markdown: string): ISkillTriggerDefinition[] | undefined {
  const content = section(markdown, 'Triggers');

  if (!content) {
    return undefined;
  }

  const whenToUse = paragraph(section(content, 'When to Use'));
  const doNotUse = paragraph(section(content, 'Do Not Use For'));

  if (!whenToUse && !doNotUse) {
    return undefined;
  }

  const trigger: ISkillTriggerDefinition = {
    description: whenToUse || 'Use when the skill is relevant to the request.',
  };

  const examples = structuredBulletValues(section(content, 'Examples'));
  const exclusions = structuredBulletValues(section(content, 'Do Not Use For'));

  if (examples.length > 0) {
    trigger.examples = examples;
  }

  if (exclusions.length > 0) {
    trigger.exclusions = exclusions;
  }

  return [trigger];
}

function parseDependencies(markdown: string): IDependency[] {
  const content = section(markdown, 'Dependencies');

  if (!content) {
    return [];
  }

  const dependencies: IDependency[] = [];

  for (const dependencySection of content.matchAll(
    /^###\s+(.+?)\s*$([\s\S]*?)(?=^###\s+|(?![\s\S]))/gim
  )) {
    const name = dependencySection[1].trim();
    const body = dependencySection[2];

    const type = paragraph(
      body.match(/^-?\s*\*\*Type\*\*:\s*(.+)$/im)?.[1] || ''
    );

    const id = paragraph(
      body.match(/^-?\s*\*\*ID\*\*:\s*(.+)$/im)?.[1] || ''
    );

    const target = paragraph(
      body.match(/^-?\s*\*\*Target\*\*:\s*(.+)$/im)?.[1] || ''
    );

    if (!id || !type || !target) {
      continue;
    }

    if (
      ![
        'runtime',
        'provider',
        'tool',
        'os',
        'network',
        'filesystem',
        'resource',
        'service',
      ].includes(type)
    ) {
      continue;
    }

    const optionalValue = paragraph(
      body.match(/^-?\s*\*\*Optional\*\*:\s*(.+)$/im)?.[1] || ''
    );

    const resolutionHint = paragraph(
      body.match(/^-?\s*\*\*Resolution Hint\*\*:\s*(.+)$/im)?.[1] || ''
    );

    dependencies.push({
      id,
      type: type as IDependency['type'],
      name,
      target,
      ...(optionalValue.toLowerCase() === 'true' ? { optional: true } : {}),
      ...(resolutionHint ? { resolutionHint } : {}),
    });
  }

  return dependencies;
}

function parsePermissions(markdown: string): IPermissionRequirement[] {
  const content = section(markdown, 'Permissions');

  if (!content) {
    return [];
  }

  const permissions: IPermissionRequirement[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(
      /^\s*-\s+`?([^`:\s]+)`?(?::\s*(.+))?\s*$/
    );

    if (!match) {
      continue;
    }

    const [, id, description] = match;

    permissions.push({
      id,
      description:
        description?.trim() ||
        `Permission required by skill: ${id}`,
    });
  }

  return permissions;
}

function parseConstraints(markdown: string): ISkillConstraint[] | undefined {
  const content = section(markdown, 'Constraints');

  if (!content) {
    return undefined;
  }

  const constraints = structuredBulletValues(content).map(
    (description, index) => ({
      id: `constraint-${index + 1}`,
      description,
    })
  );

  return constraints.length > 0 ? constraints : undefined;
}

function parseIOFields(
  markdown: string,
  heading: 'Inputs' | 'Outputs'
): ISkillIOField[] | undefined {
  const content = section(markdown, heading);

  if (!content) {
    return undefined;
  }

  const fields: ISkillIOField[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(
      /^\s*-\s+`([^`]+)`(?:\s*:\s*(.+))?\s*$/
    );

    if (!match) {
      continue;
    }

    const [, name, description] = match;

    fields.push({
      name: name.trim(),
      ...(description ? { description: description.trim() } : {}),
    });
  }

  return fields.length > 0 ? fields : undefined;
}

function parseResources(markdown: string): IResourceReference[] | undefined {
  const content = section(markdown, 'Resources');

  if (!content) {
    return undefined;
  }

  const resources: IResourceReference[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(
      /^\s*-\s+`([^`]+)`(?:\s*:\s*(.+))?\s*$/
    );

    if (!match) {
      continue;
    }

    const [, id, name] = match;

    resources.push({
      id,
      type: 'unknown',
      name: name?.trim() || id,
    });
  }

  return resources.length > 0 ? resources : undefined;
}

function parseConfiguration(
  markdown: string
): ISkillConfigurationEntry[] | undefined {
  const content = section(markdown, 'Configuration');

  if (!content) {
    return undefined;
  }

  const entries: ISkillConfigurationEntry[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(
      /^\s*-\s+`([^`]+)`(?:\s*:\s*(.+))?\s*$/
    );

    if (!match) {
      continue;
    }

    const [, id, description] = match;

    entries.push({
      id: id.trim(),
      description: description?.trim() || id.trim(),
    });
  }

  return entries.length > 0 ? entries : undefined;
}

function parseMetadata(markdown: string): Record<string, unknown> | undefined {
  const content = section(markdown, 'Metadata');

  if (!content) {
    return undefined;
  }

  const metadata: Record<string, unknown> = {};

  for (const line of content.split('\n')) {
    const match = line.match(
      /^\s*-\s+\*\*([^*]+)\*\*:\s*(.+?)\s*$/
    );

    if (!match) {
      continue;
    }

    const [, key, value] = match;
    metadata[key.trim()] = value.trim();
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function parseSkill(markdown: string, sourcePath: string): DiscoveredSkill {
  const frontMatter = parseFrontMatter(markdown);

  const id =
    frontMatterValue(frontMatter, 'name') ||
    identityValue(markdown, 'ID');

  const name =
    identityValue(markdown, 'Name') ||
    id;

  const version =
    frontMatterValue(frontMatter, 'version') ||
    identityValue(markdown, 'Version');

  const author =
    identityValue(markdown, 'Author') ||
    undefined;

  const purpose = paragraph(section(markdown, 'Purpose'));
  const scope = paragraph(section(markdown, 'Scope'));

  const capabilities = structuredBulletValues(
    section(markdown, 'Capabilities')
  );

  const tools = structuredBulletValues(
    section(markdown, 'Tools')
  );

  const permissions = parsePermissions(markdown);
  const dependencies = parseDependencies(markdown);
  const triggers = parseTriggers(markdown);
  const constraints = parseConstraints(markdown);
  const inputs = parseIOFields(markdown, 'Inputs');
  const outputs = parseIOFields(markdown, 'Outputs');
  const resources = parseResources(markdown);
  const configuration = parseConfiguration(markdown);
  const instructions =
    paragraph(section(markdown, 'Instructions')) ||
    undefined;
  const metadata = parseMetadata(markdown);

  const errors: string[] = [];

  if (!id) {
    errors.push('Missing Identity ID.');
  }

  if (!name) {
    errors.push('Missing Identity Name.');
  }

  if (!version) {
    errors.push('Missing Identity Version.');
  }

  if (!purpose) {
    errors.push('Missing Purpose.');
  }

  if (!scope) {
    errors.push('Missing Scope.');
  }

  if (capabilities.length === 0) {
    errors.push('No capabilities declared.');
  }

  const manifest: ISkillManifest = {
    id,
    name,
    version,
    ...(author ? { author } : {}),
    purpose,
    scope,
    ...(triggers ? { triggers } : {}),
    capabilities,
    tools,
    dependencies,
    permissions,
    ...(constraints ? { constraints } : {}),
    ...(inputs ? { inputs } : {}),
    ...(outputs ? { outputs } : {}),
    ...(resources ? { resources } : {}),
    ...(instructions ? { instructions } : {}),
    ...(configuration ? { configuration } : {}),
    ...(metadata ? { metadata } : {}),
  };

  return {
    manifest,
    sourcePath,
    errors,
  };
}

/** Discovers only installed skill packages; it does not resolve or activate them. */
export async function discoverSkills(
  skillsRoot: string
): Promise<DiscoveredSkill[]> {
  let entries: Array<{
    name: string;
    isDirectory: () => boolean;
  }>;

  try {
    entries = await fs.readdir(skillsRoot, {
      withFileTypes: true,
    });
  } catch (error: any) {
    throw new Error(
      `Skills root is unavailable: ${error.message}`
    );
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const sourcePath = path.join(
          skillsRoot,
          entry.name,
          'SKILL.md'
        );

        try {
          return parseSkill(
            await fs.readFile(sourcePath, 'utf8'),
            sourcePath
          );
        } catch (error: any) {
          const manifest: ISkillManifest = {
            id: entry.name,
            name: entry.name,
            version: '0.0.0',
            purpose: '',
            scope: '',
            capabilities: [],
            tools: [],
            dependencies: [],
            permissions: [],
          };

          return {
            manifest,
            sourcePath,
            errors: [
              `Unable to read SKILL.md: ${error.message}`,
            ],
          } satisfies DiscoveredSkill;
        }
      })
  );

  return skills.sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id)
  );
}

