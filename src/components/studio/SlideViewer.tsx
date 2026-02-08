import React, { useState } from 'react';
import { View, Text, FlatList, Dimensions, StatusBar } from 'react-native';
import { SlidePage } from '../../types/studio';
import Animated, { FadeIn } from 'react-native-reanimated';
import { themeClasses } from '../../theme/classes';

const { width } = Dimensions.get('window');

interface Props {
  data: SlidePage[];
}

export const SlideViewer: React.FC<Props> = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Safety check for empty data
  if (!data || data.length === 0) {
      return (
          <View className={`flex-1 items-center justify-center ${themeClasses.screen}`}>
              <Text className={themeClasses.textMuted}>Nenhum slide disponível.</Text>
          </View>
      );
  }

  const renderItem = ({ item, index }: { item: SlidePage, index: number }) => (
    <View style={{ width, padding: 32 }} className="flex-1 justify-center items-center">
       <Animated.View
         entering={FadeIn.delay(200)}
         className={`w-full h-[80%] rounded-3xl p-8 justify-center shadow-2xl ${themeClasses.surface}`}
       >
          <Text className={`${themeClasses.textPrimary} text-3xl font-bold mb-8 text-center`}>{item.title}</Text>

          <View className="space-y-4">
             {item.bullets.map((bullet, idx) => (
                <View key={idx} className="flex-row items-start">
                   <View className="w-2 h-2 rounded-full bg-cosmic-purple mt-2 mr-3" />
                   <Text className={`${themeClasses.textSecondary} text-xl leading-8 flex-1`}>{bullet}</Text>
                </View>
             ))}
          </View>

          {/* Page Number */}
          <View className="absolute bottom-6 right-6">
             <Text className={`${themeClasses.textMuted} font-bold text-4xl opacity-20`}>{index + 1}</Text>
          </View>
       </Animated.View>
    </View>
  );

  return (
    <View className={themeClasses.screen}>
      <StatusBar hidden />
      <FlatList
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        onMomentumScrollEnd={(ev) => {
            const index = Math.round(ev.nativeEvent.contentOffset.x / width);
            setCurrentPage(index);
        }}
      />

      {/* Pager Indicator */}
      <View className="absolute bottom-10 left-0 right-0 flex-row justify-center space-x-2">
         {data.map((_, idx) => (
             <View
               key={idx}
               className={`w-2 h-2 rounded-full ${currentPage === idx ? 'bg-white' : 'bg-white/20'}`}
             />
         ))}
      </View>
    </View>
  );
};
