import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, MessageSquarePlus } from 'lucide-react-native';
import Animated, { ViewStyle } from 'react-native-reanimated';
import { UserAvatar } from '../UserAvatar';

interface FloatingTutorCardProps {
  botName: string;
  botAvatar: string;
  onBack?: () => void;
  onNewChat?: () => void;
  onMenu?: () => void;
  animatedStyle?: ViewStyle;
}

export const FloatingTutorCard: React.FC<FloatingTutorCardProps> = ({
  botName,
  botAvatar,
  onBack,
  onNewChat,
  onMenu,
  animatedStyle,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <Animated.View
      className="absolute top-0 left-0 right-0 z-50 px-4 pt-[40px] pb-2 items-center"
      style={animatedStyle}
      pointerEvents="box-none"
    >
      <View className="flex-row items-center bg-space-light/90 border border-white/10 rounded-full px-4 py-2 shadow-lg backdrop-blur-md w-full justify-between">

        <View className="flex-row items-center flex-1">
          <Pressable onPress={handleBack} className="mr-3 p-1 rounded-full active:bg-white/10">
            <ArrowLeft color="#fff" size={20} />
          </Pressable>

          <UserAvatar imageUri={botAvatar} size={32} className="mr-3" />

          <Text
            className="text-starlight text-base font-bold flex-1"
            numberOfLines={1}
          >
            {botName || 'Tutor'}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
           <Pressable
              onPress={onNewChat}
              className="p-2 rounded-full active:bg-white/10"
              accessibilityLabel="Novo Chat"
           >
              <MessageSquarePlus color="#94a3b8" size={20} />
           </Pressable>

           <Pressable
              onPress={onMenu}
              className="p-2 rounded-full active:bg-white/10"
              accessibilityLabel="Menu"
           >
              <MoreVertical color="#94a3b8" size={20} />
           </Pressable>
        </View>

      </View>
    </Animated.View>
  );
};
