import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import * as DocumentPicker from 'expo-document-picker';
import { X, Upload, FileText } from 'lucide-react-native';

const CATEGORIES = [
  { id: 'productivity', label: 'Productivity' },
  { id: 'education', label: 'Education' },
  { id: 'coding', label: 'Coding' },
  { id: 'general', label: 'General' },
];

export default function CreateStudyScreen() {
  const router = useRouter();
  const { createStudy, isLoading } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [files, setFiles] = useState<any[]>([]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        setFiles((prev) => [...prev, ...result.assets]);
      }
    } catch (err) {
      console.log('Unknown error: ', err);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for your study.');
      return;
    }

    try {
      await createStudy({
        name,
        category: selectedCategory,
        files,
      });
      router.back();
    } catch (e) {
      // Error is handled in store
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-row justify-between items-center mb-6 mt-2">
        <Text className="text-xl font-bold">New Study</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X color="#000" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Input
          label="Study Name"
          placeholder="e.g. History Final, Project X"
          value={name}
          onChangeText={setName}
        />

        <Text className="text-gray-700 font-medium mb-2">Category</Text>
        <View className="flex-row flex-wrap mb-4 gap-2">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              className={`px-4 py-2 rounded-full border ${
                selectedCategory === cat.id
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-white border-gray-300'
              }`}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                className={`${
                  selectedCategory === cat.id ? 'text-white' : 'text-gray-700'
                } font-medium`}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-gray-700 font-medium mb-2">Knowledge Base</Text>
        <TouchableOpacity
          className="border border-dashed border-gray-300 rounded-lg p-6 items-center justify-center mb-4 bg-gray-50"
          onPress={handlePickDocument}
        >
          <Upload color="#9CA3AF" size={32} />
          <Text className="text-gray-500 mt-2">Tap to select PDF, DOCX or TXT</Text>
        </TouchableOpacity>

        {files.length > 0 && (
          <View className="mb-4">
            {files.map((file, index) => (
              <View
                key={index}
                className="flex-row items-center justify-between bg-gray-100 p-3 rounded-lg mb-2"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <FileText size={20} color="#6B7280" />
                  <Text className="ml-2 text-gray-700" numberOfLines={1}>
                    {file.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeFile(index)}>
                  <X size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="py-4 border-t border-gray-100">
        <Button
          title={isLoading ? "Creating..." : "Create Study Space"}
          onPress={handleCreate}
          disabled={isLoading}
        />
        {isLoading && <ActivityIndicator className="mt-2" color="#3b82f6" />}
      </View>
    </View>
  );
}
