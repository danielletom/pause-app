import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pause-api-seven.vercel.app';

interface ContentItem {
  id: number;
  title: string;
  description: string | null;
  contentType: string;
  audioUrl: string | null;
  durationMinutes: number | null;
  category: string | null;
  tags: string[];
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Fetch content
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const data = await apiRequest(`/api/content?id=${id}`, token);
        setContent(data);
      } catch (err) {
        console.error('Failed to load content:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
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

  const togglePlayPause = async () => {
    hapticMedium();

    if (!content?.audioUrl) return;

    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      return;
    }

    // First time — load and play
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const audioUri = content.audioUrl.startsWith('http')
      ? content.audioUrl
      : `${API_URL}${content.audioUrl}`;

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    setSound(newSound);
    setIsPlaying(true);
  };

  const seekBy = async (seconds: number) => {
    hapticLight();
    if (sound) {
      const newPos = Math.max(0, Math.min(position + seconds * 1000, duration));
      await sound.setPositionAsync(newPos);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </SafeAreaView>
    );
  }

  if (!content) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Content not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeLabel = content.contentType === 'podcast' ? 'The Pause Pod'
    : content.contentType === 'meditation' ? 'Guided Meditation'
    : content.contentType === 'lesson' ? 'Audio Lesson'
    : 'Audio';

  const typeIcon = content.contentType === 'podcast' ? '🎙'
    : content.contentType === 'meditation' ? '🧘'
    : content.contentType === 'lesson' ? '📚'
    : '🎧';

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <AnimatedPressable
        onPress={() => { hapticLight(); router.back(); }}
        scaleDown={0.95}
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Back</Text>
      </AnimatedPressable>

      <View style={styles.content}>
        {/* Cover art area */}
        <View style={styles.coverContainer}>
          <View style={styles.cover}>
            <Text style={styles.coverIcon}>{typeIcon}</Text>
          </View>
        </View>

        {/* Title & info */}
        <View style={styles.info}>
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          <Text style={styles.title}>{content.title}</Text>
          {content.description && (
            <Text style={styles.description} numberOfLines={2}>
              {content.description}
            </Text>
          )}
          {content.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{content.category}</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{duration > 0 ? formatTime(duration) : `${content.durationMinutes || '?'} min`}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <AnimatedPressable onPress={() => seekBy(-15)} scaleDown={0.9} style={styles.seekButton}>
            <Text style={styles.seekText}>-15s</Text>
          </AnimatedPressable>

          <AnimatedPressable onPress={togglePlayPause} scaleDown={0.95} style={styles.playPauseButton}>
            <Text style={styles.playPauseIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          </AnimatedPressable>

          <AnimatedPressable onPress={() => seekBy(30)} scaleDown={0.9} style={styles.seekButton}>
            <Text style={styles.seekText}>+30s</Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: '#a8a29e' },

  backButton: { paddingHorizontal: 24, paddingVertical: 12 },
  backText: { fontSize: 16, color: '#78716c', fontWeight: '500' },

  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },

  coverContainer: { alignItems: 'center', marginBottom: 32 },
  cover: {
    width: 200,
    height: 200,
    borderRadius: 24,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  coverIcon: { fontSize: 64 },

  info: { alignItems: 'center', marginBottom: 32 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: '#d97706', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1c1917', textAlign: 'center', lineHeight: 26 },
  description: { fontSize: 13, color: '#78716c', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  categoryPill: {
    marginTop: 10,
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, color: '#a8a29e', fontWeight: '500' },

  progressContainer: { marginBottom: 24 },
  progressBar: {
    height: 4,
    backgroundColor: '#e7e5e4',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1c1917',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: { fontSize: 11, color: '#a8a29e' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  seekButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekText: { fontSize: 11, fontWeight: '600', color: '#78716c' },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseIcon: { fontSize: 18, color: '#ffffff' },
});
