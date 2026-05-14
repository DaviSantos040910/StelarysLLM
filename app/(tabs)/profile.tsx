import { useRouter, useFocusEffect } from 'expo-router';
import {
  Bell,
  CreditCard,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Shield,
  Trash2,
  User,
  Globe
} from 'lucide-react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView, View, Modal, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { SettingsItem } from '../../src/components/profile/SettingsItem';
import { SettingsSection } from '../../src/components/profile/SettingsSection';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { userService } from '../../src/services/userService';

const FEATURES = {
  language: false,
  notifications: false,
  legal: false
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setUser, isAuthenticated } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const { colorScheme, setColorScheme } = useColorScheme();

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Sync theme
  useEffect(() => {
      setColorScheme(mode);
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      const refreshProfile = async () => {
        if (!isAuthenticated) return; // Do not fetch profile for guests
        try {
          const updatedUser = await userService.getProfile();
          setUser(updatedUser);
        } catch (error) {
          console.error("Failed to refresh profile", error);
        }
      };
      refreshProfile();
    }, [setUser, isAuthenticated])
  );

  const handleLogout = async () => {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: logout }
    ]);
  };

  const handleDeleteAccount = async () => {
      Alert.alert(
          "Excluir Conta",
          "Esta ação é irreversível. Todos os seus dados serão perdidos. Tem certeza?",
          [
              { text: "Cancelar", style: "cancel" },
              {
                  text: "Excluir",
                  style: "destructive",
                  onPress: async () => {
                      try {
                          await userService.deleteAccount();
                          logout();
                      } catch (e) {
                          Alert.alert("Erro", "Falha ao excluir conta.");
                      }
                  }
              }
          ]
      );
  };

  const handleChangeTheme = (newMode: 'light' | 'dark' | 'system') => {
      setMode(newMode);
      setThemeModalVisible(false);
  };

  const getThemeLabel = () => {
      if (mode === 'system') return 'Sistema';
      if (mode === 'dark') return 'Escuro';
      return 'Claro';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-space-dark" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>

        <ProfileHeader
            user={user}
            onEditPress={() => router.push('/profile/edit')}
        />

        <SettingsSection title="Preferências">
            <SettingsItem
                icon={Moon}
                label="Tema"
                value={getThemeLabel()}
                onPress={() => setThemeModalVisible(true)}
                color="#818cf8"
            />
            {/* Placeholder for Language */}
            {FEATURES.language && (
                <SettingsItem
                    icon={Globe}
                    label="Idioma"
                    value="Português"
                    onPress={() => {}}
                    color="#34d399"
                />
            )}
        </SettingsSection>


        {/* Authenticated User Actions */}
        {isAuthenticated && (
            <SettingsSection title="Conta">
                <SettingsItem
                    icon={CreditCard}
                    label="Planos e Consumo"
                    onPress={() => router.push('/plans')}
                    color="#f59e0b"
                />
                <SettingsItem
                    icon={User}
                    label="Editar Perfil"
                    onPress={() => router.push('/profile/edit')}
                />
                <SettingsItem
                    icon={Lock}
                    label="Segurança"
                    onPress={() => router.push('/profile/security')}
                />
                {FEATURES.notifications && (
                    <SettingsItem
                        icon={Bell}
                        label="Notificações"
                        isSwitch
                        switchValue={true} // Mock for now
                        onSwitchChange={() => {}}
                    />
                )}
            </SettingsSection>
        )}

        <SettingsSection title="Suporte">
            <SettingsItem
                icon={HelpCircle}
                label="Ajuda e Suporte"
                onPress={() => Alert.alert("Suporte", "Entre em contato: suporte@stelarys.com")}
            />
            {FEATURES.legal && (
                <>
                    <SettingsItem
                        icon={Shield}
                        label="Política de Privacidade"
                        onPress={() => {}}
                    />
                    <SettingsItem
                        icon={FileText}
                        label="Termos de Uso"
                        onPress={() => {}}
                    />
                </>
            )}
        </SettingsSection>

        <SettingsSection title="Zona de Perigo">
            <SettingsItem
                icon={LogOut}
                label="Sair"
                onPress={handleLogout}
                danger
            />
            <SettingsItem
                icon={Trash2}
                label="Excluir Conta"
                onPress={handleDeleteAccount}
                danger
            />
        </SettingsSection>

      </ScrollView>

      {/* Theme Modal */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
          <Pressable className="flex-1 bg-black/60 justify-center px-6" onPress={() => setThemeModalVisible(false)}>
              <View className="bg-white dark:bg-space-light rounded-2xl p-6">
                  <Text className="text-lg font-bold text-gray-900 dark:text-starlight mb-4">Escolha um tema</Text>

                  <Pressable onPress={() => handleChangeTheme('light')} className="py-4 border-b border-gray-100 dark:border-white/5">
                      <Text className="text-base text-gray-700 dark:text-gray-300">Claro</Text>
                  </Pressable>
                  <Pressable onPress={() => handleChangeTheme('dark')} className="py-4 border-b border-gray-100 dark:border-white/5">
                      <Text className="text-base text-gray-700 dark:text-gray-300">Escuro</Text>
                  </Pressable>
                  <Pressable onPress={() => handleChangeTheme('system')} className="py-4">
                      <Text className="text-base text-gray-700 dark:text-gray-300">Automático (Sistema)</Text>
                  </Pressable>
              </View>
          </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
