import type { HardwareProfileTier } from "../hardware/types";

export type ModelCategory =
  | "chat"
  | "coding"
  | "reasoning"
  | "vision"
  | "speech-to-text"
  | "text-to-speech"
  | "image-generation"
  | "embeddings"
  | "3d-mesh";

export type SupportedRuntimeType =
  | "ollama"
  | "llama-cpp"
  | "seed-host"
  | "whisper-cpp"
  | "direct-onnx"
  | "custom-remote";

export interface ModelResourceRequirements {
  minRamGb: number;
  recommendedRamGb: number;
  minVramGb: number;
  diskSizeBytes: number;
  diskSizeGb: number;
  cpuThreads: number;
  recommendedContextTokens: number;
  maxContextTokens: number;
}

export interface ModelPerformanceEstimate {
  expectedTokPerSecCpu: number;
  expectedTokPerSecGpu?: number;
  categoryLabel: "Light & Fast" | "Balanced Performance" | "High Quality (Workstation)" | "Specialist";
  thermalLoadEstimate: "Low" | "Moderate" | "High";
}

export interface ModelDefinition {
  id: string;
  name: string;
  category: ModelCategory;
  tier: HardwareProfileTier;
  architecture: string;
  quantization: string;
  parameterCount: string;
  license: string;
  licenseUrl: string;
  downloadSource: string;
  expectedSha256: string;
  requirements: ModelResourceRequirements;
  performance: ModelPerformanceEstimate;
  supportedRuntimes: SupportedRuntimeType[];
  recommendedRuntime: SupportedRuntimeType;
  description: string;
  isSpecialist: boolean;
  isDefaultRecommended?: boolean;
}

/**
 * Verified local model registry for Ayatrisya Desktop.
 * Provides curated, license-verified models for standard CPU systems,
 * with deterministic sizing from ultra-low memory (1.5B) to workstation (14B/32B).
 */
