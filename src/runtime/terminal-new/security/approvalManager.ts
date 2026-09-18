export type ApprovalCallback = (command: string, reason: string) => Promise<boolean>;

export class ApprovalManager {
  private handler: ApprovalCallback | null = null;

  public setApprovalHandler(handler: ApprovalCallback): void {
    this.handler = handler;
  }

  public async requestApproval(command: string, reason: string): Promise<boolean> {
    if (!this.handler) {
      // Default policy: reject if no human approval handler is registered
      return false;
    }
    return this.handler(command, reason);
  }
}
