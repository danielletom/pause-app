import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticLight, hapticSelection, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

interface Settings {
  enabled: boolean;
  homeWidget: boolean;
  predictions: boolean;
  reminders: boolean;
  crossInsights: boolean;
}

export default function PeriodSettingsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    homeWidget: true,
    predictions: true,
    reminders: true,
    crossInsights: true,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const data = await apiRequest('/api/period/settings', token);
      setSettings({
        enabled: data.enabled ?? true,
        homeWidget: data.homeWidget ?? true,
        predictions: data.predictions ?? true,
        reminders: data.reminders ?? true,
        crossInsights: data.crossInsights ?? true,
      });
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchSettings(); }, [fetchSettings]));

  const updateSetting = async (key: string, value: boolean) => {
    hapticSelection();
    const prev = { ...settings };
    setSettings(s => ({ ...s, [key]: value }));
    try {
      const token = await getTokenRef.current();
      await apiRequest('/api/period/settings', token, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setSettings(prev); // revert on error
    }
  };

  const handleDeclareMenopause = () => {
    Alert.alert(
      'Reached menopause?',
      "If it's been 12+ months since your last period, we'll disable period tracking and focus on post-menopause wellbeing. Your data won't be deleted.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Yes, I've reached menopause",
          onPress: async () => {
            try {
              const token = await getTokenRef.current();
              await apiRequest('/api/period/settings/declare-menopause', token, { method: 'POST' });
              hapticMedium();
              router.replace('/(app)/profile');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update');
            }
          },
        },
      ]
    );
  };

  const Toggle = ({ value, onToggle, label, desc }: { value: boolean; onToggle: () => void; label: string; desc?: string }) => (
    <AnimatedPressable onPress={onToggle} scaleDown={0.98} style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {desc && <Text style={styles.toggleDesc}>{desc}</Text>}
      </View>
      <View style={[styles.toggleSwitch, value && styles.toggleSwitchOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </AnimatedPressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton label="Tracker" />
          <Text style={styles.title}>Period Tracking</Text>
          <Text style={styles.subtitle}>Manage your period tracker settings</Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#f43f5e" />
          </View>
        ) : (
          <>
            {/* Master toggle */}
            <View style={[styles.masterCard, settings.enabled && { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
              <Toggle
                value={settings.enabled}
                onToggle={() => updateSetting('enabled', !settings.enabled)}
                label="Enable period tracking"
                desc="Show period tracker on your home screen and include cycle data in insights"
              />
              {!settings.enabled && (
                <View style={styles.disabledNotice}>
                  <Text style={styles.disabledNoticeText}>
                    Disabling won't delete your data. You can turn this back on anytime. If you've reached menopause (12 months without a period), you can safely disable this.
                  </Text>
                </View>
              )}
            </View>

            {settings.enabled && (
              <>
                {/* Feature toggles */}
                <View style={styles.card}>
                  <Toggle
                    value={settings.homeWidget}
                    onToggle={() => updateSetting('homeWidget', !settings.homeWidget)}
                    label="Home screen widget"
                    desc="Show period tracker widget on your home screen"
                  />
                  <View style={styles.divider} />
                  <Toggle
                    value={settings.predictions}
                    onToggle={() => updateSetting('predictions', !settings.predictions)}
                    label="Period predictions"
                    desc="Estimate your next period based on cycle patterns"
                  />
                  <View style={styles.divider} />
                  <Toggle
                    value={settings.reminders}
                    onToggle={() => updateSetting('reminders', !settings.reminders)}
                    label="Period reminders"
                    desc="Gentle notification when your period may be approaching"
                  />
                  <View style={styles.divider} />
                  <Toggle
                    value={settings.crossInsights}
                    onToggle={() => updateSetting('crossInsights', !settings.crossInsights)}
                    label="Cross-feature insights"
                    desc="Connect period data with hot flashes, sleep and mood tracking"
                  />
                </View>

                {/* Data management */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>Data</Text>
                  <AnimatedPressable onPress={() => hapticLight()} scaleDown={0.98} style={styles.dataRow}>
                    <Text style={styles.dataRowText}>Export cycle data (CSV)</Text>
                    <Text style={styles.chevron}>›</Text>
                  </AnimatedPressable>
                  <View style={styles.divider} />
                  <AnimatedPressable onPress={() => hapticLight()} scaleDown={0.98} style={styles.dataRow}>
                    <Text style={styles.dataRowText}>Generate GP report (PDF)</Text>
                    <Text style={styles.chevron}>›</Text>
                  </AnimatedPressable>
                </View>

                {/* Approaching menopause */}
                <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: '#d97706' }}>✦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 }}>Reached menopause?</Text>
                      <Text style={{ fontSize: 12, color: '#78716c', lineHeight: 18 }}>
                        If it's been 12 months since your last period, you've likely reached menopause. You can disable period tracking and Pause will adjust your experience.
                      </Text>
                      <AnimatedPressable onPress={handleDeclareMenopause} scaleDown={0.97}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#d97706', marginTop: 8 }}>
                          I haven't had a period in 12+ months →
                        </Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                </View>

                {/* Delete data */}
                <AnimatedPressable
                  onPress={() => {
                    hapticLight();
                    Alert.alert('Delete period data', 'This will permanently delete all your period and cycle data. This action cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => {} },
                    ]);
                  }}
                  scaleDown={0.97}
                  style={{ alignItems: 'center', paddingVertical: 16 }}
                >
                  <Text style={{ fontSize: 12, color: '#f43f5e' }}>Delete all period data</Text>
                </AnimatedPressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
  topBar: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 12, color: '#a8a29e', marginTop: 2 },

  masterCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#e7e5e4', marginBottom: 10,
  },
  disabledNotice: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f5f5f4' },
  disabledNoticeText: { fontSize: 12, color: '#a8a29e', lineHeight: 18 },

  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4', marginBottom: 10,
  },
  divider: { height: 1, backgroundColor: '#f5f5f4', marginVertical: 4 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  toggleLabel: { fontSize: 14, color: '#44403c' },
  toggleDesc: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e7e5e4', justifyContent: 'center', padding: 2 },
  toggleSwitchOn: { backgroundColor: '#f43f5e' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#44403c', marginBottom: 10 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  dataRowText: { fontSize: 12, color: '#78716c' },
  chevron: { fontSize: 16, color: '#d6d3d1' },
});
