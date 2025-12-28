import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';
import { Mic, Send, Plus, Trash2 } from 'lucide-react-native';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPlusPress: () => void;
  onAudioRecorded: (uri: string, duration: number) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSend,
  onPlusPress,
  onAudioRecorded,
  disabled
}) => {
  const {
    recordingState,
    formattedDuration,
    duration,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder();

  const isRecording = recordingState === 'recording' || recordingState === 'initializing';
  const micScale = useSharedValue(1);

  useEffect(() => {
    if (recordingState === 'recording') {
      micScale.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true
      );
    } else {
      micScale.value = withSpring(1);
    }
  }, [recordingState]);

  const animatedMicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }]
  }));

  const handleMicPress = async () => {
     await startRecording();
  };

  const handleStopRecording = async () => {
      const uri = await stopRecording();
      if (uri) {
          onAudioRecorded(uri, duration);
      }
  };

  const handleSendPress = () => {
    if (value.trim()) {
      onSend();
    } else {
      handleMicPress();
    }
  };

  // Card container styles
  const cardContainerClass = "bg-space-light rounded-[28px] p-4";
  const wrapperClass = "px-4 pb-2 pt-2"; // wrapper to float the card

  if (isRecording) {
    return (
      <View className={wrapperClass}>
          <View className={`${cardContainerClass} flex-row items-center justify-between h-[120px]`}>
            <Pressable
                onPress={cancelRecording}
                className="p-3 bg-red-500/10 rounded-full"
            >
                <Trash2 color="#ef4444" size={24} />
            </Pressable>

            <View className="flex-1 items-center justify-center space-y-2">
                <View className="w-2 h-2 rounded-full bg-red-500 animate-pulse mb-1" />
                <Text className="text-starlight text-xl font-mono font-bold">
                    {formattedDuration}
                </Text>
                <Text className="text-gray-400 text-xs">Gravando áudio...</Text>
            </View>

            <Pressable
                onPress={handleStopRecording}
                className="p-3 bg-cosmic-purple rounded-full"
            >
                <Send color="white" size={24} />
            </Pressable>
          </View>
      </View>
    );
  }

  return (
    <View className={wrapperClass}>
        <View className={cardContainerClass}>
            {/* Top: Input Area */}
            <TextInput
                placeholder="Peça ao Stelarys..."
                placeholderTextColor="#64748b"
                value={value}
                onChangeText={onChangeText}
                multiline
                editable={!disabled}
                className="text-starlight text-lg leading-6 min-h-[40px] max-h-[120px] mb-3"
                style={{ textAlignVertical: 'top' }}
            />

            {/* Bottom: Icons Row */}
            <View className="flex-row justify-between items-center">
                {/* Left: Attachment */}
                <Pressable
                    onPress={onPlusPress}
                    disabled={disabled}
                    className="p-2 bg-white/5 rounded-full"
                >
                    <Plus color="#94a3b8" size={24} />
                </Pressable>

                {/* Right: Mic or Send */}
                <Pressable
                    onPress={value.trim() ? onSend : handleMicPress}
                    disabled={disabled}
                    className={`p-3 rounded-full ${value.trim() ? 'bg-cosmic-purple' : 'bg-white/10'}`}
                >
                    {value.trim() ? (
                        <Send color="white" size={20} />
                    ) : (
                        <Animated.View style={animatedMicStyle}>
                            <Mic color={disabled ? "#64748b" : "#ffffff"} size={20} />
                        </Animated.View>
                    )}
                </Pressable>
            </View>
        </View>
    </View>
  );
};
