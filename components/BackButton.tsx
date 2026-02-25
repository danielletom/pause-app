import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { useRouter, useNavigationContainerRef } from 'expo-router';
import AnimatedPressable from './AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

interface BackButtonProps {
  /** Override the default label. Default: "Back" */
  label?: string;
  /** Use light text for dark backgrounds */
  light?: boolean;
  /** Custom onPress — defaults to router.back() */
  onPress?: () => void;
  /** Extra container styles */
  style?: ViewStyle;
}

/**
 * Accessible back button sized for 40+ demographic.
 * 44pt minimum tap target, 16px font, clear contrast.
 */
export default function BackButton({ label = 'Back', light = false, onPress, style }: BackButtonProps) {
  const router = useRouter();
  const navRef = useNavigationContainerRef();

  const safeGoBack = () => {
    if (onPress) { onPress(); return; }
    if (navRef.canGoBack()) { router.back(); }
    else { router.navigate('/(app)/(tabs)'); }
  };

  return (
    <AnimatedPressable
      onPress={() => { hapticLight(); safeGoBack(); }}
      scaleDown={0.95}
      style={[styles.container, style]}
    >
      <Text style={[styles.arrow, light && styles.lightText]}>‹</Text>
      <Text style={[styles.label, light && styles.lightText]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 16,
    minHeight: 44, // Apple HIG minimum tap target
    gap: 4,
  },
  arrow: {
    fontSize: 24,
    fontWeight: '500',
    color: '#78716c',
    marginTop: -1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#78716c',
  },
  lightText: {
    color: 'rgba(255,255,255,0.8)',
  },
});
