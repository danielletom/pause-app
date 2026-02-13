import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

const SECTIONS = [
  {
    heading: '1. What We Collect',
    body: 'Account information (name, email via Apple Sign-In), health and wellness data you voluntarily log (symptoms, sleep, mood, medications, journal entries), device data (device type, app version, crash logs), and usage analytics (screens viewed, features used \u2014 anonymized and aggregated).',
  },
  {
    heading: '2. How We Use It',
    body: 'To provide personalized insights and patterns based on your tracking data. To deliver your 8-week program content. To generate doctor reports you request. To send you reminders (push and SMS, with your consent). To improve the App through aggregated, anonymized analytics. To ship your Pause supplement (Pause+ subscribers).',
  },
  {
    heading: '3. \u2018Am I Normal?\u2019 & Benchmarks',
    body: 'Our comparison features use fully anonymized, aggregated data. Your individual data is never identifiable in benchmarks. You can opt out of contributing to anonymous benchmarks in your settings without losing access to the feature.',
  },
  {
    heading: '4. Data Storage & Security',
    body: 'Your data is encrypted at rest (AES-256) and in transit (TLS 1.3). Data is stored on servers in Canada and the United States (via Vercel/Neon). We do not store credit card information \u2014 payments are processed through Apple/Google.',
  },
  {
    heading: '5. Third-Party Sharing',
    body: 'We do not sell your personal data. We share data only with: service providers (hosting, email, shipping) under strict data processing agreements, and law enforcement only when required by Canadian law. Wearable data (Apple Health, Oura) stays on your device and is only read with your explicit permission.',
  },
  {
    heading: '6. Your Rights (PIPEDA)',
    body: 'You have the right to: access your personal data (via Export in the App), correct inaccurate data, withdraw consent at any time, request deletion of your account and all data, and file a complaint with the Office of the Privacy Commissioner of Canada.',
  },
  {
    heading: '7. Data Retention',
    body: 'We retain your data for as long as your account is active. If you delete your account, we permanently erase all personal data within 30 days. Anonymized, aggregated analytics may be retained indefinitely.',
  },
  {
    heading: '8. SMS & Communications',
    body: 'SMS medication reminders require opt-in. You can opt out at any time by replying STOP or toggling off in Notifications settings. Standard messaging rates may apply. We will never send marketing messages via SMS without explicit consent.',
  },
];

export default function PrivacyScreen() {
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
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subtitle}>Last updated February 2026</Text>
        </View>

        {/* PIPEDA callout */}
        <View style={styles.pipedaCard}>
          <Text style={styles.pipedaText}>
            Pause Botanica Inc. is a Canadian company. We comply with PIPEDA
            (Personal Information Protection and Electronic Documents Act) and all
            applicable Canadian privacy laws. We do not sell your personal
            information.
          </Text>
        </View>

        {/* Sections */}
        <View style={styles.sectionsContainer}>
          {SECTIONS.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </View>

        {/* Footer card */}
        <View style={styles.footerCard}>
          <Text style={styles.footerLabel}>Privacy Officer</Text>
          <Text style={styles.footerEmail}>privacy@pausebotanica.com</Text>
          <Text style={styles.footerName}>Pause Botanica Inc.</Text>
          <Text style={styles.footerDetail}>
            20 Bay Street, 11th Floor, Toronto, ON M6J 2N8, Canada
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },

  backButton: { paddingVertical: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },

  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#a8a29e' },

  pipedaCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  pipedaText: {
    fontSize: 13,
    color: '#78716c',
    lineHeight: 20,
  },

  sectionsContainer: { gap: 20, marginBottom: 32 },
  section: {},
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 14,
    color: '#78716c',
    lineHeight: 22,
  },

  footerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a8a29e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
    marginBottom: 8,
  },
  footerName: {
    fontSize: 13,
    color: '#78716c',
    marginBottom: 2,
  },
  footerDetail: {
    fontSize: 13,
    color: '#a8a29e',
    lineHeight: 20,
  },
});
