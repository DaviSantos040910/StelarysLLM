import { TextInput, TextInputProps, View, Text } from 'react-native';
import { themeClasses } from '../theme/classes';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: string;
}

export function Input({ label, error, className, containerStyle, ...props }: InputProps) {
  return (
    <View className={containerStyle}>
      {label && <Text className={`${themeClasses.textSecondary} font-medium mb-2`}>{label}</Text>}
      <TextInput
        className={`${themeClasses.input} px-4 py-4 ${error ? 'border-red-500' : 'focus:border-indigo-500'} ${className}`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
      {error && <Text className="text-red-400 text-sm mt-1">{error}</Text>}
    </View>
  );
}
