import { TextInput, TextInputProps, View, Text } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: string;
}

export function Input({ label, error, className, containerStyle, ...props }: InputProps) {
  return (
    <View className={containerStyle}>
      {label && <Text className="text-gray-300 font-medium mb-2">{label}</Text>}
      <TextInput
        className={`bg-card border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-gray-500 ${error ? 'border-red-500' : 'focus:border-primary'} ${className}`}
        placeholderTextColor="#64748b"
        {...props}
      />
      {error && <Text className="text-red-400 text-sm mt-1">{error}</Text>}
    </View>
  );
}
