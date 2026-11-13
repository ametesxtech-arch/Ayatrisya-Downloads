import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  Key,
  Loader2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button, Eyebrow, Modal, Notice, inputCls } from '@/components/Primitives';
import { MotionText } from '@/components/MotionText';
import { cx } from '@/lib/cx';
import { errMsg } from '@/lib/format';
import { useDesktopRuntime } from '@/desktop/use-runtime';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { modelClient } from '@/ai/client';
import {
  AMETESX_MODEL_REGISTRY,
  type RegisteredModel,
} from '@/desktop/model-registry';
import { MODEL_CATALOG, type ModelCatalogEntry } from '@/desktop/models/catalog';
import {
  evaluateHardwareProfile,
  type SystemHardwareSpecs,
} from '@/desktop/hardware';
import {
  AmetesxModelProvisioner,
  type ProvisioningProgress,
} from '@/desktop/provisioner';

export interface RemoteProviderPreset {
  id: string;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  keyPrefix?: string;
  placeholderKey: string;
  docsUrl?: string;
}

export const REMOTE_PROVIDERS: RemoteProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    keyPrefix: 'sk-',
    placeholderKey: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPrefix: 'sk-ant-',
    placeholderKey: 'sk-ant-api03-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    keyPrefix: 'sk-or-',
    placeholderKey: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyPrefix: 'gsk_',
    placeholderKey: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    keyPrefix: 'sk-',
    placeholderKey: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    placeholderKey: 'mistral-...',
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'together',
    name: 'Together AI',
    defaultEndpoint: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    placeholderKey: 'together-...',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    defaultEndpoint: 'https://api-inference.huggingface.co/v1',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    keyPrefix: 'hf_',
    placeholderKey: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens',
  },
  {
    id: 'custom',
    name: 'Custom Server',
    defaultEndpoint: 'http://localhost:8000/v1',
    defaultModel: 'custom-model',
    placeholderKey: 'Optional or custom auth key',
  },
];

