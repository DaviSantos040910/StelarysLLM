import React, { useState } from 'react';
import { View, Text, Pressable, ViewStyle, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, MessageSquarePlus, RefreshCw, History, FileText, X, Settings } from 'lucide-react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { UserAvatar } from '../UserAvatar';
import { themeClasses } from '../../theme/classes';
import { useColorScheme } from 'nativewind';

interface FloatingTutorCardProps {
  botName: string;
  botAvatar: string;
  createdByMe?: boolean;
  onBack?: () => void;
  onNewChat?: () => void;
  onMenu?: (action: string) => void;
  animatedStyle?: ViewStyle;
}

export const FloatingTutorCard: React.FC<FloatingTutorCardProps> = ({
  botName,
  botAvatar,
  createdByMe,
  onBack,
  onNewChat,
  onMenu,
  animatedStyle,
}) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleMenuAction = (action: string) => {
      setMenuVisible(false);
      onMenu?.(action);
  };

  return (
    <>
        <Animated.View
        className="absolute top-0 left-0 right-0 z-50 px-4 pt-[40px] pb-2 items-center"
        style={animatedStyle}
        pointerEvents="box-none"
        >
        <View className="flex-row items-center bg-white/90 dark:bg-space-light/90 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 shadow-lg backdrop-blur-md w-full justify-between">

            <View className="flex-row items-center flex-1">
            <Pressable onPress={handleBack} className={`mr-3 p-1 rounded-full ${themeClasses.press}`}>
                <ArrowLeft color={colorScheme === 'dark' ? '#f8fafc' : '#111827'} size={20} />
            </Pressable>

            <UserAvatar imageUri={botAvatar} size={32} className="mr-3" />

            <Text
                className={`${themeClasses.textPrimary} text-base font-bold flex-1`}
                numberOfLines={1}
            >
                {botName || 'Tutor'}
            </Text>
            </View>

            <View className="flex-row items-center gap-2">
            <Pressable
                onPress={onNewChat}
                className={`p-2 rounded-full ${themeClasses.press}`}
                accessibilityLabel="Estúdio"
            >
                <MessageSquarePlus color="#94a3b8" size={20} />
            </Pressable>

            <Pressable
                onPress={() => setMenuVisible(true)}
                className={`p-2 rounded-full ${themeClasses.press}`}
                accessibilityLabel="Menu"
            >
                <MoreVertical color="#94a3b8" size={20} />
            </Pressable>
            </View>

        </View>
        </Animated.View>

        {/* Custom Modal Menu */}
        <Modal
            transparent
            visible={menuVisible}
            animationType="fade"
            onRequestClose={() => setMenuVisible(false)}
        >
            <Pressable
                className="flex-1 bg-black/60"
                onPress={() => setMenuVisible(false)}
            >
                <Animated.View
                    entering={SlideInDown.duration(200)}
                    className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-space-light rounded-t-3xl border-t border-gray-200 dark:border-white/10 p-6 pb-10`}
                >
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`${themeClasses.textSecondary} font-bold text-sm`}>Opções da Conversa</Text>
                        <Pressable onPress={() => setMenuVisible(false)} className={`p-1 rounded-full ${themeClasses.softSurface}`}>
                            <X color="#94a3b8" size={20} />
                        </Pressable>
                    </View>

                    {createdByMe && (
                        <MenuItem
                            icon={Settings}
                            label="Editar Tutor"
                            desc="Alterar configurações do assistente"
                            onPress={() => handleMenuAction('edit_bot')}
                            color="#eab308"
                        />
                    )}

                    <MenuItem
                        icon={RefreshCw}
                        label="Novo Chat"
                        desc="Inicia uma nova conversa limpa"
                        onPress={() => handleMenuAction('new_chat')}
                        color="#818cf8"
                    />
                    <MenuItem
                        icon={History}
                        label="Histórico de Conversas"
                        desc="Ver conversas anteriores"
                        onPress={() => handleMenuAction('history')}
                        color="#fbbf24"
                    />
                    <MenuItem
                        icon={FileText}
                        label="Gerenciar Fontes"
                        desc="Ver arquivos anexados a este chat"
                        onPress={() => handleMenuAction('manage_sources')}
                        color="#34d399"
                    />
                </Animated.View>
            </Pressable>
        </Modal>
    </>
  );
};

const MenuItem = ({ icon: Icon, label, desc, onPress, color }: any) => (
    <Pressable
        onPress={onPress}
        className={`flex-row items-center p-4 rounded-2xl mb-3 ${themeClasses.softSurface} ${themeClasses.press}`}
    >
        <View className="p-3 rounded-full bg-white/50 dark:bg-white/5 mr-4">
            <Icon size={24} color={color} />
        </View>
        <View className="flex-1">
            <Text className={`${themeClasses.textPrimary} font-bold text-base`}>{label}</Text>
            <Text className={`${themeClasses.textMuted} text-xs`}>{desc}</Text>
        </View>
    </Pressable>
);
