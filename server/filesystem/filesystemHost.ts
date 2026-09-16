import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface FilesystemRoots {
  workspace: string;
  desktop: string;
  home: string;
}

export interface FilesystemItem {
  name: string;
  path: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size: number;
  modifiedAt: string;
}

export interface FilesystemStat {
  path: string;
  fullPath: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size: number;
  modifiedAt: string;
  createdAt: string;
  accessedAt: string;
  mode: number;
}

export interface FilesystemSearchResult {
  path: string;
  fullPath: string;
  name: string;
  isDirectory: boolean;
  matches?: Array<{
    line: number;
    text: string;
  }>;
}

export interface FilesystemSearchOptions {
  query: string;
  path?: string;
  content?: boolean;
  maxResults?: number;
  maxFileSize?: number;
}

// filesystemHost.ts
export interface ResolvedFilesystemTarget {
  inputPath: string;
  fullPath: string;
  displayPath: string;
  root: 'workspace' | 'desktop';
  isDirectory?: boolean;
  isFile?: boolean;
  isSymbolicLink?: boolean;
}

const DEFAULT_MAX_READ_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_SEARCH_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_SEARCH_RESULTS = 100;

export class FilesystemHost {
  private readonly roots: FilesystemRoots;

  constructor(workspaceRoot: string = process.cwd()) {
    const home = os.homedir();
    const desktop = path.join(home, 'Desktop');

    this.roots = {
      workspace: path.resolve(workspaceRoot),
      desktop: path.resolve(desktop),
      home: path.resolve(home),
    };
  }

  getRoots(): FilesystemRoots {
    return { ...this.roots };
  }

