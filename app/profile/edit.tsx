import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { userService } from '../../src/services/userService';
import { useAuthStore } from '../../src/stores/authStore';

export default function EditProfileScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { pickImage } = useAttachmentPicker();

    const [firstName, setFirstName] = useState(user?.first_name || '');
    const [lastName, setLastName] = useState('');
    const [avatar, setAvatar] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePickAvatar = async () => {
        const result = await pickImage();
        if (result && result[0]) {
            setAvatar(result[0]);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const updatedUser = await userService.updateProfile({
                first_name: firstName,
                last_name: lastName,
                avatar: avatar
            });
            // Note: setUser not available in AuthState, would need to reload user data
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao atualizar perfil.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-space-dark" edges={['top']}>
            {/* Header */}
            <View className="px-4 py-4 flex-row items-center justify-between border-b border-gray-200 dark:border-white/10">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-white/10">
                    <ArrowLeft className="text-gray-900 dark:text-white" size={24} />
                </Pressable>
                <Text className="text-lg font-bold text-gray-900 dark:text-starlight">Editar Perfil</Text>
                <Pressable
                    onPress={handleSave}
                    disabled={isSubmitting}
                    className="p-2"
                >
                    {isSubmitting ? <ActivityIndicator size="small" color="#818cf8" /> : <Check size={24} color="#818cf8" />}
                </Pressable>
            </View>

            <View className="p-6 items-center">
                <Pressable onPress={handlePickAvatar} className="relative mb-8">
                    <View className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10 border-4 border-white dark:border-space-light">
                        {avatar ? (
                            <Image source={{ uri: avatar.uri }} className="w-full h-full" />
                        ) : user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
                        ) : (
                            <View className="w-full h-full items-center justify-center">
                                <Text className="text-4xl text-gray-400 font-bold">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View className="absolute bottom-0 right-0 bg-cosmic-purple p-2 rounded-full border-2 border-white dark:border-space-dark">
                        <Camera size={16} color="white" />
                    </View>
                </Pressable>

                <View className="w-full space-y-4">
                    <View>
                        <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Nome</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            className="bg-white dark:bg-space-light p-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-starlight"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Sobrenome</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            className="bg-white dark:bg-space-light p-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-starlight"
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
