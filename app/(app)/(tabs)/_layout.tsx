import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBarIcon from '@/components/TabBarIcon';
import { hapticLight } from '@/lib/haptics';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Safe bottom padding: use device insets or fallback for older devices
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1c1917',
        tabBarInactiveTintColor: '#d6d3d1',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f5f5f4',
          borderTopWidth: 1,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: 56 + bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          hapticLight();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="home-outline" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="bar-chart-outline" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="book-outline" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="heart-outline" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="person-outline" size={22} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
