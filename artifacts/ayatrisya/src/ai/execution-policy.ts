/**
 * Ayatrisya Execution Policy & Capability Routing Engine
 * 
 * Target Architecture:
 * - Local Desktop AI (user's own computer via secure IPC or loopback companion)
 * - Cloud Model Server (routed through Render API Gateway with server-side credentials)
 * 
 * Rules:
 * 1. Typed policies: "local_desktop" | "cloud_model" | "auto".
 * 2. Deterministic and transparent: Never silently change execution targets in a way that violates user choice or consent.
 * 3. Local-only requests NEVER fall back to cloud. If offline/unavailable, fail with clear choice.
 * 4. 3D generation is strictly local desktop-only. Cloud requests for 3D are rejected.
 * 5. Coding toolchain, filesystem operations, and game builds are strictly executed on an authorized desktop.
 * 6. Cloud inference is only used for supported capabilities when enabled, authenticated, and authorized.
 */

export type ExecutionTarget = "local_desktop" | "cloud_model" | "auto";

export type ExecutionCapability =
  | "chat"
  | "coding"
  | "image"
  | "3d"
  | "music"
  | "game-build"
  | "project-file"
  | "transcribe"
  | "speech";

export type ExecutionRoute = "desktop_ipc" | "remote_access_gateway" | "cloud_gateway";

export interface ExecutionDecision {
  target: "local_desktop" | "cloud_model";
  route: ExecutionRoute;
  capability: ExecutionCapability;
  reason: string;
  allowed: boolean;
  error?: string;
}

export class RoutingPolicyError extends Error {
  constructor(
    message: string,
    public readonly capability: ExecutionCapability,
    public readonly target: ExecutionTarget,
  ) {
    super(message);
    this.name = "RoutingPolicyError";
  }
}

/**
 * Returns whether a capability is supported for remote cloud inference.
 * Strict boundary: 3D generation, project filesystem operations, compiler runs,
 * and game builds CANNOT run on remote cloud servers.
 */
export function canCapabilityRunOnCloud(capability: ExecutionCapability): boolean {
  switch (capability) {
    case "3d":
    case "coding":
    case "game-build":
    case "project-file":
      return false;
    case "chat":
    case "image":
    case "music":
    case "transcribe":
    case "speech":
      return true;
  }
}

export interface RoutingParameters {
  capability: ExecutionCapability;
  targetPolicy?: ExecutionTarget;
  isNativeDesktop?: boolean;
  hasLocalModel?: boolean;
  isRemoteDesktopPaired?: boolean;
  requiresLocalProjectAccess?: boolean;
  requiresLocalCompiler?: boolean;
}

/**
 * Resolves the deterministic routing decision for a given request.
 */
export function resolveExecutionRouting(params: RoutingParameters): ExecutionDecision {
  const {
    capability,
    targetPolicy = "auto",
    isNativeDesktop = false,
    hasLocalModel = false,
    isRemoteDesktopPaired = false,
    requiresLocalProjectAccess = false,
    requiresLocalCompiler = false,
  } = params;

  const requiresDesktop =
    capability === "3d" ||
    capability === "coding" ||
    capability === "game-build" ||
    capability === "project-file" ||
    requiresLocalProjectAccess ||
    requiresLocalCompiler;

  // Rule 1: Desktop-only capabilities (3D, Coding tools, Builds, Filesystem)
  if (requiresDesktop) {
    if (targetPolicy === "cloud_model") {
      const capabilityLabel =
        capability === "3d"
          ? "3D generation"
          : capability === "game-build"
            ? "Game development builds"
            : "Project operations and code compilation";
      return {
        target: "cloud_model",
        route: "cloud_gateway",
        capability,
        allowed: false,
        error: `${capabilityLabel} is strictly local desktop-only and cannot be executed on cloud model servers. Ensure Ayatrisya Desktop is active.`,
        reason: "Cloud execution rejected for desktop-only capability.",
      };
    }

    if (isNativeDesktop) {
      return {
        target: "local_desktop",
        route: "desktop_ipc",
        capability,
        allowed: true,
        reason: "Direct execution via Ayatrisya Desktop secure IPC.",
      };
    }

    if (isRemoteDesktopPaired) {
      return {
        target: "local_desktop",
        route: "remote_access_gateway",
        capability,
        allowed: true,
        reason: "Execution routed to paired desktop via Render API Remote Access gateway.",
      };
    }

    return {
      target: "local_desktop",
      route: "desktop_ipc",
      capability,
      allowed: false,
      error: `Ayatrisya Desktop is offline or unreachable. ${capability} requires an active desktop connection and is never routed to cloud inference.`,
      reason: "No active desktop connection available for desktop-only capability.",
    };
  }

  // Rule 2: Explicit Local Desktop Policy
  if (targetPolicy === "local_desktop") {
    if (isNativeDesktop) {
      if (!hasLocalModel) {
        return {
          target: "local_desktop",
          route: "desktop_ipc",
          capability,
          allowed: false,
          error: "Local desktop execution was selected, but no local AI model is configured in Ayatrisya Desktop. Cloud fallback was not permitted by user policy.",
          reason: "No local model configured on native desktop.",
        };
      }
      return {
        target: "local_desktop",
        route: "desktop_ipc",
        capability,
        allowed: true,
        reason: "Execution on native desktop local model per user policy.",
      };
    }

    if (isRemoteDesktopPaired) {
      return {
        target: "local_desktop",
        route: "remote_access_gateway",
        capability,
        allowed: true,
        reason: "Execution routed to paired desktop local AI runtime per user policy.",
      };
    }

    return {
      target: "local_desktop",
      route: "desktop_ipc",
      capability,
      allowed: false,
      error: "Local desktop execution was selected, but the desktop is offline or unreachable. Cloud fallback is disabled for Local Only requests.",
      reason: "Desktop offline for explicit local_desktop request.",
    };
  }

  // Rule 3: Explicit Cloud Model Policy
  if (targetPolicy === "cloud_model") {
    return {
      target: "cloud_model",
      route: "cloud_gateway",
      capability,
      allowed: true,
      reason: "Execution routed to Ayatrisya Cloud Model Server via Render API Gateway.",
    };
  }

  // Rule 4: Auto Policy (Deterministic & transparent)
  // - If running inside native desktop with a healthy local model, prioritize private on-device execution
  if (isNativeDesktop && hasLocalModel) {
    return {
      target: "local_desktop",
      route: "desktop_ipc",
      capability,
      allowed: true,
      reason: "Auto policy selected private on-device desktop model.",
    };
  }

  // - Otherwise, route standard inference (chat, image, music) through the Render Cloud Gateway
  return {
    target: "cloud_model",
    route: "cloud_gateway",
    capability,
    allowed: true,
    reason: "Auto policy selected Ayatrisya Cloud Gateway for remote client inference.",
  };
}

/**
 * Enforces the routing decision; throws a typed RoutingPolicyError if not allowed.
 */
export function assertExecutionAllowed(decision: ExecutionDecision): void {
  if (!decision.allowed) {
    throw new RoutingPolicyError(
      decision.error || `Execution not permitted for ${decision.capability} on ${decision.target}.`,
      decision.capability,
      decision.target,
    );
  }
}
