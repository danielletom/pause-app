import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { hapticSelection } from '@/lib/haptics';

interface SeveritySliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  labels?: string[];
  color?: string;
}

export default function SeveritySlider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 10,
  labels = ['None', 'Mild', 'Moderate', 'Severe'],
  color = '#1c1917',
}: SeveritySliderProps) {
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);
  const lastStep = useRef(value);
  // Use refs so the PanResponder closure always has latest values
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;

  const getValueFromX = useCallback((pageX: number) => {
    const localX = pageX - trackPageX.current;
    const clamped = Math.max(0, Math.min(localX, trackWidth.current));
    const ratio = trackWidth.current > 0 ? clamped / trackWidth.current : 0;
    return Math.round(ratio * (maxRef.current - minRef.current) + minRef.current);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        const newVal = getValueFromX(gesture.x0);
        onValueChangeRef.current(newVal);
        lastStep.current = newVal;
      },
      onPanResponderMove: (_, gesture) => {
        const newVal = getValueFromX(gesture.moveX);
        if (newVal !== lastStep.current) {
          hapticSelection();
          lastStep.current = newVal;
        }
        onValueChangeRef.current(newVal);
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    // Measure the track's absolute position on screen
    (e.target as any)?.measureInWindow?.((x: number) => {
      if (typeof x === 'number') trackPageX.current = x;
    });
  };

  const percentage = ((value - min) / (max - min)) * 100;
  const labelIndex = Math.min(
    Math.floor((value / max) * labels.length),
    labels.length - 1
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueLabel, { color }]}>{labels[labelIndex]}</Text>
      </View>
      <View
        style={styles.track}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
        <View
          style={[
            styles.thumb,
            {
              left: `${percentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  track: {
    height: 6,
    backgroundColor: '#e7e5e4',
    borderRadius: 3,
    justifyContent: 'center',
    // Expand hit area so users don't have to precisely tap a 6px line
    paddingVertical: 14,
    marginVertical: -14,
  },
  fill: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    marginLeft: -11,
    top: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
