import type { Plugin, ViteDevServer } from 'vite';
import { exec, spawn, ChildProcess } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverSkills } from './skillDiscovery';
import { filesystemHost } from './filesystem/filesystemHost';

interface ProviderProcessState {
  process: ChildProcess | null;
  pid?: number;
  logs: string[];
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  activeModelId?: string;
  activeModelName?: string;
}

const llamaState: ProviderProcessState = {
  process: null,
  logs: [],
  status: 'stopped',
};

async function detectLocalGgufModels() {
  const models: any[] = [];

  // 1. Qwen 2.5 Coder 14B Instruct Q6_K (split GGUF in HuggingFace cache)
  const hf14bPart1 =
    '/home/junior/.cache/huggingface/hub/models--Qwen--Qwen2.5-Coder-14B-Instruct-GGUF/snapshots/d0a692ef765eefbf2fabb130b3cb2e8917e3d225/qwen2.5-coder-14b-instruct-q6_k-00001-of-00002.gguf';
  try {
    const stat = await fs.stat(hf14bPart1);
    if (stat.isFile()) {
      models.push({
        id: 'qwen2.5-coder-14b-instruct',
        name: 'qwen2.5-coder-14b-instruct',
        provider: 'llama.cpp',
        status:
          llamaState.activeModelId === 'qwen2.5-coder-14b-instruct' && llamaState.status === 'running'
            ? 'ready'
            : 'available',
        size: '11.4 GB',
        quantization: 'Q6_K',
        contextWindow: 2048,
        description: 'Qwen 2.5 Coder 14B Instruct (Q6_K GGUF 11.4GB, HuggingFace Hub)',
        modelPath: hf14bPart1,
        alias: 'qwen2.5-coder-14b-instruct',
        threads: 4,
        contextSize: 2048,
      });
    }
  } catch {}

  // 2. Qwen 2.5 Coder 14B Q4_K_M (Ollama blob GGUF)
  const ollama14bBlob =
    '/home/junior/.ollama/models/blobs/sha256-ac9bc7a69dab38da1c790838955f1293420b55ab555ef6b4615efa1c1507b1ed';
  try {
    const stat = await fs.stat(ollama14bBlob);
    if (stat.isFile()) {
      models.push({
        id: 'qwen2.5-coder-14b-q4km-gguf',
        name: 'qwen2.5-coder-14b-q4km-gguf',
        provider: 'llama.cpp',
        status:
          llamaState.activeModelId === 'qwen2.5-coder-14b-q4km-gguf' && llamaState.status === 'running'
            ? 'ready'
            : 'available',
        size: '9.0 GB',
        quantization: 'Q4_K_M',
        contextWindow: 2048,
        description: 'Qwen 2.5 Coder 14B (Q4_K_M GGUF 9.0GB, Ollama Layer)',
        modelPath: ollama14bBlob,
        alias: 'qwen2.5-coder-14b-q4km-gguf',
        threads: 4,
        contextSize: 2048,
      });
    }
  } catch {}

  // 3. Qwen 2.5 Coder 1.5B Q4_K_M (Ollama blob GGUF)
  const ollama1_5bBlob =
    '/home/junior/.ollama/models/blobs/sha256-29d8c98fa6b098e200069bfb88b9508dc3e85586d20cba59f8dda9a808165104';
  try {
    const stat = await fs.stat(ollama1_5bBlob);
    if (stat.isFile()) {
      models.push({
        id: 'qwen2.5-coder-1.5b-gguf',
        name: 'qwen2.5-coder-1.5b-gguf',
        provider: 'llama.cpp',
        status:
          llamaState.activeModelId === 'qwen2.5-coder-1.5b-gguf' && llamaState.status === 'running'
            ? 'ready'
            : 'available',
        size: '986 MB',
        quantization: 'Q4_K_M',
        contextWindow: 4096,
        description: 'Qwen 2.5 Coder 1.5B (Q4_K_M GGUF 986MB, Local Model)',
        modelPath: ollama1_5bBlob,
        alias: 'qwen2.5-coder-1.5b-gguf',
        threads: 4,
        contextSize: 4096,
      });
    }
  } catch {}

  return models;
}

function appendLlamaLog(line: string) {
  llamaState.logs.push(line);
  if (llamaState.logs.length > 100) {
    llamaState.logs.shift();
  }
}

