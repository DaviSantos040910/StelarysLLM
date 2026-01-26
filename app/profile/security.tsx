import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { userService } from '../../src/services/userService';

export default function SecurityScreen() {
    const router = useRouter();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            Alert.alert("Erro", "Preencha todos os campos.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Erro", "As senhas não coincidem.");
            return;
        }

        setIsSubmitting(true);
        try {
            await userService.changePassword({ old_password: oldPassword, new_password: newPassword });
            Alert.alert("Sucesso", "Senha alterada com sucesso!");
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Senha atual incorreta ou erro no servidor.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-space-dark" edges={['top']}>
            <View className="px-4 py-4 flex-row items-center justify-between border-b border-gray-200 dark:border-white/10">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-white/10">
                    <ArrowLeft className="text-gray-900 dark:text-white" size={24} />
                </Pressable>
                <Text className="text-lg font-bold text-gray-900 dark:text-starlight">Segurança</Text>
                <Pressable onPress={handleSave} disabled={isSubmitting} className="p-2">
                    {isSubmitting ? <ActivityIndicator size="small" color="#818cf8" /> : <Check size={24} color="#818cf8" />}
                </Pressable>
            </View>

            <View className="p-6 space-y-6">
                <View>
                    <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Senha Atual</Text>
                    <TextInput
                        value={oldPassword}
                        onChangeText={setOldPassword}
                        secureTextEntry
                        className="bg-white dark:bg-space-light p-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-starlight"
                    />
                </View>

                <View>
                    <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Nova Senha</Text>
                    <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        className="bg-white dark:bg-space-light p-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-starlight"
                    />
                </View>

                <View>
                    <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Confirmar Nova Senha</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        className="bg-white dark:bg-space-light p-4 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-starlight"
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
