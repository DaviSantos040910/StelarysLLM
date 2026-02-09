import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { userService } from '../../src/services/userService';
import { themeClasses } from '../../src/theme/classes';

export default function SecurityScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
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
        <SafeAreaView className={themeClasses.screen} edges={['top']}>
            <View className={`px-4 py-4 flex-row items-center justify-between ${themeClasses.headerBorder}`}>
                <Pressable onPress={() => router.back()} className={`p-2 -ml-2 rounded-full ${themeClasses.press}`}>
                    <ArrowLeft color={colorScheme === 'dark' ? '#f8fafc' : '#111827'} size={24} />
                </Pressable>
                <Text className={`${themeClasses.textPrimary} text-lg font-bold`}>Segurança</Text>
                <Pressable onPress={handleSave} disabled={isSubmitting} className="p-2">
                    {isSubmitting ? <ActivityIndicator size="small" color="#818cf8" /> : <Check size={24} color="#818cf8" />}
                </Pressable>
            </View>

            <View className="p-6 space-y-6">
                <View>
                    <Text className={`${themeClasses.textSecondary} mb-2 font-medium`}>Senha Atual</Text>
                    <TextInput
                        value={oldPassword}
                        onChangeText={setOldPassword}
                        secureTextEntry
                        className={`${themeClasses.input} p-4`}
                    />
                </View>

                <View>
                    <Text className={`${themeClasses.textSecondary} mb-2 font-medium`}>Nova Senha</Text>
                    <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        className={`${themeClasses.input} p-4`}
                    />
                </View>

                <View>
                    <Text className={`${themeClasses.textSecondary} mb-2 font-medium`}>Confirmar Nova Senha</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        className={`${themeClasses.input} p-4`}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
