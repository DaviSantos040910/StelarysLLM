import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Settings, LogOut, HelpCircle, ChevronRight, UserCircle } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
             await logout();
             router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const menuItems = [
    { icon: User, label: 'My Account', action: () => {} },
    { icon: Settings, label: 'Settings', action: () => {} },
    { icon: HelpCircle, label: 'Help & Support', action: () => {} },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="items-center pb-8 pt-4">
        <View className="w-24 h-24 bg-primary/20 rounded-full items-center justify-center mb-4 overflow-hidden border border-primary/50 shadow-lg shadow-primary/30">
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
          ) : (
            <UserCircle size={60} color="#6366f1" />
          )}
        </View>
        <Text className="text-xl font-bold text-white">{user?.username || 'Astronaut'}</Text>
        <Text className="text-gray-400">{user?.email || 'explorer@stelarys.com'}</Text>
      </View>

      <ScrollView className="mt-2 px-4">
        <View className="bg-card rounded-xl overflow-hidden border border-white/10">
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              className={`flex-row items-center p-4 ${index !== menuItems.length - 1 ? 'border-b border-white/10' : ''}`}
              onPress={item.action}
            >
              <item.icon size={22} color="#94a3b8" />
              <Text className="flex-1 ml-3 text-gray-200 font-medium">{item.label}</Text>
              <ChevronRight size={20} color="#475569" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className="bg-red-900/20 mt-6 p-4 rounded-xl flex-row items-center justify-center border border-red-500/30"
          onPress={handleLogout}
        >
          <LogOut size={20} color="#EF4444" />
          <Text className="ml-2 text-red-400 font-semibold">Log Out</Text>
        </TouchableOpacity>

        <Text className="text-center text-gray-600 text-xs mt-8 pb-24">Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
