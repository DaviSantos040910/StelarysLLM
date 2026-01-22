import React, { useState } from 'react';
import { View, Text, FlatList, Dimensions, StatusBar } from 'react-native';
import { SlidePage } from '../../types/studio';
import Animated, { FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface Props {
  data: SlidePage[];
}

export const SlideViewer: React.FC<Props> = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Safety check for empty data
  if (!data || data.length === 0) {
      return (
          <View className="flex-1 bg-black items-center justify-center">
              <Text className="text-gray-400">Nenhum slide disponível.</Text>
          </View>
      );
  }

  const renderItem = ({ item, index }: { item: SlidePage, index: number }) => (
    <View style={{ width, padding: 32 }} className="flex-1 justify-center items-center">
       <Animated.View
         entering={FadeIn.delay(200)}
         className="w-full h-[80%] bg-space-light/50 border border-white/10 rounded-3xl p-8 justify-center shadow-2xl"
       >
          <Text className="text-3xl font-bold text-starlight mb-8 text-center">{item.title}</Text>

          <View className="space-y-4">
             {item.bullets.map((bullet, idx) => (
                <View key={idx} className="flex-row items-start">
                   <View className="w-2 h-2 rounded-full bg-cosmic-purple mt-2 mr-3" />
                   <Text className="text-xl text-gray-200 leading-8 flex-1">{bullet}</Text>
                </View>
             ))}
          </View>

          {/* Page Number */}
          <View className="absolute bottom-6 right-6">
             <Text className="text-white/20 font-bold text-4xl">{index + 1}</Text>
          </View>
       </Animated.View>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
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
