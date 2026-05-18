'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowUpIcon, MicIcon, MicOffIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VOICE_ENABLED } from '@/components/voice/voiceEnabled';
import type { SpeechApi } from '@/components/voice/useSpeech';
import { cn } from '@/lib/utils';

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

  const canSend = value.trim().length > 0 && !disabled;
  const micActive = VOICE_ENABLED && speech.supported.recognition && !disabled;
  const speakerActive = VOICE_ENABLED && speech.supported.synthesis && !disabled;

  const handleMicClick = () => {
    if (!micActive) return;
    if (speech.listening) speech.stopListening();
    else speech.startListening();
  };

  const handleSpeakerClick = () => {
    if (!speakerActive) return;
    const next = !speakerOn;
    if (!next) speech.cancelSpeech();
    onSpeakerToggle(next);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 z-10 pt-3 pb-4"
      data-slot="composer"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/70 px-2 py-1.5 backdrop-blur',
          'shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] focus-within:border-white/20',
        )}
      >
        {VOICE_ENABLED && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!micActive}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? 'Stop listening' : 'Start voice input'}
                  onClick={handleMicClick}
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors',
                    'hover:text-zinc-100 disabled:opacity-30',
                    speech.listening && 'text-red-400 animate-pulse',
                  )}
                  data-slot="voice-mic"
                />
              }
            >
              {speech.listening ? (
                <MicOffIcon className="size-4" aria-hidden />
              ) : (
                <MicIcon className="size-4" aria-hidden />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {micActive ? (speech.listening ? 'Listening… tap to stop' : 'Tap to speak') : 'Voice input disabled'}
            </TooltipContent>
          </Tooltip>
        )}

        {VOICE_ENABLED && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!speakerActive}
                  aria-pressed={speakerOn}
                  aria-label={speakerOn ? 'Disable voice output' : 'Enable voice output'}
                  onClick={handleSpeakerClick}
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors',
                    'hover:text-zinc-100 disabled:opacity-30',
                    speakerOn && 'text-emerald-300',
                  )}
                  data-slot="voice-speaker"
                />
              }
            >
              {speakerOn ? (
                <Volume2Icon className="size-4" aria-hidden />
              ) : (
                <VolumeXIcon className="size-4" aria-hidden />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {speakerActive
                ? speakerOn
                  ? 'Voice output on'
                  : 'Voice output off'
                : 'Voice output disabled'}
            </TooltipContent>
          </Tooltip>
        )}

        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            lastTranscriptRef.current = event.target.value;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your welder…"
          disabled={disabled}
          aria-label="Message"
          data-slot="composer-input"
          className={cn(
            'min-w-0 flex-1 bg-transparent px-2 text-sm text-zinc-100 placeholder:text-zinc-500',
            'outline-none disabled:opacity-50',
          )}
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          data-slot="composer-send"
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-150 ease-out',
            canSend
              ? 'bg-white text-zinc-900 hover:bg-zinc-200 active:scale-95'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
          )}
        >
          <ArrowUpIcon className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
