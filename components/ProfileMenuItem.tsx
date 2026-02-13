import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

interface ProfileMenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  badge?: string;
  onPress?: () => void;
  isLast?: boolean;
}

export default function ProfileMenuItem({
  icon,
  label,
  subtitle,
  badge,
  onPress,
  isLast = false,
}: ProfileMenuItemProps) {
  const handlePress = () => {
    hapticLight();
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      scaleDown={0.98}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color="#78716c" />
      </View>
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d6d3d1" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fafaf9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
  },
  badge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d97706',
  },
  subtitle: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 1,
  },
});
