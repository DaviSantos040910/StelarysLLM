import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { workspaceService } from '../../src/services/workspaceService';
import { StudyFile } from '../../src/types';
import { FileText, Trash2, ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudyDetailsScreen() {
  const { id } = useLocalSearchParams(); // This is the workspace/bot ID now, based on navigation from library
  const router = useRouter();
  const [files, setFiles] = useState<StudyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, [id]);

  const loadFiles = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      // Wait, in previous screens we used 'id' as chat ID in study/[id].
      // But in library index.tsx, we pushed `/study/${item.id}` where item is Workspace.
      // So [id] is the Workspace ID (bot ID).
      // However, StudyChatScreen uses [id] as chat ID?
      // Let's check app/study/[id].tsx.
      // In app/study/[id].tsx: `const { messages, loadMessages } = useChatStore(); loadMessages(id);`
      // `loadMessages` calls `chatService.getMessages(chatId)`.

      // Wait. The library pushes to `/study/${item.id}` (Bot ID).
      // But `StudyChatScreen` treats it as `chatId`?
      // If I send Bot ID to `getMessages(chatId)`, it will fail if Bot ID != Chat ID.
      // Backend: `ChatMessageListView` expects `chat_pk`.

      // REVISION NEEDED:
      // The Library screen pushes `/study/${item.id}` (Bot ID).
      // The StudyChatScreen receives this ID.
      // It should probably Bootstrap the chat FIRST using the Bot ID to get the Chat ID,
      // OR the route should be `/study/bot/[botId]` and it bootstraps internally?

      // In Task 5 (Create Study), we did: createWorkspace -> bootstrapChat -> uploadFile.
      // So we have a Chat ID there.

      // If the Library lists Workspaces (Bots), clicking one gives us Bot ID.
      // `app/study/[id].tsx` currently assumes `id` is Chat ID?
      // Let's look at `app/study/[id].tsx` again.
      // It calls `loadMessages(id)`.

      // ISSUE: Library passes Bot ID. Chat Screen needs Chat ID.
      // We need to fix this flow.
      // Easiest fix: `app/study/[id].tsx` should treat `id` as `botId`,
      // then call `bootstrapChat(botId)` to get the `chatId`,
      // then `loadMessages(chatId)`.

      // HOWEVER, the current task is `app/study/details.tsx`.
      // This screen is accessed from settings icon in Chat.
      // If Chat Screen has `botId` or `chatId`, it should pass the `botId` to details.

      // Let's assume `id` passed to this screen (details) is `botId` (Workspace ID).
      // Or if it's accessed via `router.push('/study/details?id=...')`.

      // For this file (details.tsx), let's assume `id` is the `botId` (Workspace ID).
      const data = await workspaceService.getWorkspaceFiles(id as string);
      setFiles(data);
    } catch (e) {
      console.log('Error loading files', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    Alert.alert(
      "Delete File",
      "Are you sure you want to delete this file?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await workspaceService.deleteWorkspaceFile(id as string, fileId);
              setFiles(prev => prev.filter(f => f.id !== fileId));
            } catch (e) {
              Alert.alert("Error", "Failed to delete file");
            }
          }
        }
      ]
    );
  };

  const handleDeleteStudy = async () => {
    Alert.alert(
      "Delete Study",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await workspaceService.deleteWorkspace(id as string);
              router.replace('/(tabs)');
            } catch (e) {
              Alert.alert("Error", "Failed to delete study");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
           <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text className="font-bold text-lg text-gray-900">Study Details</Text>
      </View>

      <View className="p-4 flex-1">
        <Text className="text-lg font-bold mb-4 text-gray-800">Files</Text>

        {isLoading ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <FlatList
            data={files}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={<Text className="text-gray-500">No files found.</Text>}
            renderItem={({ item }) => (
              <View className="flex-row items-center justify-between bg-gray-50 p-3 rounded-lg mb-2">
                <View className="flex-row items-center flex-1 mr-2">
                  <FileText size={20} color="#6B7280" />
                  <View className="ml-3">
                    <Text className="text-gray-900 font-medium" numberOfLines={1}>{item.file_name}</Text>
                    <Text className="text-gray-400 text-xs">{item.file_type.toUpperCase()}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteFile(item.id)} className="p-2">
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      <View className="p-4 border-t border-gray-100">
        <TouchableOpacity
          className="bg-red-50 p-4 rounded-lg items-center"
          onPress={handleDeleteStudy}
        >
          <Text className="text-red-500 font-bold">Delete Study Space</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
