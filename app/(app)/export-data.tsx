import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection, hapticMedium } from '@/lib/haptics';

const DATE_RANGES: [string, string][] = [
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['6m', 'Last 6 months'],
  ['all', 'All time'],
];

const PDF_ITEMS = [
  'Personal summary (age, stage, time tracking)',
  'Symptom trends & severity charts',
  'Sleep data & Sleep Score history',
  'Medication adherence rates',
  'Top triggers & patterns identified',
  'Journal highlights & mood trends',
  'Lab results (if uploaded)',
  'Recommendations for your doctor',
];

const CSV_FILES = [
  { file: 'daily_log.csv', desc: 'Daily symptom entries' },
  { file: 'sleep_data.csv', desc: 'Sleep hours, quality, disruptions' },
  { file: 'medications.csv', desc: 'Adherence records' },
  { file: 'journal_entries.csv', desc: 'Morning & evening reflections' },
  { file: 'lab_results.csv', desc: 'Your uploaded lab data' },
];

export default function ExportDataScreen() {
  const router = useRouter();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress || 'your email';

  const [range, setRange] = useState('all');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [exporting, setExporting] = useState(false);

  // Pulsing animation for export progress
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (exporting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [exporting]);

  const handleExport = () => {
    hapticMedium();
    setExporting(true);
    setTimeout(() => setExporting(false), 3000);
  };

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
            <Text style={styles.backText}>{'\u2039'}</Text>
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Export your data</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Date range pills */}
        <Text style={styles.sectionTitle}>Date range</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillStrip}
          contentContainerStyle={styles.pillStripContent}
        >
          {DATE_RANGES.map(([key, label]) => {
            const active = range === key;
            return (
              <AnimatedPressable
                key={key}
                onPress={() => { hapticSelection(); setRange(key); }}
                scaleDown={0.95}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* Format picker */}
        <Text style={styles.sectionTitle}>Format</Text>
        <View style={styles.formatRow}>
          {/* PDF card */}
          <AnimatedPressable
            onPress={() => { hapticSelection(); setFormat('pdf'); }}
            scaleDown={0.97}
            style={[
              styles.formatCard,
              format === 'pdf' ? styles.formatCardSelected : styles.formatCardUnselected,
            ]}
          >
            {format === 'pdf' && (
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>{'\u2713'}</Text>
              </View>
            )}
            <Text style={styles.formatEmoji}>{'\uD83D\uDCC4'}</Text>
            <Text style={styles.formatLabel}>PDF Report</Text>
            <Text style={styles.formatDesc}>Formatted report for your doctor or personal records</Text>
          </AnimatedPressable>

          {/* CSV card */}
          <AnimatedPressable
            onPress={() => { hapticSelection(); setFormat('csv'); }}
            scaleDown={0.97}
            style={[
              styles.formatCard,
              format === 'csv' ? styles.formatCardSelected : styles.formatCardUnselected,
            ]}
          >
            {format === 'csv' && (
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>{'\u2713'}</Text>
              </View>
            )}
            <Text style={styles.formatEmoji}>{'\uD83D\uDCCA'}</Text>
            <Text style={styles.formatLabel}>CSV</Text>
            <Text style={styles.formatDesc}>Raw data you can open in Excel or Google Sheets</Text>
          </AnimatedPressable>
        </View>

        {/* Content preview */}
        {format === 'pdf' ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>PDF will include:</Text>
            <View style={styles.card}>
              {PDF_ITEMS.map((item, i) => (
                <View key={i} style={styles.contentRow}>
                  <Text style={styles.contentCheck}>{'\u2713'}</Text>
                  <Text style={styles.contentText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>CSV files included:</Text>
            <View style={styles.card}>
              {CSV_FILES.map((item, i) => (
                <View key={i} style={styles.contentRow}>
                  <Text style={styles.contentClip}>{'\uD83D\uDCCE'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.csvFileName}>{item.file}</Text>
                    <Text style={styles.csvFileDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Export button or progress */}
        {!exporting ? (
          <AnimatedPressable
            onPress={handleExport}
            scaleDown={0.97}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Export as {format === 'pdf' ? 'PDF' : 'CSV'}
            </Text>
          </AnimatedPressable>
        ) : (
          <View style={styles.exportingCard}>
            <Animated.Text style={[styles.exportingIcon, { opacity: pulseAnim }]}>
              {'\u2193'}
            </Animated.Text>
            <Text style={styles.exportingTitle}>Generating your export...</Text>
            <Text style={styles.exportingDesc}>This takes about 10 seconds</Text>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { opacity: pulseAnim }]} />
            </View>
          </View>
        )}

        {/* Email note */}
        <Text style={styles.emailNote}>
          Your export will be emailed to {email}
        </Text>
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
    marginBottom: 20,
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

  // Sections
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 10 },

  // Pill strip
  pillStrip: { marginBottom: 20, maxHeight: 44 },
  pillStripContent: { gap: 8 },
  pill: {
    backgroundColor: '#f5f5f4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: '#1c1917' },
  pillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  pillTextActive: { color: '#ffffff' },

  // Format picker
  formatRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  formatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  formatCardSelected: {
    borderWidth: 2,
    borderColor: '#1c1917',
  },
  formatCardUnselected: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 11, color: '#ffffff', fontWeight: '700' },
  formatEmoji: { fontSize: 28, marginBottom: 8 },
  formatLabel: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  formatDesc: { fontSize: 11, color: '#78716c', textAlign: 'center', lineHeight: 16 },

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

  // Content rows
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  contentCheck: { fontSize: 13, color: '#059669', fontWeight: '600', marginTop: 1 },
  contentText: { fontSize: 13, color: '#44403c', lineHeight: 18, flex: 1 },
  contentClip: { fontSize: 13, marginTop: 1 },
  csvFileName: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  csvFileDesc: { fontSize: 12, color: '#78716c', marginTop: 1 },

  // Primary button
  primaryButton: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // Exporting card
  exportingCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  exportingIcon: { fontSize: 28, color: '#059669', marginBottom: 10 },
  exportingTitle: { fontSize: 15, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  exportingDesc: { fontSize: 12, color: '#78716c', marginBottom: 16 },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#d1fae5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '65%',
    height: 6,
    backgroundColor: '#059669',
    borderRadius: 3,
  },

  // Email note
  emailNote: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    marginTop: 4,
  },
});
