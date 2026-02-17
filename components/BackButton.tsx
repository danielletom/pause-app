import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

interface BackButtonProps {
  label?: string;
  light?: boolean;
  onPress?: () => void;
}

export default function BackButton({ label = 'Back', light = false, onPress }: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    hapticLight();
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <AnimatedPressable onPress={handlePress} scaleDown={0.95} style={styles.container}>
      <Text style={[styles.text, light && styles.textLight]}>
        ← {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingRight: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    color: '#78716c',
    fontWeight: '500',
  },
  textLight: {
    color: 'rgba(255,255,255,0.8)',
  },
});
