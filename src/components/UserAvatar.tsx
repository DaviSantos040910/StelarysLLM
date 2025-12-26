import React from 'react';
import { View, Image } from 'react-native';
import { User } from 'lucide-react-native';

interface UserAvatarProps {
  uri?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ uri, size = 48, className }: UserAvatarProps) {
  return (
    <View
      className={`rounded-full overflow-hidden bg-space-card border border-white/10 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <User size={size * 0.5} color="#94a3b8" />
      )}
    </View>
  );
}
