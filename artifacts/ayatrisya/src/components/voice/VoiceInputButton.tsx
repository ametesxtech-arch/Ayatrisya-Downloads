import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Check, X, Send, Volume2, AlertCircle } from 'lucide-react';
import {
  createSpeechRecognizer,
  requestMicrophoneAccess,
  type SpeechRecognitionController,
} from './voice-utils';

interface VoiceInputButtonProps {
  onSendTranscript: (transcript: string) => void;
  onInsertInComposer: (transcript: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  onSendTranscript,
  onInsertInComposer,
  disabled = false,
}: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [sendOnFinish, setSendOnFinish] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognizerRef = useRef<SpeechRecognitionController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) recognizerRef.current.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    setRecordingSeconds(0);

    try {
      // First ensure device permission explicitly
      const stream = await requestMicrophoneAccess();
      streamRef.current = stream;

      const recognizer = createSpeechRecognizer({
        continuous: true,
        onStart: () => {
          setIsRecording(true);
          timerRef.current = window.setInterval(() => {
            setRecordingSeconds((s) => s + 1);
          }, 1000);
        },
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal && sendOnFinish && text.trim()) {
            stopRecording();
            onSendTranscript(text.trim());
          }
        },
        onError: (err) => {
          setError(err);
          stopRecording();
        },
        onEnd: () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        },
      });

      recognizerRef.current = recognizer;

      if (!recognizer.isSupported) {
        setError('Voice recognition is not supported in this browser. Please use Google Chrome or Edge.');
        return;
      }

      recognizer.start();
    } catch (err: any) {
      setError(err.message || 'Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    // If there is recorded text, show review dialog unless auto-sent
    if (transcript.trim() && !sendOnFinish) {
      setShowReview(true);
    }
  };

  const handleSend = () => {
    if (transcript.trim()) {
      onSendTranscript(transcript.trim());
      setShowReview(false);
      setTranscript('');
    }
  };

  const handleInsert = () => {
    if (transcript.trim()) {
      onInsertInComposer(transcript.trim());
      setShowReview(false);
      setTranscript('');
    }
  };

  const handleCancel = () => {
    setShowReview(false);
    setTranscript('');
    setError(null);
  };

  return (
    <>
      {/* Microphone toggle button */}
      <button
        type="button"
        disabled={disabled}
        onClick={isRecording ? stopRecording : startRecording}
        className={`chat-composer-tool relative grid size-10 shrink-0 place-items-center rounded-xl transition-all duration-200 ${
          isRecording
            ? 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/50 hover:bg-rose-500/30'
            : 'text-slate-400 hover:bg-white/[.07] hover:text-white'
        } disabled:opacity-40`}
        aria-label={isRecording ? 'Stop speech recognition' : 'Start voice input (Speech to Text)'}
        title={isRecording ? 'Click to stop recording' : 'Voice Input (STT)'}
        data-testid="button-voice-input"
      >
        {isRecording ? (
          <div className="flex items-center justify-center">
            <span className="absolute size-3 animate-ping rounded-full bg-rose-400/60" />
            <Square size={15} className="fill-current text-rose-400" />
          </div>
        ) : (
          <Mic size={17} />
        )}
      </button>

      {/* Recording Pill Overlay */}
      {isRecording && (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-12 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-rose-500/30 bg-[#120a10] px-4 py-2 shadow-xl backdrop-blur-md"
          data-testid="voice-recording-indicator"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
            </span>
            <span className="text-xs font-medium text-rose-300">
              Listening... {recordingSeconds}s
            </span>
            {transcript && (
              <span className="max-w-[280px] truncate text-xs text-slate-300 italic">
                "{transcript}"
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/30"
          >
            <Square size={11} className="fill-current" />
            <span>Finish</span>
          </button>
        </div>
      )}

      {/* Error alert toast */}
      {error && (
        <div
          role="alert"
          className="absolute -top-12 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-amber-500/30 bg-[#141006] px-4 py-2 text-xs text-amber-300 shadow-xl"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-amber-400/80 hover:text-amber-200"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Transcript Review Modal */}
      {showReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-labelledby="stt-review-title"
          data-testid="modal-stt-review"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12131a] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[.08]">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-teal-400" />
                <h3 id="stt-review-title" className="text-sm font-semibold text-slate-200">
                  Speech-to-Text Transcript Review
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded p-1 text-slate-400 hover:bg-white/[.07] hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="stt-transcript-edit" className="block text-xs font-medium text-slate-400 mb-1.5">
                Review or edit your spoken transcription:
              </label>
              <textarea
                id="stt-transcript-edit"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-[#0b0c10] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
                placeholder="Transcribed voice will appear here..."
                data-testid="input-stt-transcript"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendOnFinish}
                  onChange={(e) => setSendOnFinish(e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-teal-400 focus:ring-teal-400"
                />
                <span>Always send automatically when recording ends</span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[.07]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsert}
                disabled={!transcript.trim()}
                className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/20 disabled:opacity-40"
                data-testid="button-insert-composer"
              >
                Insert in Composer
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!transcript.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-teal-400 disabled:opacity-40 shadow-sm"
                data-testid="button-send-transcript"
              >
                <Send size={13} />
                <span>Send to Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
