import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    withTiming
} from 'react-native-reanimated';
import { FlashcardItem } from '../../types/studio';
import { RotateCw } from 'lucide-react-native';

interface Props {
  data: FlashcardItem[];
}

export const FlashcardViewer: React.FC<Props> = ({ data }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const spin = useSharedValue(0);

  const frontStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [
        { rotateY: `${spinVal}deg` }
      ],
      opacity: spin.value < 0.5 ? 1 : 0,
      zIndex: spin.value < 0.5 ? 1 : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [
        { rotateY: `${spinVal}deg` }
      ],
      opacity: spin.value < 0.5 ? 0 : 1,
      zIndex: spin.value < 0.5 ? 0 : 1,
    };
  });

  const handleFlip = () => {
    if (isFlipped) {
       spin.value = withTiming(0, { duration: 500 });
    } else {
       spin.value = withTiming(1, { duration: 500 });
    }
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
      // Reset flip before changing
      if (isFlipped) {
          spin.value = 0;
          setIsFlipped(false);
      }

      setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % data.length);
      }, 100);
  };

  const currentCard = data[currentIndex];

  return (
    <View className="flex-1 bg-space-dark items-center justify-center p-6">

       <View className="w-full aspect-[3/4] max-h-[500px] relative">
           {/* Front */}
           <Animated.View
             className="absolute inset-0 bg-space-light rounded-3xl border border-white/10 items-center justify-center p-8 shadow-2xl backface-hidden"
             style={frontStyle}
           >
                <Text className="text-gray-400 font-bold uppercase tracking-widest mb-4">Frente</Text>
                <Text className="text-starlight text-3xl font-bold text-center leading-10">
                    {currentCard.front}
                </Text>
                <View className="absolute bottom-6 flex-row items-center">
                    <RotateCw size={16} color="#94a3b8" className="mr-2" />
                    <Text className="text-gray-400 text-sm">Toque para virar</Text>
                </View>
           </Animated.View>

           {/* Back */}
           <Animated.View
             className="absolute inset-0 bg-cosmic-purple rounded-3xl items-center justify-center p-8 shadow-2xl backface-hidden"
             style={backStyle}
           >
                <Text className="text-white/70 font-bold uppercase tracking-widest mb-4">Verso</Text>
                <Text className="text-white text-2xl font-medium text-center leading-9">
                    {currentCard.back}
                </Text>
           </Animated.View>

           {/* Tap Area */}
           <Pressable className="absolute inset-0" onPress={handleFlip} />
       </View>

       {/* Controls */}
       <View className="mt-8 flex-row items-center gap-4">
            <Text className="text-gray-500 font-medium">
                {currentIndex + 1} / {data.length}
            </Text>
            <Pressable
                onPress={handleNext}
                className="bg-white/10 px-6 py-3 rounded-full active:bg-white/20"
            >
                <Text className="text-starlight font-bold">Próximo Card</Text>
            </Pressable>
       </View>

    </View>
  );
};
