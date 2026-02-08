import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, User, MessageCircle, Compass, LayoutDashboard } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useMiniPlayerHeight } from '../hooks/useMiniPlayerHeight';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ICON_MAP: Record<string, any> = {
  'index': MessageCircle, // Home is now ChatList
  'profile': User,
  'explore': Compass, // New icon for Explore
};

function TabBarItem({
  isFocused,
  onPress,
  onLongPress,
  routeName,
  label
}: {
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  routeName: string;
  label?: string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    onPress();
  };

  const IconComponent = ICON_MAP[routeName] || LayoutDashboard;
  const activeColor = '#818cf8'; // cosmic-purple
  const inactiveColor = '#94a3b8'; // text-muted

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
      style={[animatedStyle, { alignItems: 'center', justifyContent: 'center', padding: 10 }]}
    >
      <View className={`p-2 rounded-full ${isFocused ? 'bg-cosmic-purple/20' : 'bg-transparent'}`}>
        <IconComponent
          size={24}
          color={isFocused ? activeColor : inactiveColor}
        />
      </View>
      {isFocused && (
        <View className="absolute -bottom-1 w-1 h-1 bg-cosmic-purple rounded-full" />
      )}
    </AnimatedPressable>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const miniPlayerHeight = useMiniPlayerHeight();

  const animatedStyle = useAnimatedStyle(() => {
    const baseMargin = Platform.OS === 'ios' ? insets.bottom : 20;
    return {
      marginBottom: withSpring(baseMargin + miniPlayerHeight, {
        damping: 20,
        stiffness: 100
      })
    };
  });

  return (
    <View className="absolute bottom-0 left-0 right-0 items-center" pointerEvents="box-none">
      <Animated.View
        style={[
          animatedStyle,
          {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 10,
          }
        ]}
        className="flex-row bg-white/95 dark:bg-space-light/95 border border-gray-200 dark:border-white/10 rounded-full px-6 py-2 mx-4 min-w-[200px] justify-around items-center"
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabBarItem
              key={route.key}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              routeName={route.name}
              label={options.tabBarLabel as string}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}
