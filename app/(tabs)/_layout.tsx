import { Tabs } from 'expo-router';
import { View } from 'react-native';

// Simple icon placeholder until we add an icon library
function TabIcon({ color }: { color: string }) {
  return <View style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 12 }} />;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#3b82f6' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
