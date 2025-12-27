import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { Mic, Send, Plus, Trash2, StopCircle, Paperclip } from 'lucide-react-native';
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
      // If empty and not recording, start recording?
      // Current UX: Button changes to Mic if empty.
      handleMicPress();
    }
  };

  if (isRecording) {
    return (
      <View className="flex-row items-center p-3 bg-space-light border-t border-white/10 h-[72px]">
         <Pressable
            onPress={cancelRecording}
            className="p-3 bg-red-500/10 rounded-full mr-4"
         >
             <Trash2 color="#ef4444" size={24} />
         </Pressable>

         <View className="flex-1 items-center flex-row justify-center space-x-2">
             <View className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <Text className="text-starlight text-lg font-mono font-bold">
                 {formattedDuration}
             </Text>
         </View>

         <Pressable
            onPress={handleStopRecording}
            className="p-3 bg-cosmic-purple rounded-full ml-4"
         >
             <Send color="white" size={24} />
         </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-row items-center p-3 bg-space-light border-t border-white/10 min-h-[72px]">
       <Pressable onPress={onPlusPress} disabled={disabled} className="p-2">
           <Plus color="#94a3b8" size={24} />
       </Pressable>

       <TextInput
         placeholder="Message..."
         placeholderTextColor="#64748b"
         value={value}
         onChangeText={onChangeText}
         multiline
         editable={!disabled}
         className="flex-1 bg-space-dark text-starlight rounded-2xl px-4 py-3 mx-2 border border-white/10 text-base leading-5 max-h-[100px]"
       />

       <Pressable
            onPress={value.trim() ? onSend : handleMicPress}
            disabled={disabled}
            className={`p-3 rounded-full ${value.trim() ? 'bg-cosmic-purple' : 'bg-white/10'}`}
       >
           {value.trim() ? (
               <Send color="white" size={20} />
           ) : (
               <Mic color={disabled ? "#64748b" : "#ffffff"} size={20} />
           )}
       </Pressable>
    </View>
  );
};
