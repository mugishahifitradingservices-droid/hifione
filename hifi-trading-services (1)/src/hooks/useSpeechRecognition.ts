import { useState, useEffect, useRef, useCallback } from 'react';

// Declaration for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Format dictated speech by applying common voice commands and standard casing
 */
export function formatDictatedSpeech(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Replace spoken punctuation and formatting commands
  formatted = formatted
    .replace(/\b(full stop|period)\b/gi, '.')
    .replace(/\b(comma)\b/gi, ',')
    .replace(/\b(question mark)\b/gi, '?')
    .replace(/\b(exclamation mark|exclamation point)\b/gi, '!')
    .replace(/\b(new line|next line)\b/gi, '\n')
    .replace(/\b(new paragraph)\b/gi, '\n\n')
    .replace(/\b(colon)\b/gi, ':')
    .replace(/\b(semicolon)\b/gi, ';')
    .replace(/\b(hyphen|dash)\b/gi, '-')
    .replace(/\b(bullet point|bullet)\b/gi, '\n• ');

  // Clean up punctuation spacing: e.g. "word ." -> "word."
  formatted = formatted.replace(/\s+([.,!?:;])/g, '$1');

  // Ensure spacing after punctuation if followed by a letter
  formatted = formatted.replace(/([.,!?:;])([a-zA-Z])/g, '$1 $2');

  // Capitalize after periods, question marks, exclamation marks, or new lines
  formatted = formatted.replace(/(?:^|\n|[.!?]\s+)([a-z])/g, (match) => match.toUpperCase());

  return formatted;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    onFinalResult,
    onInterimResult,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Error stopping speech recognition:', err);
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback((customLang?: string) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      const msg = 'Speech recognition is not supported in this browser. Please use Chrome, Edge, Safari, or a modern mobile browser.';
      setError(msg);
      onError?.(msg);
      return;
    }

    try {
      // Abort any existing instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      setError(null);
      setInterimTranscript('');
      shouldListenRef.current = true;

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = customLang || selectedLanguage;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcriptText = res[0]?.transcript || '';

          if (res.isFinal) {
            currentFinal += transcriptText;
          } else {
            currentInterim += transcriptText;
          }
        }

        if (currentFinal) {
          const formatted = formatDictatedSpeech(currentFinal.trim());
          if (formatted) {
            onFinalResult?.(formatted);
          }
        }

        setInterimTranscript(currentInterim);
        if (currentInterim) {
          onInterimResult?.(currentInterim);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition notice:', event.error);
        
        let errorMessage = 'Voice recognition error.';
        if (event.error === 'not-allowed') {
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings to use voice notes.';
        } else if (event.error === 'no-speech') {
          // Normal when silent, don't crash
          return;
        } else if (event.error === 'audio-capture') {
          errorMessage = 'No microphone was found on this device.';
        } else if (event.error === 'network') {
          errorMessage = 'Network issue with voice recognition. Please check your internet connection.';
        }

        setError(errorMessage);
        onError?.(errorMessage);

        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          shouldListenRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // If continuous mode was on and user didn't explicitly stop, auto-restart (handles mobile timeouts)
        if (shouldListenRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
            shouldListenRef.current = false;
          }
        } else {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start voice dictation:', err);
      const msg = err?.message || 'Failed to access microphone. Please check permissions.';
      setError(msg);
      setIsListening(false);
      onError?.(msg);
    }
  }, [continuous, interimResults, selectedLanguage, onFinalResult, onInterimResult, onError]);

  const toggleListening = useCallback((customLang?: string) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(customLang);
    }
  }, [isListening, startListening, stopListening]);

  const changeLanguage = useCallback((newLang: string) => {
    setSelectedLanguage(newLang);
    if (isListening) {
      stopListening();
      setTimeout(() => {
        startListening(newLang);
      }, 150);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    error,
    selectedLanguage,
    startListening,
    stopListening,
    toggleListening,
    changeLanguage,
    clearError: () => setError(null)
  };
}
