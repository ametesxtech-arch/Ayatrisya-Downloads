import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Sparkles,
  Download,
  Save,
  RotateCw,
  RefreshCw,
  Sliders,
  User,
  ArrowRight,
  Shield,
  X,
  AlertCircle,
  Eye,
  Check,
  Send,
} from 'lucide-react';
import { Button, Notice, inputCls, areaCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { repository } from '@/storage/repository';
import { downloadBlob } from '@/storage/backup';
import { modelClient } from '@/ai/client';
import { errMsg, formatBytes } from '@/lib/format';
import { AssetHistory } from '@/components/AssetHistory';
import {
  getGuestImageGenerationCount,
  GUEST_IMAGE_LIMIT,
  reserveGuestImageGeneration,
} from '@/ai/guest-image-quota';

import type {
  CharacterProfile,
  GeneratedImageDetails,
  ImageStudioMessage,
  ImageStyleId,
} from './types';
import { hasCloudImageConsent, getCloudImageConsentScope } from './consent';
import { CloudImageConsentModal } from './CloudImageConsentModal';
import { CharacterProfilesModal } from './CharacterProfilesModal';
import { loadCharacterProfiles } from './character-profiles';
import { StyleSelector } from './StyleSelector';
import { composeConversationalPrompt } from './prompt-composer';
import { getStylePreset } from './styles';

const aspects: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '4:3': [4, 3],
  '3:2': [3, 2],
  '16:9': [16, 9],
  '3:4': [3, 4],
  '9:16': [9, 16],
};
const dimBases = [512, 768, 1024];
const dimsFor = (ratio: string, base: number) => {
  const [w, h] = aspects[ratio] || [1, 1];
  return w >= h
    ? `${base} × ${Math.round((base * h) / w / 8) * 8}`
    : `${Math.round((base * w) / h / 8) * 8} × ${base}`;
};

const SUGGESTED_REFINEMENTS = [
  'Make the lighting warmer',
  'Put this character in a futuristic city',
  'Change camera angle to cinematic close-up',
  'Change outfit to black leather jacket',
  'Make it anime style instead',
  'Night scene with neon reflections',
];