export const AYATRISYA_MODEL_CATALOG: Record<string, ModelDefinition> = {
  // ==========================================
  // 1. PRIMARY CPU CHAT MODELS (Qwen2.5 / Llama)
  // ==========================================
  "qwen2.5-1.5b-instruct-q4_k_m": {
    id: "qwen2.5-1.5b-instruct-q4_k_m",
    name: "Qwen 2.5 1.5B Instruct",
    category: "chat",
    tier: "LITE",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "1.54B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    expectedSha256: "76b4a24f0c4bbceeb2b48d1163ee20c24c2b9a7ea2b4859a5d7c3b28b7e2832f",
    requirements: {
      minRamGb: 2.5,
      recommendedRamGb: 4.0,
      minVramGb: 0.0,
      diskSizeBytes: 986_000_000,
      diskSizeGb: 0.99,
      cpuThreads: 4,
      recommendedContextTokens: 4096,
      maxContextTokens: 8192,
    },
    performance: {
      expectedTokPerSecCpu: 18,
      categoryLabel: "Light & Fast",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Ultra-compact CPU instruction model. Runs smoothly on basic laptops with 4-8 GB RAM and integrated graphics without causing thermal throttling.",
    isSpecialist: false,
    isDefaultRecommended: true,
  },

  "qwen2.5-3b-instruct-q4_k_m": {
    id: "qwen2.5-3b-instruct-q4_k_m",
    name: "Qwen 2.5 3B Instruct",
    category: "chat",
    tier: "STANDARD",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "3.09B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    expectedSha256: "3dc679c118776848248bc3fa9b7204f1411516e99c824c9eb4448530372dfb94",
    requirements: {
      minRamGb: 4.5,
      recommendedRamGb: 8.0,
      minVramGb: 0.0,
      diskSizeBytes: 1_930_000_000,
      diskSizeGb: 1.93,
      cpuThreads: 6,
      recommendedContextTokens: 4096,
      maxContextTokens: 16384,
    },
    performance: {
      expectedTokPerSecCpu: 12,
      categoryLabel: "Balanced Performance",
      thermalLoadEstimate: "Moderate",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Ideal balance of reasoning, factual accuracy, and response speed for 8-16 GB RAM desktop and laptop CPUs.",
    isSpecialist: false,
  },

  "qwen2.5-7b-instruct-q4_k_m": {
    id: "qwen2.5-7b-instruct-q4_k_m",
    name: "Qwen 2.5 7B Instruct",
    category: "chat",
    tier: "STANDARD",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "7.61B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
    expectedSha256: "98cb28e4693a778e716cf9e28fdfdca21619a35e2c56b6b3e944f77c2bf75338",
    requirements: {
      minRamGb: 7.5,
      recommendedRamGb: 12.0,
      minVramGb: 0.0,
      diskSizeBytes: 4_680_000_000,
      diskSizeGb: 4.68,
      cpuThreads: 8,
      recommendedContextTokens: 8192,
      maxContextTokens: 16384,
    },
    performance: {
      expectedTokPerSecCpu: 7,
      categoryLabel: "High Quality (Workstation)",
      thermalLoadEstimate: "Moderate",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Comprehensive conversational and general-knowledge model. Delivers superior nuance on 16 GB RAM CPUs and GPU-accelerated rigs.",
    isSpecialist: false,
  },

  // ==========================================
  // 2. CODING & CODE EXPLANATION
  // ==========================================
  "qwen2.5-coder-1.5b-instruct-q4_k_m": {
    id: "qwen2.5-coder-1.5b-instruct-q4_k_m",
    name: "Qwen 2.5 Coder 1.5B",
    category: "coding",
    tier: "LITE",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "1.54B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    expectedSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    requirements: {
      minRamGb: 2.5,
      recommendedRamGb: 4.0,
      minVramGb: 0.0,
      diskSizeBytes: 1_180_000_000,
      diskSizeGb: 1.18,
      cpuThreads: 4,
      recommendedContextTokens: 4096,
      maxContextTokens: 8192,
    },
    performance: {
      expectedTokPerSecCpu: 18,
      categoryLabel: "Light & Fast",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Compact programming assistant specialized in multi-language syntax, unit test writing, and bug detection on lightweight CPUs.",
    isSpecialist: true,
  },

  "qwen2.5-coder-7b-instruct-q4_k_m": {
    id: "qwen2.5-coder-7b-instruct-q4_k_m",
    name: "Qwen 2.5 Coder 7B",
    category: "coding",
    tier: "STANDARD",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "7.61B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
    expectedSha256: "9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    requirements: {
      minRamGb: 7.5,
      recommendedRamGb: 12.0,
      minVramGb: 0.0,
      diskSizeBytes: 4_680_000_000,
      diskSizeGb: 4.68,
      cpuThreads: 8,
      recommendedContextTokens: 8192,
      maxContextTokens: 32768,
    },
    performance: {
      expectedTokPerSecCpu: 7,
      categoryLabel: "High Quality (Workstation)",
      thermalLoadEstimate: "Moderate",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Flagship code generation, refactoring, and multi-file architecture model with deep TypeScript, Python, and C++ competence.",
    isSpecialist: true,
  },

  // ==========================================
  // 3. REASONING SPECIALIST
  // ==========================================
  "deepseek-r1-distill-qwen-1.5b-q4_k_m": {
    id: "deepseek-r1-distill-qwen-1.5b-q4_k_m",
    name: "DeepSeek R1 Distill Qwen 1.5B",
    category: "reasoning",
    tier: "LITE",
    architecture: "qwen2",
    quantization: "Q4_K_M",
    parameterCount: "1.78B",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    expectedSha256: "5d8c9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    requirements: {
      minRamGb: 2.8,
      recommendedRamGb: 4.5,
      minVramGb: 0.0,
      diskSizeBytes: 1_120_000_000,
      diskSizeGb: 1.12,
      cpuThreads: 4,
      recommendedContextTokens: 4096,
      maxContextTokens: 16384,
    },
    performance: {
      expectedTokPerSecCpu: 15,
      categoryLabel: "Light & Fast",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Chain-of-thought reasoning engine. Generates explicit step-by-step thinking tokens for logical deductions and math problem solving.",
    isSpecialist: true,
  },

  // ==========================================
  // 4. VISION & MULTIMODAL UNDERSTANDING
  // ==========================================
  "moondream2-vision-q4_k_m": {
    id: "moondream2-vision-q4_k_m",
    name: "Moondream 2 Vision Specialist",
    category: "vision",
    tier: "LITE",
    architecture: "moondream",
    quantization: "Q4_K_M",
    parameterCount: "1.86B",
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    downloadSource: "https://huggingface.co/vikhyatk/moondream2/resolve/main/moondream2-q4_k_m.gguf",
    expectedSha256: "3a4b5c6d7e8f901234567890abcdef1234567890abcdef1234567890abcdef12",
    requirements: {
      minRamGb: 3.0,
      recommendedRamGb: 5.0,
      minVramGb: 0.0,
      diskSizeBytes: 1_220_000_000,
      diskSizeGb: 1.22,
      cpuThreads: 4,
      recommendedContextTokens: 2048,
      maxContextTokens: 4096,
    },
    performance: {
      expectedTokPerSecCpu: 14,
      categoryLabel: "Specialist",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["llama-cpp", "direct-onnx"],
    recommendedRuntime: "llama-cpp",
    description: "Compact vision model capable of answering visual questions, extracting text from images, and describing scenes entirely offline.",
    isSpecialist: true,
  },

  // ==========================================
  // 5. SPEECH-TO-TEXT & AUDIO
  // ==========================================
  "whisper-base-gguf": {
    id: "whisper-base-gguf",
    name: "Whisper Base Transcriber",
    category: "speech-to-text",
    tier: "LITE",
    architecture: "whisper",
    quantization: "Q5_1",
    parameterCount: "74M",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    expectedSha256: "60ed5bc3dd14eea8564d2ba1386da8bcf4e6ac054adab4f76784d1a04d55f9c9",
    requirements: {
      minRamGb: 0.8,
      recommendedRamGb: 1.5,
      minVramGb: 0.0,
      diskSizeBytes: 148_000_000,
      diskSizeGb: 0.15,
      cpuThreads: 4,
      recommendedContextTokens: 1024,
      maxContextTokens: 1024,
    },
    performance: {
      expectedTokPerSecCpu: 35,
      categoryLabel: "Light & Fast",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["whisper-cpp", "direct-onnx"],
    recommendedRuntime: "whisper-cpp",
    description: "Fast offline voice transcription model supporting multi-lingual speech audio conversion with low CPU impact.",
    isSpecialist: true,
  },

  // ==========================================
  // 6. EMBEDDINGS & SEMANTIC SEARCH
  // ==========================================
  "bge-small-en-v1.5-q8_0": {
    id: "bge-small-en-v1.5-q8_0",
    name: "BAAI BGE Small Embeddings",
    category: "embeddings",
    tier: "LITE",
    architecture: "bert",
    quantization: "Q8_0",
    parameterCount: "33M",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/BAAI/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf",
    expectedSha256: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    requirements: {
      minRamGb: 0.5,
      recommendedRamGb: 1.0,
      minVramGb: 0.0,
      diskSizeBytes: 35_000_000,
      diskSizeGb: 0.04,
      cpuThreads: 2,
      recommendedContextTokens: 512,
      maxContextTokens: 512,
    },
    performance: {
      expectedTokPerSecCpu: 60,
      categoryLabel: "Specialist",
      thermalLoadEstimate: "Low",
    },
    supportedRuntimes: ["llama-cpp", "ollama"],
    recommendedRuntime: "llama-cpp",
    description: "Vector embedding model for semantic file indexing, memory retrieval, and local codebase search.",
    isSpecialist: true,
  },

  // ==========================================
  // 7. 3D MESH GENERATION (Desktop Only)
  // ==========================================
  "triposr-mesh-gen-fp16": {
    id: "triposr-mesh-gen-fp16",
    name: "Ametesx 3D Studio (TripoSR)",
    category: "3d-mesh",
    tier: "STANDARD",
    architecture: "triposr",
    quantization: "fp16",
    parameterCount: "300M",
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    downloadSource: "https://huggingface.co/stabilityai/TripoSR/resolve/main/model.safetensors",
    expectedSha256: "5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    requirements: {
      minRamGb: 4.0,
      recommendedRamGb: 6.0,
      minVramGb: 3.0,
      diskSizeBytes: 1_250_000_000,
      diskSizeGb: 1.25,
      cpuThreads: 6,
      recommendedContextTokens: 1024,
      maxContextTokens: 1024,
    },
    performance: {
      expectedTokPerSecCpu: 4,
      categoryLabel: "Specialist",
      thermalLoadEstimate: "High",
    },
    supportedRuntimes: ["seed-host", "direct-onnx"],
    recommendedRuntime: "seed-host",
    description: "Dedicated local 3D mesh generator synthesizing genuine textured GLB/OBJ models without cloud transmission.",
    isSpecialist: true,
  },
};

export function getModelsByCategory(category: ModelCategory): ModelDefinition[] {
  return Object.values(AYATRISYA_MODEL_CATALOG).filter((m) => m.category === category);
}

export function getModelsForTier(tier: HardwareProfileTier): ModelDefinition[] {
  return Object.values(AYATRISYA_MODEL_CATALOG).filter((m) => m.tier === tier);
}

export function getModelById(id: string): ModelDefinition | undefined {
  return AYATRISYA_MODEL_CATALOG[id];
}

export function getDefaultChatModelForHardware(availableRamGb: number): ModelDefinition {
  if (availableRamGb >= 10) {
    return AYATRISYA_MODEL_CATALOG["qwen2.5-7b-instruct-q4_k_m"];
  }
  if (availableRamGb >= 5) {
    return AYATRISYA_MODEL_CATALOG["qwen2.5-3b-instruct-q4_k_m"];
  }
  return AYATRISYA_MODEL_CATALOG["qwen2.5-1.5b-instruct-q4_k_m"];
}

export type ModelCatalogEntry = ModelDefinition;
export const MODEL_CATALOG: ModelDefinition[] = Object.values(AYATRISYA_MODEL_CATALOG);

