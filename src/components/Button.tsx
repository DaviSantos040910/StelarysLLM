import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary';
}

export function Button({ title, variant = 'primary', className, ...props }: ButtonProps) {
  const baseStyle = "px-6 py-3 rounded-lg";
  const variantStyle = variant === 'primary' ? "bg-blue-500" : "bg-gray-200";
  const textStyle = variant === 'primary' ? "text-white font-semibold" : "text-gray-800 font-semibold";

  return (
    <TouchableOpacity
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      <Text className={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}
