export class OutputBuffer {
  private chunks: string[] = [];
  private currentBytes: number = 0;
  private isTruncated: boolean = false;

  constructor(private readonly maxBytes: number = 5 * 1024 * 1024) {}

  public append(chunk: string): void {
    const chunkBytes = Buffer.byteLength(chunk, 'utf-8');
    if (this.currentBytes + chunkBytes > this.maxBytes) {
      this.isTruncated = true;
      const remaining = Math.max(0, this.maxBytes - this.currentBytes);
      if (remaining > 0) {
        this.chunks.push(chunk.substring(0, remaining));
        this.currentBytes += remaining;
      }
      return;
    }

    this.chunks.push(chunk);
    this.currentBytes += chunkBytes;
  }

  public toString(): string {
    return this.chunks.join('');
  }

  public get truncated(): boolean {
    return this.isTruncated;
  }

  public clear(): void {
    this.chunks = [];
    this.currentBytes = 0;
    this.isTruncated = false;
  }
}
