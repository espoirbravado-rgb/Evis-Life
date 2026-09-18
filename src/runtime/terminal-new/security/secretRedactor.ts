export class SecretRedactor {
  private static readonly SECRET_PATTERNS: RegExp[] = [
    // AWS keys
    /AKIA[0-9A-Z]{16}/g,
    // GitHub tokens
    /gh[pousr]_[0-9a-zA-Z]{36}/g,
    // Generic API keys / Bearer tokens
    /(Bearer\s+)[a-zA-Z0-9_\-\.]{20,}/gi,
    /(api[_-]?key\s*[:=]\s*['"]?)[a-zA-Z0-9_\-]{16,}['"]?/gi,
    /(password\s*[:=]\s*['"]?)[^'"\s]{4,}['"]?/gi
  ];

  public static redact(text: string): string {
    let result = text;
    for (const pattern of this.SECRET_PATTERNS) {
      result = result.replace(pattern, '[REDACTED_SECRET]');
    }
    return result;
  }
}
