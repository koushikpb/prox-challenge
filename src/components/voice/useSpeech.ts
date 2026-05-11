'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type SpeechSupport = {
  recognition: boolean;
  synthesis: boolean;
};

export type SpeechApi = {
  supported: SpeechSupport;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
};

type SpeechRecognitionErrorLike = { error?: string; message?: string };

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function detectSpeechSupport(win: WindowWithSpeech | undefined): SpeechSupport {
  if (!win) return { recognition: false, synthesis: false };
  const recognition = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  const synthesis = typeof win.speechSynthesis !== 'undefined';
  return { recognition, synthesis };
}

function getRecognitionCtor(win: WindowWithSpeech): SpeechRecognitionCtor | null {
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

const SERVER_SUPPORT: SpeechSupport = { recognition: false, synthesis: false };

let clientSupportCache: SpeechSupport | null = null;

function getClientSupport(): SpeechSupport {
  if (clientSupportCache) return clientSupportCache;
  if (typeof window === 'undefined') return SERVER_SUPPORT;
  clientSupportCache = detectSpeechSupport(window as WindowWithSpeech);
  return clientSupportCache;
}

function subscribeSupport(): () => void {
  return () => {};
}

export function useSpeech(): SpeechApi {
  const supported = useSyncExternalStore(subscribeSupport, getClientSupport, () => SERVER_SUPPORT);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // already stopped; ignore
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as WindowWithSpeech;
    const Ctor = getRecognitionCtor(win);
    if (!Ctor) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    finalTextRef.current = '';
    setTranscript('');

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const chunk = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTextRef.current = (finalTextRef.current + ' ' + chunk).trim();
        } else {
          interim += chunk;
        }
      }
      const combined = (finalTextRef.current + ' ' + interim).trim();
      setTranscript(combined);
    };

    rec.onerror = (event) => {
      console.warn('SpeechRecognition error', event.error ?? event.message ?? 'unknown');
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      console.warn('SpeechRecognition start failed', err);
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    if (typeof window.speechSynthesis === 'undefined') return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    supported,
    listening,
    speaking,
    transcript,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}
