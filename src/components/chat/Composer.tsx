'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent } from 'react';
import {
  ArrowUpIcon,
  ImageIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VOICE_ENABLED } from '@/components/voice/voiceEnabled';
import type { SpeechApi } from '@/components/voice/useSpeech';
import { cn } from '@/lib/utils';

import { AttachmentChip } from './AttachmentChip';
import {
  PER_ATTACHMENT_BYTE_LIMIT,
  inferMediaType,
  prepareAttachment,
  type PreparedAttachment,
} from './image-compress';
import { setPendingAttachments, clearPendingAttachments } from './useChatSession';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_ATTACHMENTS = 4;

type ComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  speech: SpeechApi;
  speakerOn: boolean;
  onSpeakerToggle: (next: boolean) => void;
};

type AttachmentEntry = PreparedAttachment & { id: string };

let chipIdCounter = 0;
const nextChipId = () => `att-${++chipIdCounter}`;

function isImageFile(file: File): boolean {
  return inferMediaType(file.name) !== null;
}

export function Composer({
  disabled = false,
  onSubmit,
  speech,
  speakerOn,
  onSpeakerToggle,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const lastTranscriptRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (speech.transcript && speech.transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = speech.transcript;
      setValue(speech.transcript);
    }
  }, [speech.transcript]);

  useEffect(() => {
    return () => {
      // Revoke object URLs and clear any pending buffer on unmount.
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      clearPendingAttachments();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync attachments → module-level buffer so useChatSession.send picks them up.
  useEffect(() => {
    setPendingAttachments(attachments.map((a) => a.block));
  }, [attachments]);

  const addFiles = useCallback(
    async (files: File[]) => {
      setAttachError(null);
      const imageFiles = files.filter(isImageFile);
      if (imageFiles.length !== files.length) {
        setAttachError(
          'Only PNG, JPEG, WebP, and GIF images are supported (no SVG, HEIC, or PDFs).',
        );
      }
      let remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        setAttachError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
        return;
      }
      const next: AttachmentEntry[] = [];
      for (const file of imageFiles) {
        if (remaining <= 0) {
          setAttachError(`At most ${MAX_ATTACHMENTS} attachments per message — extras dropped.`);
          break;
        }
        if (file.size > PER_ATTACHMENT_BYTE_LIMIT * 5) {
          setAttachError(
            `"${file.name}" is too large to compress safely (${Math.round(file.size / (1024 * 1024))} MB).`,
          );
          continue;
        }
        try {
          const prepared = await prepareAttachment(file);
          next.push({ ...prepared, id: nextChipId() });
          remaining -= 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setAttachError(message);
        }
      }
      if (next.length > 0) {
        setAttachments((prev) => [...prev, ...next]);
      }
    },
    [attachments.length],
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list || list.length === 0) return;
      void addFiles(Array.from(list));
      event.target.value = '';
    },
    [addFiles],
  );

  const handleRemove = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const items = event.clipboardData?.files;
      if (!items || items.length === 0) return;
      const files = Array.from(items).filter(isImageFile);
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    },
    [addFiles],
  );

  // Window-level drag-drop. We can't reach into ChatShell to wrap the surface,
  // so the overlay is fixed to the viewport and fires off the global drag
  // counter so non-image drags don't show it.
  useEffect(() => {
    if (disabled) return;
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const hasFiles = Array.from(event.dataTransfer.items ?? []).some((it) => it.kind === 'file');
      if (!hasFiles) return;
      dragCounterRef.current += 1;
      setIsDragOver(true);
    };
    const onDragLeave = () => {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDragOver(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.items ?? []).some((it) => it.kind === 'file')) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [addFiles, disabled]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (disabled) return;
      if (trimmed.length === 0 && attachments.length === 0) return;
      // pendingAttachments was synced by the effect above; useChatSession will
      // consume it when send() runs.
      onSubmit(trimmed);
      setValue('');
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);
      setAttachError(null);
      lastTranscriptRef.current = '';
    },
    [attachments, disabled, onSubmit, value],
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

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;
  const micActive = VOICE_ENABLED && speech.supported.recognition && !disabled;
  const speakerActive = VOICE_ENABLED && speech.supported.synthesis && !disabled;
  const canAttachMore = attachments.length < MAX_ATTACHMENTS && !disabled;

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
      {isDragOver && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm"
          data-slot="composer-drop-overlay"
          aria-hidden
        >
          <div className="rounded-2xl border-2 border-dashed border-zinc-300/60 bg-zinc-900/80 px-8 py-6 text-sm font-medium text-zinc-100 shadow-lg">
            <ImageIcon className="mb-2 inline size-5 align-text-bottom" aria-hidden />{' '}
            Drop image to attach
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div
          className="mb-2 flex flex-wrap gap-2"
          data-slot="attachment-row"
        >
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              id={a.id}
              filename={a.filename}
              previewUrl={a.previewUrl}
              sizeBytes={a.sizeBytes}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {attachError && (
        <div
          className="mb-2 rounded-md bg-red-950/40 px-3 py-1.5 text-xs text-red-200 ring-1 ring-red-500/30"
          role="alert"
          data-slot="attachment-error"
        >
          {attachError}
        </div>
      )}

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
          onPaste={handlePaste}
          placeholder="Ask about your welder…"
          disabled={disabled}
          aria-label="Message"
          data-slot="composer-input"
          className={cn(
            'min-w-0 flex-1 bg-transparent px-2 text-sm text-zinc-100 placeholder:text-zinc-500',
            'outline-none disabled:opacity-50',
          )}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          hidden
          onChange={handleFileInput}
          data-slot="composer-file-input"
        />

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={!canAttachMore}
                aria-label="Attach image"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors',
                  'hover:text-zinc-100 disabled:opacity-30',
                )}
                data-slot="composer-attach"
              />
            }
          >
            <PaperclipIcon className="size-4" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>
            {canAttachMore ? 'Attach image (PNG, JPEG, WebP, GIF)' : `Max ${MAX_ATTACHMENTS} attachments`}
          </TooltipContent>
        </Tooltip>

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
