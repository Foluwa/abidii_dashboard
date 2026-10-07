'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, Image, Pause as PauseIcon, Play as PlayIcon, Video as VideoIcon, Volume2 } from "lucide-react";

type MediaKind = 'image' | 'audio' | 'video' | 'file';

function normalizeKind(kind?: string | null): MediaKind {
  if (kind === 'audio' || kind === 'video' || kind === 'image') {
    return kind;
  }
  return 'file';
}

function inferKindFromUrl(url: string): MediaKind {
  const normalized = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/.test(normalized)) return 'image';
  if (/\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/.test(normalized)) return 'audio';
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(normalized)) return 'video';
  return 'file';
}

export default function MediaLinkPreview({
  url,
  label,
  kind,
  compact = false,
  onRemove,
}: {
  url: string;
  label?: string;
  kind?: string | null;
  compact?: boolean;
  onRemove?: (() => void) | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const resolvedKind = useMemo(() => {
    const explicitKind = normalizeKind(kind);
    return explicitKind === 'file' ? inferKindFromUrl(url) : explicitKind;
  }, [kind, url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const previewHeightClass = compact ? 'h-16' : 'h-28';
  const previewWidthClass = compact ? 'w-16' : 'w-24';

  const mediaBadge =
    resolvedKind === 'image' ? (
      <Image className="h-4 w-4" aria-hidden="true" />
    ) : resolvedKind === 'audio' ? (
      <Volume2 className="h-4 w-4" aria-hidden="true" />
    ) : resolvedKind === 'video' ? (
      <VideoIcon className="h-4 w-4" aria-hidden="true" />
    ) : (
      <FileText className="h-4 w-4" aria-hidden="true" />
    );

  return (
    <div className="group rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-start gap-3">
        {resolvedKind === 'image' ? (
          <div className={`relative ${previewWidthClass} flex-shrink-0`}>
            <a href={url} target="_blank" rel="noreferrer" title={url} aria-label={label ? `Open ${label}` : 'Open image'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label || 'Media preview'}
                className={`${previewHeightClass} ${previewWidthClass} rounded-lg object-cover`}
              />
            </a>
            {onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white opacity-0 shadow transition-opacity hover:bg-red-700 group-hover:opacity-100"
                aria-label={label ? `Remove ${label}` : 'Remove image'}
                title="Remove image"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : resolvedKind === 'video' ? (
          <video
            controls
            className={`${previewHeightClass} ${previewWidthClass} flex-shrink-0 rounded-lg bg-black object-cover`}
            src={url}
            aria-label={label || 'Video preview'}
          />
        ) : resolvedKind === 'audio' ? (
          <div className="flex min-w-[12rem] flex-shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2 py-2">
            <button
              type="button"
              onClick={() => void toggleAudio()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-300 bg-background text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              title={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? <PauseIcon className="h-4 w-4" aria-hidden="true" /> : <PlayIcon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <audio
              ref={audioRef}
              controls
              preload="none"
              className={compact ? 'h-9 w-full min-w-0' : 'w-full'}
              src={url}
              aria-label={label || 'Audio preview'}
            />
          </div>
        ) : (
          <div className={`${previewHeightClass} ${previewWidthClass} flex flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground`}>
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {label ? <div className="truncate text-sm font-medium text-foreground">{label}</div> : null}
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {mediaBadge}
                <span>{resolvedKind}</span>
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title={url}
              aria-label={label ? `Open ${label} in a new tab` : `Open ${resolvedKind} in a new tab`}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-input bg-card text-foreground hover:bg-muted/50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
