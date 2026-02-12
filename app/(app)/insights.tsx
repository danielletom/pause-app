import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InsightsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.lockedIconContainer}>
            <Ionicons name="lock-closed" size={32} color="#a8a29e" />
          </View>
          <Text style={styles.emptyTitle}>Insights locked</Text>
          <Text style={styles.emptyDescription}>
            Log for 7 days to unlock insights about your patterns and trends
          </Text>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>0 of 7 days</Text>
          </View>
        </View>

        {/* Preview Cards */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Coming soon</Text>

          <View style={styles.previewCard}>
            <Ionicons name="trending-up-outline" size={20} color="#a8a29e" />
            <View style={styles.previewCardText}>
              <Text style={styles.previewCardTitle}>Symptom Trends</Text>
              <Text style={styles.previewCardDescription}>
                See how your symptoms change over time
              </Text>
            </View>
          </View>

          <View style={styles.previewCard}>
            <Ionicons name="analytics-outline" size={20} color="#a8a29e" />
            <View style={styles.previewCardText}>
              <Text style={styles.previewCardTitle}>Correlations</Text>
              <Text style={styles.previewCardDescription}>
                Discover what affects how you feel
              </Text>
            </View>
          </View>

          <View style={styles.previewCard}>
            <Ionicons name="calendar-outline" size={20} color="#a8a29e" />
            <View style={styles.previewCardText}>
              <Text style={styles.previewCardTitle}>Weekly Reports</Text>
              <Text style={styles.previewCardDescription}>
                Get personalized weekly summaries
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1917',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  lockedIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    width: '0%',
    height: '100%',
    backgroundColor: '#1c1917',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#a8a29e',
  },
  previewSection: {
    gap: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78716c',
    marginBottom: 4,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  previewCardText: {
    marginLeft: 14,
    flex: 1,
  },
  previewCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  previewCardDescription: {
    fontSize: 13,
    color: '#78716c',
  },
});