  async list(inputPath: string = ''): Promise<{
    items: FilesystemItem[];
    currentDir: string;
    rootDir: string;
    desktopDir: string;
  }> {
    const target = await this.resolveExistingTarget(inputPath);
    const stat = await fs.stat(target.fullPath);

    if (!stat.isDirectory()) {
      throw new Error('Target is not a directory');
    }

    const entries = await fs.readdir(target.fullPath, {
      withFileTypes: true,
    });

    const items = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.name !== '.git' &&
            entry.name !== 'node_modules',
        )
        .map((entry) => {
          const fullPath = path.join(target.fullPath, entry.name);
          return this.createItem(fullPath, target.root);
        }),
    );

    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      items,
      currentDir: target.displayPath,
      rootDir: this.roots.workspace,
      desktopDir: this.roots.desktop,
    };
  }

  async read(
    inputPath: string,
    maxSize: number = DEFAULT_MAX_READ_SIZE,
  ): Promise<{
    path: string;
    fullPath: string;
    content: string;
    size: number;
    modifiedAt: string;
  }> {
    const target = await this.resolveExistingTarget(inputPath);
    const stat = await fs.stat(target.fullPath);

    if (stat.isDirectory()) {
      throw new Error('Target is a directory, not a file');
    }

    if (stat.size > maxSize) {
      throw new Error(
        `File exceeds the ${maxSize} byte read limit`,
      );
    }

    const content = await fs.readFile(target.fullPath, 'utf-8');

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
      content,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  async write(
    inputPath: string,
    content: string,
  ): Promise<{
    path: string;
    fullPath: string;
    size: number;
    modifiedAt: string;
    created: boolean;
  }> {
    const target = await this.resolveWriteTarget(inputPath);

    let existed = false;

    try {
      const current = await fs.stat(target.fullPath);

      if (current.isDirectory()) {
        throw new Error('Target is a directory');
      }

      existed = true;
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(target.fullPath), {
      recursive: true,
    });

    await fs.writeFile(target.fullPath, content, 'utf-8');

    const stat = await fs.stat(target.fullPath);

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      created: !existed,
    };
  }

  async append(
    inputPath: string,
    content: string,
  ): Promise<{
    path: string;
    fullPath: string;
    size: number;
    modifiedAt: string;
  }> {
    const target = await this.resolveWriteTarget(inputPath);

    await fs.mkdir(path.dirname(target.fullPath), {
      recursive: true,
    });

    await fs.appendFile(target.fullPath, content, 'utf-8');

    const stat = await fs.stat(target.fullPath);

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  async createFile(inputPath: string): Promise<{
    path: string;
    fullPath: string;
    size: number;
    modifiedAt: string;
  }> {
    const target = await this.resolveWriteTarget(inputPath);

    await fs.mkdir(path.dirname(target.fullPath), {
      recursive: true,
    });

    const handle = await fs.open(target.fullPath, 'wx');

    await handle.close();

    const stat = await fs.stat(target.fullPath);

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  async mkdir(inputPath: string): Promise<{
    path: string;
    fullPath: string;
  }> {
    const target = await this.resolveWriteTarget(inputPath);

    await fs.mkdir(target.fullPath, {
      recursive: true,
    });

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
    };
  }

  async stat(inputPath: string): Promise<FilesystemStat> {
    const target = await this.resolveExistingTarget(inputPath);
    const stat = await fs.lstat(target.fullPath);

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
      name: path.basename(target.fullPath),
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      isSymbolicLink: stat.isSymbolicLink(),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      createdAt: stat.birthtime.toISOString(),
      accessedAt: stat.atime.toISOString(),
      mode: stat.mode,
    };
  }

  async exists(inputPath: string): Promise<boolean> {
    try {
      await this.resolveExistingTarget(inputPath);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  async delete(inputPath: string): Promise<{
    path: string;
    fullPath: string;
  }> {
    const target = await this.resolveExistingTarget(inputPath);

    if (
      target.fullPath === this.roots.workspace ||
      target.fullPath === this.roots.desktop
    ) {
      throw new Error(
        'Deleting a protected filesystem root is not allowed',
      );
    }

    await fs.rm(target.fullPath, {
      recursive: true,
      force: false,
    });

    return {
      path: target.displayPath,
      fullPath: target.fullPath,
    };
  }

  async rename(
    inputPath: string,
    newName: string,
  ): Promise<{
    oldPath: string;
    newPath: string;
    fullPath: string;
  }> {
    const source = await this.resolveExistingTarget(inputPath);
    const trimmedName = newName.trim();

    if (
      !trimmedName ||
      trimmedName === '.' ||
      trimmedName === '..'
    ) {
      throw new Error('A valid new name is required');
    }

    if (
      trimmedName.includes('/') ||
      trimmedName.includes('\\') ||
      path.basename(trimmedName) !== trimmedName
    ) {
      throw new Error('Rename requires a name, not a path');
    }

    const destinationPath = path.join(
      path.dirname(source.fullPath),
      trimmedName,
    );

    await this.assertAllowedWritePath(
      destinationPath,
      source.root,
    );

    await fs.rename(source.fullPath, destinationPath);

    return {
      oldPath: source.displayPath,
      newPath: this.toDisplayPath(
        destinationPath,
        source.root,
      ),
      fullPath: destinationPath,
    };
  }

  async move(
    inputPath: string,
    destinationPath: string,
  ): Promise<{
    oldPath: string;
    newPath: string;
    fullPath: string;
  }> {
    const source = await this.resolveExistingTarget(inputPath);
    const destination = await this.resolveWriteTarget(
      destinationPath,
    );

    const finalDestination =
      await this.resolveOperationDestination(
        source,
        destination,
      );

    if (
      source.isDirectory &&
      this.isPathInside(
        finalDestination,
        source.fullPath,
      )
    ) {
      throw new Error(
        'Cannot move a directory inside itself',
      );
    }

    await this.assertAllowedFinalDestination(
      finalDestination,
      destination.root,
    );

    await fs.mkdir(path.dirname(finalDestination), {
      recursive: true,
    });

    await fs.rename(
      source.fullPath,
      finalDestination,
    );

    return {
      oldPath: source.displayPath,
      newPath: this.toDisplayPath(
        finalDestination,
        destination.root,
      ),
      fullPath: finalDestination,
    };
  }

  async copy(
    inputPath: string,
    destinationPath: string,
  ): Promise<{
    sourcePath: string;
    destinationPath: string;
    fullPath: string;
  }> {
    const source = await this.resolveExistingTarget(inputPath);
    const destination = await this.resolveWriteTarget(
      destinationPath,
    );

    const finalDestination =
      await this.resolveOperationDestination(
        source,
        destination,
      );

    if (
      source.isDirectory &&
      this.isPathInside(
        finalDestination,
        source.fullPath,
      )
    ) {
      throw new Error(
        'Cannot copy a directory inside itself',
      );
    }

    await this.assertAllowedFinalDestination(
      finalDestination,
      destination.root,
    );

    await fs.mkdir(path.dirname(finalDestination), {
      recursive: true,
    });

    if (source.isDirectory) {
      await fs.cp(
        source.fullPath,
        finalDestination,
        {
          recursive: true,
          errorOnExist: true,
        },
      );
    } else {
      await fs.copyFile(
        source.fullPath,
        finalDestination,
      );
    }

    return {
      sourcePath: source.displayPath,
      destinationPath: this.toDisplayPath(
        finalDestination,
        destination.root,
      ),
      fullPath: finalDestination,
    };
  }

  async search(
    options: FilesystemSearchOptions,
  ): Promise<FilesystemSearchResult[]> {
    const query = options.query.trim();

    if (!query) {
      throw new Error(
        'Search query cannot be empty',
      );
    }

    const maxResults = Math.min(
      Math.max(
        options.maxResults ??
          DEFAULT_MAX_SEARCH_RESULTS,
        1,
      ),
      DEFAULT_MAX_SEARCH_RESULTS,
    );

    const maxFileSize =
      options.maxFileSize ??
      DEFAULT_MAX_SEARCH_FILE_SIZE;

    const start = await this.resolveExistingTarget(
      options.path ?? '',
    );

    const results: FilesystemSearchResult[] = [];

    await this.walkSearchTree(
      start.fullPath,
      start.root,
      query,
      options.content === true,
      maxResults,
      maxFileSize,
      results,
    );

    return results;
  }

  private async resolveOperationDestination(
    source: ResolvedFilesystemTarget,
    destination: ResolvedFilesystemTarget,
  ): Promise<string> {
    const destinationExists =
      await this.pathExists(
        destination.fullPath,
      );

    if (!destinationExists) {
      return destination.fullPath;
    }

    const destinationStat =
      await fs.stat(destination.fullPath);

    if (!destinationStat.isDirectory()) {
      throw new Error(
        'Destination already exists and is not a directory',
      );
    }

    return path.join(
      destination.fullPath,
      path.basename(source.fullPath),
    );
  }

  private async assertAllowedFinalDestination(
    fullPath: string,
    root: 'workspace' | 'desktop',
  ): Promise<void> {
    const realRoot =
      await this.getRealRoot(root);

    try {
      const existing =
        await fs.realpath(fullPath);

      if (
        !this.isPathInside(
          existing,
          realRoot,
        )
      ) {
        throw new Error(
          'Access denied: destination resolves outside the allowed root',
        );
      }
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }

      const parent =
        await this.resolveExistingParent(
          path.dirname(fullPath),
        );

      if (
        !this.isPathInside(
          parent,
          realRoot,
        )
      ) {
        throw new Error(
          'Access denied: destination parent resolves outside the allowed root',
        );
      }
    }
  }

  private async assertAllowedWritePath(
    fullPath: string,
    root: 'workspace' | 'desktop',
  ): Promise<void> {
    const realRoot =
      await this.getRealRoot(root);

    const parent =
      await this.resolveExistingParent(
        path.dirname(fullPath),
      );

    if (
      !this.isPathInside(
        parent,
        realRoot,
      )
    ) {
      throw new Error(
        'Access denied: destination parent resolves outside the allowed root',
      );
    }

    const candidate =
      path.join(
        parent,
        path.basename(fullPath),
      );

    if (
      !this.isPathInside(
        candidate,
        realRoot,
      )
    ) {
      throw new Error(
        'Access denied: destination is outside the allowed root',
      );
    }
  }

  private async walkSearchTree(
    directory: string,
    root: 'workspace' | 'desktop',
    query: string,
    searchContent: boolean,
    maxResults: number,
    maxFileSize: number,
    results: FilesystemSearchResult[],
  ): Promise<void> {
    if (results.length >= maxResults) {
      return;
    }

    const entries = await fs.readdir(
      directory,
      {
        withFileTypes: true,
      },
    );

    const normalizedQuery =
      query.toLowerCase();

    for (const entry of entries) {
      if (results.length >= maxResults) {
        return;
      }

      if (
        entry.name === '.git' ||
        entry.name === 'node_modules' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      const fullPath =
        path.join(
          directory,
          entry.name,
        );

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (
          entry.name
            .toLowerCase()
            .includes(normalizedQuery)
        ) {
          results.push({
            path: this.toDisplayPath(
              fullPath,
              root,
            ),
            fullPath,
            name: entry.name,
            isDirectory: true,
          });
        }

        await this.walkSearchTree(
          fullPath,
          root,
          query,
          searchContent,
          maxResults,
          maxFileSize,
          results,
        );

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const nameMatches =
        entry.name
          .toLowerCase()
          .includes(normalizedQuery);

      if (nameMatches) {
        results.push({
          path: this.toDisplayPath(
            fullPath,
            root,
          ),
          fullPath,
          name: entry.name,
          isDirectory: false,
        });

        if (
          results.length >=
          maxResults
        ) {
          return;
        }
      }

      if (!searchContent) {
        continue;
      }

      const stat =
        await fs.stat(fullPath);

      if (
        stat.size >
        maxFileSize
      ) {
        continue;
      }

      const content =
        await fs.readFile(
          fullPath,
          'utf-8',
        );

      const lines =
        content.split(/\r?\n/);

      const matches: Array<{
        line: number;
        text: string;
      }> = [];

      for (
        let index = 0;
        index < lines.length;
        index++
      ) {
        if (
          lines[index]
            .toLowerCase()
            .includes(normalizedQuery)
        ) {
          matches.push({
            line: index + 1,
            text: lines[index],
          });
        }
      }

      if (matches.length > 0) {
        results.push({
          path: this.toDisplayPath(
            fullPath,
            root,
          ),
          fullPath,
          name: entry.name,
          isDirectory: false,
          matches,
        });

        if (
          results.length >=
          maxResults
        ) {
          return;
        }
      }
    }
  }

  private async createItem(
    fullPath: string,
    root: 'workspace' | 'desktop',
  ): Promise<FilesystemItem> {
    const stat =
      await fs.lstat(fullPath);

    return {
      name: path.basename(fullPath),
      path: this.toDisplayPath(
        fullPath,
        root,
      ),
      fullPath,
      isDirectory:
        stat.isDirectory(),
      isFile: stat.isFile(),
      isSymbolicLink:
        stat.isSymbolicLink(),
      size: stat.size,
      modifiedAt:
        stat.mtime.toISOString(),
    };
  }

  private async resolveExistingTarget(
    inputPath: string,
  ): Promise<ResolvedFilesystemTarget> {
    const lexical =
      this.resolveLexicalPath(
        inputPath,
      );

    await fs.lstat(
      lexical.fullPath,
    );

    const realPath =
      await fs.realpath(
        lexical.fullPath,
      );

    const realRoot =
      await this.getRealRoot(
        lexical.root,
      );

    if (
      !this.isPathInside(
        realPath,
        realRoot,
      )
    ) {
      throw new Error(
        'Access denied: target resolves outside the allowed root',
      );
    }

    const stat =
      await fs.lstat(
        lexical.fullPath,
      );

    return {
      inputPath,
      fullPath: realPath,
      displayPath:
        this.toDisplayPath(
          realPath,
          lexical.root,
        ),
      root: lexical.root,
      isDirectory:
        stat.isDirectory(),
      isFile:
        stat.isFile(),
      isSymbolicLink:
        stat.isSymbolicLink(),
    };
  }

  private async resolveWriteTarget(
    inputPath: string,
  ): Promise<ResolvedFilesystemTarget> {
    const lexical =
      this.resolveLexicalPath(
        inputPath,
      );

    const parentPath =
      path.dirname(
        lexical.fullPath,
      );

    const fileName =
      path.basename(
        lexical.fullPath,
      );

    if (
      !fileName ||
      fileName === '.' ||
      fileName === '..'
    ) {
      throw new Error(
        'A valid target path is required',
      );
    }

    const realRoot =
      await this.getRealRoot(
        lexical.root,
      );

    const realParent =
      await this.resolveExistingParent(
        parentPath,
      );

    if (
      !this.isPathInside(
        realParent,
        realRoot,
      )
    ) {
      throw new Error(
        'Access denied: target parent resolves outside the allowed root',
      );
    }

    const candidate =
      path.join(
        realParent,
        fileName,
      );

    if (
      !this.isPathInside(
        candidate,
        realRoot,
      )
    ) {
      throw new Error(
        'Access denied: target is outside the allowed root',
      );
    }

    return {
      inputPath,
      fullPath: candidate,
      displayPath:
        this.toDisplayPath(
          candidate,
          lexical.root,
        ),
      root: lexical.root,
    };
  }

  private resolveLexicalPath(
    inputPath: string,
  ): {
    fullPath: string;
    root: 'workspace' | 'desktop';
  } {
    const trimmed =
      inputPath.trim();

    if (!trimmed) {
      return {
        fullPath:
          this.roots.workspace,
        root: 'workspace',
      };
    }

    const lower =
      trimmed.toLowerCase();

    if (
      lower === 'desktop' ||
      lower === 'bureau' ||
      lower.startsWith('desktop:') ||
      lower.startsWith('desktop/') ||
      lower.startsWith('bureau:') ||
      lower.startsWith('bureau/')
    ) {
      const relative =
        trimmed.replace(
          /^(desktop:\/?|desktop\/|bureau:\/?|bureau\/)/i,
          '',
        );

      return {
        fullPath: path.resolve(
          this.roots.desktop,
          relative,
        ),
        root: 'desktop',
      };
    }

    if (
      trimmed === '~' ||
      trimmed === '~/'
    ) {
      throw new Error(
        'The home directory itself is not an allowed filesystem root',
      );
    }

    if (
      trimmed.startsWith(
        '~/Desktop',
      ) ||
      trimmed.startsWith(
        '~/Bureau',
      )
    ) {
      const relative =
        trimmed.replace(
          /^~\/(?:Desktop|Bureau)\/?/i,
          '',
        );

      return {
        fullPath: path.resolve(
          this.roots.desktop,
          relative,
        ),
        root: 'desktop',
      };
    }

    if (path.isAbsolute(trimmed)) {
      const absolute =
        path.resolve(trimmed);

      if (
        this.isPathInside(
          absolute,
          this.roots.workspace,
        )
      ) {
        return {
          fullPath: absolute,
          root: 'workspace',
        };
      }

      if (
        this.isPathInside(
          absolute,
          this.roots.desktop,
        )
      ) {
        return {
          fullPath: absolute,
          root: 'desktop',
        };
      }

      throw new Error(
        'Access denied: absolute path is outside the allowed workspace/Desktop boundaries',
      );
    }

    return {
      fullPath: path.resolve(
        this.roots.workspace,
        trimmed,
      ),
      root: 'workspace',
    };
  }

  private async resolveExistingParent(
    parentPath: string,
  ): Promise<string> {
    let current =
      parentPath;

    while (true) {
      try {
        return await fs.realpath(
          current,
        );
      } catch (error) {
        if (
          !this.isNotFoundError(error)
        ) {
          throw error;
        }

        const parent =
          path.dirname(current);

        if (
          parent === current
        ) {
          throw new Error(
            'Unable to resolve target parent directory',
          );
        }

        current = parent;
      }
    }
  }

  private async getRealRoot(
    root: 'workspace' | 'desktop',
  ): Promise<string> {
    return fs.realpath(
      this.getRootPath(root),
    );
  }

  private getRootPath(
    root: 'workspace' | 'desktop',
  ): string {
    return root === 'workspace'
      ? this.roots.workspace
      : this.roots.desktop;
  }

  private toDisplayPath(
    fullPath: string,
    root: 'workspace' | 'desktop',
  ): string {
    const rootPath =
      this.getRootPath(root);

    const relative =
      path.relative(
        rootPath,
        fullPath,
      );

    return relative
      ? relative
      : '';
  }

  private async pathExists(
    fullPath: string,
  ): Promise<boolean> {
    try {
      await fs.lstat(fullPath);
      return true;
    } catch (error) {
      if (
        this.isNotFoundError(error)
      ) {
        return false;
      }

      throw error;
    }
  }

  private isPathInside(
    target: string,
    root: string,
  ): boolean {
    const relative =
      path.relative(
        root,
        target,
      );

    return (
      relative === '' ||
      (
        !relative.startsWith(
          `..${path.sep}`,
        ) &&
        relative !== '..' &&
        !path.isAbsolute(relative)
      )
    );
  }

  private isNotFoundError(
    error: unknown,
  ): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (
        error as {
          code?: string;
        }
      ).code === 'ENOENT'
    );
  }
}

export const filesystemHost =
  new FilesystemHost();