import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Volume2,
  X,
  Radio,
  AlertCircle,
  RotateCcw,
  MessageSquare,
  Search,
} from 'lucide-react';
import {
  createSpeechRecognizer,
  requestMicrophoneAccess,
  speakText,
  cleanTextForSpeech,
  type SpeechRecognitionController,
  type SpeechPlayHandle,
} from './voice-utils';
import { modelClient } from '@/ai/client';
import { applyPersonalization } from '@/ai/personalization';
import { usePrefs } from '@/hooks/use-prefs';
import { repository } from '@/storage/repository';
import { IntelligentMemoryContextManager } from '@/storage/intelligent-memory-context-manager';
import { LiquidGlassOrb } from '../liquid-glass-orb';

interface SpeechToSpeechModalProps {
  conversationId: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  onNewMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  onClose: () => void;
}

type StsState = 'idle' | 'listening' | 'thinking' | 'searching' | 'speaking' | 'error';

export function SpeechToSpeechModal({
  conversationId,
  history,
  onNewMessage,
  onClose,
}: SpeechToSpeechModalProps) {
  const { prefs } = usePrefs();
  const [state, setState] = useState<StsState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoListenAfterSpeech, setAutoListenAfterSpeech] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0.55);

  const recognizerRef = useRef<SpeechRecognitionController | null>(null);
  const speechHandleRef = useRef<SpeechPlayHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const localHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>(history);
  const isMountedRef = useRef(true);
  const autoListenTimerRef = useRef<number | null>(null);
  const autoListenRef = useRef(autoListenAfterSpeech);
  autoListenRef.current = autoListenAfterSpeech;

  // Stop everything on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupAll();
    };
  }, []);

  // Audio level tracking for listening & speaking envelopes
  useEffect(() => {
    if (state === 'listening' && streamRef.current) {
      let rafId: number;
      let audioCtx: AudioContext | null = null;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaStreamSource(streamRef.current);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            if (!isMountedRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / (dataArray.length * 255);
            const normalized = Math.min(1, Math.max(0.15, avg * 3.2));
            setAudioLevel(normalized);
            rafId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        setAudioLevel(0.55);
      }
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (audioCtx && audioCtx.state !== 'closed') {
          try {
            void audioCtx.close();
          } catch {}
        }
      };
    } else if (state === 'speaking') {
      let rafId: number;
      let t = 0;
      const tick = () => {
        if (!isMountedRef.current) return;
        t += 0.08;
        const speechEnvelope = 0.55 + Math.sin(t * 3.1) * 0.2 + Math.sin(t * 7.4) * 0.12;
        setAudioLevel(Math.min(1, Math.max(0.2, speechEnvelope)));
        rafId = requestAnimationFrame(tick);
      };
      tick();
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      setAudioLevel(0.55);
      return undefined;
    }
  }, [state]);

  const cleanupAll = () => {
    if (autoListenTimerRef.current !== null) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
    if (recognizerRef.current) {
      recognizerRef.current.abort();
    }
    if (speechHandleRef.current) {
      speechHandleRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const startListening = async () => {
    // Barge-in: Stop any speaking or processing immediately
    if (speechHandleRef.current) {
      speechHandleRef.current.stop();
      speechHandleRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setErrorMessage(null);
    setUserTranscript('');

    try {
      if (!streamRef.current) {
        streamRef.current = await requestMicrophoneAccess();
      }

      const recognizer = createSpeechRecognizer({
        continuous: false,
        onStart: () => {
          setState('listening');
        },
        onResult: (text, isFinal) => {
          setUserTranscript(text);
          if (isFinal && text.trim()) {
            void handleUserUtterance(text.trim());
          }
        },
        onError: (err) => {
          setErrorMessage(err);
          setState('error');
        },
        onEnd: () => {
          // If stopped without final transcript and not processing
          setState((curr) => (curr === 'listening' ? 'idle' : curr));
        },
      });

      recognizerRef.current = recognizer;
      recognizer.start();
    } catch (err: any) {
      setErrorMessage(err.message || 'Microphone access failed.');
      setState('error');
    }
  };

  const stopListening = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    if (userTranscript.trim() && state === 'listening') {
      void handleUserUtterance(userTranscript.trim());
    } else {
      setState('idle');
    }
  };

  const handleUserUtterance = async (userPrompt: string) => {
    if (!userPrompt.trim()) {
      setState('idle');
      return;
    }

    const isSearchIntent =
      /\b(search|google|find|lookup|who is|what is|where is|latest|recent|news|current|web|browse|weather|stock)\b/i.test(
        userPrompt,
      ) || (prefs.mode as string) === 'research';

    if (isSearchIntent) {
      setState('searching');
      // Natural search pause for visual feedback
      await new Promise((r) => setTimeout(r, 700));
      if (!isMountedRef.current) return;
    }

    setState('thinking');
    setAssistantReply('');

    // Append user message to history
    localHistoryRef.current = [
      ...localHistoryRef.current,
      { role: 'user', content: userPrompt },
    ];
    void onNewMessage('user', userPrompt);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      let personalizedMessages = localHistoryRef.current;
      if (prefs.personalization.enabled && prefs.personalization.useMemory) {
        try {
          const memoryMgr = new IntelligentMemoryContextManager(repository);
          const ctxPkg = await memoryMgr.buildContextPackage(userPrompt, { currentConversationId: conversationId });
          personalizedMessages = applyPersonalization(localHistoryRef.current, prefs.personalization, {
            memories: ctxPkg.rankedMemories,
            memorySummary: ctxPkg.summaryContext,
            knowledgePassages: ctxPkg.knowledgePassages,
            pastConversationExcerpts: ctxPkg.pastConversationExcerpts,
          });
        } catch (memErr) {
          console.warn('[Voice IntelligentMemory] Context build notice:', memErr);
        }
      }

      const job = modelClient.submitJob({
        kind: 'chat',
        messages: personalizedMessages,
        options: {
          model: prefs.model,
          mode: prefs.mode,
          signal: ac.signal,
        },
      });

      const response = await job.result;
      if (ac.signal.aborted) return;

      if (prefs.personalization.enabled && prefs.personalization.useMemory && prefs.personalization.autoMemoryCollection !== false) {
        void (async () => {
          try {
            const memoryMgr = new IntelligentMemoryContextManager(repository);
            await memoryMgr.processTurnAndExtractMemories(userPrompt, response, { conversationId });
          } catch (memErr) {
            console.warn('[Voice IntelligentMemory] Extraction notice:', memErr);
          }
        })();
      }

      setAssistantReply(response);
      localHistoryRef.current = [
        ...localHistoryRef.current,
        { role: 'assistant', content: response },
      ];
      void onNewMessage('assistant', response);

      // Speak assistant response
      setState('speaking');
      const clean = cleanTextForSpeech(response);

      const handle = speakText(clean, {
        rate: 1.0,
        onEnd: () => {
          if (!isMountedRef.current) return;
          setState('idle');
          if (autoListenRef.current) {
            // Turn-taking: Automatically listen for next user response
            autoListenTimerRef.current = window.setTimeout(() => {
              if (isMountedRef.current && autoListenRef.current) {
                void startListening();
              }
            }, 600);
          }
        },
        onError: () => {
          setState('idle');
        },
      });

      speechHandleRef.current = handle;
    } catch (err: any) {
      if (!ac.signal.aborted) {
        setErrorMessage(err.message || 'Model response failed during voice conversation.');
        setState('error');
      }
    }
  };

  // Interruption / Barge-in trigger
  const handleInterrupt = () => {
    cleanupAll();
    void startListening();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sts-modal-title"
      data-testid="modal-sts"
    >
      <div className="relative flex w-full max-w-lg flex-col items-center rounded-3xl border border-white/10 bg-[#101118] p-6 shadow-2xl">
        {/* Header with Close and Pipeline Architecture Disclaimer */}
        <div className="flex w-full items-center justify-between border-b border-white/[.08] pb-3">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-teal-400 animate-pulse" />
            <h2 id="sts-modal-title" className="text-sm font-semibold text-slate-100">
              Ayatrisya Voice Conversation
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupAll();
              onClose();
            }}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/[.08] hover:text-white"
            aria-label="Close voice conversation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Honest architecture badge */}
        <div className="mt-2.5 flex items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-[11px] text-teal-300/80">
          <span>Pipeline: STT &rarr; {prefs.model === 'v1-fast' ? 'Ayatrisya V1 Fast' : 'Ayatrisya V2'} &rarr; TTS</span>
        </div>

        {/* Central Dynamic Visualizer State using LiquidGlassOrb */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div
            className="relative flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            onClick={() => {
              if (state === 'idle') void startListening();
              else if (state === 'listening') stopListening();
              else if (state === 'speaking') handleInterrupt();
            }}
            data-testid={
              state === 'idle'
                ? 'button-sts-start-speaking'
                : state === 'speaking'
                ? 'button-sts-interrupt'
                : undefined
            }
          >
            {state === 'idle' && (
              <LiquidGlassOrb
                baseColor={'#ffffff'}
                colorA={'#000000'}
                colorB={'#4d4d4d'}
                colorC={'#a9a9a9'}
                seed={145}
                startTime={18}
                speed={1.5}
                distortion={0.8}
                clusterCount={7.2}
                clusterIntensity={3}
                clusterSize={22.5}
                scale={0.23}
                spotSize={1.15}
                rotation={0}
                softness={0.31}
                relief={2.94}
                refraction={0.65}
                roughness={0}
                reflection={1.3}
                caustics={0}
                dispersion={1}
                colorDistribution={0}
                grain={0.3}
                grainSize={1}
                paused={false}
                animateDistortion={true}
                grainMode={'fine'}
                flowType={'drift'}
                state={'idle'}
                thinkingAnimation={'ripples'}
                searchingAnimation={'lens'}
                preserveWhites={true}
                animateEntrance={true}
                size={250}
                audioLevel={audioLevel}
              />
            )}

            {state === 'thinking' && (
              <LiquidGlassOrb
                baseColor={'#ffffff'}
                colorA={'#000000'}
                colorB={'#4d4d4d'}
                colorC={'#a9a9a9'}
                seed={145}
                startTime={18}
                speed={1.5}
                distortion={0.8}
                clusterCount={7.2}
                clusterIntensity={3}
                clusterSize={22.5}
                scale={0.23}
                spotSize={1.15}
                rotation={0}
                softness={0.31}
                relief={2.94}
                refraction={0.65}
                roughness={0}
                reflection={1.3}
                caustics={0}
                dispersion={1}
                colorDistribution={0}
                grain={0.3}
                grainSize={1}
                paused={false}
                animateDistortion={true}
                grainMode={'fine'}
                flowType={'drift'}
                state={'thinking'}
                thinkingAnimation={'ripples'}
                searchingAnimation={'lens'}
                preserveWhites={true}
                animateEntrance={true}
                size={250}
                audioLevel={audioLevel}
              />
            )}

            {state === 'listening' && (
              <LiquidGlassOrb
                baseColor={'#ffffff'}
                colorA={'#000000'}
                colorB={'#4d4d4d'}
                colorC={'#a9a9a9'}
                seed={145}
                startTime={18}
                speed={1.5}
                distortion={0.8}
                clusterCount={7.2}
                clusterIntensity={3}
                clusterSize={22.5}
                scale={0.23}
                spotSize={1.15}
                rotation={0}
                softness={0.31}
                relief={2.94}
                refraction={0.65}
                roughness={0}
                reflection={1.3}
                caustics={0}
                dispersion={1}
                colorDistribution={0}
                grain={0.3}
                grainSize={1}
                paused={false}
                animateDistortion={true}
                grainMode={'fine'}
                flowType={'drift'}
                state={'listening'}
                thinkingAnimation={'ripples'}
                searchingAnimation={'lens'}
                intensity={1}
                preserveWhites={true}
                animateEntrance={true}
                size={250}
                audioLevel={audioLevel}
              />
            )}

            {state === 'searching' && (
              <LiquidGlassOrb
                baseColor={'#ffffff'}
                colorA={'#000000'}
                colorB={'#4d4d4d'}
                colorC={'#a9a9a9'}
                seed={145}
                startTime={18}
                speed={1.5}
                distortion={0.8}
                clusterCount={7.2}
                clusterIntensity={3}
                clusterSize={22.5}
                scale={0.23}
                spotSize={1.15}
                rotation={0}
                softness={0.31}
                relief={2.94}
                refraction={0.65}
                roughness={0}
                reflection={1.3}
                caustics={0}
                dispersion={1}
                colorDistribution={0}
                grain={0.3}
                grainSize={1}
                paused={false}
                animateDistortion={true}
                grainMode={'fine'}
                flowType={'drift'}
                state={'searching'}
                thinkingAnimation={'ripples'}
                searchingAnimation={'lens'}
                preserveWhites={true}
                animateEntrance={true}
                size={250}
                audioLevel={audioLevel}
              />
            )}

            {state === 'speaking' && (
              <LiquidGlassOrb
                baseColor={'#ffffff'}
                colorA={'#000000'}
                colorB={'#4d4d4d'}
                colorC={'#a9a9a9'}
                seed={145}
                startTime={18}
                speed={1.5}
                distortion={0.8}
                clusterCount={7.2}
                clusterIntensity={3}
                clusterSize={22.5}
                scale={0.23}
                spotSize={1.15}
                rotation={0}
                softness={0.31}
                relief={2.94}
                refraction={0.65}
                roughness={0}
                reflection={1.3}
                caustics={0}
                dispersion={1}
                colorDistribution={0}
                grain={0.3}
                grainSize={1}
                paused={false}
                animateDistortion={true}
                grainMode={'fine'}
                flowType={'drift'}
                state={'speaking'}
                thinkingAnimation={'ripples'}
                searchingAnimation={'lens'}
                intensity={1}
                preserveWhites={true}
                animateEntrance={true}
                size={250}
                audioLevel={audioLevel}
              />
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center justify-center size-[250px] rounded-full border border-amber-500/30 bg-amber-500/10">
                <AlertCircle size={44} className="text-amber-400" />
                <p className="mt-3 text-xs text-amber-300 max-w-[200px] text-center">
                  {errorMessage || 'Voice error occurred'}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void startListening();
                  }}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
                >
                  <RotateCcw size={13} />
                  <span>Try again</span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Status Indicator */}
          <div className="mt-4 flex items-center justify-center">
            {state === 'idle' && (
              <button
                type="button"
                onClick={() => void startListening()}
                className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/20 transition-all"
              >
                <Mic size={14} className="text-teal-400" />
                <span>Tap orb to speak</span>
              </button>
            )}

            {state === 'listening' && (
              <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-medium text-rose-300 animate-pulse">
                <span className="size-2 rounded-full bg-rose-400 animate-ping" />
                <span>Listening to you... (tap orb to finish)</span>
              </div>
            )}

            {state === 'thinking' && (
              <div className="flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300">
                <Sparkles size={14} className="animate-spin text-violet-400" />
                <span>Ayatrisya is thinking...</span>
              </div>
            )}

            {state === 'searching' && (
              <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
                <Search size={14} className="animate-pulse text-cyan-400" />
                <span>Ayatrisya is searching...</span>
              </div>
            )}

            {state === 'speaking' && (
              <button
                type="button"
                onClick={handleInterrupt}
                className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
                title="Tap to interrupt and speak"
              >
                <Volume2 size={14} className="animate-pulse text-emerald-400" />
                <span>Speaking... (tap orb to interrupt)</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Conversation Subtitles */}
        <div className="w-full rounded-2xl border border-white/[.07] bg-[#0c0d12] p-4 text-xs leading-relaxed max-h-40 overflow-y-auto space-y-2">
          {userTranscript && (
            <p className="text-slate-200">
              <span className="font-semibold text-teal-400">You: </span>
              {userTranscript}
            </p>
          )}
          {assistantReply && (
            <p className="text-slate-300">
              <span className="font-semibold text-violet-400">Ayatrisya: </span>
              {cleanTextForSpeech(assistantReply)}
            </p>
          )}
          {!userTranscript && !assistantReply && (
            <p className="text-center italic text-slate-500">
              Spoken conversation transcripts will appear here in real time.
            </p>
          )}
        </div>

        {/* Turn-taking toggle & Controls */}
        <div className="mt-4 flex w-full items-center justify-between text-xs text-slate-400">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoListenAfterSpeech}
              onChange={(e) => setAutoListenAfterSpeech(e.target.checked)}
              className="rounded border-white/20 bg-white/10 text-teal-400 focus:ring-teal-400"
            />
            <span>Continuous turn-taking (auto-listen after reply)</span>
          </label>

          <button
            type="button"
            onClick={() => {
              cleanupAll();
              onClose();
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
          >
            <MessageSquare size={13} />
            <span>Switch to Text</span>
          </button>
        </div>
      </div>
    </div>
  );
}
