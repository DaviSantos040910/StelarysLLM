import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { QuizQuestion } from '../../types/studio';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

interface Props {
  data: QuizQuestion[];
  onFinish?: () => void;
}

export const QuizViewer: React.FC<Props> = ({ data, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = data[currentIndex];

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === currentQuestion.correctAnswerIndex) {
        setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < data.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
    } else {
        setShowResult(true);
    }
  };

  if (showResult) {
      // Replaced absolute positioning with standard Flexbox container to respect parent layout/modal headers
      return (
          <View className="flex-1 bg-space-dark items-center justify-center p-6">
              <Animated.View entering={ZoomIn} className="w-full bg-space-light p-8 rounded-3xl border border-white/10 items-center shadow-xl">
                  <Text className="text-starlight text-2xl font-bold mb-2 text-center">Quiz Finalizado!</Text>
                  <Text className="text-gray-400 text-lg mb-8 text-center">Você acertou</Text>

                  <View className="w-32 h-32 rounded-full border-4 border-cosmic-purple items-center justify-center mb-8 bg-space-dark/30">
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
    <View className="flex-1 bg-space-dark pt-24">
      {/* Scrollable Content Container */}
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header Stats */}
          <View className="flex-row justify-between mb-8 items-center">
              <Text className="text-gray-400 font-medium text-base">Questão {currentIndex + 1} de {data.length}</Text>
              <View className="bg-cosmic-purple/10 px-3 py-1 rounded-full border border-cosmic-purple/20">
                 <Text className="text-cosmic-purple font-bold">Pontos: {score}</Text>
              </View>
          </View>

          {/* Question */}
          <Animated.View key={`q-${currentIndex}`} entering={FadeIn}>
              <Text className="text-2xl text-starlight font-bold mb-8 leading-9">
                  {currentQuestion.question}
              </Text>

              <View className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = idx === currentQuestion.correctAnswerIndex;

                      let bgStyle = 'bg-space-light border-white/10';
                      let icon = null;

                      if (isAnswered) {
                          if (isCorrect) {
                              bgStyle = 'bg-green-500/20 border-green-500';
                              icon = <CheckCircle2 color="#4ade80" size={24} />;
                          } else if (isSelected) {
                              bgStyle = 'bg-red-500/20 border-red-500';
                              icon = <XCircle color="#f87171" size={24} />;
                          } else {
                              bgStyle = 'bg-space-light/50 border-white/5 opacity-40';
                          }
                      } else if (isSelected) {
                          bgStyle = 'bg-cosmic-purple/20 border-cosmic-purple';
                      }

                      return (
                          <Pressable
                              key={idx}
                              onPress={() => handleSelect(idx)}
                              className={`flex-row items-center p-5 rounded-2xl border-2 ${bgStyle} transition-all`}
                          >
                              <View className="flex-1 mr-2">
                                  <Text className={`text-lg leading-6 ${isAnswered && isCorrect ? 'text-green-400 font-bold' : 'text-starlight'}`}>
                                      {option}
                                  </Text>
                              </View>
                              {icon}
                          </Pressable>
                      );
                  })}
              </View>
          </Animated.View>
      </ScrollView>

      {/* Footer Actions (Sticky Bottom) */}
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-space-dark/95 border-t border-white/5">
          {isAnswered ? (
              <Animated.View entering={FadeIn}>
                  <Pressable
                      onPress={handleNext}
                      className="bg-starlight py-4 rounded-2xl flex-row justify-center items-center shadow-lg shadow-white/10"
                  >
                      <Text className="text-space-dark font-bold text-xl mr-2">
                          {currentIndex < data.length - 1 ? 'Próxima Questão' : 'Ver Resultado'}
                      </Text>
                      <ChevronRight color="#020617" size={24} />
                  </Pressable>
              </Animated.View>
          ) : (
              <View className="h-[60px] justify-center items-center">
                  <Text className="text-gray-600 font-medium">Selecione uma opção para continuar</Text>
              </View>
          )}
      </View>
    </View>
  );
};
