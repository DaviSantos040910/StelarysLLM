import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Settings, LogOut, HelpCircle, ChevronRight } from 'lucide-react-native';

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
             // Router replacement handled in store/layout usually, but safe to do here
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white p-6 items-center border-b border-gray-100 pb-8">
        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4 overflow-hidden">
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
          ) : (
            <Text className="text-3xl text-blue-500 font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <Text className="text-xl font-bold text-gray-900">{user?.username || 'User'}</Text>
        <Text className="text-gray-500">{user?.email || 'email@example.com'}</Text>
      </View>

      <ScrollView className="mt-6 px-4">
        <View className="bg-white rounded-xl overflow-hidden">
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              className={`flex-row items-center p-4 ${index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''}`}
              onPress={item.action}
            >
              <item.icon size={22} color="#4B5563" />
              <Text className="flex-1 ml-3 text-gray-700 font-medium">{item.label}</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className="bg-white mt-6 p-4 rounded-xl flex-row items-center justify-center"
          onPress={handleLogout}
        >
          <LogOut size={20} color="#EF4444" />
          <Text className="ml-2 text-red-500 font-semibold">Log Out</Text>
        </TouchableOpacity>

        <Text className="text-center text-gray-400 text-xs mt-8">Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
