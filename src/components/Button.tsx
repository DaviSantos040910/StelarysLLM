import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'nativewind';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading = false, className, ...props }: ButtonProps) {
  const { colorScheme } = useColorScheme();

  let variantStyle = "";
  let textStyle = "";
  let spinnerColor = "#ffffff";

  switch (variant) {
    case 'primary':
      variantStyle = "bg-cosmic-purple shadow-lg shadow-cosmic-purple/30";
      textStyle = "text-white font-bold text-center text-lg";
      spinnerColor = "#ffffff";
      break;
    case 'secondary':
      variantStyle = "bg-nebula-pink shadow-lg shadow-nebula-pink/30";
      textStyle = "text-white font-bold text-center text-lg";
      spinnerColor = "#ffffff";
      break;
    case 'outline':
      variantStyle = "bg-transparent border border-gray-200 dark:border-white/20";
      textStyle = "text-gray-900 dark:text-white font-semibold text-center text-lg";
      spinnerColor = colorScheme === 'dark' ? '#ffffff' : '#111827';
      break;
    default:
      variantStyle = "bg-cosmic-purple";
      textStyle = "text-white font-bold text-center";
      spinnerColor = "#ffffff";
  }

  const isDisabled = props.disabled || loading;

  return (
    <TouchableOpacity
      className={`px-6 py-4 rounded-xl items-center justify-center ${variantStyle} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text className={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
