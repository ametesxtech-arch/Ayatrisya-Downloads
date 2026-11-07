import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  ArrowDown, Check, Copy, RefreshCw, MoreHorizontal, Mic, Paperclip, Pencil,
  Send, Square, Trash2, X, Sparkles, ArrowUpRight, Code2, Lightbulb,
  ShieldCheck, Archive, HelpCircle, Radio, Image as ImageIcon, Flame, Smile, MessageSquare, ExternalLink,
  FileText, Presentation, FileArchive, ChevronDown, ChevronUp, Play
} from 'lucide-react';
import { downloadDocx } from '@/lib/docx-export';
import { downloadPdf } from '@/lib/pdf-export';
import { downloadZip } from '@/lib/zip-export';


import { Button, ConfirmDialog, IconButton, Modal, Notice, Skeleton, LoadError } from '@/components/Primitives';
import { AttachmentChip, AttachmentThumbnail } from '@/components/AttachmentPreview';
import { ChatInlineImage } from '@/components/ChatInlineImage';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { modelClient } from '@/ai/client';
import { applyPersonalization } from '@/ai/personalization';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { MAX_UPLOAD, ago, errMsg, formatBytes } from '@/lib/format';
import { ActionMenu } from '@/components/Menus';
import { useConvActions } from '@/hooks/use-conv-actions';
import type { ChatMode, Message } from '@/storage/types';
import type { MessageAttachment } from '@/ai/types';
import { MotionText } from '@/components/MotionText';
import { CanvasProvider, useCanvas } from '@/components/canvas/CanvasContext';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';
import { VoiceInputButton, MessageTtsButton, SpeechToSpeechModal } from '@/components/voice';
import { parseScheduleRequest } from '@/lib/scheduled-tasks/schedule-parser';
import { hasModelConsent, grantModelConsent } from '@/lib/model-consent';
import { hasCloudImageConsent } from '@/features/image-studio/consent';
import { CloudImageConsentModal } from '@/features/image-studio/CloudImageConsentModal';
import { detectImageRequest } from '@/lib/image-intent';
import { MemoryEngine } from '@/storage/memory-engine';
import { KnowledgeBaseEngine } from '@/storage/knowledge-engine';
import { AIMemorySummaryEngine } from '@/storage/ai-memory-summary-engine';
import { ChromaticButton } from '@/components/chromatic-button';

type Turn = Array<{ role: 'user' | 'assistant'; content: string; attachments?: MessageAttachment[] }>;

const starters = [
  { label: 'Explain a concept', prompt: 'Explain a concept I am trying to understand: ', icon: Lightbulb },
  { label: 'Generate an image', prompt: '/image A cinematic cyberpunk landscape with glowing neon: ', icon: Sparkles },
  { label: 'Quiz my knowledge', prompt: 'Give me an interactive quiz or multiple-choice test on: ', icon: HelpCircle },
  { label: 'Help me write', prompt: 'Help me write a clear first draft about: ', icon: Pencil },
  { label: 'Debug my code', prompt: 'Help me debug this code. I will share the code and what I expected: ', icon: Code2 },
];

const CHAT_MODES: Array<{ id: ChatMode; label: string; icon: typeof MessageSquare; desc: string }> = [
  { id: 'Normal', label: 'Normal', icon: MessageSquare, desc: 'Helpful, balanced, accurate, professional' },
  { id: 'Savage', label: 'Savage', icon: Flame, desc: 'Witty, bold, sharp, playful sarcasm & roasts' },
  { id: 'Joke', label: 'Joke', icon: Smile, desc: 'Humorous, playful banter, punchlines & fun' },
];

export function ChatPage(props: { path: string; goto: (h: string) => void; notify: (m: string) => void }) {
  return (
    <CanvasProvider>
      <ChatContent {...props} />
    </CanvasProvider>
  );
}

