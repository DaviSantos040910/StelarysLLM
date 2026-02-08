import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { QuizQuestion } from '../../types/studio';
import { CheckCircle2, XCircle, ChevronRight, HelpCircle, ChevronUp, ChevronDown, Lightbulb, BookOpen } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn, Layout } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { themeClasses } from '../../theme/classes';

interface Props {
  data: QuizQuestion[];
  onFinish?: () => void;
}

export const QuizViewer: React.FC<Props> = ({ data, onFinish }) => {
  const { colorScheme } = useColorScheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Safety check for empty data
  if (!data || data.length === 0) {
      return (
          <View className={`flex-1 items-center justify-center ${themeClasses.screen}`}>
              <Text className={themeClasses.textMuted}>Nenhum dado disponível.</Text>
          </View>
      );
  }

  const currentQuestion = data[currentIndex];

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    setShowHint(false); // Reset hint state
    if (index === currentQuestion.correctAnswerIndex) {
        setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < data.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
        setShowHint(false);
    } else {
        setShowResult(true);
    }
  };

  if (showResult) {
      return (
          <View className={`flex-1 items-center justify-center p-6 ${themeClasses.screen}`}>
              <Animated.View entering={ZoomIn} className={`w-full p-8 rounded-3xl border border-gray-200 dark:border-white/10 items-center shadow-xl ${themeClasses.surface}`}>
                  <Text className={`${themeClasses.textPrimary} text-2xl font-bold mb-2 text-center`}>Quiz Finalizado!</Text>
                  <Text className={`${themeClasses.textSecondary} text-lg mb-8 text-center`}>Você acertou</Text>

                  <View className="w-32 h-32 rounded-full border-4 border-cosmic-purple items-center justify-center mb-8 bg-gray-100 dark:bg-space-dark/30">
                      <Text className="text-4xl font-bold text-cosmic-purple">{score}/{data.length}</Text>
                  </View>

                  <Pressable
                    onPress={onFinish}
                    className="w-full bg-cosmic-purple py-4 rounded-xl items-center active:opacity-90"
                  >
                      <Text className="text-white font-bold text-lg">Fechar</Text>
                  </Pressable>
              </Animated.View>
          </View>
      );
  }

  return (
    <View className={`flex-1 pt-24 ${themeClasses.screen}`}>
      {/* Scrollable Content Container */}
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Header Stats */}
          <View className="flex-row justify-between mb-8 items-center">
              <Text className={`${themeClasses.textMuted} font-medium text-base`}>Questão {currentIndex + 1} de {data.length}</Text>
              <View className="bg-cosmic-purple/10 px-3 py-1 rounded-full border border-cosmic-purple/20">
                 <Text className="text-cosmic-purple font-bold">Pontos: {score}</Text>
              </View>
          </View>

          {/* Question */}
          <Animated.View key={`q-${currentIndex}`} entering={FadeIn}>
              <Text className={`${themeClasses.textPrimary} text-2xl font-bold mb-8 leading-9`}>
                  {currentQuestion.question}
              </Text>

              <View className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = idx === currentQuestion.correctAnswerIndex;

                      // Default style for options
                      let bgStyle = themeClasses.softSurface; // 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                      let icon = null;

                      if (isAnswered) {
                          if (isCorrect) {
                              bgStyle = 'bg-green-500/20 border border-green-500';
                              icon = <CheckCircle2 color="#4ade80" size={24} />;
                          } else if (isSelected) {
                              bgStyle = 'bg-red-500/20 border border-red-500';
                              icon = <XCircle color="#f87171" size={24} />;
                          } else {
                              bgStyle = 'bg-gray-100/50 dark:bg-space-light/50 border border-gray-200 dark:border-white/5 opacity-40';
                          }
                      } else if (isSelected) {
                          bgStyle = 'bg-cosmic-purple/20 border border-cosmic-purple';
                      }

                      return (
                          <Pressable
                              key={idx}
                              onPress={() => handleSelect(idx)}
                              className={`flex-row items-center p-5 rounded-2xl border-2 ${bgStyle} transition-all`}
                              // Note: border-2 might override themeClasses border if themeClasses has border-1.
                              // Actually themeClasses has 'border'.
                              // I'll rely on bgStyle being the last one applied or explicit classes.
                          >
                              <View className="flex-1 mr-2">
                                  <Text className={`text-lg leading-6 ${isAnswered && isCorrect ? 'text-green-600 dark:text-green-400 font-bold' : themeClasses.textPrimary}`}>
                                      {option}
                                  </Text>
                              </View>
                              {icon}
                          </Pressable>
                      );
                  })}
              </View>

              {/* Dica (Hint) - Only show if not answered and hint exists */}
              {!isAnswered && currentQuestion.hint && (
                  <Animated.View layout={Layout.springify()} className="mt-6">
                      <Pressable
                          onPress={() => setShowHint(!showHint)}
                          className={`flex-row items-center self-start px-4 py-2 rounded-full ${themeClasses.softSurface} ${themeClasses.press}`}
                      >
                          <Text className={`${themeClasses.textSecondary} font-bold mr-2`}>Dica</Text>
                          {showHint ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                      </Pressable>

                      {showHint && (
                          <Animated.View entering={FadeIn} className="mt-3 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex-row">
                              <Lightbulb size={20} color="#818cf8" style={{ marginTop: 2 }} />
                              <Text className="text-indigo-600 dark:text-indigo-200 ml-3 flex-1 leading-5">
                                  {currentQuestion.hint}
                              </Text>
                          </Animated.View>
                      )}
                  </Animated.View>
              )}

              {/* Explanation - Show after answering */}
              {isAnswered && currentQuestion.explanation && (
                  <Animated.View entering={FadeIn} className="mt-8 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                      <View className="flex-row items-center mb-2">
                          <BookOpen size={20} color="#60a5fa" />
                          <Text className="text-blue-400 font-bold ml-2">Explicação</Text>
                      </View>
                      <Text className="text-blue-100 leading-6">
                          {currentQuestion.explanation}
                      </Text>
                  </Animated.View>
              )}

          </Animated.View>
      </ScrollView>

      {/* Footer Actions (Sticky Bottom) */}
      <View className={`absolute bottom-0 left-0 right-0 p-6 ${themeClasses.surface} border-t border-gray-200 dark:border-white/5`}>
          {isAnswered ? (
              <Animated.View entering={FadeIn}>
                  <Pressable
                      onPress={handleNext}
                      className="bg-gray-900 dark:bg-starlight py-4 rounded-2xl flex-row justify-center items-center shadow-lg shadow-gray-400/20 dark:shadow-white/10"
                  >
                      <Text className="text-white dark:text-space-dark font-bold text-xl mr-2">
                          {currentIndex < data.length - 1 ? 'Próxima Questão' : 'Ver Resultado'}
                      </Text>
                      <ChevronRight color={colorScheme === 'dark' ? '#020617' : '#ffffff'} size={24} />
                  </Pressable>
              </Animated.View>
          ) : (
              <View className="h-[60px] justify-center items-center">
                  <Text className={themeClasses.textMuted}>Selecione uma opção para continuar</Text>
              </View>
          )}
      </View>
    </View>
  );
};
