import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { useAudio, Track } from '@/lib/audio-context';

interface ContentData {
  id: number;
  title: string;
  description: string | null;
  contentType: string;
  audioUrl: string | null;
  durationMinutes: number | null;
  category: string | null;
  tags: string[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PROGRESS_HORIZONTAL_PADDING = 32;
const PROGRESS_WIDTH = SCREEN_WIDTH - PROGRESS_HORIZONTAL_PADDING * 2;
const DISMISS_THRESHOLD = 120;

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const audio = useAudio();

  const [contentData, setContentData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Swipe-down to minimize
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = translateY.interpolate({
    inputRange: [0, DISMISS_THRESHOLD],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  const dismissPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only capture vertical downward swipes (not taps or horizontal gestures)
      return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx * 1.5);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
        // Dismiss — animate out then navigate
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          hapticLight();
          router.back();
        });
      } else {
        // Snap back
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      }
    },
  }), []);

  // Fetch content data
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const data = await apiRequest(`/api/content?id=${id}`, token);
        setContentData(data);

        // Auto-play if not already playing this track
        if (data.audioUrl && audio.track?.id !== data.id) {
          const track: Track = {
            id: data.id,
            title: data.title,
            description: data.description,
            contentType: data.contentType,
            audioUrl: data.audioUrl,
            durationMinutes: data.durationMinutes,
            category: data.category,
          };
          audio.play(track);
        }
      } catch (err) {
        console.error('Failed to load content:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // Scrubbing via pan gesture on progress bar
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / PROGRESS_WIDTH, 1));
      audio.seekTo(ratio * audio.duration);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / PROGRESS_WIDTH, 1));
      audio.seekTo(ratio * audio.duration);
    },
  });

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audio.duration > 0 ? audio.position / audio.duration : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </SafeAreaView>
    );
  }

  if (!contentData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Content not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeLabel = contentData.contentType === 'podcast' ? 'The Pause Pod'
    : contentData.contentType === 'meditation' ? 'Guided Meditation'
    : contentData.contentType === 'lesson' ? 'Audio Lesson'
    : 'Audio';

  const typeIcon = contentData.contentType === 'podcast' ? '🎙'
    : contentData.contentType === 'meditation' ? '🧘'
    : contentData.contentType === 'lesson' ? '📚'
    : '🎧';

  return (
    <Animated.View
      {...dismissPanResponder.panHandlers}
      style={[styles.dismissWrapper, { transform: [{ translateY }], opacity }]}
    >
    <SafeAreaView style={styles.container}>
      {/* Swipe indicator pill */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipePill} />
      </View>

      {/* Back / minimize button */}
      <AnimatedPressable
        onPress={() => { hapticLight(); router.back(); }}
        scaleDown={0.95}
        style={styles.backButton}
      >
        <Text style={styles.backText}>⌄</Text>
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
          <Text style={styles.title}>{contentData.title}</Text>
          {contentData.description && (
            <Text style={styles.description} numberOfLines={2}>
              {contentData.description}
            </Text>
          )}
          {contentData.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{contentData.category}</Text>
            </View>
          )}
        </View>

        {/* Progress bar — fat and scrubbable */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarWrapper} {...panResponder.panHandlers}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            {/* Scrub handle */}
            <View
              style={[
                styles.scrubHandle,
                { left: `${progress * 100}%` },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(audio.position)}</Text>
            <Text style={styles.timeText}>
              {audio.duration > 0 ? formatTime(audio.duration) : `${contentData.durationMinutes || '?'} min`}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <AnimatedPressable
            onPress={() => { hapticLight(); audio.seekBy(-15); }}
            scaleDown={0.9}
            style={styles.seekButton}
          >
            <Text style={styles.seekText}>-15s</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => { hapticMedium(); audio.togglePlayPause(); }}
            scaleDown={0.95}
            style={styles.playPauseButton}
          >
            <Text style={styles.playPauseIcon}>
              {audio.isLoading ? '...' : audio.isPlaying ? '❚❚' : '▶'}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => { hapticLight(); audio.seekBy(30); }}
            scaleDown={0.9}
            style={styles.seekButton}
          >
            <Text style={styles.seekText}>+30s</Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dismissWrapper: { flex: 1, backgroundColor: '#fafaf9' },
  container: { flex: 1 },
  swipeIndicator: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  swipePill: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#d6d3d1' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: '#a8a29e' },

  backButton: { alignItems: 'center', paddingVertical: 8 },
  backText: { fontSize: 28, color: '#a8a29e', fontWeight: '300' },

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

  progressContainer: { marginBottom: 28 },
  progressBarWrapper: {
    paddingVertical: 12, // extra touch target
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e7e5e4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1c1917',
    borderRadius: 4,
  },
  scrubHandle: {
    position: 'absolute',
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1c1917',
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: { fontSize: 12, color: '#a8a29e', fontWeight: '500' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  seekButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekText: { fontSize: 12, fontWeight: '600', color: '#78716c' },
  playPauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseIcon: { fontSize: 20, color: '#ffffff' },
});
