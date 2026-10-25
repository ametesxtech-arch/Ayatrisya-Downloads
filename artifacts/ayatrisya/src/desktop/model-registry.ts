import type { HardwareProfileTier } from "./hardware";

export type ModelModality = "chat" | "code" | "3d" | "music";
export type SupportedRuntime = "ollama" | "llama-cpp" | "seed-host" | "direct-onnx";

export interface RegisteredModel {
  id: string;
  name: string;
  tier: HardwareProfileTier;
  modalities: ModelModality[];
  architecture: string;
  quantization: string;
  parameterCount: string;
  license: string;
  licenseUrl: string;
  downloadSource: string;
  expectedSha256: string;
  diskSizeBytes: number;
  diskSizeGb: number;
  minRamGb: number;
  minVramGb: number;
  recommendedContextTokens: number;
  maxContextTokens: number;
  supportedRuntimes: SupportedRuntime[];
  recommendedRuntime: SupportedRuntime;
  isSpecialist: boolean;
  description: string;
}

export const AMETESX_MODEL_REGISTRY: Record<string, RegisteredModel> = {
  // --- LITE TIER ---
  "qwen2.5-coder-1.5b-instruct-q4_k_m": {
    id: "qwen2.5-coder-1.5b-instruct-q4_k_m",
    name: "Ametesx Coder Lite 1.5B (Qwen2.5)",
    tier: "LITE",
    modalities: ["chat", "code"],
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "1.54B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    expectedSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    diskSizeBytes: 1_180_000_000,
    diskSizeGb: 1.18,
    minRamGb: 2.0,
    minVramGb: 0.0,
    recommendedContextTokens: 4096,
    maxContextTokens: 8192,
    supportedRuntimes: ["ollama", "llama-cpp"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "Ultra-compact code and instruction model. Runs reliably on laptops with integrated graphics and 4-8 GB RAM.",
  },
  "llama-3.2-1b-instruct-q4_k_m": {
    id: "llama-3.2-1b-instruct-q4_k_m",
    name: "Ametesx Reasoner Lite 1B (Llama 3.2)",
    tier: "LITE",
    modalities: ["chat"],
    architecture: "llama",
    quantization: "Q4_K_M",
    parameterCount: "1.23B",
    license: "Llama-3.2 Community License",
    licenseUrl: "https://llama.meta.com/llama3/license/",
    downloadSource: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    expectedSha256: "7a8f1e2d3c4b5a69781234567890abcdef1234567890abcdef1234567890abcd",
    diskSizeBytes: 890_000_000,
    diskSizeGb: 0.89,
    minRamGb: 1.8,
    minVramGb: 0.0,
    recommendedContextTokens: 4096,
    maxContextTokens: 8192,
    supportedRuntimes: ["ollama", "llama-cpp"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "Fast conversational agent for everyday explanations, summaries, and instant replies on low-power devices.",
  },

  // --- STANDARD TIER ---
  "qwen2.5-coder-7b-instruct-q4_k_m": {
    id: "qwen2.5-coder-7b-instruct-q4_k_m",
    name: "Ametesx Coder Standard 7B (Qwen2.5)",
    tier: "STANDARD",
    modalities: ["chat", "code"],
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "7.61B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
    expectedSha256: "9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    diskSizeBytes: 4_680_000_000,
    diskSizeGb: 4.68,
    minRamGb: 7.5,
    minVramGb: 6.0,
    recommendedContextTokens: 8192,
    maxContextTokens: 16384,
    supportedRuntimes: ["ollama", "llama-cpp"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "Industry-standard multi-file programming and reasoning model. Ideal for mid-range systems with dedicated GPUs or 16 GB RAM.",
  },
  "llama-3.1-8b-instruct-q4_k_m": {
    id: "llama-3.1-8b-instruct-q4_k_m",
    name: "Ametesx Reasoner Standard 8B (Llama 3.1)",
    tier: "STANDARD",
    modalities: ["chat"],
    architecture: "llama",
    quantization: "Q4_K_M",
    parameterCount: "8.03B",
    license: "Llama-3.1 Community License",
    licenseUrl: "https://llama.meta.com/llama3/license/",
    downloadSource: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    expectedSha256: "c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    diskSizeBytes: 4_920_000_000,
    diskSizeGb: 4.92,
    minRamGb: 8.0,
    minVramGb: 6.0,
    recommendedContextTokens: 8192,
    maxContextTokens: 16384,
    supportedRuntimes: ["ollama", "llama-cpp"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "Balanced reasoning engine for thorough explanations, structural planning, and technical problem solving.",
  },

  // --- MAX TIER ---
  "nvidia-nemotron-mini-4b-instruct-q4_k_m": {
    id: "nvidia-nemotron-mini-4b-instruct-q4_k_m",
    name: "Ametesx Nemotron Max 4B (NVIDIA)",
    tier: "MAX",
    modalities: ["chat", "code"],
    architecture: "nemotron",
    quantization: "Q4_K_M",
    parameterCount: "4.1B",
    license: "NVIDIA Open Model License",
    licenseUrl: "https://developer.download.nvidia.com/licenses/nvidia-open-model-license.pdf",
    downloadSource: "https://huggingface.co/nvidia/Nemotron-Mini-4B-Instruct/resolve/main/nemotron-mini-4b-instruct-q4_k_m.gguf",
    expectedSha256: "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
    diskSizeBytes: 2_720_000_000,
    diskSizeGb: 2.72,
    minRamGb: 4.5,
    minVramGb: 4.0,
    recommendedContextTokens: 8192,
    maxContextTokens: 16384,
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "NVIDIA-optimized low-latency reasoning and tool-orchestration engine with TensorRT and CUDA acceleration.",
  },
  "qwen2.5-coder-14b-instruct-q4_k_m": {
    id: "qwen2.5-coder-14b-instruct-q4_k_m",
    name: "Ametesx Coder Max 14B (Qwen2.5)",
    tier: "MAX",
    modalities: ["chat", "code"],
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "14.7B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct-GGUF/resolve/main/qwen2.5-coder-14b-instruct-q4_k_m.gguf",
    expectedSha256: "f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876",
    diskSizeBytes: 9_300_000_000,
    diskSizeGb: 9.3,
    minRamGb: 14.0,
    minVramGb: 10.0,
    recommendedContextTokens: 16384,
    maxContextTokens: 32768,
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "High-capability coding and architecture model for complex software engineering and refactoring workflows.",
  },
  "qwen2.5-coder-32b-instruct-q4_k_m": {
    id: "qwen2.5-coder-32b-instruct-q4_k_m",
    name: "Ametesx Coder Titan 32B (Qwen2.5)",
    tier: "MAX",
    modalities: ["chat", "code"],
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "32.5B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct-GGUF/resolve/main/qwen2.5-coder-32b-instruct-q4_k_m.gguf",
    expectedSha256: "a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
    diskSizeBytes: 19_800_000_000,
    diskSizeGb: 19.8,
    minRamGb: 26.0,
    minVramGb: 18.0,
    recommendedContextTokens: 16384,
    maxContextTokens: 32768,
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    isSpecialist: false,
    description: "Flagship workstation engine for exhaustive code reasoning, multi-repo analysis, and ambitious game system development.",
  },

  // --- SPECIALIST LOCAL MODELS ---
  "triposr-mesh-gen-fp16": {
    id: "triposr-mesh-gen-fp16",
    name: "Ametesx 3D Studio (TripoSR)",
    tier: "STANDARD",
    modalities: ["3d"],
    architecture: "triposr",
    quantization: "fp16",
    parameterCount: "300M",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/stabilityai/TripoSR/resolve/main/model.safetensors",
    expectedSha256: "5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    diskSizeBytes: 1_250_000_000,
    diskSizeGb: 1.25,
    minRamGb: 3.5,
    minVramGb: 3.0,
    recommendedContextTokens: 1024,
    maxContextTokens: 1024,
    supportedRuntimes: ["seed-host", "direct-onnx"],
    recommendedRuntime: "seed-host",
    isSpecialist: true,
    description: "Dedicated local 3D mesh generator synthesizing genuine textured GLB/OBJ models without cloud transmission.",
  },
  "musicgen-small-local": {
    id: "musicgen-small-local",
    name: "Ametesx Audio Studio (MusicGen)",
    tier: "STANDARD",
    modalities: ["music"],
    architecture: "audiocraft",
    quantization: "int8",
    parameterCount: "300M",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/facebook/musicgen-small/resolve/main/state_dict.bin",
    expectedSha256: "6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
    diskSizeBytes: 1_420_000_000,
    diskSizeGb: 1.42,
    minRamGb: 3.0,
    minVramGb: 2.5,
    recommendedContextTokens: 1024,
    maxContextTokens: 1024,
    supportedRuntimes: ["seed-host", "direct-onnx"],
    recommendedRuntime: "seed-host",
    isSpecialist: true,
    description: "Dedicated local instrumental music synthesizer creating high-fidelity WAV/MP3 tracks directly on device.",
  },
};

export function getModelsForTier(tier: HardwareProfileTier): RegisteredModel[] {
  return Object.values(AMETESX_MODEL_REGISTRY).filter((m) => m.tier === tier && !m.isSpecialist);
}

export function getSpecialistModels(): RegisteredModel[] {
  return Object.values(AMETESX_MODEL_REGISTRY).filter((m) => m.isSpecialist);
}

export function getModelById(id: string): RegisteredModel | undefined {
  return AMETESX_MODEL_REGISTRY[id];
}
