/**
 * Ayatrisya Voice Utilities
 * Safe, robust STT and TTS helpers for Web & Electron Desktop.
 */

/**
 * Cleans markdown and UI metadata from text so TTS reads natural spoken prose.
 * Strips:
 * - Interactive block fences (```interactive ... ```)
 * - Fenced code blocks (replaced with "[Code snippet]")
 * - Inline code backticks
 * - Markdown links [text](url) -> text
 * - Raw URLs -> "link"
 * - Headers, asterisks, blockquotes, math syntax
 * - HTML tags
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';

  let cleaned = raw;

  // 1. Remove interactive block JSON fences completely
  cleaned = cleaned.replace(/```(?:interactive|interactive-block|ayatrisya-block|ayatrisya-interactive)[\s\S]*?```/gi, '');

  // 2. Replace regular code fences with a brief verbal indicator
  cleaned = cleaned.replace(/```[\w-]*\n([\s\S]*?)```/g, ' [Code snippet] ');

  // 3. Remove inline code backticks
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 4. Remove display and inline math
  cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, ' [formula] ');
  cleaned = cleaned.replace(/\$[^$\n]+\$/g, ' [formula] ');
  cleaned = cleaned.replace(/\\\[[\s\S]*?\\\]/g, ' [formula] ');
  cleaned = cleaned.replace(/\\\([\s\S]*?\\\)/g, ' [formula] ');

  // 5. Replace markdown links [anchor](url) with just anchor
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 6. Remove raw URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, ' [link] ');

  // 7. Strip markdown header tokens, bullet asterisks/dashes, blockquotes
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^\s*>\s+/gm, '');

  // 8. Strip bold/italic formatting
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');

  // 9. Strip HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 10. Collapse excess whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Checks microphone permission state safely across browser & Electron.
 */
export async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state;
    } catch {
      // Some browsers do not support microphone in permissions.query
      return 'prompt';
    }
  }

  return 'prompt';
}

/**
 * Requests microphone stream to ensure device authorization.
 */
export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone audio recording is not supported in this environment.');
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw new Error('Microphone permission was denied. Please allow microphone access in your browser or system settings.');
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      throw new Error('No microphone device was detected on your system.');
    }
    throw new Error(err.message || 'Failed to access microphone.');
  }
}

/**
 * Fetches speech synthesis voices reliably.
 */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const handler = () => {
      voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(voices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', handler);

    // Timeout fallback if event never fires
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    }, 500);
  });
}

export interface SpeechPlayHandle {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPlaying: () => boolean;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Speaks text using the browser SpeechSynthesis engine.
 */
export function speakText(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    voiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
): SpeechPlayHandle {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.(new Error('Speech synthesis is not supported in this browser.'));
    return {
      stop: () => {},
      pause: () => {},
      resume: () => {},
      isPlaying: () => false,
    };
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  activeUtterance = null;

  const clean = cleanTextForSpeech(text);
  if (!clean.trim()) {
    options.onEnd?.();
    return {
      stop: () => {},
      pause: () => {},
      resume: () => {},
      isPlaying: () => false,
    };
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;

  if (options.voiceURI) {
    const voices = window.speechSynthesis.getVoices();
    const selected = voices.find((v) => v.voiceURI === options.voiceURI);
    if (selected) utterance.voice = selected;
  }

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    if (e.error !== 'canceled' && e.error !== 'interrupted') {
      options.onError?.(e);
    }
  };

  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);

  return {
    stop: () => {
      window.speechSynthesis.cancel();
      activeUtterance = null;
    },
    pause: () => {
      window.speechSynthesis.pause();
    },
    resume: () => {
      window.speechSynthesis.resume();
    },
    isPlaying: () => window.speechSynthesis.speaking && !window.speechSynthesis.paused,
  };
}

/**
 * Speech recognition wrapper supporting standard SpeechRecognition & webkitSpeechRecognition.
 */
export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isSupported: boolean;
}

export function createSpeechRecognizer(options: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart?: () => void;
  lang?: string;
  continuous?: boolean;
}): SpeechRecognitionController {
  if (typeof window === 'undefined') {
    return {
      start: () => options.onError('Speech recognition not available outside browser environment.'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return {
      start: () => options.onError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or a supported browser.'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = true;
  recognition.lang = options.lang || 'en-US';

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const item = event.results[i];
      if (item.isFinal) {
        final += item[0].transcript;
      } else {
        interim += item[0].transcript;
      }
    }

    const currentText = final || interim;
    options.onResult(currentText, Boolean(final));
  };

  recognition.onerror = (event: any) => {
    let msg = event.error || 'Speech recognition error';
    if (event.error === 'not-allowed') {
      msg = 'Microphone permission was denied. Please allow microphone access.';
    } else if (event.error === 'no-speech') {
      msg = 'No speech was detected. Please try speaking closer to your microphone.';
    } else if (event.error === 'network') {
      msg = 'Network connection failed during speech recognition.';
    }
    options.onError(msg);
  };

  recognition.onend = () => {
    options.onEnd();
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (err: any) {
        options.onError(err.message || 'Failed to start speech recognition.');
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Ignored if already stopped
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        // Ignored
      }
    },
    isSupported: true,
  };
}
