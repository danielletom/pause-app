import React, { useCallback } from 'react';
import {
  Pressable,
  PressableProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPress = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleDown?: number;
  disabled?: boolean;
}

/**
 * A Pressable that scales down slightly on press with a springy animation.
 * Drop-in replacement for TouchableOpacity with a more tactile feel.
 */
export default function AnimatedPressable({
  children,
  style,
  scaleDown = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(scaleDown, {
        damping: 15,
        stiffness: 400,
      });
      onPressIn?.(e);
    },
    [scaleDown, onPressIn]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 400,
      });
      onPressOut?.(e);
    },
    [onPressOut]
  );

  return (
    <AnimatedPress
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style, disabled && { opacity: 0.5 }]}
      disabled={disabled}
      {...props}
    >
      {children}
    </AnimatedPress>
  );
}
