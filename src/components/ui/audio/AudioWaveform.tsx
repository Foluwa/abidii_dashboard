"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiPlay, FiPause, FiVolume2, FiVolumeX } from "react-icons/fi";

interface AudioWaveformProps {
  src: string;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  src,
  height = 60,
  waveColor = "#94a3b8",
  progressColor = "#3b82f6",
  cursorColor = "#1d4ed8",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const warnedErrorSourcesRef = useRef<Set<string>>(new Set());
  const hasError = errorSrc === src;

  const buildFallbackWaveform = useCallback((seedSource: string) => {
    let seed = 0;
    for (let i = 0; i < seedSource.length; i++) {
      seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
    }

    const values = Array.from({ length: 100 }, (_, index) => {
      seed = (seed * 1664525 + 1013904223 + index) >>> 0;
      const normalized = (seed % 1000) / 1000;
      return 0.18 + normalized * 0.52;
    });

    setWaveformData(values);
  }, []);

  const isCrossOriginSource = useCallback((audioSrc: string) => {
    if (typeof window === "undefined") return false;

    try {
      const resolved = new URL(audioSrc, window.location.href);
      return resolved.origin !== window.location.origin;
    } catch {
      return false;
    }
  }, []);

  const analyzeAudio = useCallback(async (audioSrc: string) => {
    try {
      if (isCrossOriginSource(audioSrc)) {
        buildFallbackWaveform(audioSrc);
        return;
      }

      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 100; // Number of bars in waveform
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }

      const max = Math.max(...filteredData);
      const normalized = filteredData.map((val) => val / max);
      setWaveformData(normalized);
    } catch (error) {
      console.warn("Audio analysis fallback:", error);
      buildFallbackWaveform(audioSrc);
    }
  }, [buildFallbackWaveform, isCrossOriginSource]);

  // Load and analyze audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    audio.src = src;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      analyzeAudio(src);
    };

    const handleError = () => {
      if (!warnedErrorSourcesRef.current.has(src)) {
        warnedErrorSourcesRef.current.add(src);
        console.warn("Audio source unavailable:", src);
      }
      setErrorSrc(src);
      setWaveformData(Array(100).fill(0).map(() => Math.random() * 0.3));
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
    };
  }, [analyzeAudio, src]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformData.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    waveformData.forEach((value, i) => {
      const barHeight = value * height * 0.8;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      // Draw bar
      ctx.fillStyle = i / waveformData.length < progress ? progressColor : waveColor;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw cursor
    if (progress > 0) {
      const cursorX = progress * width;
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }
  }, [waveformData, currentTime, duration, height, waveColor, progressColor, cursorColor]);

  // Animation loop
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.warn("Error playing audio:", error);
      setErrorSrc(src);
      setIsPlaying(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audio.currentTime = percent * duration;
    setCurrentTime(audio.currentTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`w-full ${className}`}>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
      />

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
            hasError || !src
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-brand-600 hover:bg-brand-700 text-white'
          }`}
          disabled={!src || hasError}
          title={hasError ? 'Audio unavailable' : src ? 'Play/Pause' : 'No audio source'}
          aria-label={hasError ? 'Audio unavailable' : isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <FiPause className="w-4 h-4" />
          ) : (
            <FiPlay className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Waveform */}
        <div ref={containerRef} className="flex-1 relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full cursor-pointer"
            style={{ height: `${height}px` }}
          />
        </div>

        {/* Time Display */}
        <div className="flex-shrink-0 text-xs font-mono text-gray-600 dark:text-gray-400 min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleMute}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <FiVolumeX className="w-4 h-4" />
            ) : (
              <FiVolume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
          />
        </div>
      </div>
    </div>
  );
};
