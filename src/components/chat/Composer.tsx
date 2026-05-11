'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SendIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceControls } from '@/components/voice/VoiceControls';
import type { SpeechApi } from '@/components/voice/useSpeech';

type ComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  speech: SpeechApi;
  speakerOn: boolean;
  onSpeakerToggle: (next: boolean) => void;
};

export function Composer({
  disabled = false,
  onSubmit,
  speech,
  speakerOn,
  onSpeakerToggle,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    if (speech.transcript && speech.transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = speech.transcript;
      setValue(speech.transcript);
    }
  }, [speech.transcript]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (trimmed.length === 0 || disabled) return;
      onSubmit(trimmed);
      setValue('');
      lastTranscriptRef.current = '';
    },
    [disabled, onSubmit, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const form = event.currentTarget.form;
        if (form) form.requestSubmit();
      }
    },
    [],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t bg-background/80 px-3 py-2 backdrop-blur"
      data-slot="composer"
    >
      <VoiceControls
        speech={speech}
        speakerOn={speakerOn}
        onSpeakerToggle={onSpeakerToggle}
        disabled={disabled}
      />
      <Input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          lastTranscriptRef.current = event.target.value;
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your OmniPro 220…"
        disabled={disabled}
        aria-label="Message"
        className="h-9"
      />
      <Button type="submit" size="icon-sm" disabled={disabled || value.trim().length === 0}>
        <SendIcon aria-hidden />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}
