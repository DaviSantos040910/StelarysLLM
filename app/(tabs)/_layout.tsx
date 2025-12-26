import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { LayoutDashboard, UserCircle } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: 'rgba(30, 27, 75, 0.9)', // Indigo Deep with opacity
          borderRadius: 25,
          height: 60,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.5,
          paddingBottom: Platform.OS === 'ios' ? 0 : 0, // Adjust padding if needed
        },
        tabBarActiveTintColor: '#06b6d4', // Cyan
        tabBarInactiveTintColor: '#94a3b8', // Stellar Gray
        tabBarShowLabel: false,
        tabBarItemStyle: {
           height: 60,
           justifyContent: 'center',
           alignItems: 'center',
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserCircle size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
