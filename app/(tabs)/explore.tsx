import React, { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, TextInput, Pressable, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ArrowLeft } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { exploreService, Category, ExploreBotItem } from '../../src/services/exploreService';
import searchHistoryService, { SearchHistoryItem } from '../../src/services/searchHistoryService';
import { ExploreBotRow } from '../../src/components/explore/ExploreBotRow';
import { SearchHistory } from '../../src/components/explore/SearchHistory';

// Wrapper for animated list items
const AnimatedBotRow = ({ item, index }: { item: ExploreBotItem; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <ExploreBotRow item={item} />
    </Animated.View>
);

export default function ExploreScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bots, setBots] = useState<ExploreBotItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isBotsLoading, setIsBotsLoading] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false); // True when typing or showing results
  const [isSearchMode, setIsSearchMode] = useState(false); // True when search bar is focused (shows history)

  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Initial Load
  useFocusEffect(
    useCallback(() => {
        loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
      try {
          const [cats, hist] = await Promise.all([
              exploreService.getCategories(),
              searchHistoryService.getHistory()
          ]);
          setCategories(cats);
          setHistory(hist);

          // If we have categories and none selected, select first
          if (cats.length > 0 && !activeCategoryId) {
              setActiveCategoryId(cats[0].id);
              loadBots(cats[0].id);
          } else if (activeCategoryId) {
             // Just refresh bots if already on a category
             // loadBots(activeCategoryId);
             // Logic to avoid double loading on mount?
             // We can skip if bots are already populated, but let's refresh to be safe
             if (bots.length === 0) loadBots(activeCategoryId);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const loadBots = async (categoryId: string) => {
      setIsBotsLoading(true);
      try {
          const data = await exploreService.getBots(categoryId);
          setBots(data);
      } catch (e) {
          console.error(e);
      } finally {
          setIsBotsLoading(false);
      }
  };

  // Search Logic
  const handleSearchFocus = () => {
      setIsSearchMode(true);
      // Refresh history just in case
      searchHistoryService.getHistory().then(setHistory);
  };

  const handleSearchCancel = () => {
      Keyboard.dismiss();
      setIsSearchMode(false);
      setIsSearching(false);
      setSearchQuery('');
      // Revert to category view
      if (activeCategoryId) loadBots(activeCategoryId);
  };

  const performSearch = async (text: string) => {
      setSearchQuery(text);
      if (text.trim().length > 2) {
          setIsSearching(true);
          setIsBotsLoading(true);
          try {
              const results = await exploreService.searchBots(text);
              setBots(results);
          } catch(e) {
              console.error(e);
          } finally {
              setIsBotsLoading(false);
          }
      } else if (text.trim().length === 0) {
          setIsSearching(false);
      }
  };

  const handleHistorySelect = (term: string) => {
      setSearchQuery(term);
      performSearch(term);
      // Add to history (bumps to top)
      searchHistoryService.addSearchTerm(term).then(setHistory);
      // Hide history view, show results
      // We keep isSearchMode=true to keep the "Back" button on header,
      // but we need to ensure the list shows results, not history.
      // My logic in render: if isSearchMode && !isSearching (and query empty?) -> History.
      // If query not empty -> Results.
  };

  const handleHistoryRemove = async (id: string) => {
      const updated = await searchHistoryService.removeSearchTerm(id);
      setHistory(updated);
  };

  const handleClearHistory = async () => {
      await searchHistoryService.clearHistory();
      setHistory([]);
  };

  const handleCategoryPress = (id: string) => {
      setActiveCategoryId(id);
      loadBots(id);
  };

  return (
    <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
      {/* Header / Search Bar */}
      <View className="px-4 py-3 border-b border-white/5 bg-space-dark z-10">
        <View className="flex-row items-center gap-2">
            {isSearchMode && (
                <Pressable onPress={handleSearchCancel} entering={FadeInDown} exiting={FadeOut}>
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
            )}

            <View className="flex-1 flex-row items-center bg-space-light rounded-xl px-3 py-3 border border-white/10">
                <Search color="#94a3b8" size={20} />
                <TextInput
                    className="flex-1 ml-2 text-starlight text-base h-full" // Ensure height for centering
                    placeholder="Busque por tutores..." // Translated to match
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={performSearch}
                    onFocus={handleSearchFocus}
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <Pressable onPress={() => performSearch('')}>
                        <X color="#94a3b8" size={20} />
                    </Pressable>
                )}
            </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1">
          {isSearchMode && searchQuery.length === 0 ? (
              /* History View */
              <SearchHistory
                  history={history}
                  onRemoveItem={handleHistoryRemove}
                  onClearAll={handleClearHistory}
                  onPressItem={handleHistorySelect}
              />
          ) : (
             /* Lists (Categories + Bots) */
             <>
                {/* Categories (Only show if NOT searching text) */}
                {!isSearching && !isSearchMode && (
                    <View>
                        <FlatList
                            data={categories}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                            renderItem={({ item }) => {
                                const isActive = activeCategoryId === item.id;
                                return (
                                    <Pressable
                                        onPress={() => handleCategoryPress(item.id)}
                                        className={`mr-2 px-4 py-2 rounded-full border ${
                                            isActive
                                            ? 'bg-cosmic-purple border-cosmic-purple'
                                            : 'bg-transparent border-white/20'
                                        }`}
                                    >
                                        <Text className={`${isActive ? 'text-white' : 'text-gray-400'} font-medium`}>
                                            {item.name}
                                        </Text>
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                )}

                {/* Bots List */}
                {isLoading || isBotsLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator color="#818cf8" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={bots}
                        keyExtractor={item => item.id}
                        renderItem={({ item, index }) => <AnimatedBotRow item={item} index={index} />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View className="items-center mt-20">
                                <Text className="text-gray-500 text-lg">Nenhum tutor encontrado.</Text>
                            </View>
                        }
                    />
                )}
             </>
          )}
      </View>
    </SafeAreaView>
  );
}
