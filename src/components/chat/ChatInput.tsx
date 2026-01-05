import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, Text, Modal, SafeAreaView } from 'react-native';
import { Mic, Send, Paperclip, Image as ImageIcon, Camera, Trash2, Maximize2, Minimize2 } from 'lucide-react-native';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPlusPress: () => void;
  onGalleryPress: () => void;
  onCameraPress: () => void;
  onAudioRecorded: (uri: string, duration: number) => void;
  disabled?: boolean;
  allowAttachments?: boolean; // New Prop
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSend,
  onPlusPress,
  onGalleryPress,
  onCameraPress,
  onAudioRecorded,
  disabled,
  allowAttachments = true // Default true
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
  const dotOpacity = useSharedValue(1);

  // Expanded Mode State
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  // Mic Animation (Scale)
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

  // Red Dot Animation (Opacity Pulse)
  useEffect(() => {
    if (isRecording) {
      dotOpacity.value = withRepeat(withTiming(0.2, { duration: 800 }), -1, true);
    } else {
      dotOpacity.value = 1;
    }
  }, [isRecording]);

  const animatedMicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }]
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value
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
        setIsExpanded(false); // Collapse on send
        onSend();
    } else {
        handleMicPress();
    }
  };

  // Card container styles
  const cardContainerClass = "bg-space-light rounded-[28px] p-4";
  const wrapperClass = "px-4 pb-2 pt-2";
  const iconColor = "#94a3b8";

  // Threshold for showing the expand button (approx 3 lines)
  const showExpandButton = contentHeight > 60 || isExpanded;

  return (
    <>
        <View className={wrapperClass}>
            <View className={cardContainerClass}>
                {isRecording ? (
                    // Recording UI
                    <View className="flex-row items-center justify-between h-[120px]">
                        <Pressable
                            onPress={cancelRecording}
                            className="p-3 bg-red-500/10 rounded-full"
                            accessibilityLabel="Cancelar gravação"
                        >
                            <Trash2 color="#ef4444" size={24} />
                        </Pressable>

                        <View className="flex-1 items-center justify-center space-y-2">
                            <Animated.View
                                style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginBottom: 4 }, animatedDotStyle]}
                            />
                            <Text className="text-starlight text-xl font-mono font-bold">
                                {formattedDuration}
                            </Text>
                            <Text className="text-gray-400 text-xs">Gravando áudio...</Text>
                        </View>

                        <Pressable
                            onPress={handleStopRecording}
                            className="p-3 bg-cosmic-purple rounded-full"
                            accessibilityLabel="Enviar áudio"
                        >
                            <Send color="white" size={24} />
                        </Pressable>
                    </View>
                ) : (
                    // Standard Text Input UI
                    <>
                        <View className="flex-row">
                            <TextInput
                                placeholder="Peça ao Stelarys..."
                                placeholderTextColor="#64748b"
                                value={value}
                                onChangeText={onChangeText}
                                multiline
                                editable={!disabled}
                                onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
                                className="text-starlight text-lg leading-6 min-h-[40px] max-h-[120px] mb-3 flex-1"
                                style={{ textAlignVertical: 'top' }}
                            />
                            {/* Expand Button (Absolute top-right relative to text area) */}
                            {showExpandButton && (
                                <Pressable
                                    onPress={() => setIsExpanded(true)}
                                    className="p-2 ml-2 self-start"
                                    accessibilityLabel="Expandir editor"
                                >
                                    <Maximize2 color="#64748b" size={18} />
                                </Pressable>
                            )}
                        </View>

                        {/* Bottom: Icons Row */}
                        <View className="flex-row justify-between items-center">
                            {/* Left: Attachment Actions */}
                            <View className="flex-row items-center gap-5">
                                {/* Only show Paperclip if allowAttachments is true */}
                                {allowAttachments && (
                                    <Pressable
                                        onPress={onPlusPress}
                                        disabled={disabled}
                                        className="p-2 -ml-2"
                                        accessibilityLabel="Abrir menu de anexos"
                                    >
                                        <Paperclip color={iconColor} size={24} />
                                    </Pressable>
                                )}

                                <Pressable
                                    onPress={onGalleryPress}
                                    disabled={disabled}
                                    className="p-2"
                                    accessibilityLabel="Escolher da galeria"
                                >
                                    <ImageIcon color={iconColor} size={24} />
                                </Pressable>

                                <Pressable
                                    onPress={onCameraPress}
                                    disabled={disabled}
                                    className="p-2"
                                    accessibilityLabel="Tirar foto"
                                >
                                    <Camera color={iconColor} size={24} />
                                </Pressable>
                            </View>

                            {/* Right: Mic or Send */}
                            <Pressable
                                onPress={handleSendPress}
                                disabled={disabled}
                                className={`p-3 rounded-full ${value.trim() ? 'bg-cosmic-purple' : 'bg-white/10'}`}
                                accessibilityLabel={value.trim() ? "Enviar mensagem" : "Gravar áudio"}
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
                    </>
                )}
            </View>
        </View>

        {/* Expanded Mode Modal */}
        <Modal
            visible={isExpanded}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setIsExpanded(false)}
        >
            <SafeAreaView className="flex-1 bg-space-dark">
                <View className="flex-1 px-4 pt-4">
                    {/* Header: Minimize */}
                    <View className="flex-row justify-end mb-4 border-b border-white/5 pb-2">
                        <Pressable
                            onPress={() => setIsExpanded(false)}
                            className="p-2 bg-space-light rounded-full border border-white/10"
                        >
                            <Minimize2 color="#94a3b8" size={20} />
                        </Pressable>
                    </View>

                    {/* Main Input Area */}
                    <TextInput
                        value={value}
                        onChangeText={onChangeText}
                        multiline
                        autoFocus
                        placeholder="Digite sua mensagem..."
                        placeholderTextColor="#64748b"
                        className="flex-1 text-starlight text-lg leading-7 p-2"
                        style={{ textAlignVertical: 'top' }}
                    />

                    {/* Footer: Actions */}
                    <View className="h-[80px] flex-row items-center justify-between border-t border-white/10 mt-4">
                         {/* Attachment buttons hidden in Expanded Mode per UX requirement */}
                         <View className="flex-row gap-4">
                            {/* Empty View to maintain flex-between structure if needed, or just nothing */}
                         </View>

                         <Pressable
                            onPress={handleSendPress}
                            className={`p-3 rounded-full ${value.trim() ? 'bg-cosmic-purple' : 'bg-white/10'}`}
                        >
                            <Send color="white" size={24} />
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    </>
  );
};
