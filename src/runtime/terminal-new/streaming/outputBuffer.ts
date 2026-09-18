import { StringDecoder } from 'node:string_decoder';

export class OutputBuffer {
  private headChunks: string[] = [];
  private tailChunks: string[] = [];
  private headBytes: number = 0;
  private tailBytes: number = 0;
  private totalBytesReceived: number = 0;
  private isTruncated: boolean = false;

  private readonly maxHeadBytes: number;
  private readonly maxTailBytes: number;
  private headDecoder = new StringDecoder('utf-8');
  private tailDecoder = new StringDecoder('utf-8');

  constructor(maxBytes: number = 5 * 1024 * 1024) {
    // 25% for head, 75% for tail when overflowing
    this.maxHeadBytes = Math.floor(maxBytes * 0.25);
    this.maxTailBytes = maxBytes - this.maxHeadBytes;
  }

  public append(chunk: string): void {
    const chunkBuffer = Buffer.from(chunk, 'utf-8');
    const chunkLength = chunkBuffer.length;
    this.totalBytesReceived += chunkLength;

    if (!this.isTruncated && this.headBytes + chunkLength <= this.maxHeadBytes) {
      this.headChunks.push(chunk);
      this.headBytes += chunkLength;
      return;
    }

    if (!this.isTruncated) {
      this.isTruncated = true;
      const headSpace = Math.max(0, this.maxHeadBytes - this.headBytes);
      if (headSpace > 0) {
        const headPart = chunkBuffer.subarray(0, headSpace);
        this.headChunks.push(this.headDecoder.write(headPart));
        this.headBytes += headPart.length;

        const tailPart = chunkBuffer.subarray(headSpace);
        this.appendTail(tailPart);
      } else {
        this.appendTail(chunkBuffer);
      }
    } else {
      this.appendTail(chunkBuffer);
    }
  }

  private appendTail(buffer: Buffer): void {
    // If incoming buffer is larger than maxTailBytes, only take the newest tail of it
    const sliceToKeep = buffer.length > this.maxTailBytes
      ? buffer.subarray(buffer.length - this.maxTailBytes)
      : buffer;

    const sliceLen = sliceToKeep.length;

    // Prune existing tail chunks until there is space for sliceToKeep
    while (this.tailChunks.length > 0 && (this.tailBytes + sliceLen) > this.maxTailBytes) {
      const removed = this.tailChunks.shift()!;
      this.tailBytes -= Buffer.byteLength(removed, 'utf-8');
    }

    const text = this.tailDecoder.write(sliceToKeep);
    this.tailChunks.push(text);
    this.tailBytes += sliceLen;
  }

  public toString(): string {
    if (!this.isTruncated) {
      return this.headChunks.join('') + this.headDecoder.end();
    }

    const omittedBytes = Math.max(0, this.totalBytesReceived - (this.headBytes + this.tailBytes));
    const separator = `\n\n... [output truncated: ${omittedBytes} bytes omitted] ...\n\n`;

    return (
      this.headChunks.join('') +
      this.headDecoder.end() +
      separator +
      this.tailChunks.join('') +
      this.tailDecoder.end()
    );
  }

  public get truncated(): boolean {
    return this.isTruncated;
  }

  public get totalBytes(): number {
    return this.totalBytesReceived;
  }

  public get retainedBytes(): number {
    return this.headBytes + this.tailBytes;
  }

  public clear(): void {
    this.headChunks = [];
    this.tailChunks = [];
    this.headBytes = 0;
    this.tailBytes = 0;
    this.totalBytesReceived = 0;
    this.isTruncated = false;
    this.headDecoder = new StringDecoder('utf-8');
    this.tailDecoder = new StringDecoder('utf-8');
  }
}
