import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';

interface NotifItem {
  key: string;
  icon: string;
  label: string;
  desc: string;
  badge?: string;
}

const notifItems: NotifItem[] = [
  {
    key: 'log',
    icon: '◉',
    label: 'Daily check-in reminder',
    desc: 'A gentle nudge to log how you\u2019re feeling',
  },
  {
    key: 'hrt',
    icon: '◎',
    label: 'Medication reminders',
    desc: 'Never miss a dose or patch change',
  },
  {
    key: 'sms',
    icon: '💬',
    label: 'SMS medication alerts',
    desc: 'Get a text when it\u2019s time for your meds',
    badge: 'Premium',
  },
  {
    key: 'insights',
    icon: '✦',
    label: 'Weekly insights digest',
    desc: 'Your patterns and trends, summarized',
  },
  {
    key: 'wellness',
    icon: '☽',
    label: 'Daily lesson reminder',
    desc: 'Your 8-week program, one day at a time',
  },
];

const timeOptions = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

export default function NotifSetupScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const [notifs, setNotifs] = useState(data.notifPrefs);

  const toggleNotif = (key: string) => {
    hapticLight();
    setNotifs((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const setTime = (time: string) => {
    hapticSelection();
    setNotifs((prev) => ({ ...prev, time }));
  };

  const setPhone = (phone: string) => {
    setNotifs((prev) => ({ ...prev, phone }));
  };

  const handleFinish = () => {
    updateData({ notifPrefs: notifs });
    router.push('/(onboarding)/done');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={5} total={7} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Stay on track</Text>
        <Text style={styles.subheading}>
          Gentle nudges, not noise. Customize anytime.
        </Text>

        <View style={styles.notifList}>
          {notifItems.map((item) => (
            <View key={item.key} style={styles.notifRow}>
              <Text style={styles.notifIcon}>{item.icon}</Text>
              <View style={styles.notifContent}>
                <View style={styles.notifLabelRow}>
                  <Text style={styles.notifLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.premBadge}>
                      <Text style={styles.premBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.notifDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={notifs[item.key as keyof typeof notifs] as boolean}
                onValueChange={() => toggleNotif(item.key)}
                trackColor={{ false: '#e7e5e4', true: '#1c1917' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e7e5e4"
              />
            </View>
          ))}
        </View>

        {/* SMS Phone Input */}
        {notifs.sms && (
          <View style={styles.phoneSection}>
            <Text style={styles.phoneLabel}>Your phone number for SMS</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="(555) 555-1234"
              placeholderTextColor="#a8a29e"
              value={notifs.phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          </View>
        )}

        {/* Time Preference */}
        {notifs.log && (
          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>Best time to remind you?</Text>
            <View style={styles.timeOptions}>
              {timeOptions.map((opt) => (
                <AnimatedPressable
                  key={opt.key}
                  onPress={() => setTime(opt.key)}
                  scaleDown={0.93}
                  style={[
                    styles.timePill,
                    notifs.time === opt.key && styles.timePillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.timePillText,
                      notifs.time === opt.key && styles.timePillTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleFinish}>
          Finish setup
        </OnboardingButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    marginBottom: 24,
    lineHeight: 20,
  },
  notifList: {
    gap: 0,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    gap: 12,
  },
  notifIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
    color: '#a8a29e',
  },
  notifContent: {
    flex: 1,
  },
  notifLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
  },
  premBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  premBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d97706',
  },
  notifDesc: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  phoneSection: {
    marginTop: 20,
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 14,
  },
  phoneLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#44403c',
    marginBottom: 8,
  },
  phoneInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1c1917',
  },
  timeSection: {
    marginTop: 24,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#44403c',
    marginBottom: 10,
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    backgroundColor: '#f5f5f4',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  timePillSelected: {
    backgroundColor: '#1c1917',
  },
  timePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#78716c',
  },
  timePillTextSelected: {
    color: '#ffffff',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});
