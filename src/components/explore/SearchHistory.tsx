import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Clock, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SearchHistoryItem } from '../../services/searchHistoryService';

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onPressItem: (term: string) => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onRemoveItem,
  onClearAll,
  onPressItem,
}) => {
  if (history.length === 0) {
    return (
      <View className="flex-1 items-center justify-center mt-10">
        <Text className="text-gray-500">Sem histórico recente.</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} className="flex-1 px-4">
      <View className="flex-row justify-between items-center py-4 border-b border-white/10 mb-2">
        <Text className="text-starlight font-bold text-lg">Recentes</Text>
        <TouchableOpacity onPress={onClearAll}>
          <Text className="text-cosmic-purple font-medium">Limpar tudo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {history.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 50)}
            className="flex-row items-center justify-between py-3 border-b border-white/5"
          >
            <TouchableOpacity
              className="flex-1 flex-row items-center"
              onPress={() => onPressItem(item.term)}
            >
              <Clock color="#94a3b8" size={18} className="mr-3" />
              <Text className="text-gray-300 text-base flex-1" numberOfLines={1}>
                {item.term}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onRemoveItem(item.id)}
              className="p-2 -mr-2"
              hitSlop={10}
            >
              <X color="#64748b" size={16} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

export default SearchHistory;
