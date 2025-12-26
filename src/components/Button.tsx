import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ title, variant = 'primary', className, ...props }: ButtonProps) {
  let variantStyle = "";
  let textStyle = "";

  switch (variant) {
    case 'primary':
      variantStyle = "bg-cosmic-purple shadow-lg shadow-cosmic-purple/30";
      textStyle = "text-white font-bold text-center text-lg";
      break;
    case 'secondary':
      variantStyle = "bg-nebula-pink shadow-lg shadow-nebula-pink/30";
      textStyle = "text-white font-bold text-center text-lg";
      break;
    case 'outline':
      variantStyle = "bg-transparent border border-white/20";
      textStyle = "text-white font-semibold text-center text-lg";
      break;
    default:
      variantStyle = "bg-cosmic-purple";
      textStyle = "text-white font-bold text-center";
  }

  return (
    <TouchableOpacity
      className={`px-6 py-4 rounded-xl ${variantStyle} ${props.disabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      <Text className={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}
