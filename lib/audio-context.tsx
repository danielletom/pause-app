import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pause-api-seven.vercel.app';

export interface Track {
  id: number;
  title: string;
  description: string | null;
  contentType: string;
  audioUrl: string;
  durationMinutes: number | null;
  category: string | null;
}

interface AudioContextType {
  // Current track
  track: Track | null;
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  position: number;   // ms
  duration: number;    // ms
  // Actions
  play: (track: Track) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekBy: (seconds: number) => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  stop: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Set up audio mode once
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    }).catch(() => {});
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, []);

  const unloadCurrent = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  const play = useCallback(async (newTrack: Track) => {
    // If same track, just resume
    if (track?.id === newTrack.id && soundRef.current) {
      await soundRef.current.playAsync();
      return;
    }

    setIsLoading(true);
    setTrack(newTrack);
    setPosition(0);
    setDuration(0);

    // Unload previous
    await unloadCurrent();

    // Build URI
    const audioUri = newTrack.audioUrl.startsWith('http')
      ? newTrack.audioUrl
      : `${API_URL}${newTrack.audioUrl}`;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to load audio:', err);
      setTrack(null);
    } finally {
      setIsLoading(false);
    }
  }, [track, onPlaybackStatusUpdate, unloadCurrent]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.warn('togglePlayPause error (sound may have been unloaded):', err);
    }
  }, [isPlaying]);

  const seekBy = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    try {
      const newPos = Math.max(0, Math.min(position + seconds * 1000, duration));
      await soundRef.current.setPositionAsync(newPos);
    } catch (err) {
      console.warn('seekBy error:', err);
    }
  }, [position, duration]);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!soundRef.current) return;
    try {
      const clamped = Math.max(0, Math.min(positionMs, duration));
      await soundRef.current.setPositionAsync(clamped);
    } catch (err) {
      console.warn('seekTo error:', err);
    }
  }, [duration]);

  const stop = useCallback(async () => {
    await unloadCurrent();
    setTrack(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, [unloadCurrent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        track,
        isPlaying,
        isLoading,
        position,
        duration,
        play,
        togglePlayPause,
        seekBy,
        seekTo,
        stop,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
