import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

const LEGAL_ITEMS = [
  {
    icon: '📋',
    label: 'Terms of Service',
    desc: 'How you can use Pause',
    route: '/(app)/terms',
  },
  {
    icon: '🔒',
    label: 'Privacy Policy',
    desc: 'How we protect your data',
    route: '/(app)/privacy',
  },
  {
    icon: '⚕️',
    label: 'Medical Disclaimer',
    desc: 'Pause is not medical advice',
    route: null,
  },
  {
    icon: '💬',
    label: 'SMS Terms',
    desc: 'Messaging opt-in and opt-out',
    route: null,
  },
];

export default function LegalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back nav */}
        <AnimatedPressable
          onPress={() => { hapticLight(); router.back(); }}
          scaleDown={0.95}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </AnimatedPressable>

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Terms & Privacy</Text>
        </View>

        {/* List items */}
        <View style={styles.listContainer}>
          {LEGAL_ITEMS.map((item) => (
            <AnimatedPressable
              key={item.label}
              onPress={() => {
                hapticLight();
                if (item.route) router.push(item.route as any);
              }}
              scaleDown={0.98}
              style={styles.card}
            >
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              {item.route && <Text style={styles.chevron}>›</Text>}
            </AnimatedPressable>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Version 1.0.0 · © 2026 Pause Botanica Inc.
          </Text>
          <Text style={styles.footerAddress}>
            20 Bay Street, 11th Floor, Toronto, ON M6J 2N8
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  backButton: { paddingVertical: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },

  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },

  listContainer: { gap: 6, marginBottom: 32 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardIcon: { fontSize: 16 },
  cardLabel: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  cardDesc: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  chevron: { fontSize: 18, color: '#d6d3d1' },

  footer: { alignItems: 'center', marginTop: 8 },
  footerText: { fontSize: 11, color: '#d6d3d1', marginBottom: 4 },
  footerAddress: { fontSize: 11, color: '#d6d3d1', textAlign: 'center' },
});
