import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';

export default function HomeScreen() {
  const { user } = useUser();

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const firstName = user?.firstName || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.dateText}>{dateString}</Text>
          <Text style={styles.greeting}>Hi, {firstName}</Text>
        </View>

        {/* Readiness Score */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Readiness Score</Text>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>--</Text>
          </View>
          <Text style={styles.scoreHint}>
            Log your first entry to see your score
          </Text>
        </View>

        {/* Today's Summary */}
        <Text style={styles.sectionTitle}>Today</Text>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>+</Text>
          </View>
          <Text style={styles.emptyCardTitle}>No entries yet</Text>
          <Text style={styles.emptyCardDescription}>
            Tap the Log button to record how you're feeling
          </Text>
        </View>

        {/* Streaks */}
        <Text style={styles.sectionTitle}>Your Streak</Text>

        <View style={styles.streakCard}>
          <View style={styles.streakRow}>
            <Text style={styles.streakNumber}>0</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
          <Text style={styles.streakHint}>
            Log daily to build your streak
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 28,
  },
  dateText: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1917',
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#78716c',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#d6d3d1',
  },
  scoreHint: {
    fontSize: 13,
    color: '#a8a29e',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 24,
    color: '#a8a29e',
    fontWeight: '300',
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 4,
  },
  emptyCardDescription: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 20,
  },
  streakCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1c1917',
    marginRight: 8,
  },
  streakLabel: {
    fontSize: 16,
    color: '#78716c',
  },
  streakHint: {
    fontSize: 13,
    color: '#a8a29e',
  },
});
