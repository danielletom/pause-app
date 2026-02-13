import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection, hapticSuccess } from '@/lib/haptics';

const TABS = [
  { key: 'help', label: 'Get help' },
  { key: 'feature', label: 'Request a feature' },
];

const FAQ_DATA = [
  {
    question: 'How do I cancel my subscription?',
    answer: 'Go to Profile \u2192 Manage subscription, or manage in your Apple ID settings.',
  },
  {
    question: 'How do I track a new symptom?',
    answer: 'Go to Journal \u2192 Custom tracking to add any symptom you want to monitor.',
  },
  {
    question: 'When will I see my first insights?',
    answer: 'After 14 days of logging. The more consistent you are, the better your insights.',
  },
  {
    question: 'Is my data private?',
    answer: 'Yes. Your data is encrypted and stored securely. We never sell or share personal data.',
  },
];

const SUPPORT_CATEGORIES = ['App issue', 'Subscription', 'Supplement', 'Shipping', 'Other'];

const FEATURE_CATEGORIES = ['Tracking', 'Insights', 'Program', 'Supplement', 'Design', 'Other'];

const IMPORTANCE_OPTIONS: [string, string][] = [
  ['nice', 'Nice to have'],
  ['important', 'Important'],
  ['critical', "Can't live without"],
];

export default function HelpFeedbackScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'help' | 'feature'>('help');
  const [submitted, setSubmitted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [category, setCategory] = useState('App issue');
  const [description, setDescription] = useState('');

  const [featureSubmitted, setFeatureSubmitted] = useState(false);
  const [featureText, setFeatureText] = useState('');
  const [featureCategory, setFeatureCategory] = useState('Tracking');
  const [importance, setImportance] = useState('important');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.back(); }}
            scaleDown={0.92}
            style={styles.backButton}
          >
            <Text style={styles.backText}>\u2039</Text>
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Help & feedback</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <AnimatedPressable
                key={t.key}
                onPress={() => { hapticSelection(); setTab(t.key as 'help' | 'feature'); }}
                scaleDown={0.97}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {tab === 'help' ? (
          <>
            {/* FAQ Section */}
            <Text style={styles.sectionTitle}>Common questions</Text>
            <View style={{ gap: 8, marginBottom: 24 }}>
              {FAQ_DATA.map((faq, index) => {
                const expanded = expandedFaq === index;
                return (
                  <AnimatedPressable
                    key={index}
                    onPress={() => {
                      hapticSelection();
                      setExpandedFaq(expanded ? null : index);
                    }}
                    scaleDown={0.98}
                    style={styles.card}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      <Text style={styles.faqToggle}>{expanded ? '\u25B4' : '\u25BE'}</Text>
                    </View>
                    {expanded && (
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Support form */}
            {!submitted ? (
              <>
                <Text style={styles.sectionTitle}>Still need help?</Text>

                {/* Category pills */}
                <View style={styles.pillRow}>
                  {SUPPORT_CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <AnimatedPressable
                        key={cat}
                        onPress={() => { hapticSelection(); setCategory(cat); }}
                        scaleDown={0.95}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Description input */}
                <TextInput
                  style={styles.textArea}
                  placeholder="Tell us what happened..."
                  placeholderTextColor="#a8a29e"
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                />

                {/* Screenshot attach */}
                <View style={styles.attachCard}>
                  <Text style={styles.attachText}>\uD83D\uDCCE Attach a screenshot</Text>
                </View>

                {/* Submit button */}
                <AnimatedPressable
                  onPress={() => { hapticSuccess(); setSubmitted(true); }}
                  scaleDown={0.97}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Send to support</Text>
                </AnimatedPressable>

                <Text style={styles.noteText}>We typically respond within 24 hours</Text>
              </>
            ) : (
              <View style={styles.successCard}>
                <Text style={styles.successEmoji}>\u2705</Text>
                <Text style={styles.successTitle}>Message sent!</Text>
                <Text style={styles.successDesc}>We typically respond within 24 hours</Text>
              </View>
            )}
          </>
        ) : (
          /* Feature request tab */
          <>
            {!featureSubmitted ? (
              <>
                {/* Amber header card */}
                <View style={styles.amberCard}>
                  <Text style={styles.amberText}>
                    Your ideas shape Pause. Tell us what you'd love to see.
                  </Text>
                </View>

                {/* Feature text input */}
                <TextInput
                  style={styles.textArea}
                  placeholder="I wish Pause could..."
                  placeholderTextColor="#a8a29e"
                  multiline
                  numberOfLines={4}
                  value={featureText}
                  onChangeText={setFeatureText}
                  textAlignVertical="top"
                />

                {/* Feature category pills */}
                <Text style={styles.sectionTitle}>Category</Text>
                <View style={styles.pillRow}>
                  {FEATURE_CATEGORIES.map((cat) => {
                    const active = featureCategory === cat;
                    return (
                      <AnimatedPressable
                        key={cat}
                        onPress={() => { hapticSelection(); setFeatureCategory(cat); }}
                        scaleDown={0.95}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Importance section */}
                <Text style={styles.sectionTitle}>How important is this?</Text>
                <View style={styles.pillRow}>
                  {IMPORTANCE_OPTIONS.map(([key, label]) => {
                    const active = importance === key;
                    return (
                      <AnimatedPressable
                        key={key}
                        onPress={() => { hapticSelection(); setImportance(key); }}
                        scaleDown={0.95}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Submit button */}
                <AnimatedPressable
                  onPress={() => { hapticSuccess(); setFeatureSubmitted(true); }}
                  scaleDown={0.97}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Submit request</Text>
                </AnimatedPressable>
              </>
            ) : (
              <View style={styles.successCard}>
                <Text style={styles.successEmoji}>\uD83D\uDCA1</Text>
                <Text style={styles.successTitle}>Request submitted!</Text>
                <Text style={styles.successDesc}>Thank you for helping us build a better Pause</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 22, color: '#1c1917', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1c1917' },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  tabTextActive: { color: '#1c1917', fontWeight: '600' },

  // Section
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 10 },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // FAQ
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: '#1c1917', flex: 1, marginRight: 8 },
  faqToggle: { fontSize: 14, color: '#a8a29e' },
  faqAnswer: { fontSize: 13, color: '#78716c', lineHeight: 19, marginTop: 10 },

  // Pills
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    backgroundColor: '#f5f5f4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: '#1c1917',
  },
  pillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  pillTextActive: { color: '#ffffff' },

  // Text area
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: '#1c1917',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // Attach card
  attachCard: {
    backgroundColor: '#f5f5f4',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  attachText: { fontSize: 13, color: '#78716c', fontWeight: '500' },

  // Primary button
  primaryButton: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // Note
  noteText: { fontSize: 12, color: '#a8a29e', textAlign: 'center', marginBottom: 16 },

  // Success card
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginTop: 8,
  },
  successEmoji: { fontSize: 32, marginBottom: 12 },
  successTitle: { fontSize: 17, fontWeight: '700', color: '#1c1917', marginBottom: 6 },
  successDesc: { fontSize: 13, color: '#78716c', textAlign: 'center' },

  // Amber card
  amberCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  amberText: { fontSize: 13, color: '#78716c', lineHeight: 19 },
});
