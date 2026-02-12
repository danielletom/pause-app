import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LogScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Log</Text>
          <Text style={styles.subtitle}>How are you feeling?</Text>
        </View>

        {/* Log Options */}
        <View style={styles.cardsContainer}>
          {/* Quick Log */}
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={[styles.cardIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="flash" size={24} color="#f59e0b" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Quick Log</Text>
              <Text style={styles.cardDescription}>
                Rate your overall feeling in seconds
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#d6d3d1" />
          </TouchableOpacity>

          {/* Log Meds */}
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={[styles.cardIcon, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="flask" size={24} color="#059669" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Log Meds</Text>
              <Text style={styles.cardDescription}>
                Track your medications and supplements
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#d6d3d1" />
          </TouchableOpacity>

          {/* Detailed Log */}
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={[styles.cardIcon, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="document-text" size={24} color="#6366f1" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Detailed Log</Text>
              <Text style={styles.cardDescription}>
                Full symptom tracking with notes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#d6d3d1" />
          </TouchableOpacity>
        </View>

        {/* Recent Logs */}
        <Text style={styles.sectionTitle}>Recent</Text>
        <View style={styles.emptyRecent}>
          <Text style={styles.emptyRecentText}>No recent logs</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#78716c',
  },
  cardsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 13,
    color: '#78716c',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 12,
  },
  emptyRecent: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyRecentText: {
    fontSize: 14,
    color: '#a8a29e',
  },
});
