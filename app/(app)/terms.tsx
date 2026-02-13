import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';

const SECTIONS = [
  {
    heading: '1. Agreement',
    body: 'By downloading, accessing, or using the Pause mobile application (\u201CApp\u201D) operated by Pause Botanica Inc. (\u201Cwe,\u201D \u201Cus,\u201D or \u201CPause\u201D), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.',
  },
  {
    heading: '2. Eligibility',
    body: 'You must be at least 18 years old and capable of forming a binding contract to use this App. By using Pause, you represent that you meet these requirements.',
  },
  {
    heading: '3. Not Medical Advice',
    body: 'Pause is a wellness tracking tool. It is not a medical device and does not provide medical diagnoses, treatment recommendations, or clinical advice. Content provided through the App, including insights, patterns, and program materials, is for informational and educational purposes only. Always consult a qualified healthcare provider before making health decisions, starting supplements, or changing medications.',
  },
  {
    heading: '4. Account & Subscriptions',
    body: 'You are responsible for maintaining the security of your account. Subscriptions (Pause Premium and Pause+) are billed through your Apple ID or Google Play account. You may cancel at any time through your device\u2019s subscription settings. Pause+ subscribers receive a physical supplement shipment; the 90-day money-back guarantee applies from first shipment date. Refunds for digital subscriptions follow Apple/Google\u2019s refund policies.',
  },
  {
    heading: '5. Supplements',
    body: 'The Pause supplement is a natural health product, not a drug. It has not been evaluated by Health Canada to diagnose, treat, cure, or prevent any disease. Individual results may vary. Consult your doctor before use, especially if pregnant, nursing, or taking medications. Do not exceed recommended dose.',
  },
  {
    heading: '6. User Data',
    body: 'You retain ownership of all personal data you enter into the App. We use your data solely to provide and improve the Pause service as described in our Privacy Policy. You may export or delete your data at any time through the App.',
  },
  {
    heading: '7. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Pause Botanica Inc. shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App or supplement products. Our total liability shall not exceed the amount you paid in the 12 months preceding the claim.',
  },
  {
    heading: '8. Governing Law',
    body: 'These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada. Any disputes will be resolved in the courts of Toronto, Ontario.',
  },
];

export default function TermsScreen() {
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
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.subtitle}>Last updated February 2026</Text>
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
          <Text style={styles.footerName}>Pause Botanica Inc.</Text>
          <Text style={styles.footerDetail}>
            20 Bay Street, 11th Floor, Toronto, ON M6J 2N8, Canada
          </Text>
          <Text style={styles.footerDetail}>support@pausebotanica.com</Text>
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

  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#a8a29e' },

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
  footerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 4,
  },
  footerDetail: {
    fontSize: 13,
    color: '#a8a29e',
    lineHeight: 20,
  },
});