export function ImageStudioConversation({
  notify,
  guestLimited = false,
}: {
  notify?: (m: string) => void;
  guestLimited?: boolean;
}) {
  const note = notify ?? (() => undefined);
  const { guest } = useAuth();
  const isLimitedGuest = guestLimited || guest;
  const { caps, loading: capsLoading } = useCaps();
  const { prefs } = usePrefs();

  const capable = caps.some((c) => c.available && c.modalities.includes('image'));

  // Generation options
  const [format, setFormat] = useState<'PNG' | 'JPEG'>('PNG');
  const [ratio, setRatio] = useState('1:1');
  const [baseDim, setBaseDim] = useState(1024);

  // Style and character profiles
  const [selectedStyleId, setSelectedStyleId] = useState<ImageStyleId>('photorealistic');
  const [customStyleModifier, setCustomStyleModifier] = useState('');
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<CharacterProfile | undefined>();
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  // Conversation history
  const [messages, setMessages] = useState<ImageStudioMessage[]>([]);
  const [activeReferenceId, setActiveReferenceId] = useState<string | undefined>();
  const [promptInput, setPromptInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingPromptSubmission, setPendingPromptSubmission] = useState<string | null>(null);

  // Guest image quota
  const [guestImagesUsed, setGuestImagesUsed] = useState(() => getGuestImageGenerationCount());
  const guestImagesRemaining = Math.max(0, GUEST_IMAGE_LIMIT - guestImagesUsed);

  const generationAbort = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load character profiles on mount
  useEffect(() => {
    loadCharacterProfiles().then(setCharacterProfiles).catch(() => {});
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      messages.forEach((msg) => {
        if (msg.generated?.url) {
          URL.revokeObjectURL(msg.generated.url);
        }
      });
    };
  }, [messages]);

  const activeReferenceMessage = messages.find((m) => m.id === activeReferenceId);

  async function triggerGeneration(userText: string) {
    if (!userText.trim()) return;

    // 1. Verify consent first
    if (!hasCloudImageConsent()) {
      setPendingPromptSubmission(userText);
      setShowConsentModal(true);
      return;
    }

    if (isLimitedGuest && guestImagesRemaining <= 0) {
      note('Guest image generation limit reached.');
      return;
    }

    // 2. Synthesize multi-turn prompt with character and style context
    const composition = composeConversationalPrompt({
      userInput: userText,
      referencePrompt: activeReferenceMessage?.effectivePrompt || activeReferenceMessage?.content,
      character: activeProfile,
      styleId: selectedStyleId,
      customStyleModifier,
    });

    const targetWidth = Number(dimsFor(ratio, baseDim).split(' × ')[0]);
    const targetHeight = Number(dimsFor(ratio, baseDim).split(' × ')[1]);

    const messageId = crypto.randomUUID();
    const newMessage: ImageStudioMessage = {
      id: messageId,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      status: 'generating',
      effectivePrompt: composition.effectivePrompt,
      refinementContext: composition.refinementSummary,
      appliedStyleId: composition.detectedStyleOverride || selectedStyleId,
      appliedCustomStyle: selectedStyleId === 'custom' ? customStyleModifier : undefined,
      appliedCharacterId: activeProfile?.id,
      appliedCharacterName: activeProfile?.name,
      referenceParentId: activeReferenceId,
      generationOptions: {
        format,
        aspectRatio: ratio,
        width: targetWidth,
        height: targetHeight,
      },
    };

    setMessages((prev) => [...prev, newMessage]);
    setPromptInput('');
    setGenerating(true);

    let releaseGuestQuota: (() => void) | undefined;
    const controller = new AbortController();
    generationAbort.current = controller;

    try {
      if (isLimitedGuest) {
        releaseGuestQuota = reserveGuestImageGeneration();
        setGuestImagesUsed(getGuestImageGenerationCount());
      }

      const job = modelClient.submitJob({
        kind: 'asset',
        assetKind: 'image',
        prompt: composition.effectivePrompt,
        options: {
          model: prefs.model,
          format,
          aspectRatio: ratio,
          width: targetWidth,
          height: targetHeight,
          signal: controller.signal,
        },
      });

      const output = await job.result;

      // Validate image dimensions
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        const tempUrl = URL.createObjectURL(output.blob);
        img.onload = () => {
          URL.revokeObjectURL(tempUrl);
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          } else {
            reject(new Error('The generated image contains invalid or zero dimensions.'));
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          reject(new Error('The model output could not be decoded as a valid image.'));
        };
        img.src = tempUrl;
      });

      const url = URL.createObjectURL(output.blob);
      const generatedDetails: GeneratedImageDetails = {
        blob: output.blob,
        fileName: output.fileName,
        url,
        width: dims.width,
        height: dims.height,
        sizeBytes: output.blob.size,
        format,
        aspectRatio: ratio,
        provider: (output as any).provider,
        model: (output as any).model,
        stage: (output as any).stage,
        fallbackUsed: (output as any).fallbackUsed,
        version: (output as any).version,
        stageAudit: (output as any).stageAudit,
      };

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, status: 'completed', generated: generatedDetails }
            : msg,
        ),
      );

      // Automatically set newly completed image as the active reference for follow-ups
      setActiveReferenceId(messageId);
      releaseGuestQuota = undefined;
      note('Image generated successfully.');
    } catch (err: any) {
      releaseGuestQuota?.();
      if (isLimitedGuest) setGuestImagesUsed(getGuestImageGenerationCount());

      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const errorMsg = errMsg(err, 'Image generation failed.');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: 'failed', error: errorMsg } : msg,
          ),
        );
        note(errorMsg);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: 'failed', error: 'Generation cancelled by user.' } : msg,
          ),
        );
      }
    } finally {
      setGenerating(false);
      generationAbort.current = null;
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!promptInput.trim() || generating) return;
    void triggerGeneration(promptInput.trim());
  }

  async function handleSaveToLibrary(details: GeneratedImageDetails) {
    try {
      await repository.addFile(
        new File([details.blob], details.fileName, { type: details.blob.type }),
      );
      note(`${details.fileName} saved to Library.`);
    } catch (err) {
      note(errMsg(err, 'Failed to save to Library.'));
    }
  }

  function handleConsentApproved() {
    setShowConsentModal(false);
    if (pendingPromptSubmission) {
      const p = pendingPromptSubmission;
      setPendingPromptSubmission(null);
      void triggerGeneration(p);
    }
  }

  function handleConsentCancelled() {
    setShowConsentModal(false);
    setPendingPromptSubmission(null);
    note('Cloud image generation was not granted.');
  }

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-8 pb-32 space-y-6">
      <PageHeading
        eyebrow="Image Studio"
        title="Conversational Image Generation"
        description="Generate, refine, and iterate on images through interactive conversation with character consistency and artistic styles."
      />

      {/* Requirement 4 & 5 Status Banner */}
      <div
        role="status"
        className="rounded-xl border border-teal-500/20 bg-teal-500/[.05] p-4 text-sm text-teal-100/90"
        data-testid="status-image"
      >
        {capsLoading ? (
          'Checking model status…'
        ) : capable ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-teal-200">Ayatrisya 4-Stage Image Generation Engine Active</span>
            <span className="text-xs text-slate-400">Sequence: 1. Proprietary Model → 2. Hugging Face → 3. Gemini → 4. Cloudflare</span>
          </div>
        ) : (
          <span className="text-rose-200">
            No image generation model is connected. Configure Ayatrisya Image Model, Hugging Face, Gemini, or Cloudflare credentials on your API server.
          </span>
        )}
        {isLimitedGuest && (
          <span className="mt-1 block text-xs text-amber-300/80" data-testid="status-guest-image-quota">
            {guestImagesRemaining} of {GUEST_IMAGE_LIMIT} guest image generations remaining in this browser.
          </span>
        )}
      </div>

      {/* Control Bar: Style, Character, Aspect Ratio, Dimensions, Format */}
      <div className="rounded-xl border border-white/[.08] bg-[#15171e] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] pb-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Style Selector */}
            <StyleSelector
              selectedStyleId={selectedStyleId}
              customStyleModifier={customStyleModifier}
              onSelectStyle={setSelectedStyleId}
              onChangeCustomModifier={setCustomStyleModifier}
            />

            {/* Character Profile Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-400">Character</label>
              <button
                type="button"
                onClick={() => setShowCharacterModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#101116] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-violet-400/40 hover:bg-white/[.05] transition"
                data-testid="button-character-profile-selector"
              >
                <User size={14} className="text-violet-400" />
                <span>{activeProfile ? activeProfile.name : 'No character'}</span>
                {activeProfile && (
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[9px] text-violet-300">
                    Active
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active reference indicator */}
          {activeReferenceMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-xs text-violet-200">
              <Eye size={12} className="text-violet-400" />
              <span className="truncate max-w-[200px]">
                Refining from: &ldquo;{activeReferenceMessage.content}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => setActiveReferenceId(undefined)}
                title="Clear reference"
                className="hover:text-white ml-1"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Technical settings: Ratio, Dimensions, Format */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <label className="block text-slate-400">
            Aspect Ratio
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              className={`${inputCls} mt-1`}
              disabled={generating}
            >
              {Object.keys(aspects).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-slate-400">
            Dimensions
            <select
              value={baseDim}
              onChange={(e) => setBaseDim(Number(e.target.value))}
              className={`${inputCls} mt-1`}
              disabled={generating}
            >
              {dimBases.map((b) => (
                <option key={b} value={b}>
                  {dimsFor(ratio, b)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-slate-400">
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'PNG' | 'JPEG')}
              className={`${inputCls} mt-1`}
              disabled={generating}
            >
              <option value="PNG">PNG (lossless)</option>
              <option value="JPEG">JPEG (smaller)</option>
            </select>
          </label>

          <div className="flex items-end">
            <div className="text-[11px] leading-tight">
              <span className="font-semibold text-teal-300">4-Stage Pipeline</span>
              <span className="text-slate-500 block text-[10px]">Proprietary → HF → Gemini → Cloudflare</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversational Stream */}
      <div className="space-y-6 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <Sparkles size={36} className="mx-auto text-violet-400/60 mb-3" />
            <h3 className="text-base font-semibold text-slate-200">Start an Image Conversation</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Describe the scene or character you want to create. Once generated, you can refine lighting, outfit, camera angles, or styles through natural follow-up messages.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
              {SUGGESTED_REFINEMENTS.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPromptInput(suggestion)}
                  className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs text-slate-300 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white transition"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isRefActive = activeReferenceId === msg.id;
            return (
              <div
                key={msg.id}
                className={`rounded-2xl border p-4 sm:p-5 transition space-y-3 ${
                  isRefActive
                    ? 'border-violet-500/40 bg-[#161722]'
                    : 'border-white/[.075] bg-[#15171e]'
                }`}
              >
                {/* Message Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.05] pb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">You</span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.appliedStyleId && (
                      <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.2 text-[10px] text-slate-300">
                        {getStylePreset(msg.appliedStyleId).label}
                      </span>
                    )}
                    {msg.appliedCharacterName && (
                      <span className="rounded bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.2 text-[10px] text-violet-300">
                        Character: {msg.appliedCharacterName}
                      </span>
                    )}
                  </div>

                  {msg.status === 'completed' && msg.generated && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={isRefActive ? 'solid' : 'outline'}
                        onClick={() => setActiveReferenceId(isRefActive ? undefined : msg.id)}
                        data-testid="use-as-reference-button"
                      >
                        {isRefActive ? <Check size={12} /> : <Eye size={12} />}
                        {isRefActive ? 'Active reference' : 'Use as reference'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* User Prompt */}
                <div className="text-sm text-slate-200 font-medium whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Refinement Context note if follow-up */}
                {msg.refinementContext && (
                  <p className="text-[11px] text-violet-300/80 bg-violet-500/[.06] rounded px-2 py-1">
                    ↳ {msg.refinementContext}
                  </p>
                )}

                {/* Status / Output Section */}
                {msg.status === 'generating' && (
                  <div className="rounded-xl border border-white/10 bg-[#101116] p-8 text-center animate-pulse">
                    <Sparkles size={28} className="mx-auto text-amber-300 animate-spin" />
                    <h4 className="mt-3 text-sm font-semibold text-slate-200">Generating image…</h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Processing with Cloudflare Workers AI FLUX.1-schnell model.
                    </p>
                  </div>
                )}

                {msg.status === 'failed' && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-4 text-xs text-rose-200 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                      <AlertCircle size={15} />
                      Generation Failed
                    </div>
                    <p>{msg.error || 'The model service could not fulfill this generation.'}</p>
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        onClick={() => void triggerGeneration(msg.content)}
                        disabled={generating}
                      >
                        <RefreshCw size={12} />
                        Retry
                      </Button>
                    </div>
                  </div>
                )}

                {msg.status === 'completed' && msg.generated && (
                  <div className="space-y-3 pt-1">
                    {/* Image display */}
                    <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <img
                        src={msg.generated.url}
                        alt={msg.content}
                        className="w-full max-h-[500px] object-contain rounded-xl"
                      />
                    </div>

                    {/* Provider & Model Honest Attribution Badge */}
                    <div className="rounded-lg border border-white/[.07] bg-white/[.02] p-2.5 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {msg.generated.provider === 'ayatrisya-own-model' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                              <Sparkles size={11} /> Ayatrisya Proprietary Model
                            </span>
                          ) : msg.generated.provider === 'huggingface' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                              Hugging Face
                            </span>
                          ) : msg.generated.provider === 'gemini' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                              Google Gemini
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              Cloudflare Workers AI
                            </span>
                          )}

                          {msg.generated.fallbackUsed && (
                            <span className="rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[9px] text-rose-300">
                              Fallback (Stage {msg.generated.stage || 2})
                            </span>
                          )}

                          <span className="font-mono text-[10px] text-slate-400">
                            {msg.generated.model || 'Default Model'}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {msg.generated.width} × {msg.generated.height} px · {msg.generated.format}
                        </span>
                      </div>

                      {/* Expandable Provider Fallback Audit Trail */}
                      {msg.generated.stageAudit && msg.generated.stageAudit.length > 0 && (
                        <details className="text-[10px] text-slate-500 pt-1 border-t border-white/[.04]">
                          <summary className="cursor-pointer text-slate-400 hover:text-slate-300 font-medium">
                            Provider fallback execution trace ({msg.generated.stageAudit.length} stages checked)
                          </summary>
                          <div className="mt-1.5 space-y-1 pl-2 border-l border-white/10">
                            {msg.generated.stageAudit.map((audit: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span>
                                  Stage {audit.stage} ({audit.provider}):{' '}
                                  <span className={audit.status === 'success' ? 'text-teal-300' : 'text-slate-400'}>
                                    {audit.status}
                                  </span>
                                  {audit.reason ? ` — ${audit.reason}` : ''}
                                </span>
                                <span className="font-mono text-slate-600">{audit.durationMs}ms</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        Size: {formatBytes(msg.generated.sizeBytes)}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">
                        {msg.generated.fileName}
                      </span>
                    </div>

                    {/* Action buttons: Retry, Regenerate, Refine, Save, Download */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[.05]">
                      <Button
                        variant="outline"
                        onClick={() => downloadBlob(msg.generated!.blob, msg.generated!.fileName)}
                        title="Download image file to your device"
                        data-testid="button-download-image"
                      >
                        <Download size={13} />
                        Download
                      </Button>

                      {!isLimitedGuest && (
                        <Button
                          variant="outline"
                          onClick={() => void handleSaveToLibrary(msg.generated!)}
                          title="Save image to local workspace library"
                          data-testid="button-save-image"
                        >
                          <Save size={13} />
                          Save to Library
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => void triggerGeneration(msg.content)}
                        disabled={generating}
                        title="Generate a new variation with the same prompt"
                        data-testid="button-regenerate-image"
                      >
                        <RotateCw size={13} />
                        Regenerate
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setActiveReferenceId(msg.id);
                          setPromptInput('Make the lighting warmer');
                        }}
                        data-testid="button-refine-image"
                      >
                        <Sliders size={13} />
                        Refine
                      </Button>
                    </div>

                    {/* Technical details accordion */}
                    <details className="text-[11px] text-slate-500 pt-1">
                      <summary className="cursor-pointer hover:text-slate-300">
                        View synthesized prompt details
                      </summary>
                      <div className="mt-2 rounded-lg bg-black/20 p-2.5 font-mono text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed border border-white/[.05]">
                        {msg.effectivePrompt}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-up Chips when an image is ready */}
      {messages.some((m) => m.status === 'completed') && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] font-medium text-slate-500">Refinement ideas:</span>
          {SUGGESTED_REFINEMENTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPromptInput(chip)}
              className="rounded-full border border-white/10 bg-[#15171e] px-2.5 py-0.5 text-[11px] text-slate-300 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white transition"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Conversational Prompt Input */}
      <form onSubmit={handleFormSubmit} className="space-y-3">
        <div className="relative rounded-2xl border border-white/15 bg-[#15171e] p-2 focus-within:border-violet-500 transition shadow-xl">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (promptInput.trim() && !generating) {
                  void triggerGeneration(promptInput.trim());
                }
              }
            }}
            placeholder={
              activeReferenceMessage
                ? `Follow-up on reference (e.g. "make the lighting warmer", "put in futuristic city")...`
                : 'Describe the image you want to create (e.g. "portrait of an astronaut in a lush alien greenhouse")...'
            }
            className={`${areaCls} min-h-20 border-0 bg-transparent p-2 focus:ring-0 text-sm`}
            disabled={generating || (!capable && !capsLoading)}
            data-testid="input-image-conversation-prompt"
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/[.05] px-2">
            <span className="text-[11px] text-slate-500">
              Press <kbd className="font-mono bg-white/10 px-1 rounded text-[10px]">Enter</kbd> to send,{' '}
              <kbd className="font-mono bg-white/10 px-1 rounded text-[10px]">Shift+Enter</kbd> for line
            </span>

            <div className="flex items-center gap-2">
              {generating && (
                <Button
                  variant="outline"
                  onClick={() => generationAbort.current?.abort()}
                >
                  Stop
                </Button>
              )}
              <Button
                type="submit"
                disabled={
                  generating ||
                  !promptInput.trim() ||
                  (!capable && !capsLoading) ||
                  (isLimitedGuest && guestImagesRemaining <= 0)
                }
                data-testid="button-send-image-prompt"
              >
                {generating ? 'Generating…' : 'Generate'}
                <Send size={13} />
              </Button>
            </div>
          </div>
        </div>
      </form>

      {!isLimitedGuest && <AssetHistory kind="image" notify={note} />}

      {/* Consent Modal */}
      {showConsentModal && (
        <CloudImageConsentModal
          onConsentGranted={handleConsentApproved}
          onCancel={handleConsentCancelled}
        />
      )}

      {/* Character Profiles Modal */}
      {showCharacterModal && (
        <CharacterProfilesModal
          profiles={characterProfiles}
          activeProfileId={activeProfile?.id}
          onSelectProfile={setActiveProfile}
          onProfilesChanged={() => loadCharacterProfiles().then(setCharacterProfiles)}
          onClose={() => setShowCharacterModal(false)}
        />
      )}
    </div>
  );
}