function ChatContent({ path, goto, notify }: { path: string; goto: (h: string) => void; notify: (m: string) => void }) {
  const id = path.startsWith('/workspace/chat/') ? path.split('/')[3] : null;
  const { prefs, save: savePrefs } = usePrefs();
  const studioWidth = prefs.workspaceMode === 'studio';
  const { caps } = useCaps();
  const { user, guest } = useAuth();
  const uid = guest ? 'guest' : user?.uid ?? 'signed-out';
  const savingRef = useRef(false), runningRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const cap = caps.find((c) => c.id === prefs.model);
  const available = !!cap?.available;
  const msgs = useLocalQuery<Message[]>(() => (id ? repository.getMessages(id) : Promise.resolve([])), [id]);
  const conv = useLocalQuery(() => (id ? repository.getConversation(id) : Promise.resolve(undefined)), [id]);
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const canvas = useCanvas();
  const [showStsModal, setShowStsModal] = useState(false);
  const [text, setText] = useState(''), [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [stream, setStream] = useState(''), [streamFor, setStreamFor] = useState<string | null>(null), [error, setError] = useState('');
  const [consent, setConsent] = useState(() => hasModelConsent()), [ask, setAsk] = useState<{ cid: string; history: Turn; after?: () => Promise<void> } | null>(null), [remember, setRemember] = useState(true);
  const [showImageConsent, setShowImageConsent] = useState(false);
  const [pendingImageGen, setPendingImageGen] = useState<{ cid: string; prompt: string; userMessageId?: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null), [confirmDel, setConfirmDel] = useState(false), [renaming, setRenaming] = useState<string | null>(null), [delMsg, setDelMsg] = useState<Message | null>(null), [resubmit, setResubmit] = useState<{ m: Message; text: string } | null>(null), [copied, setCopied] = useState<string | null>(null), [atBottom, setAtBottom] = useState(true);
  const streamRef = useRef('');

  // Per-conversation mode: initialize from conversation record if present, otherwise fallback to global prefs
  const activeMode: ChatMode = (conv.data?.mode as ChatMode | undefined) || prefs.mode || 'Normal';

  const acts = useConvActions({ notify, goto, onDeleted: () => goto('/workspace') });
  const abortRef = useRef<AbortController | null>(null), jobIdRef = useRef<string | null>(null), retryRef = useRef<{ cid: string; history: Turn } | null>(null), endRef = useRef<HTMLDivElement>(null), fileRef = useRef<HTMLInputElement>(null), taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (jobIdRef.current) modelClient.cancelJob(jobIdRef.current);
  }, [uid]);

  const list = msgs.data ?? [];

  useEffect(() => {
    const main = document.getElementById('main'); if (!main) return;
    const f = () => setAtBottom(main.scrollHeight - main.scrollTop - main.clientHeight < 120);
    f(); main.addEventListener('scroll', f, { passive: true });
    return () => main.removeEventListener('scroll', f);
  }, []);

  const atBottomRef = useRef(true); atBottomRef.current = atBottom;
  useEffect(() => { if (atBottomRef.current) endRef.current?.scrollIntoView({ block: 'end' }); }, [list.length, stream]);

  useEffect(() => {
    const t = taRef.current; if (!t) return;
    const fit = () => { t.style.height = 'auto'; t.style.height = `${Math.min(Math.max(t.scrollHeight, 36), 200)}px`; };
    fit();
    window.addEventListener('resize', fit);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(t.parentElement!);
    return () => { window.removeEventListener('resize', fit); ro?.disconnect(); };
  }, [text]);

  const setConversationMode = async (newMode: ChatMode) => {
    if (id) {
      try {
        await repository.updateConversation(id, { mode: newMode });
        notify(`Chat mode switched to ${newMode}.`);
      } catch (e) {
        notify(errMsg(e, 'Could not update conversation mode.'));
      }
    } else {
      void savePrefs({ mode: newMode });
      notify(`Default chat mode set to ${newMode}.`);
    }
  };

  /** Executes image generation through Ayatrisya Vision Engine with consent verification */
  async function executeImageGeneration(cid: string, imgPrompt: string, userFacingLabel?: string) {
    if (!hasCloudImageConsent()) {
      setPendingImageGen({ cid, prompt: imgPrompt });
      setShowImageConsent(true);
      return;
    }

    if (runningRef.current) return;
    runningRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true); setStreamFor(cid); setStream('🎨 Generating image with Ayatrisya Vision Engine...'); setError('');

    try {
      const job = modelClient.submitJob({
        kind: 'asset',
        assetKind: 'image',
        prompt: imgPrompt,
        options: {
          model: prefs.model,
          format: 'PNG',
          signal: ac.signal,
        },
      });
      jobIdRef.current = job.id;
      const asset = await job.result;
      const file = new File([asset.blob], asset.fileName, { type: asset.blob.type });
      const saved = await repository.addFile(file, null, cid);
      const displayLabel = userFacingLabel || imgPrompt;
      const outText = `Generated image for **"${displayLabel}"**:\n\n*Format: ${asset.blob.type === 'image/jpeg' ? 'JPEG' : 'PNG'} · Size: ${formatBytes(asset.blob.size)}*`;
      if (!ac.signal.aborted) {
        await repository.addMessage(cid, outText, 'assistant', [saved.id]);
      }
      retryRef.current = null;
    } catch (e) {
      setError(ac.signal.aborted ? 'Image generation stopped.' : errMsg(e, 'Image generation failed.'));
    } finally {
      runningRef.current = false; setBusy(false); setStream(''); setStreamFor(null);
      abortRef.current = null; jobIdRef.current = null;
    }
  }

  async function run(cid: string, history: Turn) {
    if (runningRef.current) return;
    const latestTurn = history[history.length - 1];

    // Detect explicit (/image), natural language, or multi-turn conversational follow-up image requests
    const imageIntent = latestTurn?.content ? detectImageRequest(latestTurn.content, history.slice(0, -1)) : null;
    if (imageIntent && imageIntent.isImageRequest) {
      await executeImageGeneration(cid, imageIntent.cleanPrompt, imageIntent.userFacingLabel);
      return;
    }

    runningRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac; retryRef.current = { cid, history };
    streamRef.current = '';
    setBusy(true); setStreamFor(cid); setStream(''); setError('');
    try {
      // Retrieve relevant AI memories & structured memory summary (if memory is enabled)
      let memorySummaryText = '';
      let relevantMemories: Array<{ content: string; category?: string; pinned?: boolean }> = [];
      if (prefs.personalization.enabled && prefs.personalization.useMemory && latestTurn?.content) {
        try {
          const summaryEngine = new AIMemorySummaryEngine(repository);
          const summaryRecord = await summaryEngine.getSummary();
          if (summaryRecord) {
            memorySummaryText = summaryEngine.formatSummaryForPrompt(summaryRecord, 1500);
          }
          const memEngine = new MemoryEngine(repository);
          const retrieved = await memEngine.retrieveContext(latestTurn.content, { maxTokens: 400 });
          relevantMemories = retrieved.map((m) => ({
            content: m.content,
            category: m.category,
            pinned: m.pinned,
          }));
        } catch {
          // Graceful fallback: continue without memory context if retrieval fails
        }
      }

      // Retrieve relevant Knowledge Base documents if user query mentions or asks knowledge questions
      let knowledgePassages: Array<{ text: string; citation: string }> = [];
      if (latestTurn?.content && !latestTurn.content.startsWith('/')) {
        try {
          const kbEngine = new KnowledgeBaseEngine(repository);
          const kbs = await kbEngine.listKnowledgeBases();
          if (kbs.length > 0) {
            // Check top active knowledge base for matching query terms
            const matches = await kbEngine.searchKnowledgeBase(kbs[0].id, latestTurn.content, { maxMatches: 2 });
            knowledgePassages = matches.map((m) => ({
              text: m.chunk.text,
              citation: m.citation,
            }));
          }
        } catch {
          // Graceful fallback
        }
      }

      const job = modelClient.submitJob({
        kind: "chat",
        messages: applyPersonalization(history, prefs.personalization, {
          memories: relevantMemories,
          memorySummary: memorySummaryText,
          knowledgePassages,
        }),
        options: {
          model: prefs.model,
          mode: activeMode,
          signal: ac.signal,
          onToken: (t: string) => {
            streamRef.current += t;
            setStream(streamRef.current);
          },
          attachments: latestTurn?.attachments,
        },
      });
      jobIdRef.current = job.id;
      const out = await job.result;
      let finalOut = out;
      if (latestTurn?.content) {
        const scheduleIntent = parseScheduleRequest(latestTurn.content);
        if (scheduleIntent.isScheduleIntent && scheduleIntent.task && !finalOut.includes('"scheduled_task"')) {
          const blockJson = JSON.stringify({
            version: '1.0',
            type: 'scheduled_task',
            task: scheduleIntent.task,
          }, null, 2);
          finalOut = `${finalOut.trim()}\n\n\`\`\`interactive\n${blockJson}\n\`\`\``;
        }

        const wantsCanvas = /\b(in\s+canvas|open\s+canvas|create\s+in\s+canvas|code\s+canvas|canvas\s+panel|do\s+in\s+canvas|make\s+in\s+canvas|canvas)\b/i.test(latestTurn.content);
        if (wantsCanvas) {
          const codeMatch = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/.exec(finalOut);
          const rawExt = (codeMatch ? codeMatch[1] : 'ts').toLowerCase();
          const code = codeMatch ? codeMatch[2] : '// Project opened in Canvas\nconsole.log("Canvas ready");';
          const extMap: Record<string, string> = {
            typescript: 'ts',
            javascript: 'js',
            python: 'py',
            html: 'html',
            css: 'css',
            json: 'json',
            markdown: 'md',
            rust: 'rs',
            go: 'go',
            sql: 'sql',
          };
          const extension = extMap[rawExt] || (rawExt.length <= 4 && rawExt !== 'code' ? rawExt : 'ts');
          const canvasFilename = `project-${Date.now().toString().slice(-4)}.${extension}`;
          
          canvas.openCanvas({
            name: canvasFilename,
            content: code,
            language: rawExt !== 'code' && rawExt ? rawExt : 'typescript',
          });
          
          // Automatically launch dedicated full-screen Canvas IDE tab
          window.open('/workspace/canvas', '_blank');

          // Append an inline interactive launcher block into chat
          if (!finalOut.includes('/workspace/canvas')) {
            finalOut += `\n\n---\n🚀 **Canvas IDE Active:** Opened \`${canvasFilename}\` in Canvas. [Open Fullscreen Canvas IDE](/workspace/canvas)`;
          }
        }
      }
      if (finalOut.trim() && !ac.signal.aborted) {
        await repository.addMessage(cid, finalOut, 'assistant');
        if (prefs.personalization.enabled && prefs.personalization.useMemory && latestTurn?.content) {
          void (async () => {
            try {
              const summaryEngine = new AIMemorySummaryEngine(repository);
              await summaryEngine.processNewTurn(latestTurn.content, finalOut, cid);
            } catch (err) {
              console.warn('[AI Memory] Auto-summarization turn processing notice:', err);
            }
          })();
        }
      }
      retryRef.current = null;
    } catch (e) {
      if (ac.signal.aborted && streamRef.current.trim()) {
        const partial = `${streamRef.current.trim()}\n\n*[Response generation was stopped by user]*`;
        void repository.addMessage(cid, partial, 'assistant');
        streamRef.current = '';
      }
      setError(ac.signal.aborted ? 'Generation stopped. Partial response preserved.' : errMsg(e, 'The model request failed.'));
    }
    finally { runningRef.current = false; setBusy(false); setStream(''); setStreamFor(null); abortRef.current = null; jobIdRef.current = null; }
  }

  function stop() {
    if (jobIdRef.current) modelClient.cancelJob(jobIdRef.current);
    abortRef.current?.abort();
  }

  const copyEntireConversation = async () => {
    if (!list.length) return;
    const formatted = list
      .map((m) => {
        const sender = m.role === 'user' ? 'User' : 'Ayatrisya';
        const time = new Date(m.createdAt).toLocaleString();
        return `[${time}] ${sender}:\n${m.content}\n`;
      })
      .join('\n---\n\n');
    try {
      await navigator.clipboard.writeText(formatted);
      notify('Entire conversation copied to clipboard!');
    } catch {
      notify('Copy was blocked by the browser.');
    }
  };

  const openSts = async () => {
    let targetId = id;
    if (!targetId) {
      try {
        const newConv = await repository.createConversation('Voice Conversation', activeMode);
        targetId = newConv.id;
        goto(`/workspace/chat/${targetId}`);
      } catch (e) {
        notify(errMsg(e, 'Could not start voice session.'));
        return;
      }
    }
    setShowStsModal(true);
  };

  async function send(overrideText?: string) {
    const body = (typeof overrideText === 'string' ? overrideText : text).trim();
    if ((!body && !files.length) || busy || ask || savingRef.current || runningRef.current) return;
    savingRef.current = true; setSaving(true);
    setError('');
    try {
      let cid = id;
      if (!cid) cid = (await repository.createConversation((body || files[0].name).slice(0, 48), activeMode)).id;
      const ids: string[] = [];
      const msgAttachments: MessageAttachment[] = [];

      for (const f of files) {
        ids.push((await repository.addFile(f, null, cid)).id);

        if (f.type.startsWith('image/')) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(f);
            });
            const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
            msgAttachments.push({
              name: f.name,
              mimeType: f.type || 'image/jpeg',
              dataBase64: base64,
              size: f.size,
            });
          } catch {}
        } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(f);
            });
            const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
            msgAttachments.push({
              name: f.name,
              mimeType: 'application/pdf',
              dataBase64: base64,
              size: f.size,
            });
          } catch {}
        } else if (
          f.type.startsWith('text/') ||
          /\.(txt|md|csv|json|ts|tsx|js|jsx|py|html|css|yaml|yml|xml|sql|rs|go|c|cpp|h)$/i.test(f.name)
        ) {
          try {
            const textContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(f);
            });
            msgAttachments.push({
              name: f.name,
              mimeType: f.type || 'text/plain',
              textContent,
              size: f.size,
            });
          } catch {}
        } else {
          msgAttachments.push({
            name: f.name,
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
          });
        }
      }

      const content = body || (files.length === 1 ? `Attached: ${files[0].name}` : `Attached: ${files.map((f) => f.name).join(', ')}`);
      await repository.addMessage(cid, content, 'user', ids);
      const history: Turn = [
        ...list.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content, attachments: msgAttachments.length > 0 ? msgAttachments : undefined },
      ];
      setText(''); setFiles([]);
      if (!id) goto(`/workspace/chat/${cid}`);

      // Check if this is an image request (including conversational continuations)
      const imageIntent = detectImageRequest(content, list);
      if (imageIntent.isImageRequest) {
        if (!hasCloudImageConsent()) {
          setPendingImageGen({ cid, prompt: imageIntent.cleanPrompt });
          setShowImageConsent(true);
        } else {
          void executeImageGeneration(cid, imageIntent.cleanPrompt, imageIntent.userFacingLabel);
        }
        return;
      }

      if (available) {
        if (hasModelConsent() || consent) void run(cid, history); else setAsk({ cid, history });
      } else {
        const scheduleIntent = parseScheduleRequest(content);
        if (scheduleIntent.isScheduleIntent && scheduleIntent.task) {
          const blockJson = JSON.stringify({
            version: '1.0',
            type: 'scheduled_task',
            task: scheduleIntent.task,
          }, null, 2);
          const out = `I have interpreted your schedule request. Please review the details below and click **Activate Schedule** to enable it:\n\n\`\`\`interactive\n${blockJson}\n\`\`\``;
          await repository.addMessage(cid, out, 'assistant');
        }
      }
    } catch (e) { setError(errMsg(e, 'Could not save your message locally.')); }
    finally { savingRef.current = false; setSaving(false); }
  }

  function pick(fl: FileList | null) {
    const ok: File[] = [];
    for (const f of Array.from(fl ?? [])) { if (f.size > MAX_UPLOAD) notify(`${f.name} is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_UPLOAD)}.`); else ok.push(f); }
    setFiles((p) => [...p, ...ok]); if (fileRef.current) fileRef.current.value = '';
  }

  const attMap = new Map((atts.data ?? []).map((a) => [a.id, a]));
  const lastUserUnanswered = (m: Message, i: number) => m.role === 'user' && !list.slice(i + 1).some((x) => x.role === 'assistant');

  // Find user prompt corresponding to an assistant image message
  const getPromptForAssistantMessage = (index: number): string => {
    for (let j = index - 1; j >= 0; j--) {
      if (list[j].role === 'user') return list[j].content;
    }
    return '';
  };

  const currentModeObj = CHAT_MODES.find((m) => m.id === activeMode) || CHAT_MODES[0];
  const CurrentModeIcon = currentModeObj.icon;

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      <div className="chat-page flex flex-col flex-1 min-h-0 h-full min-w-0 transition-all duration-200">
        <div className="chat-conversation-bar flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs text-slate-500 border-b border-white/[.05] bg-[#121319]/60 backdrop-blur-sm overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Persistent, clearly visible Chat Mode Selector */}
            <div className="flex items-center rounded-lg border border-white/10 bg-white/[.03] p-0.5 shrink-0" data-testid="chat-mode-selector">

              {CHAT_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => void setConversationMode(mode.id)}
                    title={`${mode.label} Mode: ${mode.desc}`}
                    data-testid={`mode-tab-${mode.id.toLowerCase()}`}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      isSelected
                        ? mode.id === 'Savage'
                          ? 'bg-rose-500/20 text-rose-300 shadow-sm border border-rose-500/30'
                          : mode.id === 'Joke'
                            ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                            : 'bg-violet-500/20 text-violet-200 shadow-sm border border-violet-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[.05]'
                    }`}
                  >
                    <Icon size={12} className={isSelected ? 'animate-pulse' : ''} />
                    <span className="shrink-0 whitespace-nowrap">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="quiet"
              onClick={() => {
                window.open('/workspace/canvas', '_blank');
              }}
              data-testid="button-toggle-canvas"
              title="Open full-screen Canvas IDE in a dedicated workspace tab"
              className="whitespace-nowrap text-xs h-7 px-2"
            >
              <Code2 size={13} className="text-violet-300" />
              <span className="hidden sm:inline">Canvas IDE</span>
              <ExternalLink size={10} className="text-slate-400 ml-0.5 hidden sm:inline" />
            </Button>
            <Button variant="quiet" onClick={openSts} data-testid="button-header-sts" title="Start real-time Voice Conversation" className="whitespace-nowrap text-xs h-7 px-2">
              <Radio size={13} className="text-violet-300 animate-pulse" />
              <span className="hidden sm:inline">Voice</span>
            </Button>
            {list.length > 0 && (
              <Button
                variant="quiet"
                onClick={copyEntireConversation}
                data-testid="button-copy-conversation"
                title="Copy entire conversation formatted to clipboard"
                className="whitespace-nowrap text-xs h-7 px-2"
              >
                <Copy size={13} className="text-slate-300" />
                <span className="hidden sm:inline">Copy chat</span>
              </Button>
            )}
            {id && !guest && <>
              <Button variant="quiet" onClick={() => setRenaming(conv.data?.title ?? '')} className="whitespace-nowrap text-xs h-7 px-2">
                <Pencil size={13} />
                <span className="hidden sm:inline">Rename</span>
              </Button>
              <Button variant="quiet" onClick={() => setConfirmDel(true)} className="whitespace-nowrap text-xs h-7 px-2">
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete</span>
              </Button>
              {conv.data && <ActionMenu label="More conversation actions" items={acts.items(conv.data)}><MoreHorizontal size={15} /></ActionMenu>}
            </>}
          </div>
        </div>

        <div className={`chat-content mx-auto w-full ${studioWidth ? 'max-w-[1060px]' : 'max-w-[820px]'} flex-1 min-h-0 overflow-y-auto px-4 pb-8 pt-7 sm:px-7 sm:pt-10`}>
          {id && msgs.loading && !msgs.data && <div className="space-y-7 pt-8" role="status" aria-label="Loading conversation"><Skeleton className="h-20 w-3/5" /><Skeleton className="ml-auto h-16 w-2/5" /><Skeleton className="h-24 w-4/5" /></div>}
          {msgs.error && <LoadError message={msgs.error} retry={msgs.refresh} />}
          {id && conv.data === undefined && !conv.loading && !conv.error && <Notice>This conversation was not found in this browser. <Link href="/workspace" className="underline">Start a new chat</Link>.</Notice>}
          {(!id || (msgs.data && list.length === 0)) && <section className="chat-welcome reveal" aria-labelledby="welcome-title" data-testid="empty-chat-welcome">
            <div className="chat-welcome-mark" aria-hidden><Sparkles size={19} /></div>
            <p className="chat-kicker"><span /> A space to think clearly</p>
            <h2 id="welcome-title" className="display"><MotionText>{prefs.displayName ? `Good to see you, ${prefs.displayName}.` : 'Where should we start?'}</MotionText></h2>
            <p className="chat-welcome-copy">Bring a question, a creative prompt, or a problem to solve. Current mode: <span className="font-semibold text-violet-300">{currentModeObj.label}</span> ({currentModeObj.desc}).</p>
            {!available && <div className="chat-model-notice" data-testid="status-model-unavailable"><span className="chat-notice-indicator" aria-hidden /><div><b>{prefs.model === 'v1-fast' ? 'V1 Fast' : 'V2 Best Result'} is unavailable.</b><p>{cap?.reason ?? 'No model connection is configured for this deployment.'} You can still write and save {guest ? 'chats in this browser' : 'messages and drafts'}.{!guest && <> <Link href="/workspace/settings" className="underline" data-testid="link-model-settings">Review model status</Link> · <Link href="/workspace/models" className="underline font-semibold text-violet-300">Models & Engines setup</Link></>}</p></div></div>}
            <div className="chat-starter-grid" aria-label="Prompt suggestions">{starters.map(({ label, prompt, icon: Icon }, index) => <button key={label} type="button" data-testid={`button-prompt-${index + 1}`} onClick={() => { setText(prompt); taRef.current?.focus(); }} className="chat-starter"><span className="chat-starter-icon"><Icon size={15} /></span><span>{label}</span><ArrowUpRight size={13} className="chat-starter-arrow" aria-hidden /></button>)}</div>
          </section>}
          <ul className="chat-message-list" aria-label="Conversation messages">
            {list.map((m, i) => <li key={m.id} className={`chat-message chat-message-${m.role}`} data-testid={`message-${m.id}`}>
              <div className="chat-message-inner">
              <div className={`chat-avatar chat-avatar-${m.role}`} aria-hidden>{m.role === 'user' ? 'You' : <Sparkles size={15} />}</div>
              <div className="chat-message-body">
              <div className="chat-message-label flex items-center gap-2">
                <span>{m.role === 'user' ? 'You' : 'Ayatrisya'}</span>
                <span className="text-[10px] font-normal text-slate-500" data-testid={`message-timestamp-${m.id}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {editing?.id === m.id ? <div className="w-full"><label className="sr-only" htmlFor="edit-msg">Edit message</label><textarea id="edit-msg" data-testid="input-edit-message" data-autofocus value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} className="chat-edit-area" />
                <div className="mt-2 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)} data-testid="button-cancel-edit">Cancel</Button><Button onClick={async () => { try { await repository.editMessage(m.id, editing.text); setEditing(null); } catch (e) { notify(errMsg(e)); } }} data-testid="button-save-edit">Save edit</Button><Button disabled={!available || busy || !editing.text.trim()} title={available ? undefined : 'Resubmitting needs a connected model'} onClick={() => setResubmit({ m, text: editing.text })} data-testid="button-resubmit-edit">{available ? 'Save and resubmit' : 'Resubmit unavailable'}</Button></div></div>
                : <div className={m.role === 'user' ? 'chat-user-content' : 'chat-prose prose prose-invert prose-sm max-w-none'}>
                    <MarkdownRenderer content={m.content} messageId={m.id} />

                  {/* Render generated images and attachments */}
                  {m.attachmentIds.length > 0 && <div className="mt-3 flex flex-col gap-2">
                    {m.attachmentIds.map((a) => {
                      const att = attMap.get(a);
                      if (!att) return null;
                      if (att.mimeType.startsWith('image/')) {
                        const originatingPrompt = m.role === 'assistant' ? getPromptForAssistantMessage(i) : undefined;
                        return (
                          <ChatInlineImage
                            key={a}
                            attachment={att}
                            promptText={originatingPrompt}
                            onRegenerate={m.role === 'assistant' && originatingPrompt ? () => {
                              void executeImageGeneration(id || conv.data?.id || 'current', originatingPrompt);
                            } : undefined}
                            onRefine={(refinePrefix) => {
                              setText(refinePrefix);
                              taRef.current?.focus();
                            }}
                            notify={notify}
                          />
                        );
                      }
                      return <AttachmentChip key={a} attachment={att} />;
                    })}
                  </div>}
                </div>}
              <div className="chat-message-actions flex flex-wrap items-center gap-1.5 min-h-[36px] mt-2 mb-1 text-slate-400">
                {m.role === 'user' && lastUserUnanswered(m, i) && !busy && <span data-testid="status-not-sent">{available ? 'No reply recorded' : 'Saved locally, not sent to any model'}</span>}
                {m.role === 'assistant' && <MessageTtsButton content={m.content} messageId={m.id} />}
                
                {/* Instant Docx / PDF / Zip Export for any AI message in chat */}
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadDocx(`Ayatrisya_${m.id.slice(0, 6)}`, m.content)}
                      className="flex items-center gap-1 rounded border border-white/[.08] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.07] hover:text-white shrink-0 whitespace-nowrap min-w-max transition-colors"
                      title="Export as Word (.docx)"
                      data-testid={`button-export-docx-${m.id}`}
                    >
                      <FileText size={12} className="text-blue-400 shrink-0" />
                      <span>.docx</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPdf(`Ayatrisya_${m.id.slice(0, 6)}`, m.content)}
                      className="flex items-center gap-1 rounded border border-white/[.08] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.07] hover:text-white shrink-0 whitespace-nowrap min-w-max transition-colors"
                      title="Export as PDF"
                      data-testid={`button-export-pdf-${m.id}`}
                    >
                      <FileText size={12} className="text-red-400 shrink-0" />
                      <span>.pdf</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadZip(`Ayatrisya_${m.id.slice(0, 6)}`, [
                        { path: `response-${m.id.slice(0, 6)}.md`, data: m.content }
                      ])}
                      className="flex items-center gap-1 rounded border border-white/[.08] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.07] hover:text-white shrink-0 whitespace-nowrap min-w-max transition-colors"
                      title="Export as .ZIP package"
                      data-testid={`button-export-zip-${m.id}`}
                    >
                      <FileArchive size={12} className="text-amber-400 shrink-0" />
                      <span>.zip</span>
                    </button>
                  </div>
                )}

                <IconButton label={copied === m.id ? 'Copied' : 'Copy message'} onClick={() => navigator.clipboard.writeText(m.content).then(() => { setCopied(m.id); window.setTimeout(() => setCopied(null), 1600); }, () => notify('Copy was blocked by the browser.'))} className="shrink-0 size-8" data-testid={`button-copy-message-${m.id}`}>{copied === m.id ? <Check size={13} className="text-teal-300" /> : <Copy size={13} />}</IconButton>
                {m.role === 'user' && <IconButton label="Edit message" onClick={() => setEditing({ id: m.id, text: m.content })} className="shrink-0 size-8" data-testid={`button-edit-message-${m.id}`}><Pencil size={13} /></IconButton>}
                {m.role === 'assistant' && i === list.length - 1 && (
                  <button
                    type="button"
                    disabled={!available || busy}
                    title="Continue generation from where it stopped"
                    aria-label="Continue generation"
                    data-testid={`button-continue-generation`}
                    onClick={() => {
                      const history: Turn = [
                        ...list.map((x) => ({ role: x.role, content: x.content })),
                        { role: 'user', content: 'Please continue from where you left off.' }
                      ];
                      const go = async () => {
                        void run(id!, history);
                      };
                      if (hasModelConsent() || consent) void go();
                      else setAsk({ cid: id!, history, after: go });
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium text-teal-300 hover:bg-teal-500/20 transition-colors disabled:opacity-40 shrink-0 whitespace-nowrap min-w-max"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Continue</span>
                  </button>
                )}
                {m.role === 'assistant' && i === list.length - 1 && <button type="button" disabled={!available || busy} title={available ? 'Regenerate this reply' : 'Regeneration needs a connected model'} aria-label={available ? 'Regenerate reply' : 'Regenerate unavailable: no model connected'} data-testid={`button-regenerate-${m.id}`} onClick={() => { const history: Turn = list.slice(0, i).map((x) => ({ role: x.role, content: x.content })); const go = async () => { try { await repository.deleteMessage(m.id); void run(id!, history); } catch (e) { notify(errMsg(e)); } }; if (hasModelConsent() || consent) void go(); else setAsk({ cid: id!, history, after: go }); }} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] hover:text-slate-100 transition-colors disabled:opacity-40 shrink-0"><RefreshCw size={13} /></button>}
                <IconButton label="Delete message" onClick={() => setDelMsg(m)} className="shrink-0 size-8" data-testid={`button-delete-message-${m.id}`}>{copied === m.id ? <Check size={13} className="text-teal-300" /> : <Trash2 size={13} />}</IconButton>
              </div>
              </div></div>
            </li>)}
            {streamFor === id && busy && <li className="chat-message chat-message-assistant" data-testid="status-generation"><div className="chat-message-inner"><div className="chat-avatar chat-avatar-assistant" aria-hidden><Sparkles size={15} /></div><div className="chat-message-body"><div className="chat-message-label">Ayatrisya</div><div className="chat-prose prose prose-invert prose-sm max-w-none" aria-live="polite">{stream ? <MarkdownRenderer content={stream} messageId="streaming" isStreaming={busy} /> : <p className="chat-thinking" role="status"><span className="chat-thinking-orbit" aria-hidden><i /><i /><i /></span><span><b>Thinking</b><small>Waiting for the model. No response has arrived yet.</small></span></p>}</div></div></div></li>}
          </ul>
          {error && <div role="alert" className="chat-error" data-testid="status-chat-error"><span>{error}</span>{retryRef.current && !busy && <Button variant="outline" onClick={() => retryRef.current && ((hasModelConsent() || consent) ? void run(retryRef.current.cid, retryRef.current.history) : setAsk(retryRef.current))} data-testid="button-retry">Retry</Button>}</div>}
          <div ref={endRef} />
        </div>
        <div className="chat-composer-dock safe-b shrink-0 z-10 sticky bottom-0 bg-[#101116]/80 backdrop-blur-md px-3 pt-3 pb-3 sm:px-6">
          <div className={`chat-composer-wrap mx-auto ${studioWidth ? 'max-w-[1060px]' : 'max-w-[820px]'}`}>
            {id && !available && <p className="chat-model-footnote" data-testid="status-model-local-only">Selected model unavailable. New messages are saved locally and not sent.</p>}
            {files.length > 0 && <div className="chat-attachments" data-testid="list-pending-attachments">{files.map((f, i) => <span key={`${f.name}-${i}`} className="chat-attachment"><Paperclip size={13} /><span className="truncate">{f.name}</span><span className="shrink-0">{formatBytes(f.size)}</span><button type="button" aria-label={`Remove ${f.name}`} data-testid={`button-remove-attachment-${i}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button></span>)}<span className="chat-attachment-note">Attachments will be analyzed by Ayatrisya's vision and document engine when you send.</span></div>}
            <div className="chat-composer flex flex-col p-2.5 sm:p-2 rounded-2xl relative shadow-xl" data-testid="chat-composer">
              {/* TOP: Full-width Textarea */}
              <div className="w-full flex-1 min-h-[44px]">
                <label className="sr-only" htmlFor="composer">Message</label>
                <textarea
                  id="composer"
                  ref={taRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (items) {
                      const pastedFiles: File[] = [];
                      for (const it of Array.from(items)) {
                        if (it.type.startsWith('image/')) {
                          const f = it.getAsFile();
                          if (f) pastedFiles.push(f);
                        }
                      }
                      if (pastedFiles.length > 0) {
                        setFiles((prev) => [...prev, ...pastedFiles]);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && (prefs.enterToSend ? !e.shiftKey : (e.ctrlKey || e.metaKey))) {
                      e.preventDefault();
                      if (!busy && !saving) void send();
                    }
                  }}
                  placeholder={
                    activeMode === 'Savage'
                      ? "Enter prompt for Savage mode (roasts, bold wit)..."
                      : activeMode === 'Joke'
                        ? "Enter prompt for Joke mode (humor, punchlines)..."
                        : "Write a message or type /image to generate visuals..."
                  }
                  className="chat-composer-input w-full min-h-[44px] !p-1.5 focus:ring-0"
                  data-testid="input-message"
                  aria-describedby="composer-hint"
                />
              </div>

              {/* BOTTOM: Action Bar */}
              <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-white/[.05] mt-1">
                {/* Left: Tools */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {!guest && (
                    <>
                      <input ref={fileRef} type="file" multiple hidden onChange={(e) => pick(e.target.files)} data-testid="input-attachments" />
                      <input id="chat-zip-attachment" type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} data-testid="input-zip-attachment" />
                      <IconButton label="Attach files" onClick={() => fileRef.current?.click()} className="chat-composer-tool" data-testid="button-attach"><Paperclip size={16} /></IconButton>
                      <label htmlFor="chat-zip-attachment" aria-label="Upload ZIP archive" title="Upload ZIP archive" data-testid="button-upload-zip" className="chat-composer-tool hidden sm:grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] hover:text-white"><Archive size={16} /></label>
                      <IconButton
                        label="Generate an image (/image)"
                        onClick={() => {
                          setText((prev) => (prev.trim() ? `${prev.trim()} /image ` : '/image '));
                          taRef.current?.focus();
                        }}
                        className="chat-composer-tool text-violet-300 hover:text-violet-200"
                        data-testid="button-composer-image"
                      >
                        <ImageIcon size={16} />
                      </IconButton>
                      <ActionMenu label="Other chat actions" up items={[
                        { label: canvas.isOpen ? 'Close Code Canvas' : 'Open Code Canvas', onSelect: () => canvas.isOpen ? canvas.closeCanvas() : canvas.openCanvas() },
                        { label: 'Upload ZIP archive', onSelect: () => document.getElementById('chat-zip-attachment')?.click() },
                        { label: 'Generate image with AI (/image)', onSelect: () => { setText('/image '); taRef.current?.focus(); } },
                        { label: 'Voice Conversation (STS)', onSelect: openSts },
                        { label: 'Open Image Studio', onSelect: () => goto('/workspace/images') },
                        { label: 'Open voice studio', onSelect: () => goto('/workspace/voice') },
                        { label: 'Open coding workspace', onSelect: () => goto('/workspace/coding') },
                      ]} className="!flex !h-9 !w-auto gap-1 px-1.5 shrink-0 whitespace-nowrap min-w-max"><MoreHorizontal size={15} /><span className="hidden sm:inline text-[11px] shrink-0 whitespace-nowrap">Other</span></ActionMenu>
                    </>
                  )}
                </div>

                {/* Right: Voice Input + Send */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <VoiceInputButton
                    onSendTranscript={(transcript) => void send(transcript)}
                    onInsertInComposer={(transcript) => {
                      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                      taRef.current?.focus();
                    }}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={openSts}
                    aria-label="Start Voice Conversation (STS)"
                    title="Real-time Voice Conversation (STS)"
                    data-testid="button-sts-composer"
                    className="chat-composer-tool hidden sm:grid size-9 shrink-0 place-items-center rounded-xl text-teal-300 hover:bg-teal-500/10 hover:text-teal-200"
                  >
                    <Radio size={16} />
                  </button>
                  {busy ? (
                    <button type="button" onClick={stop} aria-label="Stop generation" data-testid="button-stop-generation" className="chat-send-button chat-stop-button">
                      <Square size={14} />
                      <span className="hidden sm:inline">Stop</span>
                    </button>
                  ) : (
                    <ChromaticButton
                      type="button"
                      onClick={() => void send()}
                      disabled={saving || busy || !!ask || (!text.trim() && !files.length)}
                      aria-label="Send message"
                      data-testid="button-send"
                      className="chat-chromatic-send"
                      color="#b126ff"
                      colorMode="spectrum"
                      speed={0.7}
                      paused={false}
                      phase={0}
                      feather={100}
                      projectionScale={174.7}
                      intensity={1.4}
                      grain={0.105}
                      seed={7}
                      borderRadius={50}
                      hoverEffect="brighten"
                      entrance="blur-up"
                      entranceSpeed={1}
                      entranceBlur={10}
                      entranceDistance={20}
                      entranceScale={0.65}
                    >
                      <Send size={15} />
                      <span className="hidden sm:inline">Send</span>
                    </ChromaticButton>
                  )}
                </div>
              </div>
            </div>
            <p id="composer-hint" className="chat-composer-hint" aria-live="polite" data-testid="status-composer-hint">{saving ? (files.length ? `Saving ${files.length} file${files.length > 1 ? 's' : ''} and your message to this browser…` : 'Saving to this browser…') : <>{prefs.enterToSend ? 'Enter to send' : 'Ctrl+Enter to send'} <span aria-hidden>·</span> {prefs.enterToSend ? 'Shift+Enter for a new line' : 'Enter for a new line'} <span className="chat-local-promise"><ShieldCheck size={12} /> Stored locally</span></>}</p>
          </div>
          {!atBottom && <button type="button" onClick={() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })} aria-label="Scroll to latest message" data-testid="button-scroll-latest" className="chat-scroll-latest"><ArrowDown size={16} /></button>}
        </div>
        {acts.dialogs}
        {delMsg && <ConfirmDialog danger title="Delete message" confirmLabel="Delete message" body="Delete this message from the conversation? Files attached to it stay in your Library. This cannot be undone." onConfirm={async () => { try { await repository.deleteMessage(delMsg.id); } catch (e) { notify(errMsg(e)); } setDelMsg(null); }} onClose={() => setDelMsg(null)} />}
        {resubmit && id && <ConfirmDialog title="Save and resubmit" confirmLabel="Resubmit" body="Saving this edit will delete every later message in the conversation, then ask the model for a new reply. This cannot be undone." onConfirm={async () => { const { m, text: t } = resubmit; setResubmit(null); setEditing(null); try { await repository.editMessage(m.id, t); const idx = list.findIndex((x) => x.id === m.id); for (const later of list.slice(idx + 1)) await repository.deleteMessage(later.id); const history: Turn = [...list.slice(0, idx).map((x) => ({ role: x.role, content: x.content })), { role: 'user', content: t }]; if (hasModelConsent() || consent) void run(id, history); else setAsk({ cid: id, history }); } catch (e) { notify(errMsg(e)); } }} onClose={() => setResubmit(null)} />}
        {ask && <Modal title="Send conversation text to a model?" onClose={() => setAsk(null)}>
          <p className="text-sm leading-6 text-slate-400">Your conversation text and attached images or documents will be sent to your configured Ayatrisya model connection to produce a reply. Your message is saved locally either way.</p>
          <label className="mt-4 flex items-center gap-2 text-xs text-slate-300"><input data-testid="input-remember-model-consent" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-violet-500" />Do not ask again until I reload this page</label>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setAsk(null)} data-testid="button-keep-local">Keep local only</Button><Button onClick={() => { const a = ask; setAsk(null); grantModelConsent({ rememberUntilReload: remember }); setConsent(true); if (a.after) void a.after(); else void run(a.cid, a.history); }} data-testid="button-confirm-model-send">Send</Button></div>
        </Modal>}

        {/* Cloud Image Generation Consent Modal */}
        {showImageConsent && (
          <CloudImageConsentModal
            onConsentGranted={() => {
              setShowImageConsent(false);
              if (pendingImageGen) {
                const target = pendingImageGen;
                setPendingImageGen(null);
                void executeImageGeneration(target.cid, target.prompt);
              }
            }}
            onCancel={() => {
              setShowImageConsent(false);
              setPendingImageGen(null);
              notify('Image generation cancelled: cloud permission not granted.');
            }}
          />
        )}

        {confirmDel && id && <ConfirmDialog danger title="Delete conversation" confirmLabel="Delete" body="Delete this conversation and its messages and attachments from this browser? This cannot be undone." onConfirm={async () => { try { await repository.deleteConversation(id); goto('/workspace'); } catch (e) { notify(errMsg(e)); setConfirmDel(false); } }} onClose={() => setConfirmDel(false)} />}
        {renaming !== null && id && <Modal title="Rename conversation" onClose={() => setRenaming(null)}><form onSubmit={async (e) => { e.preventDefault(); if (!renaming.trim()) return; try { await repository.renameConversation(id, renaming.trim()); setRenaming(null); } catch (er) { notify(errMsg(er)); } }}><input data-autofocus aria-label="Conversation title" value={renaming} onChange={(e) => setRenaming(e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit">Save</Button></div></form></Modal>}
      </div>

      {/* Full Speech-to-Speech Conversation Modal */}
      {showStsModal && (
        <SpeechToSpeechModal
          conversationId={id ?? 'new'}
          history={list.map((m) => ({ role: m.role, content: m.content }))}
          onNewMessage={async (role, content) => {
            let cid = id;
            if (!cid) {
              const newConv = await repository.createConversation(content.slice(0, 48), activeMode);
              cid = newConv.id;
              goto(`/workspace/chat/${cid}`);
            }
            await repository.addMessage(cid, content, role);
          }}
          onClose={() => setShowStsModal(false)}
        />
      )}
    </div>
  );
}
