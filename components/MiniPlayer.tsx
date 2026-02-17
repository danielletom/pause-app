import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';
import { useAudio } from '@/lib/audio-context';

const MINI_PLAYER_HEIGHT = 56;

export default function MiniPlayer() {
  const { track, isPlaying, isLoading, position, duration, togglePlayPause, stop } = useAudio();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Don't show mini-player when full player is open or no track
  if (!track || pathname === '/player') return null;

  const progress = duration > 0 ? position / duration : 0;

  const typeIcon = track.contentType === 'podcast' ? '🎙'
    : track.contentType === 'meditation' ? '🧘'
    : track.contentType === 'lesson' ? '📚'
    : '🎧';

  // Position above tab bar
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <View style={[styles.wrapper, { bottom: tabBarHeight }]}>
      {/* Progress bar across the top */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <AnimatedPressable
        onPress={() => {
          hapticLight();
          router.push({ pathname: '/(app)/player', params: { id: String(track.id) } });
        }}
        scaleDown={0.98}
        style={styles.container}
      >
        {/* Icon */}
        <View style={styles.icon}>
          <Text style={styles.iconText}>{typeIcon}</Text>
        </View>

        {/* Title */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {track.contentType === 'podcast' ? 'The Pause Pod' : track.category || 'Audio'}
          </Text>
        </View>

        {/* Play/Pause */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            togglePlayPause();
          }}
          scaleDown={0.9}
          style={styles.playButton}
        >
          <Text style={styles.playIcon}>
            {isLoading ? '...' : isPlaying ? '❚❚' : '▶'}
          </Text>
        </AnimatedPressable>

        {/* Close / dismiss */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            stop();
          }}
          scaleDown={0.9}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </AnimatedPressable>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#fafaf9',
    borderTopWidth: 1,
    borderTopColor: '#e7e5e4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 5,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#e7e5e4',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1c1917',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
  },
  subtitle: {
    fontSize: 11,
    color: '#a8a29e',
    marginTop: 1,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 12,
    color: '#ffffff',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 12,
    color: '#a8a29e',
    fontWeight: '600',
  },
});