// Quick HTTP check helper
function checkHttpPort(port: number, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path,
        timeout: 1000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Read body helper
function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function evisBackendPlugin(): Plugin {
  return {
    name: 'evis-backend-host-bridge',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Runtime skill discovery. This endpoint reads installed packages only;
        // lifecycle validation and activation remain in the runtime registry.
        if (url === '/api/runtime/skills' && req.method === 'GET') {
          try {
            const skills = await discoverSkills(path.join(process.cwd(), 'skills'));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ skills }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 0. Real Host Environment Inspection Endpoint
        if (url === '/api/environment/profile' && req.method === 'GET') {
          try {
            const userInfo = os.userInfo();
            const homedir = os.homedir();
            const desktopDir = path.join(homedir, 'Desktop');
            const projectDir = process.cwd();

            let distro = `${os.platform()} ${os.release()}`;
            try {
              const osRelease = await fs.readFile('/etc/os-release', 'utf-8');
              const match = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
              if (match && match[1]) distro = match[1];
            } catch {}

            const hostOS = {
              platform: os.platform(),
              distro,
              release: os.release(),
              arch: os.arch(),
              hostname: os.hostname(),
              username: userInfo.username,
              homedir,
              desktopDir,
              projectDir,
            };

            const targets = ['node', 'npm', 'git', 'python3', 'ollama', 'bash', 'curl'];
            const binaries: Record<string, { isAvailable: boolean; path?: string }> = {};

            await Promise.all(
              targets.map(
                (cmd) =>
                  new Promise<void>((resolve) => {
                    exec(`which ${cmd}`, { timeout: 2000 }, (error, stdout) => {
                      const p = stdout.trim();
                      binaries[cmd] = { isAvailable: !error && Boolean(p), path: p || undefined };
                      resolve();
                    });
                  })
              )
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ os: hostOS, binaries, timestamp: Date.now() }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 1. Real Terminal Command Execution
        if (url === '/api/terminal/exec' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const command = (body.command || '').trim();
            const cwd = body.cwd || process.cwd();

            if (!command) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Command is required' }));
              return;
            }

            exec(
              command,
              {
                cwd,
                shell: '/bin/bash',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
                env: {
                  ...process.env,
                  TERM: 'xterm-256color',
                },
              },
              (error, stdout, stderr) => {
                const exitCode = error ? (error.code ?? 1) : 0;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    stdout: stdout || '',
                    stderr: stderr || (error && !stdout ? error.message : ''),
                    exitCode,
                    cwd,
                  })
                );
              }
            );
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 2. Discover local GGUF models on disk
        if (url === '/api/provider/gguf-models' && req.method === 'GET') {
          try {
            const ggufModels = await detectLocalGgufModels();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ models: ggufModels, activeModelId: llamaState.activeModelId }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 3. Start Provider Process
        if (url === '/api/provider/start' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const provider = body.provider || 'llama.cpp';

            if (provider === 'llama.cpp') {
              const requestedModelId = (body.modelId || body.alias || '').trim();

              // Check if already running on 8080
              const isAlreadyUp = await checkHttpPort(8080, '/health');
              if (isAlreadyUp) {
                const isDifferentModel =
                  requestedModelId &&
                  llamaState.activeModelId &&
                  llamaState.activeModelId !== requestedModelId;

                if (!isDifferentModel) {
                  llamaState.status = 'running';
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(
                    JSON.stringify({
                      success: true,
                      status: 'running',
                      message: `llama-server is already running with model ${llamaState.activeModelId || 'default'}`,
                      pid: llamaState.pid,
                      activeModel: llamaState.activeModelId,
                    })
                  );
                  return;
                } else {
                  appendLlamaLog(
                    `[EVIS] Switching llama.cpp model from ${llamaState.activeModelId} to ${requestedModelId}...`
                  );
                  if (llamaState.process) {
                    llamaState.process.kill('SIGTERM');
                    llamaState.process = null;
                  }
                  exec('fuser -k 8080/tcp 2>/dev/null || pkill -f llama-server 2>/dev/null', () => {});
                  await new Promise((r) => setTimeout(r, 1500));
                }
              }

              // CRITICAL MEMORY MANAGEMENT:
              // Unload loaded models from Ollama to free up ~9.6 GB of host RAM
              exec('ollama stop qwen2.5-coder:14b 2>/dev/null; ollama stop qwen2.5-coder:1.5b 2>/dev/null', () => {});
              await new Promise((r) => setTimeout(r, 300));

              // Resolve model path, alias, context window, and thread count
              const binaryPath = '/home/junior/llama.cpp/llama-server';
              let defaultModelPath =
                '/home/junior/.cache/huggingface/hub/models--Qwen--Qwen2.5-Coder-14B-Instruct-GGUF/snapshots/d0a692ef765eefbf2fabb130b3cb2e8917e3d225/qwen2.5-coder-14b-instruct-q6_k-00001-of-00002.gguf';
              let modelAlias = 'qwen2.5-coder-14b-instruct';
              let contextSize = '2048';
              let threads = '4';

              if (requestedModelId.includes('1.5b')) {
                defaultModelPath =
                  '/home/junior/.ollama/models/blobs/sha256-29d8c98fa6b098e200069bfb88b9508dc3e85586d20cba59f8dda9a808165104';
                modelAlias = 'qwen2.5-coder-1.5b-gguf';
                contextSize = '4096';
              } else if (requestedModelId.includes('q4km')) {
                defaultModelPath =
                  '/home/junior/.ollama/models/blobs/sha256-ac9bc7a69dab38da1c790838955f1293420b55ab555ef6b4615efa1c1507b1ed';
                modelAlias = 'qwen2.5-coder-14b-q4km-gguf';
                contextSize = '2048';
              } else if (body.modelPath) {
                defaultModelPath = body.modelPath;
                modelAlias = body.alias || 'custom-gguf';
              }

              llamaState.status = 'starting';
              llamaState.activeModelId = modelAlias;
              appendLlamaLog(
                `[EVIS] Spawning llama-server on port 8080 with model ${modelAlias} (-c ${contextSize} -t ${threads})...`
              );

              const child = spawn(
                binaryPath,
                [
                  '-m',
                  defaultModelPath,
                  '--alias',
                  modelAlias,
                  '--port',
                  '8080',
                  '--host',
                  '127.0.0.1',
                  '-c',
                  contextSize,
                  '-t',
                  threads,
                ],
                {
                  detached: false,
                  stdio: ['ignore', 'pipe', 'pipe'],
                }
              );

              llamaState.process = child;
              llamaState.pid = child.pid;

              child.stdout?.on('data', (data) => {
                const text = data.toString();
                appendLlamaLog(text.trim());
              });

              child.stderr?.on('data', (data) => {
                const text = data.toString();
                appendLlamaLog(text.trim());
              });

              child.on('error', (err) => {
                llamaState.status = 'error';
                llamaState.lastError = err.message;
                appendLlamaLog(`[EVIS ERROR] ${err.message}`);
              });

              child.on('exit', (code) => {
                llamaState.status = 'stopped';
                llamaState.process = null;
                llamaState.pid = undefined;
                appendLlamaLog(`[EVIS] llama-server exited with code ${code}`);
              });

              // Poll until /health returns 200 (up to 40 seconds = 80 attempts * 500ms)
              let ready = false;
              for (let i = 0; i < 80; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const healthy = await checkHttpPort(8080, '/health');
                if (healthy) {
                  ready = true;
                  break;
                }
              }

              if (ready) {
                llamaState.status = 'running';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: true,
                    status: 'running',
                    pid: child.pid,
                    activeModel: modelAlias,
                    message: `llama-server started with ${modelAlias} on 127.0.0.1:8080`,
                  })
                );
              } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: false,
                    status: 'timeout',
                    message: `llama-server was spawned but failed health check within 40 seconds`,
                    logs: llamaState.logs.slice(-15),
                  })
                );
              }
              return;
            }

            if (provider === 'ollama') {
              const isOllamaUp = await checkHttpPort(11434, '/api/tags');
              if (isOllamaUp) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: true,
                    status: 'running',
                    message: 'Ollama is running on port 11434',
                  })
                );
                return;
              }

              // Try starting ollama serve
              exec('ollama serve', { shell: '/bin/bash' }, () => {});
              await new Promise((r) => setTimeout(r, 1500));
              const nowUp = await checkHttpPort(11434, '/api/tags');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: nowUp,
                  status: nowUp ? 'running' : 'failed',
                  message: nowUp ? 'Ollama daemon started' : 'Failed to launch Ollama daemon',
                })
              );
              return;
            }

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown provider: ${provider}` }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 3. Stop Provider Process
        if (url === '/api/provider/stop' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const provider = body.provider || 'llama.cpp';

            if (provider === 'llama.cpp') {
              if (llamaState.process) {
                llamaState.process.kill('SIGTERM');
                llamaState.process = null;
                llamaState.pid = undefined;
              }
              // Kill any stray llama-server on port 8080
              exec('fuser -k 8080/tcp 2>/dev/null || pkill -f llama-server 2>/dev/null', () => {});
              llamaState.status = 'stopped';
              appendLlamaLog('[EVIS] llama-server stopped by user request.');

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, status: 'stopped' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Provider stop acknowledged' }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 4. Provider Process Status & Telemetry
        if (url === '/api/provider/status' && req.method === 'GET') {
          try {
            const [isLlamaUp, isOllamaUp] = await Promise.all([
              checkHttpPort(8080, '/health'),
              checkHttpPort(11434, '/api/tags'),
            ]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                llamaCpp: {
                  running: isLlamaUp,
                  status: isLlamaUp ? 'running' : llamaState.status,
                  pid: llamaState.pid,
                  activeModel: llamaState.activeModelId,
                  logs: llamaState.logs.slice(-20),
                },
                ollama: {
                  running: isOllamaUp,
                  status: isOllamaUp ? 'running' : 'offline',
                },
              })
            );
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

                // Runtime Filesystem Tool
        // This is the execution boundary for the new Filesystem Skill.
        // Authorization is handled by the runtime PermissionManager.
        // FilesystemHost remains the real Node filesystem implementation.
        if (
          url === '/api/runtime/tools/filesystem' &&
          req.method === 'POST'
        ) {
          try {
            const body = await parseJsonBody(req);
            const action = (body.action || '').trim();
            const inputPath = (body.path || '').trim();

            if (!action) {
              res.writeHead(400, {
                'Content-Type': 'application/json',
              });
              res.end(
                JSON.stringify({
                  error: 'Filesystem action is required',
                }),
              );
              return;
            }

            const execute = async (): Promise<unknown> => {
              switch (action) {
                case 'read':
                  return filesystemHost.read(
                    inputPath,
                    body.maxSize,
                  );

                case 'write':
                  return filesystemHost.write(
                    inputPath,
                    body.content ?? '',
                  );

                case 'create':
                  return filesystemHost.createFile(
                    inputPath,
                  );

                case 'append':
                  return filesystemHost.append(
                    inputPath,
                    body.content ?? '',
                  );

                case 'list':
                  return filesystemHost.list(
                    inputPath,
                  );

                case 'search':
                  return filesystemHost.search({
                    query: body.query ?? '',
                    path: body.path,
                    content: body.content === true,
                    maxResults: body.maxResults,
                    maxFileSize: body.maxFileSize,
                  });

                case 'mkdir':
                  return filesystemHost.mkdir(
                    inputPath,
                  );

                case 'stat':
                  return filesystemHost.stat(
                    inputPath,
                  );

                case 'exists':
                  return filesystemHost.exists(
                    inputPath,
                  );

                case 'delete':
                  return filesystemHost.delete(
                    inputPath,
                  );

                case 'rename':
                  return filesystemHost.rename(
                    inputPath,
                    body.newName ?? '',
                  );

                case 'move':
                  return filesystemHost.move(
                    inputPath,
                    body.destination ?? '',
                  );

                case 'copy':
                  return filesystemHost.copy(
                    inputPath,
                    body.destination ?? '',
                  );

                default:
                  throw new Error(
                    `Unsupported filesystem action: ${action}`,
                  );
              }
            };

            const data = await execute();

            res.writeHead(200, {
              'Content-Type': 'application/json',
            });

            res.end(
              JSON.stringify({
                success: true,
                action,
                data,
              }),
            );
          } catch (err: any) {
            const message =
              err instanceof Error
                ? err.message
                : String(err);

            res.writeHead(500, {
              'Content-Type': 'application/json',
            });

            res.end(
              JSON.stringify({
                success: false,
                error: message,
              }),
            );
          }

          return;
        }

        // Helper for safe path resolution (Workspace Root + User Desktop)
        const rootDir = process.cwd();
        const homeDir = process.env.HOME || '/home/junior';
        const desktopDir = path.join(homeDir, 'Desktop');

        const resolveSafeTarget = (inputPath: string): { fullPath: string; isSafe: boolean; isDesktop: boolean } => {
          const trimmed = (inputPath || '').trim();
          if (!trimmed) return { fullPath: '', isSafe: false, isDesktop: false };

          let resolved: string;
          const lower = trimmed.toLowerCase();

          if (
            lower.startsWith('desktop:') ||
            lower.startsWith('desktop/') ||
            lower.startsWith('bureau:') ||
            lower.startsWith('bureau/')
          ) {
            const rel = trimmed.replace(/^(desktop:\/?|desktop\/|bureau:\/?|bureau\/)/i, '');
            resolved = path.resolve(desktopDir, rel);
          } else if (trimmed.startsWith('~/Desktop') || trimmed.startsWith('~/Bureau')) {
            const rel = trimmed.replace(/^~(\/Desktop\/|\/Bureau\/)/i, '');
            resolved = path.resolve(desktopDir, rel);
          } else if (path.isAbsolute(trimmed)) {
            resolved = path.resolve(trimmed);
          } else {
            resolved = path.resolve(rootDir, trimmed);
          }

          const isInsideWorkspace = resolved.startsWith(rootDir);
          const isInsideDesktop = resolved.startsWith(desktopDir);
          const isSafe = isInsideWorkspace || isInsideDesktop;

          return { fullPath: resolved, isSafe, isDesktop: isInsideDesktop && !isInsideWorkspace };
        };

        // 5. Filesystem API: List Directory
        if (url.startsWith('/api/fs/list') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(url, 'http://127.0.0.1');
            const relDir = parsedUrl.searchParams.get('dir') || '';
            const { fullPath: targetDir, isSafe } = resolveSafeTarget(relDir);

            if (!isSafe) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Access denied: Path is outside allowed workspace/Desktop boundary' }));
              return;
            }

            const entries = await fs.readdir(targetDir, { withFileTypes: true });
            const items = await Promise.all(
              entries
                .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
                .map(async (entry) => {
                  const itemFullPath = path.join(targetDir, entry.name);
                  const stat = await fs.stat(itemFullPath).catch(() => null);
                  const isDir = entry.isDirectory();
                  return {
                    name: entry.name,
                    path: targetDir.startsWith(desktopDir)
                      ? path.relative(desktopDir, itemFullPath)
                      : path.relative(rootDir, itemFullPath),
                    fullPath: itemFullPath,
                    isDirectory: isDir,
                    size: stat ? stat.size : 0,
                    modifiedAt: stat ? stat.mtime.toISOString() : '',
                  };
                })
            );

            // Sort: directories first, then files alphabetically
            items.sort((a, b) => {
              if (a.isDirectory && !b.isDirectory) return -1;
              if (!a.isDirectory && b.isDirectory) return 1;
              return a.name.localeCompare(b.name);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items, currentDir: relDir, rootDir, desktopDir }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 6. Filesystem API: Read File Content
        if (url.startsWith('/api/fs/read') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(url, 'http://127.0.0.1');
            const relPath = parsedUrl.searchParams.get('path') || '';
            const { fullPath, isSafe } = resolveSafeTarget(relPath);

            if (!isSafe) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Access denied: Path is outside workspace/Desktop' }));
              return;
            }

            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Target is a directory, not a file' }));
              return;
            }

            if (stat.size > 2 * 1024 * 1024) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File exceeds 2MB preview limit' }));
              return;
            }

            const content = await fs.readFile(fullPath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ path: relPath, fullPath, content, size: stat.size, modifiedAt: stat.mtime.toISOString() }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 7. Filesystem API: Write File Content (Workspace or Desktop)
        if (url === '/api/fs/write' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const target = (body.path || '').trim();
            const content = body.content ?? '';
            const { fullPath, isSafe } = resolveSafeTarget(target);

            if (!target || !isSafe) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid or restricted path' }));
              return;
            }

            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
            const stat = await fs.stat(fullPath);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                path: target,
                fullPath,
                size: stat.size,
                modifiedAt: stat.mtime.toISOString(),
              })
            );
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 8. Specialized API: Create Desktop Note
        if (url === '/api/fs/desktop-note' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const content = (body.content ?? '').trim();
            const title = (body.title || '').trim();

            if (!content) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Note content cannot be empty' }));
              return;
            }

            // Generate sanitized filename
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 5).replace(':', 'h');
            let sanitizedTitle = title
              ? title.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40)
              : `Note_${dateStr}_${timeStr}`;

            if (!sanitizedTitle.endsWith('.txt') && !sanitizedTitle.endsWith('.md')) {
              sanitizedTitle += '.txt';
            }

            const targetFilePath = path.join(desktopDir, sanitizedTitle);
            await fs.mkdir(desktopDir, { recursive: true });
            await fs.writeFile(targetFilePath, content + '\n', 'utf-8');
            const stat = await fs.stat(targetFilePath);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                filename: sanitizedTitle,
                fullPath: targetFilePath,
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
                contentPreview: content.slice(0, 120),
              })
            );
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 9. Filesystem API: Create Directory
        if (url === '/api/fs/mkdir' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const relPath = (body.path || '').trim();
            const { fullPath, isSafe } = resolveSafeTarget(relPath);

            if (!relPath || !isSafe) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid or restricted path' }));
              return;
            }

            await fs.mkdir(fullPath, { recursive: true });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, path: relPath, fullPath }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 10. Filesystem API: Delete File or Directory
        if (url === '/api/fs/delete' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const relPath = (body.path || '').trim();
            const { fullPath, isSafe } = resolveSafeTarget(relPath);

            if (!relPath || !isSafe || fullPath === rootDir || fullPath === desktopDir) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid or restricted path' }));
              return;
            }

            await fs.rm(fullPath, { recursive: true, force: true });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, path: relPath, fullPath }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 11. Real Web Search API (DuckDuckGo Lite)
        if (url === '/api/web/search' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const query = (body.query || '').trim();
            const limit = Math.min(Number(body.limit) || 5, 10);

            if (!query) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Query parameter is required' }));
              return;
            }

            const ddgRes = await fetch('https://lite.duckduckgo.com/lite/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
              },
              body: `q=${encodeURIComponent(query)}`,
              signal: AbortSignal.timeout(10000),
            });

            if (!ddgRes.ok) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Search engine responded with HTTP ${ddgRes.status}` }));
              return;
            }

            const html = await ddgRes.text();
            const results: Array<{ title: string; url: string; snippet: string }> = [];

            const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*class=["']result-link["'][^>]*>([\s\S]*?)<\/a>/gi;
            const snippetRegex = /<td[^>]*class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/gi;

            const links: Array<{ url: string; title: string }> = [];
            let linkMatch: RegExpExecArray | null;
            while ((linkMatch = linkRegex.exec(html)) !== null) {
              const rawUrl = linkMatch[1];
              const rawTitle = linkMatch[2].replace(/<[^>]+>/g, '').trim();
              links.push({ url: rawUrl, title: rawTitle });
            }

            const snippets: string[] = [];
            let snippetMatch: RegExpExecArray | null;
            while ((snippetMatch = snippetRegex.exec(html)) !== null) {
              const rawSnippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
              snippets.push(rawSnippet);
            }

            for (let i = 0; i < Math.min(links.length, limit); i++) {
              results.push({
                title: links[i].title,
                url: links[i].url,
                snippet: snippets[i] || '',
              });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, query, results }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 12. Real Web Fetch API (Extract clean readable text)
        if (url === '/api/web/fetch' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const targetUrl = (body.url || '').trim();

            if (!targetUrl || !targetUrl.startsWith('http')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Valid HTTP/HTTPS URL is required' }));
              return;
            }

            const pageRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                Accept: 'text/html,application/xhtml+xml,text/plain',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (!pageRes.ok) {
              res.writeHead(pageRes.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `HTTP ${pageRes.status} fetching URL` }));
              return;
            }

            const rawHtml = await pageRes.text();
            const cleaned = rawHtml
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
              .replace(/<!--[\s\S]*?-->/g, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/\s{2,}/g, ' ')
              .trim();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                url: targetUrl,
                content: cleaned.slice(0, 4000),
                totalLength: cleaned.length,
              })
            );
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });

      // Cleanup on server close
      server.httpServer?.on('close', () => {
        if (llamaState.process) {
          try {
            llamaState.process.kill('SIGTERM');
          } catch {}
        }
      });
    },
  };
}
