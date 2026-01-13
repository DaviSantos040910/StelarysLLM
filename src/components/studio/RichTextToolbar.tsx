import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Bold, Italic, Highlighter, Underline, ChevronUp, Palette } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface Props {
  onStylePress: (style: string, value?: string) => void;
  activeStyles?: string[];
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export const RichTextToolbar: React.FC<Props> = ({ onStylePress, activeStyles = [] }) => {
  const [activeMenu, setActiveMenu] = useState<'highlight' | 'color' | null>(null);

  const toggleMenu = (menu: 'highlight' | 'color') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  const isBold = activeStyles.includes('bold');
  const isItalic = activeStyles.includes('italic');

  const ColorPalette = ({ type }: { type: 'highlight' | 'color' }) => (
    <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        className="absolute bottom-16 left-4 right-4 bg-space-light border border-white/10 rounded-xl p-4 flex-row justify-between shadow-xl"
    >
        {COLORS.map(color => (
            <Pressable
                key={color}
                onPress={() => {
                    onStylePress(type, color);
                    setActiveMenu(null);
                }}
                className="w-8 h-8 rounded-full border-2 border-white/20"
                style={{ backgroundColor: color }}
            />
        ))}
    </Animated.View>
  );

  return (
    <View className="bg-space-light/95 border-t border-white/10 pb-6 pt-2">
        {activeMenu && <ColorPalette type={activeMenu} />}

        <View className="flex-row justify-around items-center px-4 h-12">
            <Pressable onPress={() => onStylePress('bold')} className={`p-2 rounded-lg ${isBold ? 'bg-cosmic-purple/20' : 'active:bg-white/10'}`}>
                <Bold color={isBold ? '#818cf8' : '#e2e8f0'} size={24} />
            </Pressable>

            <Pressable onPress={() => onStylePress('italic')} className={`p-2 rounded-lg ${isItalic ? 'bg-cosmic-purple/20' : 'active:bg-white/10'}`}>
                <Italic color={isItalic ? '#818cf8' : '#e2e8f0'} size={24} />
            </Pressable>

            <Pressable onPress={() => toggleMenu('color')} className="p-2 rounded-lg active:bg-white/10">
                <Palette color="#e2e8f0" size={24} />
            </Pressable>

            <Pressable onPress={() => toggleMenu('highlight')} className="p-2 rounded-lg active:bg-white/10">
                <Highlighter color="#e2e8f0" size={24} />
            </Pressable>
        </View>
    </View>
  );
};
