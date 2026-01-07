import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { QuizQuestion } from '../../types/studio';
import { CheckCircle2, XCircle, ChevronRight, RefreshCw } from 'lucide-react-native';
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
      return (
          <View className="flex-1 items-center justify-center p-6 bg-space-dark">
              <Animated.View entering={ZoomIn} className="items-center bg-space-light p-8 rounded-3xl border border-white/10 w-full">
                  <Text className="text-starlight text-2xl font-bold mb-2">Quiz Finalizado!</Text>
                  <Text className="text-gray-400 text-lg mb-6">Você acertou</Text>

                  <View className="w-32 h-32 rounded-full border-4 border-cosmic-purple items-center justify-center mb-6">
                      <Text className="text-4xl font-bold text-cosmic-purple">{score}/{data.length}</Text>
                  </View>

                  <Pressable onPress={onFinish} className="bg-cosmic-purple px-8 py-3 rounded-full">
                      <Text className="text-white font-bold">Fechar</Text>
                  </Pressable>
              </Animated.View>
          </View>
      );
  }

  return (
    <View className="flex-1 bg-space-dark px-6 pt-10">
      {/* Progress */}
      <View className="flex-row justify-between mb-8">
          <Text className="text-gray-400 font-medium">Questão {currentIndex + 1}/{data.length}</Text>
          <Text className="text-cosmic-purple font-bold">Pontos: {score}</Text>
      </View>

      <Animated.View key={currentIndex} entering={FadeIn} className="flex-1">
          <Text className="text-2xl text-starlight font-bold mb-8 leading-8">
              {currentQuestion.question}
          </Text>

          <View className="space-y-4">
              {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQuestion.correctAnswerIndex;

                  let bgStyle = 'bg-space-light border-white/10';
                  let icon = null;

                  if (isAnswered) {
                      if (isCorrect) {
                          bgStyle = 'bg-green-500/20 border-green-500';
                          icon = <CheckCircle2 color="#4ade80" size={20} />;
                      } else if (isSelected) {
                          bgStyle = 'bg-red-500/20 border-red-500';
                          icon = <XCircle color="#f87171" size={20} />;
                      } else {
                           bgStyle = 'bg-space-light/50 border-white/5 opacity-50';
                      }
                  } else if (isSelected) {
                      bgStyle = 'bg-cosmic-purple/20 border-cosmic-purple';
                  }

                  return (
                      <Pressable
                          key={idx}
                          onPress={() => handleSelect(idx)}
                          className={`flex-row items-center p-4 rounded-xl border-2 ${bgStyle} transition-all`}
                      >
                          <View className="flex-1">
                              <Text className={`text-lg ${isAnswered && isCorrect ? 'text-green-400 font-bold' : 'text-starlight'}`}>
                                  {option}
                              </Text>
                          </View>
                          {icon}
                      </Pressable>
                  );
              })}
          </View>
      </Animated.View>

      <View className="h-24 justify-center">
          {isAnswered && (
              <Animated.View entering={FadeIn}>
                  <Pressable
                      onPress={handleNext}
                      className="bg-starlight py-4 rounded-xl flex-row justify-center items-center"
                  >
                      <Text className="text-space-dark font-bold text-lg mr-2">
                          {currentIndex < data.length - 1 ? 'Próxima' : 'Ver Resultado'}
                      </Text>
                      <ChevronRight color="#020617" size={20} />
                  </Pressable>
              </Animated.View>
          )}
      </View>
    </View>
  );
};
