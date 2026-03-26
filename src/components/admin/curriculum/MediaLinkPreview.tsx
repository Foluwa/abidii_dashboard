'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

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

  return (
    <div className="group rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start gap-3">
        {resolvedKind === 'image' ? (
          <div className="relative w-24 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label || 'Media preview'}
              className={`${previewHeightClass} w-24 rounded-lg object-cover`}
            />
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
            className={`${previewHeightClass} w-24 flex-shrink-0 rounded-lg bg-black object-cover`}
            src={url}
            aria-label={label || 'Video preview'}
          />
        ) : resolvedKind === 'audio' ? (
          <div className="flex min-w-[7rem] flex-shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => void toggleAudio()}
              className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
            >
              {isPlaying ? 'Pause audio' : 'Play audio'}
            </button>
            <audio ref={audioRef} controls preload="none" className="w-full" src={url} aria-label={label || 'Audio preview'} />
          </div>
        ) : (
          <div className={`${previewHeightClass} flex w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400`}>
            File
          </div>
        )}

        <div className="min-w-0 flex-1">
          {label ? (
            <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
          ) : null}
          <div className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{url}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Open {resolvedKind}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
