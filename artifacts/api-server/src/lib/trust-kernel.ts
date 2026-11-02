
/**
 * Capability-based permissions and execution policies for Ayatrisya Cloud.
 * Enforces deny-by-default for sensitive operations, model actions, connector invocations,
 * agent behaviors, and data transfers.
 */

export type TrustRole = "guest" | "user" | "desktop_paired" | "admin";

export type AgentDomain =
  | "research"
  | "coding"
  | "image"
  | "github"
  | "automation"
  | "general";

export type ResourceScope =
  | "model:chat"
  | "model:image"
  | "model:3d"
  | "model:music"
  | "model:transcribe"
  | "connector:github:read"
  | "connector:github:write"
  | "connector:figma:read"
  | "connector:drive:backup"
  | "tasks:schedule"
  | "tasks:execute"
  | "workspace:file:read"
  | "workspace:file:write"
  | "sandbox:exec";

export interface CapabilityToken {
  id: string;
  userId: string;
  sessionId?: string;
  deviceId?: string;
  grantedScopes: ResourceScope[];
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  approvalStatus: "approved" | "pending" | "denied";
  auditMetadata?: Record<string, unknown>;
}

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  userId: string;
  role: TrustRole;
  action: string;
  resource: ResourceScope | string;
  decision: "allow" | "deny";
  reason: string;
  ipHash?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentFirewallRule {
  domain: AgentDomain;
  allowedScopes: Set<ResourceScope>;
  forbiddenScopes: Set<ResourceScope>;
  requiresApprovalScopes: Set<ResourceScope>;
}

