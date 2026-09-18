export class SecretRedactor {
  private static customSecrets: Set<string> = new Set();
  private static customPatterns: RegExp[] = [];

  private static readonly BUILTIN_PATTERNS: RegExp[] = [
    // AWS Access Keys
    /AKIA[0-9A-Z]{16}/g,
    // GitHub Tokens (Personal & App tokens)
    /gh[pousr]_[0-9a-zA-Z]{20,}/g,
    /github_pat_[0-9a-zA-Z_]{82}/g,
    // Bearer authorization headers
    /(Bearer\s+)[a-zA-Z0-9_\-\.]{20,}/gi,
    // Generic API Key assignments
    /((?:api[_-]?key|apikey|auth[_-]?token|secret)\s*[:=]\s*['"]?)[a-zA-Z0-9_\-]{16,}['"]?/gi,
    // Passwords embedded in URIs (e.g. postgres://user:password@host)
    /(:\/\/[^:]+:)([^@\s]{3,})(@)/g,
    // PEM Private Keys
    /-----BEGIN\s+([A-Z\s]+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+([A-Z\s]+)?PRIVATE\s+KEY-----/g
  ];

  public static registerSecret(secretValue: string): void {
    const trimmed = secretValue.trim();
    if (trimmed.length >= 4) {
      this.customSecrets.add(trimmed);
    }
  }

  public static addPattern(pattern: RegExp): void {
    this.customPatterns.push(pattern);
  }

  public static clearCustomSecrets(): void {
    this.customSecrets.clear();
    this.customPatterns = [];
  }

  public static redact(text: string): string {
    if (!text) return text;
    let result = text;

    // 1. Redact dynamically registered environment/runtime secrets
    for (const secret of this.customSecrets) {
      if (result.includes(secret)) {
        result = result.split(secret).join('[REDACTED_SECRET]');
      }
    }

    // 2. Redact built-in patterns
    for (const pattern of this.BUILTIN_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, (_match, p1, p2, p3) => {
        if (p1 && p3) {
          // URI pattern with groups (protocol + user : password @ host)
          return `${p1}[REDACTED_PASSWORD]${p3}`;
        }
        if (p1 && !p2 && !p3) {
          // Header pattern (e.g. "Bearer ")
          return `${p1}[REDACTED_TOKEN]`;
        }
        return '[REDACTED_SECRET]';
      });
    }

    // 3. Redact custom user patterns
    for (const pattern of this.customPatterns) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, '[REDACTED_SECRET]');
    }

    return result;
  }
}
