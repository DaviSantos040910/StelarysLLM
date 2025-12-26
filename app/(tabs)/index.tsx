import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { Workspace } from '../../src/types';
import { BookOpen, Briefcase, Code, Folder, Plus } from 'lucide-react-native';

const ICON_MAP: Record<string, any> = {
  'productivity': Briefcase,
  'coding': Code,
  'education': BookOpen,
  'default': Folder
};

function StudyCard({ item }: { item: Workspace }) {
  const router = useRouter();
  const IconComponent = ICON_MAP[item.category_id || 'default'] || ICON_MAP['default'];

  return (
    <TouchableOpacity
      className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 m-2 h-40 justify-between"
      onPress={() => router.push(`/study/${item.id}`)}
    >
      <View>
        <View className="bg-blue-50 w-10 h-10 rounded-full items-center justify-center mb-3">
          <IconComponent size={20} color="#3b82f6" />
        </View>
        <Text className="font-bold text-gray-900 text-lg" numberOfLines={2}>
          {item.name}
        </Text>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="bg-gray-100 px-2 py-1 rounded text-xs">
           <Text className="text-gray-500 text-xs font-medium uppercase">{item.category_id || 'General'}</Text>
        </View>
        <Text className="text-gray-400 text-xs">{item.files_count} files</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { workspaces, loadWorkspaces, isLoading, error } = useWorkspaceStore();

  useFocusEffect(
    useCallback(() => {
      loadWorkspaces();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 px-2" edges={['top']}>
      <View className="flex-row justify-between items-center px-2 py-4">
        <Text className="text-2xl font-bold text-gray-900">Meus Estudos</Text>
        {/* Potentially add a settings or profile icon here */}
      </View>

      {error && (
        <View className="bg-red-50 p-4 m-2 rounded-lg">
          <Text className="text-red-500">{error}</Text>
        </View>
      )}

      {isLoading && workspaces.length === 0 ? (
         <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
         </View>
      ) : (
        <FlatList
          data={workspaces}
          renderItem={({ item }) => <StudyCard item={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadWorkspaces} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
               <Text className="text-gray-500 text-center">No studies found.{'\n'}Create your first one!</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 bg-black w-16 h-16 rounded-full justify-center items-center shadow-lg"
        onPress={() => router.push('/create')}
      >
        <Plus color="white" size={32} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
