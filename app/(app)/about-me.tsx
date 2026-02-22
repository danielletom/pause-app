import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium, hapticSelection } from '@/lib/haptics';
import BackButton from '@/components/BackButton';
import { apiRequest } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';

// Map between API values (stored in DB) and display labels
const STAGE_MAP: [string, string][] = [
  ['peri', 'Perimenopause'],
  ['meno', 'Menopause'],
  ['post', 'Post-menopause'],
  ['unsure', "I'm not sure"],
];

const RELATIONSHIP_MAP: [string, string][] = [
  ['single', 'Single'],
  ['partnered', 'In a relationship'],
  ['married', 'Married'],
  ['divorced', 'Divorced'],
  ['widowed', 'Widowed'],
  ['prefer_not_to_say', 'Prefer not to say'],
];

const WORK_MAP: [string, string][] = [
  ['full_time', 'Working full-time'],
  ['part_time', 'Working part-time'],
  ['self_employed', 'Self-employed'],
  ['stay_at_home', 'Stay-at-home'],
  ['retired', 'Retired'],
  ['other', 'Other'],
];

const CHILDREN_MAP: [string, string][] = [
  ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4+'],
];

const EXERCISE_MAP: [string, string][] = [
  ['rarely', 'Rarely'],
  ['1_2_per_week', '1-2x/week'],
  ['3_per_week', '3-4x/week'],
  ['5_plus_per_week', '5+/week'],
];

function getLabel(map: [string, string][], value: string): string {
  return map.find(([v]) => v === value)?.[1] || value;
}

function getValue(map: [string, string][], label: string): string {
  return map.find(([, l]) => l === label)?.[0] || label;
}

export default function AboutMeScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { profile, refetch } = useProfile();

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weight, setWeight] = useState('');
  const [stage, setStage] = useState('');
  const [relationship, setRelationship] = useState('');
  const [workStatus, setWorkStatus] = useState('');
  const [children, setChildren] = useState('');
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.dateOfBirth) setDateOfBirth(p.dateOfBirth);
    if (p.height) {
      const match = String(p.height).match(/^(\d+)'(\d+)$/);
      if (match) {
        setHeightFeet(match[1]);
        setHeightInches(match[2]);
      }
    }
    if (p.weight) setWeight(String(p.weight));
    // Map API codes → display labels for pill selections
    if (p.stage) setStage(getLabel(STAGE_MAP, p.stage));
    if (p.relationship) setRelationship(getLabel(RELATIONSHIP_MAP, p.relationship));
    if (p.workStatus) setWorkStatus(getLabel(WORK_MAP, p.workStatus));
    if (p.children) setChildren(getLabel(CHILDREN_MAP, p.children));
    if (p.exerciseFrequency) setExerciseFrequency(getLabel(EXERCISE_MAP, p.exerciseFrequency));
  }, [profile]);

  const computedAge = (() => {
    if (!dateOfBirth) return null;
    const parts = dateOfBirth.split('-');
    if (parts.length !== 3) return null;
    const birthYear = parseInt(parts[0], 10);
    const birthMonth = parseInt(parts[1], 10);
    const birthDay = parseInt(parts[2], 10);
    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null;
    const now = new Date();
    let age = now.getFullYear() - birthYear;
    const monthDiff = now.getMonth() + 1 - birthMonth;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDay)) {
      age--;
    }
    return age > 0 && age < 120 ? age : null;
  })();

  const handleSave = async () => {
    try {
      hapticMedium();
      setSaving(true);
      const token = await getToken();
      await apiRequest('/api/profile', token, {
        method: 'POST',
        body: JSON.stringify({
          dateOfBirth: dateOfBirth || undefined,
          height: heightFeet && heightInches ? `${heightFeet}'${heightInches}` : undefined,
          weight: weight || undefined,
          stage: stage ? getValue(STAGE_MAP, stage) : undefined,
          relationship: relationship ? getValue(RELATIONSHIP_MAP, relationship) : undefined,
          workStatus: workStatus ? getValue(WORK_MAP, workStatus) : undefined,
          children: children ? getValue(CHILDREN_MAP, children) : undefined,
          exerciseFrequency: exerciseFrequency ? getValue(EXERCISE_MAP, exerciseFrequency) : undefined,
        }),
      });
      await refetch();
      Alert.alert('Saved', 'Your info has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderPills = (
    options: string[],
    selected: string,
    onSelect: (value: string) => void,
    wrap?: boolean
  ) => (
    <View style={[styles.pillRow, wrap && styles.pillRowWrap]}>
      {options.map((option) => {
        const isActive = selected === option;
        return (
          <AnimatedPressable
            key={option}
            onPress={() => {
              hapticSelection();
              onSelect(isActive ? '' : option);
            }}
            scaleDown={0.95}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {option}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>About me</Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            This info helps us give you better insights and more relevant
            comparisons in 'Am I Normal?' — it's all optional and stored securely.
          </Text>
        </View>

        {/* Date of birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date of birth</Text>
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#a8a29e"
            autoCapitalize="none"
          />
          {computedAge !== null && (
            <Text style={styles.fieldHint}>
              Age: {computedAge} · Used for peer comparisons
            </Text>
          )}
        </View>

        {/* Height */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Height</Text>
          <View style={styles.heightRow}>
            <TextInput
              style={[styles.input, styles.heightInput]}
              value={heightFeet}
              onChangeText={setHeightFeet}
              placeholder="5"
              placeholderTextColor="#a8a29e"
              keyboardType="numeric"
              maxLength={1}
            />
            <Text style={styles.unitText}>ft</Text>
            <TextInput
              style={[styles.input, styles.heightInput]}
              value={heightInches}
              onChangeText={setHeightInches}
              placeholder="6"
              placeholderTextColor="#a8a29e"
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.unitText}>in</Text>
          </View>
        </View>

        {/* Weight */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Weight</Text>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, styles.weightInput]}
              value={weight}
              onChangeText={setWeight}
              placeholder="148"
              placeholderTextColor="#a8a29e"
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={styles.unitText}>lbs</Text>
          </View>
        </View>

        {/* Menopause stage */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Menopause stage</Text>
          {renderPills(STAGE_MAP.map(([, l]) => l), stage, setStage, true)}
        </View>

        {/* Relationship status */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Relationship status</Text>
          {renderPills(RELATIONSHIP_MAP.map(([, l]) => l), relationship, setRelationship, true)}
        </View>

        {/* Work status */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Work status</Text>
          {renderPills(WORK_MAP.map(([, l]) => l), workStatus, setWorkStatus, true)}
        </View>

        {/* Number of children */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Number of children</Text>
          {renderPills(CHILDREN_MAP.map(([, l]) => l), children, setChildren)}
        </View>

        {/* Exercise frequency */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Exercise frequency</Text>
          {renderPills(EXERCISE_MAP.map(([, l]) => l), exerciseFrequency, setExerciseFrequency)}
        </View>

        {/* Save button */}
        <AnimatedPressable
          onPress={handleSave}
          scaleDown={0.97}
          style={styles.saveButton}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </AnimatedPressable>
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
  infoText: {
    fontSize: 13,
    color: '#1c1917',
    lineHeight: 19,
  },

  // Fields
  fieldGroup: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1c1917',
  },
  fieldHint: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 6,
    marginLeft: 2,
  },

  // Height row
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightInput: {
    width: 60,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '500',
  },

  // Weight row
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    width: 80,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillRowWrap: {
    flexWrap: 'wrap',
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
  pillText: {
    fontSize: 13,
    color: '#78716c',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#ffffff',
  },

  // Save
  saveButton: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
