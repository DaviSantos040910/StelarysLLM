import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';

interface UserAvatarProps {
  imageUri?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ imageUri, size = 48, className }: UserAvatarProps) {
  return (
    <View
      className={`rounded-full overflow-hidden bg-space-light border border-cosmic-purple items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <User size={size * 0.5} color="#ffffff" />
      )}
    </View>
  );
}
