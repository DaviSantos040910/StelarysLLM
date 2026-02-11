import React from 'react';
import { View, Text, Image, Pressable, ViewStyle } from 'react-native';
import { Edit2, Camera } from 'lucide-react-native';
import { User } from '../../types/auth';

interface ProfileHeaderProps {
    user: User | null;
    onEditPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onEditPress }) => {
    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || "Visitante";

    const initial = user?.username?.charAt(0).toUpperCase() || "?";

    return (
        <View className="items-center py-8">
            <Pressable onPress={onEditPress} className="relative" disabled={!user}>
                <View className="w-28 h-28 rounded-full border-4 border-space-light dark:border-space-dark overflow-hidden bg-gray-200 dark:bg-white/10">
                    {user?.avatar ? (
                        <Image source={{ uri: user.avatar }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Text className="text-4xl text-gray-400 dark:text-gray-500 font-bold">
                                {initial}
                            </Text>
                        </View>
                    )}
                </View>
                {user && (
                    <View className="absolute bottom-0 right-0 bg-cosmic-purple p-2 rounded-full border-2 border-white dark:border-space-dark">
                        <Edit2 size={16} color="white" />
                    </View>
                )}
            </Pressable>

            <View className="mt-4 items-center">
                <Text className="text-2xl font-bold text-gray-900 dark:text-starlight">
                    {displayName}
                </Text>
                {user?.email && (
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        {user.email}
                    </Text>
                )}
            </View>
        </View>
    );
};
