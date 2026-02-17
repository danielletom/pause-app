import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBarIcon, { TabBarLogIcon } from '@/components/TabBarIcon';
import { hapticLight } from '@/lib/haptics';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  // Safe bottom padding: use device insets or fallback for older devices
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1c1917',
        tabBarInactiveTintColor: '#78716c',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f5f5f4',
          borderTopWidth: 1,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: 56 + bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 12,
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
          title: '',
          tabBarIcon: ({ focused }) => <TabBarLogIcon focused={focused} />,
          tabBarLabel: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="meds" options={{ href: null }} />
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
      {/* Hidden screens — accessible via router.push but not shown in tab bar */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="quick-log" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="article" options={{ href: null }} />
      <Tabs.Screen name="sos" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="symptom-detail" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="about-me" options={{ href: null }} />
      <Tabs.Screen name="legal" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="help-feedback" options={{ href: null }} />
      <Tabs.Screen name="export-data" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="journal-am" options={{ href: null }} />
      <Tabs.Screen name="journal-pm" options={{ href: null }} />
      <Tabs.Screen name="journal-done" options={{ href: null }} />
      <Tabs.Screen name="journal-week" options={{ href: null }} />
    </Tabs>
  );
}
