export type RoutingPolicy = "local-only" | "ayatrisya-cloud" | "custom-remote" | "ask-each-time";

export interface RemoteEndpointConfig {
  id: string;
  name: string;
  endpointUrl: string;
  modelName: string;
  hasApiKey: boolean;
  createdAt: string;
  lastTestedAt: string | null;
  lastLatencyMs: number | null;
  isHealthy: boolean;
  discoveredModels: string[];
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  models: string[];
  error: string | null;
  warning?: string | null;
}

export interface GatewayHealthResult {
  gatewayHealthy: boolean;
  chatModelAvailable: boolean;
  latencyMs: number;
  models: string[];
  error: string | null;
}

export interface RemoteRouteDecision {
  route: "local" | "ayatrisya-cloud" | "custom-remote";
  targetName: string;
  isOffline: boolean;
  requiresConsent: boolean;
}
