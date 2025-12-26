import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, UserCircle } from 'lucide-react-native';

const ICON_MAP: Record<string, any> = {
  'index': LayoutDashboard,
  'profile': UserCircle,
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="absolute bottom-0 left-0 right-0 items-center">
        <View
            style={{
                marginBottom: Platform.OS === 'ios' ? insets.bottom : 20,
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 3.5,
            }}
            className="flex-row bg-space-card/90 border border-white/10 rounded-full px-4 py-2 mx-5 min-w-[200px] justify-around items-center h-16"
        >
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;
                const IconComponent = ICON_MAP[route.name] || LayoutDashboard;

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

                return (
                    <TouchableOpacity
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        testID={options.tabBarTestID}
                        onPress={onPress}
                        className="items-center justify-center p-2"
                    >
                        <View className={`p-2 rounded-full ${isFocused ? 'bg-nebula/20' : 'bg-transparent'}`}>
                             <IconComponent
                                size={24}
                                color={isFocused ? '#6366f1' : '#94a3b8'}
                             />
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
  );
}
