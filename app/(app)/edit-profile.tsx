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
import { useUser, useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { profile, refetch } = useProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (profile?.name) {
      const parts = profile.name.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    } else {
      setFirstName(user?.firstName || '');
      setLastName(user?.lastName || '');
    }
  }, [profile, user]);

  const handleSave = async () => {
    try {
      hapticMedium();
      setSaving(true);
      const token = await getToken();
      await apiRequest('/api/profile', token, {
        method: 'POST',
        body: JSON.stringify({ name: `${firstName} ${lastName}`.trim() }),
      });
      await refetch();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      hapticMedium();
      await user?.delete();
      router.replace('/(auth)/sign-in');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete account');
    }
  };

  const email = user?.primaryEmailAddress?.emailAddress || '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.back(); }}
            scaleDown={0.95}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </AnimatedPressable>
          <Text style={styles.title}>Edit profile</Text>
        </View>

        {/* First name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="#a8a29e"
            autoCapitalize="words"
          />
        </View>

        {/* Last name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor="#a8a29e"
            autoCapitalize="words"
          />
        </View>

        {/* Email (read-only) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, { opacity: 0.5 }]}
            value={email}
            editable={false}
            placeholderTextColor="#a8a29e"
          />
        </View>

        {/* Apple Sign-In badge */}
        <View style={styles.appleBadge}>
          <Text style={styles.appleIcon}>🍎</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.appleBadgeTitle}>Signed in with Apple</Text>
            <Text style={styles.appleBadgeDesc}>Password managed by Apple ID</Text>
          </View>
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>Connected</Text>
          </View>
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

        {/* Delete account section */}
        <View style={styles.deleteSection}>
          {!showDelete ? (
            <AnimatedPressable
              onPress={() => { hapticLight(); setShowDelete(true); }}
              scaleDown={0.98}
            >
              <Text style={styles.deleteLink}>Delete my account</Text>
            </AnimatedPressable>
          ) : (
            <View style={styles.deleteCard}>
              <Text style={styles.deleteCardTitle}>Are you sure?</Text>
              <Text style={styles.deleteCardBody}>
                This will permanently delete your account, all tracking data,
                journal entries, and reports. This cannot be undone.
              </Text>
              <Text style={styles.deleteCardNote}>
                If you have a Pause+ subscription, please cancel it first in
                your Apple ID settings.
              </Text>

              <AnimatedPressable
                onPress={handleDeleteAccount}
                scaleDown={0.97}
                style={styles.deleteConfirmButton}
              >
                <Text style={styles.deleteConfirmText}>Yes, delete my account</Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => { hapticLight(); setShowDelete(false); }}
                scaleDown={0.97}
                style={styles.deleteCancelButton}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  // Header
  header: { marginBottom: 24 },
  backButton: { marginBottom: 12 },
  backText: { fontSize: 16, color: '#78716c' },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },

  // Fields
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#1c1917', marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1c1917',
  },

  // Apple badge
  appleBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  appleIcon: { fontSize: 20 },
  appleBadgeTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  appleBadgeDesc: { fontSize: 12, color: '#78716c', marginTop: 1 },
  connectedBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  connectedText: { fontSize: 11, fontWeight: '600', color: '#059669' },

  // Save
  saveButton: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // Delete section
  deleteSection: { alignItems: 'center', marginTop: 8 },
  deleteLink: {
    fontSize: 13,
    color: '#ef4444',
    textDecorationLine: 'underline',
  },
  deleteCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    width: '100%',
  },
  deleteCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 8,
  },
  deleteCardBody: {
    fontSize: 13,
    color: '#1c1917',
    lineHeight: 19,
    marginBottom: 8,
  },
  deleteCardNote: {
    fontSize: 12,
    color: '#78716c',
    lineHeight: 17,
    marginBottom: 16,
  },
  deleteConfirmButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteConfirmText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  deleteCancelButton: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteCancelText: { fontSize: 14, fontWeight: '500', color: '#78716c' },
});
