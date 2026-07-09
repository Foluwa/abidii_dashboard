'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause } from 'react-icons/fi';

interface InlineAudioPlayerProps {
  src?: string | null;
  size?: 'sm' | 'md';
}

export default function InlineAudioPlayer({ src, size = 'sm' }: InlineAudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current || !src) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  if (!src) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  }

  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex ${btnSize} items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 transition-colors`}
        title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <FiPause className={iconSize} />
        ) : (
          <FiPlay className={`${iconSize} ml-0.5`} />
        )}
      </button>
      <audio ref={audioRef} src={src} preload="none" className="hidden" />
    </div>
  );
}
