import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

interface SettingsItemProps {
    icon: any;
    label: string;
    onPress?: () => void;
    value?: string;
    isSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (val: boolean) => void;
    danger?: boolean;
    color?: string;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
    icon: Icon,
    label,
    onPress,
    value,
    isSwitch,
    switchValue,
    onSwitchChange,
    danger,
    color
}) => {
    const iconColor = color || (danger ? '#ef4444' : '#94a3b8');
    const textColor = danger ? 'text-red-500' : 'text-gray-900 dark:text-starlight';

    return (
        <Pressable
            onPress={isSwitch ? undefined : onPress}
            className="flex-row items-center py-4 border-b border-gray-100 dark:border-white/5 active:opacity-70"
        >
            <View className={`p-2 rounded-lg ${danger ? 'bg-red-500/10' : 'bg-gray-100 dark:bg-white/5'} mr-4`}>
                <Icon size={20} color={iconColor} />
            </View>

            <View className="flex-1">
                <Text className={`text-base font-medium ${textColor}`}>
                    {label}
                </Text>
            </View>

            {isSwitch ? (
                <Switch
                    value={switchValue}
                    onValueChange={onSwitchChange}
                    trackColor={{ false: "#e2e8f0", true: "#818cf8" }}
                    thumbColor="#ffffff"
                />
            ) : (
                <View className="flex-row items-center">
                    {value && <Text className="text-gray-500 text-sm mr-2">{value}</Text>}
                    <ChevronRight size={20} color="#94a3b8" />
                </View>
            )}
        </Pressable>
    );
};