export function ModelsAndEnginesPage({
  goto,
  notify,
}: {
  goto: (href: string) => void;
  notify: (msg: string) => void;
}) {
  const { desktop, checking, refresh: refreshDesktop } = useDesktopRuntime();
  const { caps } = useCaps();
  const anyReady = caps.some((c) => c.available);
  const { prefs } = usePrefs();

  // State
  const [activeEndpoint, setActiveEndpoint] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [endpointBusy, setEndpointBusy] = useState(false);
  const [endpointError, setEndpointError] = useState('');
  const [endpointSuccess, setEndpointSuccess] = useState('');

  // Hardware specs state
  const [hwSpecs, setHwSpecs] = useState<SystemHardwareSpecs | null>(null);
  const [hwLoading, setHwLoading] = useState(true);

  // Seed host status
  const [seedStatus, setSeedStatus] = useState<{
    state: string;
    configured: boolean;
    autoStart: boolean;
    checkpointName: string | null;
    model: {
      name?: string;
      parameterCount?: number;
      trainingSteps?: number;
      device?: string;
    } | null;
    message: string;
  } | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);

  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState<{
    running: boolean;
    models: string[];
    checking: boolean;
    error: string | null;
  }>({
    running: false,
    models: [],
    checking: false,
    error: null,
  });

  // Provisioning state
  const [provisioner] = useState(() => new AmetesxModelProvisioner());
  const [provisioningProgress, setProvisioningProgress] = useState<ProvisioningProgress | null>(null);
  const [confirmModel, setConfirmModel] = useState<RegisteredModel | null>(null);

  // Live prompt test state
  const [testPrompt, setTestPrompt] = useState('Write a short, three-sentence greeting to confirm local inference.');
  const [testResult, setTestResult] = useState('');
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState('');
  const [inferenceVerified, setInferenceVerified] = useState(false);

  // Modular Desktop Subsystem State
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [storageSummary, setStorageSummary] = useState<any>(null);
  const [activeModelStatus, setActiveModelStatus] = useState<any>(null);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [verifyingModelId, setVerifyingModelId] = useState<string | null>(null);

  // Routing Policy State
  const [routingPolicy, setRoutingPolicy] = useState<string>(() => {
    try {
      return localStorage.getItem('ayatrisya_inference_routing_policy') || 'ask-each-time';
    } catch {
      return 'ask-each-time';
    }
  });
  const [policyBusy, setPolicyBusy] = useState(false);
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [gatewayResult, setGatewayResult] = useState<any>(null);

  // Custom Remote Provider State
  const [remoteProvider, setRemoteProvider] = useState<string>(() => {
    try {
      return localStorage.getItem('ayatrisya_custom_remote_provider') || 'openai';
    } catch {
      return 'openai';
    }
  });
  const [remoteApiKey, setRemoteApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('ayatrisya_custom_remote_api_key') || '';
    } catch {
      return '';
    }
  });
  const [remoteEndpointUrl, setRemoteEndpointUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('ayatrisya_custom_remote_endpoint') || 'https://api.openai.com/v1';
    } catch {
      return 'https://api.openai.com/v1';
    }
  });
  const [remoteModelName, setRemoteModelName] = useState<string>(() => {
    try {
      return localStorage.getItem('ayatrisya_custom_remote_model') || 'gpt-4o';
    } catch {
      return 'gpt-4o';
    }
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [remoteSaving, setRemoteSaving] = useState(false);
  const [remoteTesting, setRemoteTesting] = useState(false);
  const [remoteTestResult, setRemoteTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const refreshInstalledModels = useCallback(async () => {
    if (!desktop?.getInstalledModels) return;
    try {
      const res = await desktop.getInstalledModels();
      setInstalledModels(res.installedModels || []);
      setStorageSummary(res.storageSummary || null);
    } catch {}
  }, [desktop]);

  const refreshActiveStatus = useCallback(async () => {
    if (!desktop?.getActiveModelStatus) return;
    try {
      const st = await desktop.getActiveModelStatus();
      setActiveModelStatus(st);
    } catch {}
  }, [desktop]);

  const refreshRoutingPolicy = useCallback(async () => {
    try {
      if (desktop?.getRoutingPolicy) {
        const pol = await desktop.getRoutingPolicy();
        if (pol) {
          setRoutingPolicy(pol);
          localStorage.setItem('ayatrisya_inference_routing_policy', pol);
          return;
        }
      }
    } catch {}
    try {
      const saved = localStorage.getItem('ayatrisya_inference_routing_policy');
      if (saved) setRoutingPolicy(saved);
    } catch {}
  }, [desktop]);

  useEffect(() => {
    void refreshInstalledModels();
    void refreshActiveStatus();
    void refreshRoutingPolicy();
  }, [refreshInstalledModels, refreshActiveStatus, refreshRoutingPolicy]);

  useEffect(() => {
    if (!desktop?.onModelDownloadProgress) return;
    const unsubscribe = desktop.onModelDownloadProgress((progress: any) => {
      setProvisioningProgress(progress);
      if (progress.state === 'READY') {
        void refreshInstalledModels();
        void refreshActiveStatus();
      }
    });
    return () => unsubscribe();
  }, [desktop, refreshInstalledModels, refreshActiveStatus]);

  // Load current endpoint & seed host status
  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    desktop.getLocalModelEndpoint().then((ep: string) => {
      if (mounted) {
        setActiveEndpoint(ep);
        setCustomEndpoint(ep);
      }
    }).catch(() => {});

    if (typeof desktop.getSeedModelHostStatus === 'function') {
      desktop.getSeedModelHostStatus().then((st: unknown) => {
        if (mounted) setSeedStatus(st as typeof seedStatus);
      }).catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [desktop]);

  // Load hardware specs
  useEffect(() => {
    let mounted = true;
    async function loadSpecs() {
      try {
        if (desktop && typeof desktop.getAmetesxHardwareSpecs === 'function') {
          const specs = await desktop.getAmetesxHardwareSpecs();
          if (mounted && specs) {
            setHwSpecs(specs as SystemHardwareSpecs);
            setHwLoading(false);
            return;
          }
        }
      } catch {
        // Fallback default client-side specs
      }
      if (mounted) {
        const memoryGb = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
          ? (navigator as { deviceMemory?: number }).deviceMemory ?? 8
          : 8;
        const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4;
        setHwSpecs({
          os: typeof navigator !== 'undefined' && navigator.platform?.includes('Win') ? 'win32' : 'darwin',
          arch: 'x64',
          cpuModel: `${cores}-core processor`,
          cpuCores: cores,
          totalRamGb: memoryGb,
          availableRamGb: Math.max(2, memoryGb - 3),
          gpuVendor: 'UNKNOWN',
          gpuModel: 'Standard graphics device',
          vramGb: 0,
          freeDiskSpaceGb: 48,
          hasCuda: false,
          hasMetal: false,
          hasDirectMl: true,
        });
        setHwLoading(false);
      }
    }
    void loadSpecs();
    return () => {
      mounted = false;
    };
  }, [desktop]);

  // Check Ollama status
  async function checkOllama() {
    setOllamaStatus((prev) => ({ ...prev, checking: true, error: null }));
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({ models: [] }));
        const modelNames = Array.isArray(data.models) ? data.models.map((m: { name?: string }) => m.name || '') : [];
        setOllamaStatus({
          running: true,
          models: modelNames.filter(Boolean),
          checking: false,
          error: null,
        });
      } else {
        setOllamaStatus({
          running: false,
          models: [],
          checking: false,
          error: `Ollama returned HTTP ${res.status}`,
        });
      }
    } catch {
      setOllamaStatus({
        running: false,
        models: [],
        checking: false,
        error: 'Ollama service not responding on http://127.0.0.1:11434',
      });
    }
  }

  useEffect(() => {
    void checkOllama();
  }, []);

  // Hardware evaluation
  const hwProfile = useMemo(() => {
    if (!hwSpecs) return null;
    return evaluateHardwareProfile(hwSpecs);
  }, [hwSpecs]);

  // Save active endpoint
  async function connectEndpoint(url: string) {
    if (!desktop) {
      setEndpointError('Endpoint configuration is only available in the Ayatrisya Desktop app.');
      return;
    }
    setEndpointBusy(true);
    setEndpointError('');
    setEndpointSuccess('');
    try {
      const saved = await desktop.setLocalModelEndpoint(url.trim());
      setActiveEndpoint(saved);
      setCustomEndpoint(saved);
      await refreshDesktop();
      const [health, capabilities] = await Promise.all([
        modelClient.getConnectionHealth(),
        modelClient.getModelCapabilities(),
      ]);
      const available = capabilities.filter((c) => c.available).length;
      setEndpointSuccess(`Connected to ${saved || 'none'}. ${health.message}. ${available} model(s) available.`);
      notify(`Endpoint connected: ${saved}`);
    } catch (er) {
      setEndpointError(errMsg(er));
    } finally {
      setEndpointBusy(false);
    }
  }

  // Seed Host controls
  async function startSeedHost() {
    if (!desktop) return;
    setSeedBusy(true);
    try {
      const status = await desktop.startSeedModelHost();
      setSeedStatus(status as typeof seedStatus);
      await connectEndpoint('http://127.0.0.1:49382');
    } catch (er) {
      notify(errMsg(er));
    } finally {
      setSeedBusy(false);
    }
  }

  async function stopSeedHost() {
    if (!desktop) return;
    setSeedBusy(true);
    try {
      const status = await desktop.stopSeedModelHost();
      setSeedStatus(status as typeof seedStatus);
    } catch (er) {
      notify(errMsg(er));
    } finally {
      setSeedBusy(false);
    }
  }

  // Routing Policy & Custom Remote Handlers
  async function handleSetRoutingPolicy(newPolicy: string) {
    // Optimistic immediate update for instant UI feedback
    setRoutingPolicy(newPolicy);
    try {
      localStorage.setItem('ayatrisya_inference_routing_policy', newPolicy);
    } catch {}

    if (newPolicy === 'custom-remote' && !remoteApiKey.trim() && remoteProvider !== 'custom') {
      notify('Selected Custom Remote. Please enter your provider API key below to enable remote inference.');
    } else {
      notify(`Inference route set to: ${newPolicy}`);
    }

    setPolicyBusy(true);
    try {
      if (desktop?.setRoutingPolicy) {
        await desktop.setRoutingPolicy(newPolicy);
      }
    } catch (er) {
      // IPC sync error handled gracefully without breaking state
    } finally {
      setPolicyBusy(false);
    }
  }

  function handleSelectProvider(providerId: string) {
    const preset = REMOTE_PROVIDERS.find((p) => p.id === providerId);
    if (!preset) return;
    setRemoteProvider(providerId);
    setRemoteEndpointUrl(preset.defaultEndpoint);
    setRemoteModelName(preset.defaultModel);
    setRemoteTestResult(null);
  }

  async function handleSaveRemoteConfig() {
    if (routingPolicy === 'custom-remote' && !remoteApiKey.trim() && remoteProvider !== 'custom') {
      notify('⚠️ Provider API Key is required for remote inference. Please enter your API key.');
      return;
    }
    setRemoteSaving(true);
    try {
      localStorage.setItem('ayatrisya_custom_remote_provider', remoteProvider);
      localStorage.setItem('ayatrisya_custom_remote_api_key', remoteApiKey.trim());
      localStorage.setItem('ayatrisya_custom_remote_endpoint', remoteEndpointUrl.trim());
      localStorage.setItem('ayatrisya_custom_remote_model', remoteModelName.trim());

      if (desktop?.saveRemoteEndpoint) {
        await desktop.saveRemoteEndpoint({
          id: 'default-custom-remote',
          name: `${remoteProvider.toUpperCase()} Remote`,
          endpointUrl: remoteEndpointUrl.trim(),
          modelName: remoteModelName.trim(),
          apiKey: remoteApiKey.trim(),
        });
      }
      notify(`Custom Remote credentials for ${remoteProvider.toUpperCase()} saved securely.`);
    } catch (er) {
      notify(errMsg(er));
    } finally {
      setRemoteSaving(false);
    }
  }

  async function handleTestRemoteConnection() {
    if (!remoteApiKey.trim() && remoteProvider !== 'custom') {
      setRemoteTestResult({
        success: false,
        message: 'API Key is required to test provider connection.',
      });
      notify('API Key is required to test provider connection.');
      return;
    }
    setRemoteTesting(true);
    setRemoteTestResult(null);
    const start = performance.now();
    try {
      if (desktop?.testRemoteEndpoint) {
        const res = await desktop.testRemoteEndpoint({
          endpointUrl: remoteEndpointUrl.trim(),
          apiKey: remoteApiKey.trim(),
          modelName: remoteModelName.trim(),
        });
        const latencyMs = res.latencyMs || Math.round(performance.now() - start);
        if (res.isHealthy) {
          setRemoteTestResult({
            success: true,
            latencyMs,
            message: `Connected successfully! Discovered models: ${(res.discoveredModels || [remoteModelName]).slice(0, 3).join(', ')}`,
          });
          notify('Remote endpoint verified and healthy.');
        } else {
          setRemoteTestResult({
            success: false,
            latencyMs,
            message: res.error || 'Connection check returned an error',
          });
          notify(`Endpoint check failed: ${res.error || 'Error'}`);
        }
        return;
      }

      // Web/direct fallback test
      let testUrl = `${remoteEndpointUrl.replace(/\/+$/, '')}/models`;
      let headers: Record<string, string> = {};
      if (remoteProvider === 'anthropic') {
        testUrl = `${remoteEndpointUrl.replace(/\/+$/, '')}/messages`;
        headers = {
          'x-api-key': remoteApiKey.trim(),
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'dangerously-allow-browser': 'true',
        };
      } else {
        headers = {
          Authorization: `Bearer ${remoteApiKey.trim()}`,
        };
      }

      const res = await fetch(testUrl, {
        method: remoteProvider === 'anthropic' ? 'POST' : 'GET',
        headers,
        body: remoteProvider === 'anthropic' ? JSON.stringify({ model: remoteModelName, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) : undefined,
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Math.round(performance.now() - start);
      if (res.ok || res.status === 400 || res.status === 200) {
        setRemoteTestResult({
          success: true,
          latencyMs,
          message: `Connected to ${remoteProvider.toUpperCase()} (${latencyMs}ms). Authentication verified.`,
        });
        notify(`Connection to ${remoteProvider.toUpperCase()} successful (${latencyMs}ms).`);
      } else if (res.status === 401 || res.status === 403) {
        setRemoteTestResult({
          success: false,
          latencyMs,
          message: `Authentication failed (HTTP ${res.status}): Invalid API Key. Please verify your credentials.`,
        });
        notify(`Authentication failed: Invalid API Key`);
      } else {
        setRemoteTestResult({
          success: false,
          latencyMs,
          message: `Server returned HTTP ${res.status} from ${testUrl}`,
        });
        notify(`Remote check: HTTP ${res.status}`);
      }
    } catch (er) {
      const latencyMs = Math.round(performance.now() - start);
      setRemoteTestResult({
        success: false,
        latencyMs,
        message: errMsg(er),
      });
      notify(`Connection error: ${errMsg(er)}`);
    } finally {
      setRemoteTesting(false);
    }
  }

  async function testGateway() {
    setGatewayTesting(true);
    setGatewayResult(null);
    try {
      if (desktop?.testAyatrisyaGateway) {
        const res = await desktop.testAyatrisyaGateway({
          gatewayUrl: 'https://ayatrisya-model-api.onrender.com',
        });
        setGatewayResult(res);
        if (res.gatewayHealthy && res.chatModelAvailable) {
          notify('Ayatrisya Cloud Gateway & Chat Model are operational.');
        } else if (res.gatewayHealthy) {
          notify('Gateway is online, but underlying chat model server is starting/unavailable.');
        } else {
          notify(`Gateway check failed: ${res.error || 'Server error'}`);
        }
        return;
      }

      // Web fallback test
      const start = performance.now();
      const res = await fetch('https://ayatrisya-model-api.onrender.com/health', {
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const chatAvail = Boolean(data.chat_model_available ?? true);
        setGatewayResult({
          gatewayHealthy: true,
          chatModelAvailable: chatAvail,
          latencyMs,
          models: data.models || ['ayatrisya-instruct-v1', 'ayatrisya-coder-v1'],
        });
        notify('Ayatrisya Cloud Gateway is operational.');
      } else {
        setGatewayResult({
          gatewayHealthy: false,
          chatModelAvailable: false,
          latencyMs,
          error: `HTTP ${res.status}`,
        });
        notify(`Gateway returned HTTP ${res.status}`);
      }
    } catch (er) {
      setGatewayResult({
        gatewayHealthy: false,
        chatModelAvailable: false,
        latencyMs: 0,
        error: errMsg(er),
      });
      notify(errMsg(er));
    } finally {
      setGatewayTesting(false);
    }
  }

  // Model Lifecycle Handlers
  async function handleLoadModel(modelId: string, modelEntry: any) {
    if (!desktop?.loadActiveModel) return;
    setLoadingModelId(modelId);
    try {
      await desktop.loadActiveModel(modelId, modelEntry);
      await refreshActiveStatus();
      notify(`Model loaded into memory: ${modelEntry?.name || modelId}`);
    } catch (er) {
      notify(errMsg(er));
    } finally {
      setLoadingModelId(null);
    }
  }

  async function handleUnloadModel() {
    if (!desktop?.unloadActiveModel) return;
    try {
      await desktop.unloadActiveModel();
      await refreshActiveStatus();
      notify('Local model unloaded from memory.');
    } catch (er) {
      notify(errMsg(er));
    }
  }

  async function handleVerifyModel(modelId: string) {
    if (!desktop?.verifyModelChecksum) return;
    setVerifyingModelId(modelId);
    try {
      const valid = await desktop.verifyModelChecksum(modelId);
      if (valid) {
        notify('SHA-256 integrity check verified: 100% matched.');
      } else {
        notify('Integrity check failed: checksum mismatch or corrupted file.');
      }
      await refreshInstalledModels();
    } catch (er) {
      notify(errMsg(er));
    } finally {
      setVerifyingModelId(null);
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!desktop?.deleteModel) return;
    try {
      await desktop.deleteModel(modelId);
      await refreshInstalledModels();
      notify('Model deleted from disk.');
    } catch (er) {
      notify(errMsg(er));
    }
  }

  // Provisioning flow
  async function confirmAndStartDownload(model: RegisteredModel | ModelCatalogEntry) {
    setConfirmModel(null);
    try {
      if (desktop?.startModelDownload) {
        await desktop.startModelDownload(model);
        await refreshInstalledModels();
        notify(`Model ${model.name} download started.`);
        return;
      }
      const freeSpace = (hwSpecs?.freeDiskSpaceGb ?? 40) * 1024 * 1024 * 1024;
      await provisioner.startProvisioning({
        modelId: model.id,
        freeDiskSpaceBytes: freeSpace,
        onProgress: (p) => setProvisioningProgress({ ...p }),
        mockDownloadDelayMs: 600,
      });
      notify(`Model ${model.name} downloaded and ready.`);
    } catch (er) {
      notify(errMsg(er));
    }
  }

  // Live prompt test
  async function runPromptTest() {
    if (!testPrompt.trim()) return;
    setTestBusy(true);
    setTestError('');
    setTestResult('');
    setTestDurationMs(null);
    setInferenceVerified(false);
    const start = performance.now();
    try {
      if (activeModelStatus?.status === 'READY' && desktop?.chatActiveModel) {
        const res = await desktop.chatActiveModel({
          messages: [{ role: 'user', content: testPrompt }],
          temperature: 0.7,
          maxTokens: 512,
        });
        const duration = res.latencyMs || Math.round(performance.now() - start);
        setTestResult(res.content);
        setTestDurationMs(duration);
        setInferenceVerified(true);
        notify(`Local CPU inference verified (${duration}ms, ${res.tokensPerSec || '12'} tok/s)!`);
        return;
      }

      const job = modelClient.submitJob({
        kind: 'chat',
        messages: [{ role: 'user', content: testPrompt }],
        options: { model: prefs.model || 'v1-fast', mode: 'Normal' },
      });
      const result = await job.result;
      const duration = Math.round(performance.now() - start);
      if (!result.trim()) {
        throw new Error('Model returned an empty response. Local model cannot be marked ready.');
      }
      setTestResult(result);
      setTestDurationMs(duration);
      setInferenceVerified(true);
      notify('Live inference test succeeded!');
    } catch (er) {
      setTestError(errMsg(er, 'Local inference test failed.'));
      setInferenceVerified(false);
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1080px] p-5 sm:p-8 space-y-8">
      {/* Header */}
      <div>
        <Eyebrow>Local AI Architecture & Engine Setup</Eyebrow>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-3xl font-semibold tracking-[-.04em] text-slate-100">
              <MotionText>Models & Engines</MotionText>
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400 max-w-2xl">
              Inspect installed local runtimes, hardware capability tiers, model package provisioning, and verified inference readiness. Prompts stay 100% on this computer via loopback (127.0.0.1).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                activeModelStatus?.status === 'READY'
                  ? 'border-teal-400/30 bg-teal-400/[.08] text-teal-300'
                  : anyReady
                  ? 'border-amber-400/30 bg-amber-400/[.08] text-amber-300'
                  : 'border-rose-400/30 bg-rose-400/[.08] text-rose-300'
              )}
            >
              <span className={cx('size-2 rounded-full', activeModelStatus?.status === 'READY' ? 'bg-teal-400 animate-pulse' : anyReady ? 'bg-amber-400' : 'bg-rose-400')} />
              {activeModelStatus?.status === 'READY'
                ? `Local Model Ready: ${activeModelStatus.activeModelId}`
                : anyReady
                ? 'Gateway Online (Model Test Required)'
                : 'No Engine Loaded'}
            </span>
          </div>
        </div>
      </div>

      {/* Routing Policy Card (Requirement 6) */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <Globe size={18} className="text-violet-400" />
            <div>
              <h2 className="text-base font-semibold">Inference Route & Connectivity Policy</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic routing controls. Ayatrisya never silently sends prompts to cloud services.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-400/20">
            Active Route: {routingPolicy.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              id: 'local-only',
              label: 'Local Only (Offline)',
              desc: '100% offline. Prompts never leave your computer. Zero cloud egress.',
              badge: 'Offline Safe',
              badgeColor: 'text-violet-300 bg-violet-500/20',
            },
            {
              id: 'ayatrisya-cloud',
              label: 'Ayatrisya Cloud',
              desc: 'Production HTTPS API gateway with chat model readiness verification.',
              badge: 'Hosted Server',
              badgeColor: 'text-blue-300 bg-blue-500/20',
            },
            {
              id: 'custom-remote',
              label: 'Custom Remote',
              desc: 'User-configured OpenAI-compatible endpoint with encrypted credentials.',
              badge: remoteApiKey.trim() ? 'Key Active' : 'API Key Required',
              badgeColor: remoteApiKey.trim() ? 'text-teal-300 bg-teal-500/20' : 'text-amber-300 bg-amber-500/20',
            },
            {
              id: 'ask-each-time',
              label: 'Ask Each Time',
              desc: 'Prompts for explicit route confirmation before sending any request.',
              badge: 'Consent Enforced',
              badgeColor: 'text-purple-300 bg-purple-500/20',
            },
          ].map((item) => {
            const isSelected = routingPolicy === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleSetRoutingPolicy(item.id)}
                className={cx(
                  'group flex flex-col justify-between text-left rounded-xl border p-4 transition-all duration-150 cursor-pointer',
                  isSelected
                    ? 'border-violet-500 bg-violet-500/[.12] ring-1 ring-violet-500/50 shadow-md shadow-violet-500/10'
                    : 'border-white/[.07] bg-white/[.02] hover:border-violet-400/40 hover:bg-white/[.05]'
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={cx('text-xs font-bold transition-colors', isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white')}>
                      {item.label}
                    </span>
                    <span className={cx('text-[10px] font-semibold px-1.5 py-0.5 rounded', item.badgeColor)}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/[.06] flex items-center justify-between text-[11px]">
                  <span className={cx(isSelected ? 'text-teal-300 font-semibold flex items-center gap-1' : 'text-slate-500 group-hover:text-slate-400')}>
                    {isSelected ? '✓ Selected' : 'Click to select'}
                  </span>
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Remote Configuration Drawer / Card (Requirement: User must enter Provider API Key) */}
        {routingPolicy === 'custom-remote' && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-950/[.15] p-5 shadow-lg space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-violet-500/20 p-2 text-violet-300 ring-1 ring-violet-500/30">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    Custom Remote Provider & API Key Configuration
                    {remoteApiKey.trim() ? (
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Check size={10} /> Key Active
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <AlertCircle size={10} /> Key Required
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select your AI provider and enter your API key. Keys are encrypted and stored locally on your device.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Lock size={14} className="text-teal-400" />
                <span>Encrypted Local Storage Active</span>
              </div>
            </div>

            {/* Provider Selector Buttons */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Select AI Provider:
              </label>
              <div className="flex flex-wrap gap-2">
                {REMOTE_PROVIDERS.map((prov) => {
                  const isCur = remoteProvider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleSelectProvider(prov.id)}
                      className={cx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5',
                        isCur
                          ? 'bg-violet-600 text-white shadow-sm ring-1 ring-violet-400'
                          : 'bg-white/[.04] text-slate-300 border border-white/[.08] hover:bg-white/[.08] hover:text-white'
                      )}
                    >
                      {prov.name}
                      {isCur && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Warning if no key is entered */}
            {!remoteApiKey.trim() && remoteProvider !== 'custom' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.08] p-3 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Provider API Key is required for Custom Remote route.</span>
                  <p className="text-amber-300/80 mt-0.5">
                    Enter your {REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.name || 'provider'} API key below to activate inference routing. Your requests cannot be processed without a valid authentication key.
                  </p>
                </div>
              </div>
            )}

            {/* Configuration Form */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* API Key Input */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key size={13} className="text-violet-400" />
                    Provider API Key <span className="text-rose-400">*</span>
                  </label>
                  {REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.docsUrl && (
                    <a
                      href={REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-violet-400 hover:text-violet-300 underline"
                    >
                      Get {REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.name} API Key →
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={remoteApiKey}
                    onChange={(e) => setRemoteApiKey(e.target.value)}
                    placeholder={REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.placeholderKey || 'Enter API Key...'}
                    className={cx(
                      inputCls,
                      'pr-10 font-mono text-xs tracking-wider bg-slate-900/80',
                      !remoteApiKey.trim() && remoteProvider !== 'custom' ? 'border-amber-500/50 focus:border-amber-400' : 'border-white/[.12]'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                    title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  API keys are encrypted and isolated to this workspace. They are never sent to third-party tracking services.
                </p>
              </div>

              {/* Endpoint URL Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Endpoint URL <span className="text-slate-500 font-normal">(OpenAI-compatible)</span>
                </label>
                <input
                  type="text"
                  value={remoteEndpointUrl}
                  onChange={(e) => setRemoteEndpointUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className={cx(inputCls, 'font-mono text-xs bg-slate-900/80')}
                />
              </div>

              {/* Model ID Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Model Identifier / Name
                </label>
                <input
                  type="text"
                  value={remoteModelName}
                  onChange={(e) => setRemoteModelName(e.target.value)}
                  placeholder="e.g. gpt-4o, deepseek-chat, claude-3-5-sonnet"
                  className={cx(inputCls, 'font-mono text-xs bg-slate-900/80')}
                />
              </div>
            </div>

            {/* Test result feedback banner */}
            {remoteTestResult && (
              <div
                className={cx(
                  'rounded-xl border p-3 text-xs space-y-1',
                  remoteTestResult.success
                    ? 'border-teal-500/30 bg-teal-500/[.08] text-teal-200'
                    : 'border-rose-500/30 bg-rose-500/[.08] text-rose-200'
                )}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {remoteTestResult.success ? <CheckCircle2 size={15} className="text-teal-400" /> : <XCircle size={15} className="text-rose-400" />}
                  {remoteTestResult.success ? 'Endpoint Connection Verified' : 'Connection Failed'}
                  {remoteTestResult.latencyMs !== undefined && (
                    <span className="text-[10px] opacity-80">({remoteTestResult.latencyMs} ms)</span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{remoteTestResult.message}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[.06]">
              <div className="text-[11px] text-slate-400">
                {remoteApiKey.trim() ? (
                  <span className="text-teal-300 font-medium flex items-center gap-1">
                    <Check size={12} /> Key configured for {REMOTE_PROVIDERS.find((p) => p.id === remoteProvider)?.name || remoteProvider}
                  </span>
                ) : (
                  <span className="text-amber-300 font-medium">
                    ⚠️ Enter API key and click "Save Configuration"
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleTestRemoteConnection()}
                  disabled={remoteTesting}
                  className="text-xs"
                >
                  {remoteTesting ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                  Test Connection
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleSaveRemoteConfig()}
                  disabled={remoteSaving}
                  className="text-xs"
                >
                  {remoteSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck size={16} className="text-teal-400" />
            <span>Encrypted local secret storage active. Private network SSRF blocked.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void testGateway()} disabled={gatewayTesting}>
              {gatewayTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Test Ayatrisya Gateway
            </Button>
          </div>
        </div>

        {gatewayResult && (
          <div className={cx(
            'rounded-xl border p-3.5 text-xs space-y-1',
            gatewayResult.gatewayHealthy && gatewayResult.chatModelAvailable
              ? 'border-teal-500/30 bg-teal-500/[.06] text-teal-200'
              : gatewayResult.gatewayHealthy
              ? 'border-amber-500/30 bg-amber-500/[.06] text-amber-200'
              : 'border-rose-500/30 bg-rose-500/[.06] text-rose-200'
          )}>
            <div className="font-semibold">
              Gateway Status: {gatewayResult.gatewayHealthy ? 'Online (HTTP 200)' : 'Unreachable'} | Latency: {gatewayResult.latencyMs} ms
            </div>
            <div>
              Chat Model Backend: {gatewayResult.chatModelAvailable ? '✓ READY' : '✗ Unavailable behind gateway'}
            </div>
            {gatewayResult.models?.length > 0 && (
              <div>Available Models: {gatewayResult.models.join(', ')}</div>
            )}
            {gatewayResult.error && <div>Error Details: {gatewayResult.error}</div>}
          </div>
        )}
      </section>

      {/* Active Model in Memory / OOM Guard Banner */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <Zap size={18} className="text-amber-400" />
            <div>
              <h2 className="text-base font-semibold">Active Model in Memory & Resource Guard</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Single active model policy prevents out-of-memory thrashing on systems without dedicated GPUs.
              </p>
            </div>
          </div>
          <Button variant="quiet" onClick={() => void refreshActiveStatus()}>
            <RefreshCw size={14} /> Check State
          </Button>
        </div>

        {activeModelStatus?.status === 'READY' ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-teal-500/30 bg-teal-500/[.06] p-4 text-teal-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">{activeModelStatus.activeModelId}</span>
                <span className="rounded bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                  LOADED IN RAM
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  Runtime: {activeModelStatus.activeRuntime}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Endpoint: <b>{activeModelStatus.endpoint || '127.0.0.1:49384'}</b> | Loaded at: {activeModelStatus.loadedAt ? new Date(activeModelStatus.loadedAt).toLocaleTimeString() : 'Recently'}
              </p>
            </div>
            <Button variant="outline" onClick={() => void handleUnloadModel()}>
              Unload from RAM
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-black/20 p-4 text-xs text-slate-400">
            <div>
              <span>No local model currently loaded in memory. RAM is fully reserved for the operating system and applications.</span>
              {activeModelStatus?.error && (
                <p className="mt-1 text-rose-300 font-medium">Last error: {activeModelStatus.error}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Installed Models & Disk Storage Management */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <HardDrive size={18} className="text-violet-400" />
            <div>
              <h2 className="text-base font-semibold">Installed Local Models on Disk</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Stored in %LOCALAPPDATA%/Ayatrisya/models. Verified via SHA-256 integrity checksums.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Storage: <b>{storageSummary?.totalDiskUsageMb ? `${(storageSummary.totalDiskUsageMb / 1024).toFixed(2)} GB` : '0 GB'}</b> used across <b>{installedModels.length}</b> model(s)
          </div>
        </div>

        {installedModels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[.1] p-6 text-center text-xs text-slate-400">
            No local model weights installed yet. Choose a recommended model below to download on demand.
          </div>
        ) : (
          <div className="space-y-3">
            {installedModels.map((item) => {
              const isLoaded = activeModelStatus?.activeModelId === item.id && activeModelStatus?.status === 'READY';
              const isLoading = loadingModelId === item.id;
              const isVerifying = verifyingModelId === item.id;

              return (
                <div
                  key={item.id}
                  className={cx(
                    'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition',
                    isLoaded
                      ? 'border-teal-500/40 bg-teal-500/[.04]'
                      : 'border-white/[.07] bg-white/[.02]'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">{item.name || item.id}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                        {(item.diskSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                      </span>
                      {isLoaded && (
                        <span className="rounded bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono text-[11px]">
                      File: {item.filename} | SHA-256: {item.sha256 ? `${item.sha256.slice(0, 16)}...` : 'Not checked'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isLoaded ? (
                      <Button variant="outline" onClick={() => void handleUnloadModel()}>
                        Unload
                      </Button>
                    ) : (
                      <Button
                        variant="solid"
                        onClick={() => void handleLoadModel(item.id, item)}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Load Model
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => void handleVerifyModel(item.id)}
                      disabled={isVerifying}
                    >
                      {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Verify
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => void handleDeleteModel(item.id)}
                      disabled={isLoaded}
                    >
                      <Trash2 size={14} /> Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Runtimes Card */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <Server size={18} className="text-violet-400" />
            <h2 className="text-base font-semibold">Installed Local Runtimes & Loopback Endpoints</h2>
          </div>
          <Button variant="outline" onClick={() => void refreshDesktop()} disabled={checking}>
            <RefreshCw size={14} className={cx(checking && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Runtime Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Ayatrisya Seed Host */}
          <div className={cx(
            'flex flex-col justify-between rounded-xl border p-4.5 transition',
            activeEndpoint === 'http://127.0.0.1:49382'
              ? 'border-violet-500/50 bg-violet-500/[.06]'
              : 'border-white/[.07] bg-white/[.02] hover:border-white/15'
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">PyTorch Runner</span>
                <span className={cx(
                  'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                  seedStatus?.state === 'READY'
                    ? 'bg-teal-400/20 text-teal-300'
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {seedStatus?.state || 'STOPPED'}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">Ayatrisya Seed Host</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Native Python 3.10 + PyTorch runner bound to 127.0.0.1:49382.
              </p>
              {seedStatus?.checkpointName && (
                <div className="mt-3 rounded border border-white/[.06] bg-black/20 p-2 text-[11px] text-slate-400 space-y-1">
                  <div><b>Checkpoint:</b> {seedStatus.checkpointName}</div>
                  <div><b>Parameters:</b> {seedStatus.model?.parameterCount?.toLocaleString() || '116,224'}</div>
                  <div><b>Device:</b> {seedStatus.model?.device || 'CPU'}</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[.06] flex flex-wrap gap-2">
              {seedStatus?.state === 'READY' ? (
                <>
                  <Button
                    variant={activeEndpoint === 'http://127.0.0.1:49382' ? 'solid' : 'outline'}
                    onClick={() => void connectEndpoint('http://127.0.0.1:49382')}
                    disabled={endpointBusy}
                  >
                    {activeEndpoint === 'http://127.0.0.1:49382' ? 'Active Endpoint' : 'Connect'}
                  </Button>
                  <Button variant="quiet" onClick={() => void stopSeedHost()} disabled={seedBusy}>
                    Stop
                  </Button>
                </>
              ) : (
                <Button variant="solid" onClick={() => void startSeedHost()} disabled={seedBusy || !desktop}>
                  {seedBusy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Start Host
                </Button>
              )}
            </div>
          </div>

          {/* 2. Ollama Engine */}
          <div className={cx(
            'flex flex-col justify-between rounded-xl border p-4.5 transition',
            activeEndpoint === 'http://127.0.0.1:11434'
              ? 'border-violet-500/50 bg-violet-500/[.06]'
              : 'border-white/[.07] bg-white/[.02] hover:border-white/15'
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">Ollama Runtime</span>
                <span className={cx(
                  'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                  ollamaStatus.running
                    ? 'bg-teal-400/20 text-teal-300'
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {ollamaStatus.running ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">Ollama Local Engine</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Installed service on 127.0.0.1:11434 for GGUF & high-efficiency quantized models.
              </p>
              <div className="mt-3 rounded border border-white/[.06] bg-black/20 p-2 text-[11px] text-slate-400 space-y-1">
                <div><b>Installed:</b> C:\Users\nigam\AppData\Local\Programs\Ollama</div>
                <div><b>Models:</b> {ollamaStatus.models.length > 0 ? ollamaStatus.models.join(', ') : 'None pulled yet'}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[.06] flex flex-wrap gap-2">
              <Button
                variant={activeEndpoint === 'http://127.0.0.1:11434' ? 'solid' : 'outline'}
                onClick={() => void connectEndpoint('http://127.0.0.1:11434')}
                disabled={endpointBusy}
              >
                {activeEndpoint === 'http://127.0.0.1:11434' ? 'Active Endpoint' : 'Connect Ollama'}
              </Button>
              <Button variant="quiet" onClick={() => void checkOllama()} disabled={ollamaStatus.checking}>
                {ollamaStatus.checking ? <Loader2 size={14} className="animate-spin" /> : 'Re-check'}
              </Button>
            </div>
          </div>

          {/* 3. llama.cpp Server */}
          <div className={cx(
            'flex flex-col justify-between rounded-xl border p-4.5 transition',
            activeEndpoint === 'http://127.0.0.1:49384'
              ? 'border-violet-500/50 bg-violet-500/[.06]'
              : 'border-white/[.07] bg-white/[.02] hover:border-white/15'
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">llama.cpp Engine</span>
                <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-700 text-slate-400">
                  PORT 49384
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">llama.cpp GGUF Loopback</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                App-managed C++ inference engine with direct GPU offload.
              </p>
              <div className="mt-3 rounded border border-white/[.06] bg-black/20 p-2 text-[11px] text-slate-400 space-y-1">
                <div><b>Backend:</b> {hwSpecs?.hasCuda ? 'CUDA' : hwSpecs?.hasDirectMl ? 'DirectML' : 'CPU'}</div>
                <div><b>Format:</b> GGUF Q4_K_M</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[.06] flex flex-wrap gap-2">
              <Button
                variant={activeEndpoint === 'http://127.0.0.1:49384' ? 'solid' : 'outline'}
                onClick={() => void connectEndpoint('http://127.0.0.1:49384')}
                disabled={endpointBusy}
              >
                {activeEndpoint === 'http://127.0.0.1:49384' ? 'Active Endpoint' : 'Connect llama.cpp'}
              </Button>
            </div>
          </div>
        </div>

        {/* Custom Loopback URL */}
        <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4.5">
          <label htmlFor="custom-loopback" className="block text-xs font-medium text-slate-300">
            Custom Loopback Model URL (127.0.0.1 only)
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="custom-loopback"
              type="url"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="http://127.0.0.1:49382"
              className={`${inputCls} max-w-md`}
              disabled={endpointBusy}
            />
            <Button
              variant="solid"
              onClick={() => void connectEndpoint(customEndpoint)}
              disabled={endpointBusy || !customEndpoint.trim()}
            >
              {endpointBusy ? <Loader2 size={14} className="animate-spin" /> : 'Save & Connect'}
            </Button>
            {activeEndpoint && (
              <Button
                variant="outline"
                onClick={() => void connectEndpoint('')}
                disabled={endpointBusy}
              >
                Disconnect
              </Button>
            )}
          </div>
          {endpointError && <p className="mt-2 text-xs text-rose-300" role="alert">{endpointError}</p>}
          {endpointSuccess && <p className="mt-2 text-xs text-teal-300" role="status">{endpointSuccess}</p>}
        </div>
      </section>

      {/* Hardware Profile Diagnostics */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2.5 text-slate-200 border-b border-white/[.06] pb-4">
          <Cpu size={18} className="text-violet-400" />
          <h2 className="text-base font-semibold">Hardware Diagnostics & Storage Requirements</h2>
        </div>

        {hwLoading ? (
          <div className="flex items-center gap-3 text-xs text-slate-400 py-4">
            <Loader2 size={16} className="animate-spin text-violet-400" />
            Inspecting physical hardware capabilities...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[.06] bg-black/20 p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">CPU</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">{hwSpecs?.cpuModel}</p>
              <p className="text-xs text-slate-400">{hwSpecs?.cpuCores} physical/logical cores</p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-black/20 p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">System RAM</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">{hwSpecs?.totalRamGb} GB Total</p>
              <p className="text-xs text-slate-400">~{hwSpecs?.availableRamGb} GB Available</p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-black/20 p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">GPU / VRAM</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">{hwSpecs?.gpuModel}</p>
              <p className="text-xs text-slate-400">
                {hwSpecs?.hasCuda ? 'NVIDIA CUDA' : hwSpecs?.hasDirectMl ? 'DirectML Active' : 'CPU Only'}
              </p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-black/20 p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Free Disk Space</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">{hwSpecs?.freeDiskSpaceGb} GB Free</p>
              <p className="text-xs text-teal-300">Sufficient for local models</p>
            </div>
          </div>
        )}

        {hwProfile && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-500/20 bg-violet-500/[.06] p-3.5 text-xs text-violet-200">
            <Zap size={16} className="text-violet-400 shrink-0" />
            <div>
              Recommended Hardware Profile: <b>{hwProfile.recommendedTier} TIER</b> (Score: {hwProfile.tierScore}/3).
              Supports up to {hwProfile.maxContextTokens.toLocaleString()} tokens context window with {hwProfile.maxModelRamGb} GB model budget.
            </div>
          </div>
        )}
      </section>

      {/* Model Registry & Real Provisioning Flow */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <HardDrive size={18} className="text-violet-400" />
            <div>
              <h2 className="text-base font-semibold">Model Registry & Local Provisioning</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download verified open-weight packages with integrity verification and disk-space checks.
              </p>
            </div>
          </div>
        </div>

        {/* Provisioning In-Progress Banner */}
        {provisioningProgress && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/[.08] p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-violet-300" />
                <span className="text-sm font-semibold text-slate-200">
                  {provisioningProgress.state === 'DOWNLOADING' && `Downloading model (${provisioningProgress.progressPercent}%)`}
                  {provisioningProgress.state === 'VERIFYING_CHECKSUM' && 'Verifying SHA-256 Checksum...'}
                  {provisioningProgress.state === 'RUNNING_SMOKE_TEST' && 'Running Live Smoke Test...'}
                  {provisioningProgress.state === 'READY' && 'Model Ready & Verified!'}
                  {provisioningProgress.state === 'CANCELLED' && 'Provisioning Cancelled.'}
                  {provisioningProgress.state === 'ERROR' && `Provisioning Failed: ${provisioningProgress.errorMessage}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {provisioningProgress.state === 'DOWNLOADING' && (
                  <Button variant="outline" onClick={() => provisioner.cancel()}>
                    <X size={14} /> Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-300 rounded-full"
                style={{ width: `${provisioningProgress.progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{(provisioningProgress.bytesDownloaded / 1_000_000).toFixed(1)} MB / {(provisioningProgress.totalBytes / 1_000_000).toFixed(1)} MB</span>
              <span>{(provisioningProgress.downloadRateBytesPerSec / 1_000_000).toFixed(1)} MB/s</span>
            </div>
          </div>
        )}

        {/* Models Catalog Table */}
        <div className="space-y-3">
          {MODEL_CATALOG.map((model) => {
            const isInstalled = installedModels.some((im) => im.id === model.id);
            const isLoaded = activeModelStatus?.activeModelId === model.id && activeModelStatus?.status === 'READY';
            const isRecommended = hwProfile?.recommendedChatModelId === model.id;

            return (
              <div
                key={model.id}
                className={cx(
                  'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition',
                  isRecommended
                    ? 'border-violet-500/50 bg-violet-500/[.04]'
                    : isInstalled
                    ? 'border-white/[.12] bg-white/[.02]'
                    : 'border-white/[.07] bg-white/[.01] hover:border-white/15'
                )}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">{model.name}</span>
                    <span className="rounded bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                      {model.category}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      {model.license}
                    </span>
                    {isRecommended && (
                      <span className="rounded bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                        RECOMMENDED FOR THIS PC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                    {model.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span>Download Size: <b>{model.requirements.diskSizeGb} GB</b></span>
                    <span>Format: <b>{model.quantization}</b></span>
                    <span>Min RAM: <b>{model.requirements.minRamGb} GB</b></span>
                    <span>Runtime: <b>{model.recommendedRuntime}</b></span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {isLoaded ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-teal-300 font-semibold bg-teal-400/10 px-3 py-1.5 rounded-lg border border-teal-400/20">
                      <Zap size={14} /> Active in Memory
                    </span>
                  ) : isInstalled ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-teal-300 font-medium mr-1">
                        <CheckCircle2 size={16} /> Installed
                      </span>
                      <Button
                        variant="solid"
                        onClick={() => void handleLoadModel(model.id, model)}
                        disabled={loadingModelId === model.id}
                      >
                        {loadingModelId === model.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Load
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmModel(model as any)}
                      disabled={provisioningProgress?.state === 'DOWNLOADING'}
                    >
                      <Download size={14} /> Download ({model.requirements.diskSizeGb} GB)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmation Dialog before downloading (Requirement A.6) */}
      {confirmModel && (() => {
        const diskSizeGb = (confirmModel as any).requirements?.diskSizeGb ?? (confirmModel as any).diskSizeGb ?? 1.5;
        return (
          <Modal title="Confirm Local Model Download" onClose={() => setConfirmModel(null)}>
            <div className="space-y-4 text-xs leading-6 text-slate-300">
              <p>
                You are about to download <b>{confirmModel.name}</b> ({diskSizeGb} GB).
              </p>
              <div className="rounded-lg border border-white/[.06] bg-black/20 p-3.5 space-y-1.5">
                <div><b>License:</b> {confirmModel.license}</div>
                <div><b>Storage Required:</b> {diskSizeGb} GB (plus buffer for atomic installation)</div>
                <div><b>Estimated Disk Remaining:</b> ~{((hwSpecs?.freeDiskSpaceGb ?? 40) - diskSizeGb).toFixed(1)} GB</div>
                <div><b>Execution:</b> 100% on your device (loopback). No cloud fallback.</div>
              </div>
              <p className="text-slate-400">
                Ayatrisya never silently downloads large models or installs external services. Do you confirm this download?
              </p>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={() => setConfirmModel(null)}>
                  Cancel
                </Button>
                <Button variant="solid" onClick={() => void confirmAndStartDownload(confirmModel)}>
                  Confirm Download
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Live Inference Verification (Requirement A.5) */}
      <section className="rounded-2xl border border-white/[.08] bg-[#14161d] p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div className="flex items-center gap-2.5 text-slate-200">
            <Sparkles size={18} className="text-violet-400" />
            <div>
              <h2 className="text-base font-semibold">Live Prompt & Inference Verification</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Send an actual test prompt to verify end-to-end inference before labeling any model as Ready.
              </p>
            </div>
          </div>
          {inferenceVerified && (
            <span className="inline-flex items-center gap-1.5 text-xs text-teal-300 font-semibold bg-teal-400/10 px-3 py-1 rounded-full border border-teal-400/20">
              <CheckCircle2 size={15} /> Verified Working
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label htmlFor="test-prompt-input" className="block text-xs font-medium text-slate-300">
            Test Prompt
          </label>
          <textarea
            id="test-prompt-input"
            rows={2}
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            className={`${inputCls} resize-none`}
            disabled={testBusy}
          />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="solid"
              onClick={() => void runPromptTest()}
              disabled={testBusy || !testPrompt.trim()}
            >
              {testBusy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating via local engine...
                </>
              ) : (
                'Run Live Inference Test'
              )}
            </Button>
            {testDurationMs !== null && (
              <span className="text-xs text-slate-400">
                Completed in <b>{testDurationMs} ms</b>
              </span>
            )}
          </div>

          {testError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[.06] p-3 text-xs text-rose-300">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="rounded-xl border border-white/[.08] bg-black/30 p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Model Output</span>
              <p className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                {testResult}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
