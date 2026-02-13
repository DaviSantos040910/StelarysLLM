import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, NativeScrollEvent, NativeSyntheticEvent, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores/appStore';
import { themeClasses } from '../../src/theme/classes';
import { useColorScheme } from 'nativewind';
import { Image } from 'expo-image';
import { ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Tutoria Inteligente',
    description: 'Crie tutores personalizados que entendem seus arquivos e te ajudam a estudar.',
    imageLight: require('../../src/assets/images/onboarding_1_light.png'),
    imageDark: require('../../src/assets/images/onboarding_1_dark.png'),
  },
  {
    id: 2,
    title: 'Gere Conteúdo Automático',
    description: 'Transforme PDFs e links em Quizzes, Flashcards e Resumos instantaneamente.',
    imageLight: require('../../src/assets/images/onboarding_2_light.png'),
    imageDark: require('../../src/assets/images/onboarding_2_dark.png'),
  },
  {
    id: 3,
    title: 'Aprenda em Qualquer Lugar',
    description: 'Ouça seus resumos em formato de Podcast e estude onde estiver.',
    imageLight: require('../../src/assets/images/onboarding_3_light.png'),
    imageDark: require('../../src/assets/images/onboarding_3_dark.png'),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setHasSeenOnboarding } = useAppStore();
  const { colorScheme } = useColorScheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      handleFinishGuest();
    }
  };

  const handleFinishGuest = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    await setHasSeenOnboarding(true);
    router.push('/(auth)/login');
  };

  const isDark = colorScheme === 'dark';
  const currentSlide = slides[currentIndex];
  const bgSource = isDark ? currentSlide.imageDark : currentSlide.imageLight;

  // Gradient colors for better text readability
  // Dark mode: fade to black/dark blue at bottom
  // Light mode: fade to white at bottom (or dark if using white text on image?)
  // Assuming textPrimary is dark in light mode, we fade to white.
  const gradientColors = isDark
    ? ['transparent', 'rgba(2, 6, 23, 0.8)', '#020617'] // slate-950
    : ['transparent', 'rgba(255, 255, 255, 0.8)', '#ffffff'];

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={bgSource}
        style={[StyleSheet.absoluteFillObject]}
        contentFit="cover"
        transition={200}
      />

      {/* Gradient Overlay at Bottom */}
      <LinearGradient
        colors={gradientColors}
        style={[StyleSheet.absoluteFillObject, { top: '40%' }]}
        pointerEvents="none"
      />

      <SafeAreaView className="flex-1 bg-transparent">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          className="flex-1"
        >
          {slides.map((slide) => (
            <View key={slide.id} style={{ width }} className="flex-1 px-6 justify-end pb-48">
              <View className="items-center">
                <Text className={`text-3xl font-bold text-center mb-4 ${themeClasses.textPrimary}`}>
                  {slide.title}
                </Text>
                <Text className={`text-lg text-center ${themeClasses.textSecondary} leading-6`}>
                  {slide.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* Absolute Footer */}
      <View
        className="absolute bottom-0 left-0 right-0 px-6"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }} // Ensure safe area + padding
      >
        {/* Pagination Dots */}
        <View className="flex-row justify-center mb-8 gap-2">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-8 bg-indigo-600 dark:bg-indigo-400'
                  : 'w-2 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </View>

        {/* Buttons */}
        <View className="gap-4">
          <TouchableOpacity
            onPress={handleNext}
            className="bg-indigo-600 py-4 rounded-full flex-row justify-center items-center shadow-lg shadow-indigo-500/30 active:opacity-90"
          >
            <Text className="text-white font-bold text-lg mr-2">
              {currentIndex === slides.length - 1 ? 'Começar Agora (Guest)' : 'Próximo'}
            </Text>
            {currentIndex < slides.length - 1 && <ArrowRight size={20} color="white" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            className="py-3 items-center active:opacity-70"
          >
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold text-base">
              Já tenho conta
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
