export class AnsiCleaner {
  // Matches ANSI escape codes, terminal color codes, cursor control codes
  private static readonly ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

  public static clean(text: string): string {
    return text.replace(this.ANSI_REGEX, '');
  }
}
