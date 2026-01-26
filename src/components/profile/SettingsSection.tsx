import React from 'react';
import { View, Text } from 'react-native';

interface SettingsSectionProps {
    title?: string;
    children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
    return (
        <View className="mb-8">
            {title && (
                <Text className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                    {title}
                </Text>
            )}
            <View className="bg-white dark:bg-space-light rounded-2xl px-4 shadow-sm dark:shadow-none border border-gray-100 dark:border-white/5">
                {children}
            </View>
        </View>
    );
};
