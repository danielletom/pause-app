import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticSelection, hapticMedium, hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

export default function CustomTrackingScreen() {
  const { getToken } = useAuth();

  const [customSymptoms, setCustomSymptoms] = useState<string[]>([]);
  const [newSymptom, setNewSymptom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch custom symptoms from profile
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const token = await getToken();
          const profile = await apiRequest('/api/profile', token);
          if (profile?.customSymptoms && Array.isArray(profile.customSymptoms)) {
            setCustomSymptoms(profile.customSymptoms);
          }
        } catch {
          // Silently handle — empty state is fine
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const saveSymptoms = async (updated: string[]) => {
    try {
      setSaving(true);
      const token = await getToken();
      await apiRequest('/api/profile', token, {
        method: 'POST',
        body: JSON.stringify({ customSymptoms: updated }),
      });
      setCustomSymptoms(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const name = newSymptom.trim();
    if (!name) return;

    // Check for duplicates (case-insensitive)
    if (customSymptoms.some((s) => s.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Already exists', 'You already have this symptom tracked.');
      return;
    }

    hapticMedium();
    const updated = [...customSymptoms, name];
    await saveSymptoms(updated);
    setNewSymptom('');
  };

  const handleDelete = (index: number) => {
    const symptomName = customSymptoms[index];
    Alert.alert(
      'Remove symptom',
      `Remove "${symptomName}" from your custom tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            hapticLight();
            const updated = customSymptoms.filter((_, i) => i !== index);
            await saveSymptoms(updated);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>Custom tracking</Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Add symptoms or triggers that are unique to your experience. These
            will appear in your daily check-in alongside the standard options.
          </Text>
        </View>

        {/* Add new symptom */}
        <Text style={styles.sectionTitle}>Add a new item</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newSymptom}
            onChangeText={setNewSymptom}
            placeholder="e.g. Tinnitus, Brain fog, Dry eyes"
            placeholderTextColor="#a8a29e"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <AnimatedPressable
            onPress={handleAdd}
            scaleDown={0.95}
            style={[
              styles.addButton,
              (!newSymptom.trim() || saving) && styles.addButtonDisabled,
            ]}
            disabled={!newSymptom.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </AnimatedPressable>
        </View>

        {/* Current custom items */}
        <Text style={styles.sectionTitle}>
          Your custom items{' '}
          {customSymptoms.length > 0 && (
            <Text style={styles.countBadge}>({customSymptoms.length})</Text>
          )}
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : customSymptoms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>No custom items yet</Text>
            <Text style={styles.emptyDesc}>
              Add symptoms or triggers that matter to you above. They'll
              show up in your daily check-in.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {customSymptoms.map((symptom, index) => (
              <View key={`${symptom}-${index}`} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <View style={styles.itemDot} />
                  <Text style={styles.itemName}>{symptom}</Text>
                </View>
                <AnimatedPressable
                  onPress={() => handleDelete(index)}
                  scaleDown={0.9}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Remove</Text>
                </AnimatedPressable>
              </View>
            ))}
          </View>
        )}

        {/* Tip card */}
        {customSymptoms.length > 0 && (
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Custom items appear alongside standard symptoms when you log.
              After 14+ days of data, our AI will start detecting patterns
              with your custom items too.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  // Header
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },

  // Info card
  infoCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 24,
  },
  infoText: { fontSize: 16, color: '#1c1917', lineHeight: 22 },

  // Section title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 10,
    marginLeft: 2,
  },
  countBadge: {
    fontSize: 16,
    fontWeight: '400',
    color: '#78716c',
  },

  // Add row
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1c1917',
  },
  addButton: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Loading
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
    color: '#a8a29e',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 16,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
  },

  // List
  listContainer: {
    gap: 6,
    marginBottom: 20,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1c1917',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1917',
    flex: 1,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    minHeight: 36,
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },

  // Tip card
  tipCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  tipText: {
    fontSize: 16,
    color: '#1c1917',
    lineHeight: 22,
  },
});
