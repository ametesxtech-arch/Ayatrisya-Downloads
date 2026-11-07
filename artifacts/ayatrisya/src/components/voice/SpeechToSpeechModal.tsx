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
import { usePrefs } from '@/hooks/use-prefs';

interface SpeechToSpeechModalProps {
  conversationId: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  onNewMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  onClose: () => void;
}

type StsState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

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
            handleUserUtterance(text.trim());
          }
        },
        onError: (err) => {
          setErrorMessage(err);
          setState('error');
        },
        onEnd: () => {
          // If we stopped without final transcript and not processing
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
      handleUserUtterance(userTranscript.trim());
    } else {
      setState('idle');
    }
  };

  const handleUserUtterance = async (userPrompt: string) => {
    if (!userPrompt.trim()) {
      setState('idle');
      return;
    }

    setState('processing');
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
      const job = modelClient.submitJob({
        kind: 'chat',
        messages: localHistoryRef.current,
        options: {
          model: prefs.model,
          mode: prefs.mode,
          signal: ac.signal,
        },
      });

      const response = await job.result;
      if (ac.signal.aborted) return;

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

        {/* Central Dynamic Visualizer State */}
        <div className="my-8 flex flex-col items-center justify-center">
          {state === 'idle' && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={startListening}
                className="group relative flex size-28 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 ring-4 ring-teal-500/20 transition-all hover:scale-105 hover:bg-teal-500/20 hover:ring-teal-500/40"
                aria-label="Tap to speak"
                data-testid="button-sts-start-speaking"
              >
                <Mic size={40} className="transition-transform group-hover:scale-110" />
              </button>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Tap the microphone to speak
              </p>
            </div>
          )}

          {state === 'listening' && (
            <div className="flex flex-col items-center">
              <div
                onClick={stopListening}
                className="relative flex size-28 cursor-pointer items-center justify-center rounded-full bg-rose-500/20 text-rose-400 ring-4 ring-rose-500/40"
                title="Tap to finish speaking"
              >
                <span className="absolute size-32 animate-ping rounded-full bg-rose-500/30" />
                <Mic size={42} className="animate-pulse" />
              </div>
              <p className="mt-4 text-xs font-medium text-rose-300 animate-pulse">
                Listening to you... (Tap to finish)
              </p>
            </div>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center">
              <div className="flex size-28 items-center justify-center rounded-full bg-violet-500/10 text-violet-400 ring-4 ring-violet-500/20">
                <Sparkles size={40} className="animate-spin text-violet-400 duration-1000" />
              </div>
              <p className="mt-4 text-xs font-medium text-violet-300">
                Ayatrisya is thinking...
              </p>
            </div>
          )}

          {state === 'speaking' && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={handleInterrupt}
                className="relative flex size-28 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-4 ring-emerald-500/40 hover:scale-105"
                title="Tap to interrupt and speak (Barge-in)"
                aria-label="Interrupt assistant and start speaking"
                data-testid="button-sts-interrupt"
              >
                <span className="absolute size-32 animate-pulse rounded-full bg-emerald-500/20" />
                <Volume2 size={42} />
              </button>
              <p className="mt-4 text-xs font-medium text-emerald-300">
                Speaking... <span className="underline cursor-pointer hover:text-white" onClick={handleInterrupt}>(Tap to interrupt)</span>
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center">
              <div className="flex size-24 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 ring-4 ring-amber-500/20">
                <AlertCircle size={36} />
              </div>
              <p className="mt-3 text-xs text-amber-300 max-w-xs text-center">
                {errorMessage || 'Voice error occurred'}
              </p>
              <button
                type="button"
                onClick={startListening}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
              >
                <RotateCcw size={13} />
                <span>Try again</span>
              </button>
            </div>
          )}
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
