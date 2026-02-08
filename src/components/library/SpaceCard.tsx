import { Layers } from 'lucide-react-native';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { StudySpace } from '../../types/studio';
import { themeClasses } from '../../theme/classes';

interface Props {
    space: StudySpace;
    onPress: () => void;
}

export const SpaceCard: React.FC<Props> = ({ space, onPress }) => {
    return (
        <Pressable
            onPress={onPress}
            className={`rounded-2xl mb-4 overflow-hidden shadow-sm active:opacity-90 ${themeClasses.surface}`}
        >
            <View className="h-32 bg-gray-200 dark:bg-gray-800 relative">
                {space.cover_image ? (
                    <Image source={{ uri: space.cover_image }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="flex-1 items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                        <Layers size={40} color="rgba(255,255,255,0.3)" />
                    </View>
                )}

                <View className="absolute bottom-0 left-0 right-0 p-4 bg-black/40 backdrop-blur-sm">
                    <Text className="text-white text-lg font-bold" numberOfLines={1}>{space.title}</Text>
                </View>
            </View>

            <View className="p-4 flex-row justify-between">
                <Text className={`${themeClasses.textMuted} text-xs font-medium`}>{space.sources?.length || 0} fontes</Text>
                <Text className={`${themeClasses.textMuted} text-xs font-medium`}>{space.bots?.length || 0} tutores</Text>
            </View>
        </Pressable>
    );
};
