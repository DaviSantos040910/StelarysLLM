import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

interface TypingIndicatorDotsProps {
  color?: string;
  size?: number;
  gap?: number;
}

export const TypingIndicatorDots: React.FC<TypingIndicatorDotsProps> = ({
  color = '#818cf8',
  size = 6,
  gap = 4
}) => {
  const animations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true
          })
        ])
      );
    };

    const anim1 = createAnimation(animations[0], 0);
    const anim2 = createAnimation(animations[1], 150);
    const anim3 = createAnimation(animations[2], 300);

    Animated.parallel([anim1, anim2, anim3]).start();

    return () => {
      animations.forEach(anim => anim.stopAnimation());
    };
  }, [animations]);

  return (
    <View style={[styles.container, { gap }]}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -size] // Jump height relative to size
                  })
                }
              ],
              opacity: anim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.6, 1, 0.6]
              })
            }
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20, // Enough height for the jump
    paddingHorizontal: 4
  },
  dot: {
    // Style handled dynamically
  }
});
