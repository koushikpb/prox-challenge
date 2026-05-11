'use client';

import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { SpeechApi } from './useSpeech';
import { VOICE_ENABLED } from './voiceEnabled';

const MIC_DISABLED_TOOLTIP =
  'Voice input disabled. Set NEXT_PUBLIC_VOICE_ENABLED=true and use a supported browser (Chrome).';
const MIC_ENABLED_TOOLTIP_IDLE = 'Tap to speak';
const MIC_ENABLED_TOOLTIP_LISTENING = 'Listening… tap to stop';
const SPEAKER_DISABLED_TOOLTIP = 'Voice output disabled. Set NEXT_PUBLIC_VOICE_ENABLED=true.';
const SPEAKER_ON_TOOLTIP = 'Read assistant replies aloud (on)';
const SPEAKER_OFF_TOOLTIP = 'Read assistant replies aloud (off)';

type VoiceControlsProps = {
  speech: SpeechApi;
  speakerOn: boolean;
  onSpeakerToggle: (next: boolean) => void;
  disabled?: boolean;
};

export function VoiceControls({
  speech,
  speakerOn,
  onSpeakerToggle,
  disabled = false,
}: VoiceControlsProps) {
  const micActive = VOICE_ENABLED && speech.supported.recognition && !disabled;
  const speakerActive = VOICE_ENABLED && speech.supported.synthesis && !disabled;

  const micTooltip = !micActive
    ? MIC_DISABLED_TOOLTIP
    : speech.listening
      ? MIC_ENABLED_TOOLTIP_LISTENING
      : MIC_ENABLED_TOOLTIP_IDLE;

  const speakerTooltip = !speakerActive
    ? SPEAKER_DISABLED_TOOLTIP
    : speakerOn
      ? SPEAKER_ON_TOOLTIP
      : SPEAKER_OFF_TOOLTIP;

  const onMicClick = () => {
    if (!micActive) return;
    if (speech.listening) speech.stopListening();
    else speech.startListening();
  };

  const onSpeakerClick = () => {
    if (!speakerActive) return;
    const next = !speakerOn;
    if (!next) speech.cancelSpeech();
    onSpeakerToggle(next);
  };

  return (
    <div className="flex items-center gap-1" data-slot="voice-controls">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant={speech.listening ? 'default' : 'ghost'}
              size="icon-sm"
              disabled={!micActive}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop listening' : 'Start voice input'}
              onClick={onMicClick}
              className={cn(speech.listening && 'animate-pulse')}
            />
          }
        >
          {speech.listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
        </TooltipTrigger>
        <TooltipContent>{micTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant={speakerOn ? 'default' : 'ghost'}
              size="icon-sm"
              disabled={!speakerActive}
              aria-pressed={speakerOn}
              aria-label={speakerOn ? 'Disable voice output' : 'Enable voice output'}
              onClick={onSpeakerClick}
            />
          }
        >
          {speakerOn ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
        </TooltipTrigger>
        <TooltipContent>{speakerTooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
