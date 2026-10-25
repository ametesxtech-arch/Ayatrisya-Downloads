import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, Settings2 } from 'lucide-react';
import { speakText, type SpeechPlayHandle } from './voice-utils';

interface MessageTtsButtonProps {
  content: string;
  messageId: string;
}

export function MessageTtsButton({ content, messageId }: MessageTtsButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const handleRef = useRef<SpeechPlayHandle | null>(null);

  useEffect(() => {
    return () => {
      if (handleRef.current) {
        handleRef.current.stop();
      }
    };
  }, []);

  const handleToggle = () => {
    if (isPlaying) {
      if (isPaused) {
        handleRef.current?.resume();
        setIsPaused(false);
      } else {
        handleRef.current?.pause();
        setIsPaused(true);
      }
      return;
    }

    // Start speaking
    const handle = speakText(content, {
      rate,
      onStart: () => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onEnd: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onError: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
    });

    handleRef.current = handle;
  };

  const handleStop = () => {
    if (handleRef.current) {
      handleRef.current.stop();
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const changeRate = (newRate: number) => {
    setRate(newRate);
    setShowSpeedMenu(false);
    if (isPlaying) {
      // Restart at new rate
      handleStop();
      setTimeout(() => {
        const handle = speakText(content, {
          rate: newRate,
          onStart: () => {
            setIsPlaying(true);
            setIsPaused(false);
          },
          onEnd: () => {
            setIsPlaying(false);
            setIsPaused(false);
          },
          onError: () => {
            setIsPlaying(false);
            setIsPaused(false);
          },
        });
        handleRef.current = handle;
      }, 50);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleToggle}
        className={`chat-action grid size-9 place-items-center rounded-lg transition-colors ${
          isPlaying
            ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
            : 'text-slate-400 hover:bg-white/[.07] hover:text-slate-100'
        }`}
        aria-label={
          isPlaying
            ? isPaused
              ? 'Resume reading message aloud'
              : 'Pause reading message aloud'
            : 'Read message aloud with Text-to-Speech'
        }
        title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Read aloud (TTS)'}
        data-testid={`button-tts-${messageId}`}
      >
        {isPlaying ? (
          isPaused ? (
            <Play size={13} className="fill-current text-teal-300" />
          ) : (
            <Pause size={13} className="text-teal-300" />
          )
        ) : (
          <Volume2 size={13} />
        )}
      </button>

      {isPlaying && (
        <button
          type="button"
          onClick={handleStop}
          className="chat-action grid size-7 place-items-center rounded-md text-slate-400 hover:bg-white/[.07] hover:text-rose-300"
          aria-label="Stop reading message aloud"
          title="Stop reading"
          data-testid={`button-tts-stop-${messageId}`}
        >
          <VolumeX size={12} />
        </button>
      )}

      {/* Speed control selector dropdown toggle */}
      <button
        type="button"
        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
        className="px-1 text-[10px] font-mono font-medium text-slate-400 hover:text-slate-200"
        title="Change reading speed"
        aria-label={`TTS reading speed currently ${rate}x`}
        data-testid={`button-tts-speed-${messageId}`}
      >
        {rate}x
      </button>

      {showSpeedMenu && (
        <div
          className="absolute bottom-full right-0 mb-1 z-30 flex flex-col rounded-lg border border-white/10 bg-[#161720] p-1 shadow-xl backdrop-blur-md"
          role="menu"
        >
          {[0.75, 1.0, 1.25, 1.5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeRate(s)}
              className={`rounded px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                rate === s
                  ? 'bg-teal-500/20 text-teal-300 font-semibold'
                  : 'text-slate-300 hover:bg-white/[.08]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
