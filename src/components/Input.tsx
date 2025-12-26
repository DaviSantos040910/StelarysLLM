import { TextInput, TextInputProps, View, Text } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="mb-4">
      {label && <Text className="text-gray-700 font-medium mb-1">{label}</Text>}
      <TextInput
        className={`bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 ${error ? 'border-red-500' : 'focus:border-blue-500'} ${className}`}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}
