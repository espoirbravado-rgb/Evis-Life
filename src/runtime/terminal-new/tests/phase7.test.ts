import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalManager } from '../security/approvalManager.ts';
import { PermissionRules } from '../security/permissionRules.ts';
import { SecretRedactor } from '../security/secretRedactor.ts';

describe('Terminal-New Phase 7 (Security & Permission Engine)', () => {
  describe('Approval Request Lifecycle & Scope Bounding', () => {
    it('manages complete lifecycle: pending -> approved -> consumed', () => {
      const manager = new ApprovalManager();
      const req = manager.createRequest('npm publish', 'Publishing new package version');

      assert.equal(req.status, 'pending');
      assert.ok(req.requestId.startsWith('appr_'));

      // Approve
      const approved = manager.approve(req.requestId);
      assert.equal(approved, true);
      assert.equal(manager.getRequest(req.requestId)?.status, 'approved');

      // Consume with exact matching command
      const consumed = manager.consumeApproval(req.requestId, 'npm publish');
      assert.equal(consumed, true);
      assert.equal(manager.getRequest(req.requestId)?.status, 'consumed');

      // Cannot consume a second time (single-use guarantee)
      const secondConsume = manager.consumeApproval(req.requestId, 'npm publish');
      assert.equal(secondConsume, false);
    });

    it('strictly forbids scope hijacking (an approval for git status cannot authorize git push)', () => {
      const manager = new ApprovalManager();
      const req = manager.createRequest('git status', 'Check repository status');
      manager.approve(req.requestId);

      // Attempt to consume with malicious/altered command
      const hijacked = manager.consumeApproval(req.requestId, 'git push origin main --force');
      assert.equal(hijacked, false);
      assert.equal(manager.getRequest(req.requestId)?.status, 'approved'); // Status remains approved for original
    });

    it('expires approval requests after their TTL', async () => {
      const manager = new ApprovalManager();
      const req = manager.createRequest('cat /etc/shadow', 'Inspect shadow', { ttlMs: 40 });

      assert.equal(req.status, 'pending');
      await new Promise(r => setTimeout(r, 60));

      // Attempting to approve after TTL fails
      const approveResult = manager.approve(req.requestId);
      assert.equal(approveResult, false);
      assert.equal(manager.getRequest(req.requestId)?.status, 'expired');
    });
  });

  describe('Permission Engine & Deterministic Priority', () => {
    it('ensures high-priority explicit deny overrides broad allow rules', () => {
      const rules = new PermissionRules();

      // Add low-priority broad allow rule for 'rm'
      rules.addRule({
        name: 'allow-general-rm',
        priority: 100,
        action: 'allow',
        reason: 'Allow general rm operations',
        commandPrefix: 'rm '
      });

      // Normal safe deletion is allowed
      const safeRm = rules.evaluate('rm file.txt');
      assert.equal(safeRm.action, 'allow');

      // Root destructive deletion is DENIED by high priority (1000) rule
      const dangerousRm = rules.evaluate('rm -rf /');
      assert.equal(dangerousRm.action, 'deny');
      assert.equal(dangerousRm.matchedRule, 'destructive-root-rm');
    });

    it('evaluates superuser commands with require_approval action', () => {
      const rules = new PermissionRules();
      const decision = rules.evaluate('sudo systemctl restart nginx');
      assert.equal(decision.action, 'require_approval');
      assert.equal(decision.matchedRule, 'sudo-privilege');
    });
  });

  describe('Dynamic Secret Redactor', () => {
    it('redacts registered custom runtime secrets', () => {
      SecretRedactor.registerSecret('very_custom_dynamically_injected_api_token_12345');

      const text = 'Connected to endpoint using auth token: very_custom_dynamically_injected_api_token_12345';
      const redacted = SecretRedactor.redact(text);

      assert.ok(!redacted.includes('very_custom_dynamically_injected_api_token_12345'));
      assert.ok(redacted.includes('[REDACTED_SECRET]'));

      SecretRedactor.clearCustomSecrets();
    });

    it('redacts database passwords in URIs', () => {
      const connectionUrl = 'postgres://db_user:my_secret_database_password_99@localhost:5432/production';
      const redacted = SecretRedactor.redact(connectionUrl);

      assert.ok(!redacted.includes('my_secret_database_password_99'));
      assert.ok(redacted.includes('postgres://db_user:[REDACTED_PASSWORD]@localhost:5432/production'));
    });

    it('redacts private key blocks', () => {
      const pemKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3yD0p...dummyKeyContent...
-----END RSA PRIVATE KEY-----`;

      const redacted = SecretRedactor.redact(pemKey);
      assert.ok(!redacted.includes('dummyKeyContent'));
      assert.ok(redacted.includes('[REDACTED_SECRET]'));
    });
  });
});
