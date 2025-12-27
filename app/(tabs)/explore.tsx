import React, { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { exploreService, Category, ExploreBotItem } from '../../src/services/exploreService';
import { ExploreBotRow } from '../../src/components/explore/ExploreBotRow';

export default function ExploreScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bots, setBots] = useState<ExploreBotItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Load Categories on mount
  useFocusEffect(
    useCallback(() => {
        loadData();
    }, [])
  );

  const loadData = async () => {
      setIsLoading(true);
      try {
          const cats = await exploreService.getCategories();
          setCategories(cats);
          if (cats.length > 0 && !activeCategoryId) {
              setActiveCategoryId(cats[0].id);
          } else if (activeCategoryId) {
              loadBots(activeCategoryId);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const loadBots = async (categoryId: string) => {
      // Don't set global loading to avoid flickering whole screen, maybe local loading
      try {
          const data = await exploreService.getBots(categoryId);
          setBots(data);
      } catch (e) {
          console.error(e);
      }
  };

  const handleSearch = async (text: string) => {
      setSearchQuery(text);
      if (text.length > 2) {
          setIsSearching(true);
          try {
              const results = await exploreService.searchBots(text);
              setBots(results);
          } catch(e) {
              console.error(e);
          }
      } else if (text.length === 0 && isSearching) {
          setIsSearching(false);
          if (activeCategoryId) loadBots(activeCategoryId);
      }
  };

  const handleCategoryPress = (id: string) => {
      setActiveCategoryId(id);
      setSearchQuery('');
      setIsSearching(false);
      loadBots(id);
  };

  return (
    <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-space-light rounded-xl px-3 py-2 border border-white/10">
            <Search color="#94a3b8" size={20} />
            <TextInput
                className="flex-1 ml-2 text-starlight text-base"
                placeholder="Search tutors..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
                <Pressable onPress={() => handleSearch('')}>
                    <X color="#94a3b8" size={20} />
                </Pressable>
            )}
        </View>
      </View>

      {/* Categories */}
      {!isSearching && (
          <View>
              <FlatList
                  data={categories}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
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
      {isLoading ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#818cf8" size="large" />
          </View>
      ) : (
          <FlatList
              data={bots}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <ExploreBotRow item={item} />}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                  <View className="items-center mt-10">
                      <Text className="text-gray-500">No tutors found.</Text>
                  </View>
              }
          />
      )}
    </SafeAreaView>
  );
}