export const AGENT_FIREWALL_PROFILES: Record<AgentDomain, AgentFirewallRule> = {
  research: {
    domain: "research",
    allowedScopes: new Set<ResourceScope>([
      "model:chat",
      "workspace:file:read",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "connector:github:write",
      "sandbox:exec",
      "workspace:file:write",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>(),
  },
  coding: {
    domain: "coding",
    allowedScopes: new Set<ResourceScope>([
      "model:chat",
      "workspace:file:read",
      "workspace:file:write",
      "sandbox:exec",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "connector:github:write",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>([
      "sandbox:exec",
    ]),
  },
  image: {
    domain: "image",
    allowedScopes: new Set<ResourceScope>([
      "model:chat",
      "model:image",
      "workspace:file:read",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "sandbox:exec",
      "connector:github:write",
      "workspace:file:write",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>(),
  },
  github: {
    domain: "github",
    allowedScopes: new Set<ResourceScope>([
      "connector:github:read",
      "workspace:file:read",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "sandbox:exec",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>([
      "connector:github:write",
    ]),
  },
  automation: {
    domain: "automation",
    allowedScopes: new Set<ResourceScope>([
      "tasks:schedule",
      "model:chat",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "sandbox:exec",
      "connector:github:write",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>([
      "tasks:execute",
    ]),
  },
  general: {
    domain: "general",
    allowedScopes: new Set<ResourceScope>([
      "model:chat",
      "model:image",
      "model:music",
      "model:transcribe",
      "workspace:file:read",
      "workspace:file:write",
    ]),
    forbiddenScopes: new Set<ResourceScope>([
      "sandbox:exec",
      "connector:github:write",
    ]),
    requiresApprovalScopes: new Set<ResourceScope>([
      "connector:drive:backup",
    ]),
  },
};

export class TrustKernel {
  private auditLog: SecurityAuditRecord[] = [];
  private readonly maxAuditLogs = 2000;
  private revokedTokens = new Set<string>();
  // Map of userId -> revokedAt timestamp in milliseconds. Any token/session issued before this time is rejected.
  private userSessionRevocations = new Map<string, number>();

  public logEvent(record: Omit<SecurityAuditRecord, "id" | "timestamp">): SecurityAuditRecord {
    const entry: SecurityAuditRecord = {
      ...record,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditLogs) {
      this.auditLog.shift();
    }
    return entry;
  }

  public getAuditHistory(userId?: string): SecurityAuditRecord[] {
    if (!userId) return [...this.auditLog];
    return this.auditLog.filter((log) => log.userId === userId);
  }

  public revokeToken(tokenId: string): void {
    this.revokedTokens.add(tokenId);
  }

  public isTokenRevoked(tokenId: string): boolean {
    return this.revokedTokens.has(tokenId);
  }

  /**
   * Revokes all active sessions and tokens for a given user up to the current timestamp.
   * Any token issued at or prior to revokedAt is rejected immediately.
   */
  public revokeUserSessions(userId: string, revokedAt = Date.now()): void {
    this.userSessionRevocations.set(userId, revokedAt);
    this.logEvent({
      userId,
      role: "user",
      action: "session_revocation",
      resource: "auth:session",
      decision: "deny",
      reason: `All sessions issued prior to ${new Date(revokedAt).toISOString()} revoked.`,
    });
  }

  /**
   * Checks whether a user's session issued at issuedAtMs has been invalidated by a revocation event.
   */
  public isUserSessionRevoked(userId: string, issuedAtMs: number): boolean {
    const revokedAt = this.userSessionRevocations.get(userId);
    if (!revokedAt) return false;
    return issuedAtMs <= revokedAt;
  }

  /**
   * Resets revocation state (used primarily in test suites).
   */
  public clearRevocations(): void {
    this.revokedTokens.clear();
    this.userSessionRevocations.clear();
  }

  /**
   * Deterministically validates whether a request with a capability token is allowed
   * to access a specific resource scope.
   */
  public authorizeCapability(
    token: CapabilityToken,
    requiredScope: ResourceScope,
    role: TrustRole = "user"
  ): { allowed: boolean; reason: string } {
    if (this.revokedTokens.has(token.id) || token.revoked) {
      this.logEvent({
        userId: token.userId,
        role,
        action: "capability_check",
        resource: requiredScope,
        decision: "deny",
        reason: "Token has been revoked.",
      });
      return { allowed: false, reason: "Token has been revoked." };
    }

    if (this.isUserSessionRevoked(token.userId, token.issuedAt)) {
      this.logEvent({
        userId: token.userId,
        role,
        action: "capability_check",
        resource: requiredScope,
        decision: "deny",
        reason: "User session has been revoked.",
      });
      return { allowed: false, reason: "User session has been revoked." };
    }

    if (Date.now() > token.expiresAt) {
      this.logEvent({
        userId: token.userId,
        role,
        action: "capability_check",
        resource: requiredScope,
        decision: "deny",
        reason: "Capability token has expired.",
      });
      return { allowed: false, reason: "Capability token has expired." };
    }

    if (token.approvalStatus !== "approved") {
      this.logEvent({
        userId: token.userId,
        role,
        action: "capability_check",
        resource: requiredScope,
        decision: "deny",
        reason: `Capability token is ${token.approvalStatus}, not approved.`,
      });
      return { allowed: false, reason: `Capability token is ${token.approvalStatus}, not approved.` };
    }

    if (!token.grantedScopes.includes(requiredScope)) {
      this.logEvent({
        userId: token.userId,
        role,
        action: "capability_check",
        resource: requiredScope,
        decision: "deny",
        reason: `Required scope '${requiredScope}' was not granted in this capability token.`,
      });
      return { allowed: false, reason: `Required scope '${requiredScope}' was not granted.` };
    }

    this.logEvent({
      userId: token.userId,
      role,
      action: "capability_check",
      resource: requiredScope,
      decision: "allow",
      reason: "Capability token scope matched and valid.",
    });
    return { allowed: true, reason: "Authorized." };
  }

  /**
   * Evaluates whether an agent in a specific domain is permitted to perform an operation.
   * Deny-by-default: if forbidden, rejected immediately. If requires approval, rejected unless explicitly approved.
   */
  public evaluateAgentAction(
    domain: AgentDomain,
    scope: ResourceScope,
    isExplicitlyApprovedByUser = false,
    userId = "system"
  ): { allowed: boolean; requiresApproval: boolean; reason: string } {
    const profile = AGENT_FIREWALL_PROFILES[domain] ?? AGENT_FIREWALL_PROFILES.general;

    if (profile.forbiddenScopes.has(scope)) {
      this.logEvent({
        userId,
        role: "user",
        action: `agent:${domain}:action`,
        resource: scope,
        decision: "deny",
        reason: `Scope '${scope}' is strictly forbidden for agent profile '${domain}'.`,
      });
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Scope '${scope}' is strictly forbidden for agent profile '${domain}'.`,
      };
    }

    if (profile.requiresApprovalScopes.has(scope)) {
      if (!isExplicitlyApprovedByUser) {
        this.logEvent({
          userId,
          role: "user",
          action: `agent:${domain}:action`,
          resource: scope,
          decision: "deny",
          reason: `Consequential operation '${scope}' requires explicit user approval.`,
        });
        return {
          allowed: false,
          requiresApproval: true,
          reason: `Consequential operation '${scope}' requires explicit user approval before execution.`,
        };
      }
    }

    if (!profile.allowedScopes.has(scope) && !profile.requiresApprovalScopes.has(scope)) {
      this.logEvent({
        userId,
        role: "user",
        action: `agent:${domain}:action`,
        resource: scope,
        decision: "deny",
        reason: `Scope '${scope}' is not in allowed scopes for agent '${domain}'. Deny-by-default.`,
      });
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Scope '${scope}' is not permitted by default for ${domain} agent.`,
      };
    }

    this.logEvent({
      userId,
      role: "user",
      action: `agent:${domain}:action`,
      resource: scope,
      decision: "allow",
      reason: `Permitted under agent firewall policy for ${domain}.`,
    });
    return { allowed: true, requiresApproval: false, reason: "Allowed." };
  }
}

export const defaultTrustKernel = new TrustKernel();
