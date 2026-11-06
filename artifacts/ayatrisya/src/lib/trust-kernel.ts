/**
 * Client-side Trust Kernel capability guard for Ayatrisya Cloud.
 * Enforces deny-by-default for sensitive actions (e.g. arbitrary server shell commands)
 * and requires explicit consent / approval for operations modifying external systems.
 */

export type TrustCapability =
  | 'execute_arbitrary_shell'
  | 'modify_external_system'
  | 'access_cloud_models'
  | 'generate_images'
  | 'voice_stream'
  | 'read_local_workspace'
  | 'write_local_workspace'
  | 'web_search_research';

export interface AuditRecord {
  id: string;
  taskName: string;
  capability: TrustCapability;
  status: 'authorized' | 'denied' | 'cancelled' | 'failed' | 'completed';
  timestamp: string;
  durationMs?: number;
  reason?: string;
}

export interface TrustKernelPolicy {
  hasCapability(cap: TrustCapability): boolean;
  requiresExplicitApproval(cap: TrustCapability): boolean;
  executeAuthorizedTask<T>(
    taskName: string,
    capability: TrustCapability,
    action: () => Promise<T>,
    options?: {
      isApproved?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<{ success: boolean; result?: T; error?: string; auditId: string }>;
  getAuditHistory(): AuditRecord[];
  clearAuditHistory(): void;
}

const auditLog: AuditRecord[] = [];

export const trustKernel: TrustKernelPolicy = {
  hasCapability(cap: TrustCapability): boolean {
    // Arbitrary shell execution on production/host servers is STRICTLY denied by policy
    if (cap === 'execute_arbitrary_shell') {
      return false;
    }
    return true;
  },

  requiresExplicitApproval(cap: TrustCapability): boolean {
    return [
      'modify_external_system',
      'execute_arbitrary_shell',
      'access_cloud_models',
      'generate_images',
    ].includes(cap);
  },

  async executeAuthorizedTask<T>(
    taskName: string,
    capability: TrustCapability,
    action: () => Promise<T>,
    options: {
      isApproved?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ success: boolean; result?: T; error?: string; auditId: string }> {
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const start = Date.now();

    // 1. Check Capability Denial
    if (!this.hasCapability(capability)) {
      const rec: AuditRecord = {
        id: auditId,
        taskName,
        capability,
        status: 'denied',
        timestamp: new Date().toISOString(),
        reason: `Capability '${capability}' is permanently prohibited by Trust Kernel security policy.`,
      };
      auditLog.push(rec);
      return { success: false, error: rec.reason, auditId };
    }

    // 2. Check Approval
    if (this.requiresExplicitApproval(capability) && !options.isApproved) {
      const rec: AuditRecord = {
        id: auditId,
        taskName,
        capability,
        status: 'denied',
        timestamp: new Date().toISOString(),
        reason: `Explicit user approval required for sensitive action '${taskName}' (${capability}).`,
      };
      auditLog.push(rec);
      return { success: false, error: rec.reason, auditId };
    }

    // 3. Check Cancellation
    if (options.signal?.aborted) {
      const rec: AuditRecord = {
        id: auditId,
        taskName,
        capability,
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        reason: 'Operation aborted before execution.',
      };
      auditLog.push(rec);
      return { success: false, error: rec.reason, auditId };
    }

    // 4. Execute Action
    try {
      const result = await action();
      const rec: AuditRecord = {
        id: auditId,
        taskName,
        capability,
        status: 'completed',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
      auditLog.push(rec);
      return { success: true, result, auditId };
    } catch (err: any) {
      const rec: AuditRecord = {
        id: auditId,
        taskName,
        capability,
        status: 'failed',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
        reason: err?.message || String(err),
      };
      auditLog.push(rec);
      return { success: false, error: rec.reason, auditId };
    }
  },

  getAuditHistory(): AuditRecord[] {
    return [...auditLog];
  },

  clearAuditHistory(): void {
    auditLog.length = 0;
  },
};
