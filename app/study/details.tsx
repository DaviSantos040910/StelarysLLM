import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { libraryService } from '../../src/services/libraryService';
import { botService } from '../../src/services/botService';
import { StudySpace } from '../../src/types/studio';
import { FileText, Trash2, ArrowLeft, Plus, Youtube, Link as LinkIcon, Bot as BotIcon, X, AlertTriangle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';

export default function StudyDetailsScreen() {
  const { id } = useLocalSearchParams();
  const spaceId = parseInt(id as string, 10);
  const router = useRouter();

  const [space, setSpace] = useState<StudySpace | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSheetVisible, setSheetVisible] = useState(false);

  // Bot Linking State
  const [isBotModalVisible, setIsBotModalVisible] = useState(false);
  const [availableBots, setAvailableBots] = useState<any[]>([]);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    loadSpace();
  }, [id]);

  const loadSpace = async () => {
    if (!spaceId) return;
    try {
      setIsLoading(true);
      const data = await libraryService.getSpace(spaceId);
      setSpace(data);
      // Map existing sources to processed status
      setFiles(data.sources?.map((s: any) => ({ ...s, status: 'processed' })) || []);
      setBots(data.bots || []);
    } catch (e) {
      console.log('Error loading space', e);
      Alert.alert("Erro", "Falha ao carregar detalhes do espaço.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async (fileOrUrl: any, type: 'file' | 'url' | 'youtube') => {
      setSheetVisible(false);
      Alert.alert("Adicionando Fonte", "A fonte está sendo processada.");

      // Create temporary source for optimistic UI
      const tempId = Date.now();
      const backendType = type === 'youtube' ? 'YOUTUBE' : type === 'url' ? 'URL' : 'FILE';
      const tempTitle = fileOrUrl.name || fileOrUrl.uri || "Nova Fonte";

      const tempSource = {
          id: tempId,
          title: tempTitle,
          source_type: backendType,
          status: 'pending',
          created_at: new Date().toISOString()
      };

      setFiles(prev => [tempSource, ...prev]);

      try {
          const newSource = await libraryService.addSpaceSource(spaceId, fileOrUrl, backendType);

          // Replace temp source with real one
          setFiles(prev => prev.map(s =>
              s.id === tempId ? { ...newSource, status: 'processed' } : s
          ));
          Alert.alert("Sucesso", "Fonte adicionada ao espaço de estudo.");
      } catch (error) {
          console.error(error);
          setFiles(prev => prev.map(s =>
              s.id === tempId ? { ...s, status: 'error' } : s
          ));
          Alert.alert("Erro", "Falha ao adicionar fonte.");
      }
  };

  const handleDeleteSource = async (sourceId: number) => {
    Alert.alert(
      "Remover Fonte",
      "Tem certeza que deseja remover esta fonte?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await libraryService.removeSource(spaceId, sourceId);
              setFiles(prev => prev.filter(f => f.id !== sourceId));
            } catch (e) {
              Alert.alert("Erro", "Falha ao remover fonte.");
            }
          }
        }
      ]
    );
  };

  const openLinkBotModal = async () => {
      setIsBotModalVisible(true);
      try {
          const allBots = await botService.getBots();
          // Filter out bots already linked
          const linkedIds = new Set(bots.map(b => b.id));
          const available = allBots.filter((b: any) => !linkedIds.has(b.id));
          setAvailableBots(available);
      } catch (error) {
          Alert.alert("Erro", "Falha ao carregar tutores disponíveis.");
      }
  };

  const handleLinkBot = async (botId: number) => {
      setIsLinking(true);
      try {
          await libraryService.linkBot(spaceId, botId);
          // Refresh list
          loadSpace();
          setIsBotModalVisible(false);
          Alert.alert("Sucesso", "Tutor vinculado com sucesso!");
      } catch (error) {
          Alert.alert("Erro", "Falha ao vincular tutor.");
      } finally {
          setIsLinking(false);
      }
  };

  const handleUnlinkBot = async (botId: number) => {
      Alert.alert(
          "Desvincular Tutor",
          "Tem certeza que deseja remover este tutor do espaço?",
          [
              { text: "Cancelar", style: "cancel" },
              {
                  text: "Desvincular",
                  style: "destructive",
                  onPress: async () => {
                      try {
                          await libraryService.unlinkBot(spaceId, botId);
                          setBots(prev => prev.filter(b => b.id !== botId));
                      } catch (e) {
                          Alert.alert("Erro", "Falha ao desvincular tutor.");
                      }
                  }
              }
          ]
      );
  };

  const getIcon = (type: string) => {
      switch (type) {
          case 'YOUTUBE': return <Youtube color="#ef4444" size={24} />;
          case 'URL': return <LinkIcon color="#3b82f6" size={24} />;
          default: return <FileText color="#fbbf24" size={24} />;
      }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-space-dark" edges={['top']}>
      <View className="flex-row items-center p-4 border-b border-gray-100 dark:border-white/10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2 rounded-full active:bg-gray-100 dark:active:bg-white/10">
           <ArrowLeft className="text-gray-900 dark:text-white" size={24} />
        </TouchableOpacity>
        <Text className="font-bold text-lg text-gray-900 dark:text-starlight">Detalhes do Espaço</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text className="text-2xl font-bold mb-2 text-gray-900 dark:text-starlight">{space?.title}</Text>
        <Text className="text-gray-500 dark:text-gray-400 mb-8">{space?.description || "Sem descrição"}</Text>

        {/* Tutors Section */}
        <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800 dark:text-starlight">Tutores Vinculados</Text>
            <TouchableOpacity onPress={openLinkBotModal} className="flex-row items-center">
                <Plus size={20} color="#818cf8" />
                <Text className="text-indigo-500 font-bold ml-1">Adicionar</Text>
            </TouchableOpacity>
        </View>

        {bots.length === 0 ? (
            <Text className="text-gray-500 dark:text-gray-400 text-center py-4 mb-6 italic">Nenhum tutor vinculado.</Text>
        ) : (
            <View className="mb-8">
                {bots.map((bot) => (
                    <View key={bot.id} className="flex-row items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl mb-2 border border-gray-100 dark:border-white/5">
                        <View className="flex-row items-center flex-1 mr-2">
                            {bot.avatar_url ? (
                                <Image source={{ uri: bot.avatar_url }} className="w-10 h-10 rounded-full mr-3" />
                            ) : (
                                <View className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center mr-3">
                                    <BotIcon size={20} color="#818cf8" />
                                </View>
                            )}
                            <Text className="text-gray-900 dark:text-starlight font-medium text-base">{bot.name}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleUnlinkBot(bot.id)} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg">
                            <Trash2 size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        )}

        {/* Sources Section */}
        <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800 dark:text-starlight">Fontes de Estudo</Text>
            <TouchableOpacity onPress={() => setSheetVisible(true)} className="flex-row items-center">
                <Plus size={20} color="#818cf8" />
                <Text className="text-indigo-500 font-bold ml-1">Adicionar</Text>
            </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#818cf8" />
        ) : (
          <View>
            {files.length === 0 ? (
                <Text className="text-gray-500 dark:text-gray-400 text-center py-4 italic">Nenhuma fonte adicionada.</Text>
            ) : (
                files.map((item) => (
                    <View key={item.id} className="flex-row items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl mb-2 border border-gray-100 dark:border-white/5">
                        <View className="flex-row items-center flex-1 mr-2">
                            <View className="bg-white dark:bg-white/10 p-2 rounded-lg mr-3">
                                {getIcon(item.source_type)}
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-900 dark:text-starlight font-medium" numberOfLines={1}>{item.title}</Text>

                                <View className="flex-row items-center mt-1">
                                    <Text className="text-gray-400 text-xs mr-2">{item.source_type}</Text>

                                    {/* Status Indicator */}
                                    {item.status === 'pending' && (
                                        <View className="flex-row items-center">
                                            <ActivityIndicator size="small" color="#818cf8" style={{ transform: [{ scale: 0.7 }] }} />
                                            <Text className="text-indigo-400 text-xs ml-1">Processando...</Text>
                                        </View>
                                    )}
                                    {item.status === 'error' && (
                                        <View className="flex-row items-center">
                                            <AlertTriangle size={12} color="#ef4444" />
                                            <Text className="text-red-400 text-xs ml-1">Erro</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {item.status !== 'pending' && (
                            <TouchableOpacity onPress={() => handleDeleteSource(item.id)} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg">
                                <Trash2 size={20} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))
            )}
          </View>
        )}
      </ScrollView>

      <AttachmentSheet
        visible={isSheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={(file, type) => handleAddSource(file, type)}
      />

      {/* Link Bot Modal */}
      <Modal
          visible={isBotModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsBotModalVisible(false)}
      >
          <View className="flex-1 bg-black/60 justify-end">
              <View className="bg-white dark:bg-space-dark rounded-t-3xl h-[70%]">
                  <View className="p-4 border-b border-gray-100 dark:border-white/10 flex-row justify-between items-center">
                      <Text className="text-xl font-bold text-gray-900 dark:text-starlight">Vincular Tutor</Text>
                      <TouchableOpacity onPress={() => setIsBotModalVisible(false)} className="p-2">
                          <X size={24} color="#94a3b8" />
                      </TouchableOpacity>
                  </View>

                  {isLinking ? (
                      <View className="flex-1 justify-center items-center">
                          <ActivityIndicator size="large" color="#818cf8" />
                          <Text className="mt-4 text-gray-500">Vinculando...</Text>
                      </View>
                  ) : (
                      <FlatList
                          data={availableBots}
                          keyExtractor={(item) => item.id.toString()}
                          contentContainerStyle={{ padding: 16 }}
                          ListEmptyComponent={
                              <Text className="text-center text-gray-500 mt-10">
                                  Nenhum tutor disponível para vincular.
                              </Text>
                          }
                          renderItem={({ item }) => (
                              <TouchableOpacity
                                  onPress={() => handleLinkBot(item.id)}
                                  className="flex-row items-center bg-gray-50 dark:bg-white/5 p-4 rounded-xl mb-3 border border-gray-100 dark:border-white/5 active:bg-gray-100 dark:active:bg-white/10"
                              >
                                  {item.avatar_url ? (
                                      <Image source={{ uri: item.avatar_url }} className="w-12 h-12 rounded-full mr-4" />
                                  ) : (
                                      <View className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center mr-4">
                                          <BotIcon size={24} color="#818cf8" />
                                      </View>
                                  )}
                                  <View>
                                      <Text className="text-lg font-bold text-gray-900 dark:text-starlight">{item.name}</Text>
                                      <Text className="text-gray-500 dark:text-gray-400 text-sm" numberOfLines={1}>{item.description || "Sem descrição"}</Text>
                                  </View>
                              </TouchableOpacity>
                          )}
                      />
                  )}
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}
