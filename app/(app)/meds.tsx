import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

// ── Types ──

interface Medication {
  id: number;
  name: string;
  dose: string | null;
  time: string | null;
  frequency: string;
  type: string | null;
  active: boolean;
  takenToday?: boolean;
  createdAt?: string;
}

interface MedLog {
  id: number;
  medicationId: number;
  date: string;
  taken: boolean;
}

type TabKey = 'supplements' | 'current' | 'hrt' | 'labs';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'supplements', label: 'Supplements' },
  { key: 'current', label: 'Current' },
  { key: 'hrt', label: 'HRT' },
  { key: 'labs', label: 'Labs' },
];

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Bedtime'];
const FREQUENCY_OPTIONS = ['Daily', 'Twice daily', 'Weekly', 'Every 2 weeks', 'Monthly', 'As needed'];
const TYPE_OPTIONS = [
  { key: 'hrt', label: 'HRT' },
  { key: 'supplement', label: 'Supplement' },
  { key: 'other', label: 'Other' },
];

// Popular menopause medications, supplements, and HRT — for autofill suggestions
const POPULAR_MEDS: { name: string; dose: string; type: string; time: string }[] = [
  // HRT
  { name: 'Estradiol patch', dose: '0.05mg', type: 'hrt', time: 'Morning' },
  { name: 'Estradiol oral', dose: '1mg', type: 'hrt', time: 'Evening' },
  { name: 'Progesterone (Prometrium)', dose: '100mg', type: 'hrt', time: 'Bedtime' },
  { name: 'Estradiol gel', dose: '0.06%', type: 'hrt', time: 'Morning' },
  { name: 'Conjugated estrogens (Premarin)', dose: '0.625mg', type: 'hrt', time: 'Morning' },
  { name: 'Estradiol vaginal cream', dose: '0.01%', type: 'hrt', time: 'Bedtime' },
  // Other meds
  { name: 'Gabapentin', dose: '300mg', type: 'other', time: 'Bedtime' },
  { name: 'Venlafaxine (Effexor)', dose: '37.5mg', type: 'other', time: 'Morning' },
  { name: 'Paroxetine (Brisdelle)', dose: '7.5mg', type: 'other', time: 'Bedtime' },
  { name: 'Clonidine', dose: '0.1mg', type: 'other', time: 'Bedtime' },
  { name: 'Escitalopram (Lexapro)', dose: '10mg', type: 'other', time: 'Morning' },
  { name: 'Melatonin', dose: '3mg', type: 'other', time: 'Bedtime' },
  // Supplements
  { name: 'Magnesium glycinate', dose: '400mg', type: 'supplement', time: 'Bedtime' },
  { name: 'Vitamin D3', dose: '2000 IU', type: 'supplement', time: 'Morning' },
  { name: 'Omega-3 fish oil', dose: '1000mg', type: 'supplement', time: 'Morning' },
  { name: 'Black cohosh', dose: '20mg', type: 'supplement', time: 'Morning' },
  { name: 'Evening primrose oil', dose: '1000mg', type: 'supplement', time: 'Morning' },
  { name: 'Ashwagandha', dose: '600mg', type: 'supplement', time: 'Morning' },
  { name: 'Calcium + D3', dose: '600mg', type: 'supplement', time: 'Evening' },
  { name: 'B-complex', dose: '1 capsule', type: 'supplement', time: 'Morning' },
  { name: 'Iron', dose: '18mg', type: 'supplement', time: 'Morning' },
  { name: 'Probiotics', dose: '1 capsule', type: 'supplement', time: 'Morning' },
  { name: 'Maca root', dose: '500mg', type: 'supplement', time: 'Morning' },
  { name: 'CoQ10', dose: '100mg', type: 'supplement', time: 'Morning' },
];

export default function MedsScreen() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('supplements');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newTime, setNewTime] = useState('Morning');
  const [newFrequency, setNewFrequency] = useState('Daily');
  const [newType, setNewType] = useState('hrt');
  const [smsReminder, setSmsReminder] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const hasLoadedOnce = useRef(false);

  const today = new Date().toISOString().split('T')[0];

  const [weekLogs, setWeekLogs] = useState<MedLog[]>([]);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      const token = await getToken();
      const [medsData, medLogsData, weekLogsData] = await Promise.all([
        apiRequest('/api/meds', token),
        apiRequest(`/api/meds/logs?date=${today}`, token).catch(() => []),
        apiRequest('/api/meds/logs?range=7', token).catch(() => []),
      ]);
      setMeds(medsData);
      if (Array.isArray(medLogsData)) {
        setTodayLogs(medLogsData);
      }
      if (Array.isArray(weekLogsData)) {
        setWeekLogs(weekLogsData);
      }
      hasLoadedOnce.current = true;
    } catch (err: any) {
      console.error('Failed to fetch meds:', err);
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [getToken, today]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const markTaken = async (medId: number) => {
    if (isTakenToday(medId)) return;
    setTodayLogs((prev) => [...prev, { id: 0, medicationId: medId, date: today, taken: true }]);
    hapticSuccess();
    try {
      const token = await getToken();
      await apiRequest(`/api/meds/${medId}/log`, token, { method: 'POST' });
    } catch (err: any) {
      setTodayLogs((prev) => prev.filter((l) => l.medicationId !== medId));
      Alert.alert('Error', err.message || 'Failed to log medication');
    }
  };

  const isTakenToday = (medId: number) =>
    todayLogs.some((log) => log.medicationId === medId && log.taken);

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }
    try {
      setAddSaving(true);
      const token = await getToken();
      await apiRequest('/api/meds', token, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          dose: newDose.trim() || null,
          time: newTime,
          frequency: newFrequency.toLowerCase().replace(/ /g, '_'),
          type: newType,
        }),
      });
      hapticSuccess();
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add medication');
    } finally {
      setAddSaving(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDose('');
    setNewTime('Morning');
    setNewFrequency('Daily');
    setNewType('hrt');
    setSmsReminder(false);
  };

  // Split meds by type
  const supplementMeds = meds.filter((m) => m.type === 'supplement');
  const hrtMeds = meds.filter((m) => m.type === 'hrt');
  const allActiveMeds = meds.filter((m) => m.active !== false);

  // Adherence: % of today's active meds taken
  const totalActive = allActiveMeds.length;
  const takenCount = todayLogs.filter((l) => l.taken).length;
  const adherencePercent = totalActive > 0 ? Math.round((takenCount / totalActive) * 100) : 0;

  // Icon color for med type
  const getMedIcon = (type: string | null) => {
    if (type === 'hrt') return { bg: '#fce4ec', color: '#e91e63', symbol: '◎' };
    if (type === 'supplement') return { bg: '#fff8e1', color: '#f59e0b', symbol: '⬡' };
    return { bg: '#f5f5f4', color: '#78716c', symbol: '●' };
  };

  const formatAddedDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `Added ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `Added ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
    return `Added ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Medications</Text>
            <Text style={styles.subtitle}>Track everything in one place</Text>
          </View>
        </View>

        {/* Tab pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((tab) => (
            <AnimatedPressable
              key={tab.key}
              onPress={() => { hapticLight(); setActiveTab(tab.key); }}
              scaleDown={0.95}
              style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillText, activeTab === tab.key && styles.tabPillTextActive]}>
                {tab.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* ─── Supplements Tab ─── */}
            {activeTab === 'supplements' && (
              <View style={styles.tabContent}>
                {/* Pause Supplement — upsell since user doesn't have it yet */}
                <View style={styles.pauseUpsellCard}>
                  <View style={styles.pauseSupplementHeader}>
                    <View style={styles.pauseSupplementLogo}>
                      <View style={styles.pauseLogoDotOuter}>
                        <View style={styles.pauseLogoDotInner} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pauseSupplementName}>Pause Supplement</Text>
                      <Text style={styles.pauseSupplementDesc}>Pueraria mirifica + L-theanine</Text>
                    </View>
                    <View style={styles.pausePlusBadge}>
                      <Text style={styles.pausePlusBadgeText}>Pause+</Text>
                    </View>
                  </View>
                  <Text style={styles.pauseUpsellBody}>
                    Clinically studied ingredients to support hormonal balance, reduce hot flashes, and improve sleep quality.
                  </Text>
                  <TouchableOpacity style={styles.pauseUpsellBtn} activeOpacity={0.8}>
                    <Text style={styles.pauseUpsellBtnText}>Learn about Pause+ →</Text>
                  </TouchableOpacity>
                </View>

                {/* User's supplements with adherence */}
                {supplementMeds.length > 0 ? (
                  <View style={styles.medsList}>
                    {supplementMeds.map((med) => {
                      const icon = getMedIcon(med.type);
                      const taken = isTakenToday(med.id);
                      return (
                        <AnimatedPressable
                          key={med.id}
                          onPress={() => { taken ? undefined : markTaken(med.id); }}
                          scaleDown={0.98}
                          style={[styles.medCard, { borderWidth: 1, borderColor: '#e7e5e4' }]}
                        >
                          <View style={[styles.medIcon, { backgroundColor: icon.bg }]}>
                            <Text style={[styles.medIconText, { color: icon.color }]}>{icon.symbol}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.medName}>{med.name}</Text>
                            <Text style={styles.medDetail}>
                              {[med.dose, med.time].filter(Boolean).join(' · ')}
                            </Text>
                            <Text style={[styles.medAdherence, taken && styles.medAdherenceTaken]}>
                              {taken ? 'Taken today' : `Next: ${med.time || 'Any time'}`}
                            </Text>
                          </View>
                          {taken ? (
                            <View style={styles.checkDone}>
                              <Ionicons name="checkmark" size={18} color="#ffffff" />
                            </View>
                          ) : (
                            <View style={styles.checkEmpty}>
                              <Ionicons name="ellipse-outline" size={24} color="#d6d3d1" />
                            </View>
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="leaf-outline" size={36} color="#a8a29e" />
                    </View>
                    <Text style={styles.emptyTitle}>No supplements yet</Text>
                    <Text style={styles.emptyDesc}>Add your supplements to track daily adherence</Text>
                    <AnimatedPressable
                      onPress={() => { hapticMedium(); setNewType('supplement'); setShowAddModal(true); }}
                      scaleDown={0.97}
                      style={styles.addMedBtnSmall}
                    >
                      <Text style={styles.addMedBtnSmallText}>+ Add supplement</Text>
                    </AnimatedPressable>
                  </View>
                )}

                {/* Personalized upsell nudge */}
                <View style={styles.upsellCard}>
                  <Text style={styles.upsellIcon}>✦</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upsellTitle}>Personalized for you</Text>
                    <Text style={styles.upsellDesc}>
                      Women in your profile report 40-60% fewer hot flashes after 8 weeks with the Pause supplement.
                    </Text>
                    <Text style={styles.upsellLink}>See the research →</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── Current Tab ─── */}
            {activeTab === 'current' && (
              <View style={styles.tabContent}>
                {/* Adherence summary */}
                {totalActive > 0 && (
                  <View style={styles.adherenceCard}>
                    <View style={styles.adherenceHeader}>
                      <Text style={styles.adherenceTitle}>Today's adherence</Text>
                      <Text style={styles.adherencePercent}>{adherencePercent}%</Text>
                    </View>
                    <View style={styles.adherenceBar}>
                      <View style={[styles.adherenceFill, { width: `${adherencePercent}%` }]} />
                    </View>
                    <Text style={styles.adherenceSub}>
                      {takenCount} of {totalActive} taken
                    </Text>
                  </View>
                )}

                {/* Weekly adherence bar chart */}
                {totalActive > 0 && (
                  <WeeklyAdherenceChart weekLogs={weekLogs} totalMeds={totalActive} />
                )}

                {/* All meds */}
                {allActiveMeds.length > 0 ? (
                  <View style={styles.medsList}>
                    {allActiveMeds.map((med) => {
                      const icon = getMedIcon(med.type);
                      const taken = isTakenToday(med.id);
                      return (
                        <AnimatedPressable
                          key={med.id}
                          onPress={() => { taken ? undefined : markTaken(med.id); }}
                          scaleDown={0.98}
                          style={[styles.medCard, { borderWidth: 1, borderColor: '#e7e5e4' }]}
                        >
                          <View style={[styles.medIcon, { backgroundColor: icon.bg }]}>
                            <Text style={[styles.medIconText, { color: icon.color }]}>{icon.symbol}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.medNameRow}>
                              <Text style={styles.medName}>{med.name}</Text>
                              {smsReminder && (
                                <View style={styles.smsBadge}>
                                  <Text style={styles.smsBadgeText}>💬 SMS</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.medDetail}>
                              {[med.dose, med.frequency !== 'daily' ? med.frequency?.replace(/_/g, ' ') : null].filter(Boolean).join(' · ')}
                            </Text>
                            <Text style={[styles.medAdherence, taken && styles.medAdherenceTaken]}>
                              {taken ? 'Taken today' : `Next: ${med.time || 'Any time'}`}
                            </Text>
                          </View>
                          {taken ? (
                            <View style={styles.checkDone}>
                              <Ionicons name="checkmark" size={18} color="#ffffff" />
                            </View>
                          ) : (
                            <View style={styles.checkEmpty}>
                              <Ionicons name="ellipse-outline" size={24} color="#d6d3d1" />
                            </View>
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="medkit-outline" size={36} color="#a8a29e" />
                    </View>
                    <Text style={styles.emptyTitle}>No medications yet</Text>
                    <Text style={styles.emptyDesc}>Add your medications and supplements to track adherence</Text>
                  </View>
                )}

                <AnimatedPressable
                  onPress={() => { hapticMedium(); setShowAddModal(true); }}
                  scaleDown={0.97}
                  style={styles.addMedBtn}
                >
                  <Ionicons name="add" size={18} color="#78716c" />
                  <Text style={styles.addMedBtnText}>Add medication</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ─── HRT Tab ─── */}
            {activeTab === 'hrt' && (
              <View style={styles.tabContent}>
                {hrtMeds.length > 0 ? (
                  <>
                    {/* HRT Timeline */}
                    <View style={[styles.card, { borderWidth: 1, borderColor: '#e7e5e4' }]}>
                      <Text style={styles.cardTitle}>Your HRT timeline</Text>
                      <View style={styles.timeline}>
                        {hrtMeds.map((med, i) => (
                          <View key={med.id} style={styles.timelineItem}>
                            <View style={styles.timelineDot} />
                            {i < hrtMeds.length - 1 && <View style={styles.timelineLine} />}
                            <View style={styles.timelineContent}>
                              <Text style={styles.timelineDate}>
                                {med.createdAt ? new Date(med.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
                              </Text>
                              <Text style={styles.timelineEvent}>{med.name} started</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Symptom response chart placeholder */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>How your symptoms responded</Text>
                      <View style={styles.chartPlaceholder}>
                        <Text style={styles.chartPlaceholderText}>[ Before vs. after chart ]</Text>
                      </View>
                    </View>

                    {/* HRT meds list with adherence */}
                    <View style={styles.medsList}>
                      {hrtMeds.map((med) => {
                        const taken = isTakenToday(med.id);
                        return (
                          <AnimatedPressable
                            key={med.id}
                            onPress={() => { taken ? undefined : markTaken(med.id); }}
                            scaleDown={0.98}
                            style={[styles.medCard, { borderWidth: 1, borderColor: '#e7e5e4' }]}
                          >
                            <View style={[styles.medIcon, { backgroundColor: '#fce4ec' }]}>
                              <Text style={[styles.medIconText, { color: '#e91e63' }]}>◎</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.medName}>{med.name}</Text>
                              <Text style={styles.medDetail}>
                                {[med.dose, med.frequency !== 'daily' ? med.frequency?.replace(/_/g, ' ') : null].filter(Boolean).join(' · ')}
                              </Text>
                              <Text style={[styles.medAdherence, taken && styles.medAdherenceTaken]}>
                                {taken ? 'Taken today' : `Next: ${med.time || 'Any time'}`}
                              </Text>
                            </View>
                            {taken ? (
                              <View style={styles.checkDone}>
                                <Ionicons name="checkmark" size={18} color="#ffffff" />
                              </View>
                            ) : (
                              <View style={styles.checkEmpty}>
                                <Ionicons name="ellipse-outline" size={24} color="#d6d3d1" />
                              </View>
                            )}
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="shield-checkmark-outline" size={36} color="#a8a29e" />
                    </View>
                    <Text style={styles.emptyTitle}>No HRT medications</Text>
                    <Text style={styles.emptyDesc}>
                      Add your HRT to track timeline and symptom response
                    </Text>
                    <AnimatedPressable
                      onPress={() => { hapticMedium(); setNewType('hrt'); setShowAddModal(true); }}
                      scaleDown={0.97}
                      style={styles.addMedBtnSmall}
                    >
                      <Text style={styles.addMedBtnSmallText}>+ Add HRT</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>
            )}

            {/* ─── Labs Tab ─── */}
            {activeTab === 'labs' && (
              <View style={styles.tabContent}>
                {/* Upload options */}
                <View style={[styles.card, { borderWidth: 1, borderColor: '#e7e5e4' }]}>
                  <View style={styles.labsHeaderRow}>
                    <Text style={styles.cardTitle}>Add lab results</Text>
                    <View style={styles.premiumBadge}>
                      <Text style={styles.premiumBadgeText}>Premium</Text>
                    </View>
                  </View>
                  <View style={styles.uploadGrid}>
                    <TouchableOpacity style={styles.uploadOption} activeOpacity={0.8}>
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="camera-outline" size={22} color="#ffffff" />
                      </View>
                      <Text style={styles.uploadOptionTitle}>Scan photo</Text>
                      <Text style={styles.uploadOptionDesc}>Take a photo of your lab sheet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadOption} activeOpacity={0.8}>
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="document-outline" size={22} color="#ffffff" />
                      </View>
                      <Text style={styles.uploadOptionTitle}>Upload PDF</Text>
                      <Text style={styles.uploadOptionDesc}>Import from your files</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.uploadNote}>We'll automatically parse your results</Text>
                </View>

                {/* Placeholder for recent labs */}
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="flask-outline" size={36} color="#a8a29e" />
                  </View>
                  <Text style={styles.emptyTitle}>No lab results yet</Text>
                  <Text style={styles.emptyDesc}>
                    Upload your lab work to track hormones, vitamins, and key markers over time
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Add Modal ─── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <AnimatedPressable
              onPress={() => { hapticLight(); setShowAddModal(false); resetForm(); }}
              scaleDown={0.9}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </AnimatedPressable>
            <Text style={styles.modalTitle}>Add medication</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => (
                <AnimatedPressable
                  key={opt.key}
                  onPress={() => { hapticSelection(); setNewType(opt.key); }}
                  scaleDown={0.93}
                  style={[styles.typePill, newType === opt.key && styles.typePillActive]}
                >
                  <Text
                    style={[styles.typePillText, newType === opt.key && styles.typePillTextActive]}
                  >
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Popular suggestions */}
            {newName.length < 3 && (
              <>
                <Text style={[styles.formLabel, { marginTop: 20 }]}>Popular for menopause</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestScroll} contentContainerStyle={styles.suggestRow}>
                  {POPULAR_MEDS.filter((m) => m.type === newType).map((med) => (
                    <AnimatedPressable
                      key={med.name}
                      onPress={() => {
                        hapticSelection();
                        setNewName(med.name);
                        setNewDose(med.dose);
                        setNewType(med.type);
                        setNewTime(med.time);
                      }}
                      scaleDown={0.95}
                      style={styles.suggestChip}
                    >
                      <Text style={styles.suggestChipText}>{med.name}</Text>
                      <Text style={styles.suggestChipDose}>{med.dose}</Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Autofill matches */}
            {newName.length >= 3 && (() => {
              const matches = POPULAR_MEDS.filter((m) =>
                m.name.toLowerCase().includes(newName.toLowerCase())
              );
              if (matches.length === 0) return null;
              return (
                <View style={styles.matchList}>
                  {matches.slice(0, 4).map((med) => (
                    <AnimatedPressable
                      key={med.name}
                      onPress={() => {
                        hapticSelection();
                        setNewName(med.name);
                        setNewDose(med.dose);
                        setNewType(med.type);
                        setNewTime(med.time);
                      }}
                      scaleDown={0.97}
                      style={styles.matchItem}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matchName}>{med.name}</Text>
                        <Text style={styles.matchMeta}>{med.dose} · {med.time}</Text>
                      </View>
                      <Text style={styles.matchType}>{med.type === 'hrt' ? 'HRT' : med.type}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              );
            })()}

            {/* Name */}
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Estradiol, Vitamin D"
              placeholderTextColor="#d6d3d1"
              value={newName}
              onChangeText={setNewName}
            />

            {/* Dose */}
            <Text style={styles.formLabel}>Dosage</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. 0.5mg, 1000 IU"
              placeholderTextColor="#d6d3d1"
              value={newDose}
              onChangeText={setNewDose}
            />

            {/* Frequency */}
            <Text style={styles.formLabel}>How often</Text>
            <View style={styles.typeRow}>
              {FREQUENCY_OPTIONS.map((f) => (
                <AnimatedPressable
                  key={f}
                  onPress={() => { hapticSelection(); setNewFrequency(f); }}
                  scaleDown={0.93}
                  style={[styles.typePill, newFrequency === f && styles.typePillActive]}
                >
                  <Text style={[styles.typePillText, newFrequency === f && styles.typePillTextActive]}>
                    {f}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Best time */}
            <Text style={styles.formLabel}>Best time</Text>
            <View style={styles.typeRow}>
              {TIME_OPTIONS.map((t) => (
                <AnimatedPressable
                  key={t}
                  onPress={() => { hapticSelection(); setNewTime(t); }}
                  scaleDown={0.93}
                  style={[styles.typePill, newTime === t && styles.typePillActive]}
                >
                  <Text style={[styles.typePillText, newTime === t && styles.typePillTextActive]}>
                    {t}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* SMS Reminder toggle */}
            <View style={styles.smsToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.smsToggleLabel}>SMS reminder</Text>
                <Text style={styles.smsToggleDesc}>Get a text when it's time to take this</Text>
              </View>
              <AnimatedPressable
                onPress={() => { hapticSelection(); setSmsReminder(!smsReminder); }}
                scaleDown={0.9}
                style={[styles.toggle, smsReminder && styles.toggleActive]}
              >
                <View style={[styles.toggleThumb, smsReminder && styles.toggleThumbActive]} />
              </AnimatedPressable>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <AnimatedPressable
              onPress={handleAdd}
              scaleDown={0.96}
              style={styles.modalSaveBtn}
              disabled={addSaving}
            >
              {addSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Add medication</Text>
              )}
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Weekly Adherence Chart ──

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeeklyAdherenceChart({ weekLogs, totalMeds }: { weekLogs: MedLog[]; totalMeds: number }) {
  // Build real adherence data from API med logs
  const todayDate = new Date();
  const todayIndex = todayDate.getDay(); // 0=Sun
  const mondayOffset = todayIndex === 0 ? 6 : todayIndex - 1;

  // Build date strings for Mon–Sun of this week
  const mondayDate = new Date(todayDate);
  mondayDate.setDate(todayDate.getDate() - mondayOffset);

  const weekData = DAY_LABELS.map((label, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isFuture = i > mondayOffset;
    const isToday = i === mondayOffset;

    if (isFuture) {
      return { label, percent: 0, isFuture: true, isToday: false };
    }

    // Count unique meds taken on this date
    const takenOnDay = new Set(
      weekLogs.filter((l) => l.date === dateStr && l.taken).map((l) => l.medicationId)
    ).size;
    const percent = totalMeds > 0 ? Math.round((takenOnDay / totalMeds) * 100) : 0;

    return { label, percent, isFuture: false, isToday };
  });

  const weekAvg = (() => {
    const pastDays = weekData.filter((d) => !d.isFuture);
    if (pastDays.length === 0) return 0;
    return Math.round(pastDays.reduce((sum, d) => sum + d.percent, 0) / pastDays.length);
  })();

  return (
    <View style={styles.weekChart}>
      <View style={styles.weekChartHeader}>
        <Text style={styles.weekChartTitle}>This week</Text>
        <Text style={styles.weekChartAvg}>{weekAvg}% avg</Text>
      </View>
      <View style={styles.weekBarsRow}>
        {weekData.map((day, i) => {
          const barHeight = day.isFuture ? 4 : Math.max(4, (day.percent / 100) * 60);
          const barColor = day.isFuture
            ? '#f5f5f4'
            : day.percent >= 80
              ? '#059669'
              : day.percent >= 50
                ? '#f59e0b'
                : day.percent > 0
                  ? '#ef4444'
                  : '#e7e5e4';
          return (
            <View key={i} style={styles.weekBarCol}>
              <View style={styles.weekBarTrack}>
                <View
                  style={[
                    styles.weekBarFill,
                    {
                      height: barHeight,
                      backgroundColor: barColor,
                      borderRadius: 4,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekBarLabel, day.isToday && styles.weekBarLabelToday]}>
                {day.label}
              </Text>
              {day.isToday && <View style={styles.weekBarDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  // Header
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 12, color: '#a8a29e', marginTop: 2 },

  // Tab pills (horizontal scroll)
  tabScroll: { marginBottom: 16, marginHorizontal: -24 },
  tabRow: { paddingHorizontal: 24, gap: 8 },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  tabPillActive: { backgroundColor: '#1c1917', borderColor: '#1c1917' },
  tabPillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  tabPillTextActive: { color: '#ffffff' },

  loadingContainer: { paddingTop: 60, alignItems: 'center' },
  tabContent: { gap: 12 },

  // ── Supplements tab: Pause Supplement upsell ──
  pauseUpsellCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#e7e5e4', borderStyle: 'dashed',
  },
  pauseUpsellBody: {
    fontSize: 13, color: '#78716c', lineHeight: 19, marginBottom: 14,
  },
  pauseUpsellBtn: {
    backgroundColor: '#1c1917', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  pauseUpsellBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  pauseSupplementHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  pauseSupplementLogo: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#1c1917',
    alignItems: 'center', justifyContent: 'center',
  },
  pauseLogoDotOuter: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  pauseLogoDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  pauseSupplementName: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  pauseSupplementDesc: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  pausePlusBadge: {
    backgroundColor: '#f5f5f4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  pausePlusBadgeText: { fontSize: 10, fontWeight: '600', color: '#78716c' },

  // Upsell card
  upsellCard: {
    backgroundColor: '#fffbeb', borderRadius: 16, padding: 16,
    flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#fef3c7',
  },
  upsellIcon: { fontSize: 18, color: '#f59e0b' },
  upsellTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  upsellDesc: { fontSize: 12, color: '#78716c', lineHeight: 17 },
  upsellLink: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginTop: 8, textDecorationLine: 'underline' },

  // ── Current tab: Adherence card ──
  adherenceCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  adherenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  adherenceTitle: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  adherencePercent: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  adherenceBar: { height: 6, backgroundColor: '#e7e5e4', borderRadius: 3, marginBottom: 8 },
  adherenceFill: { height: 6, backgroundColor: '#059669', borderRadius: 3 },
  adherenceSub: { fontSize: 12, color: '#a8a29e' },

  // ── Med cards (shared) ──
  medsList: { gap: 8 },
  medCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  medIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  medIconText: { fontSize: 16 },
  medNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  medDetail: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  medAddedDate: { fontSize: 11, color: '#d6d3d1', marginTop: 2 },
  medAdherence: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  medAdherenceTaken: { color: '#059669' },
  smsBadge: {
    backgroundColor: '#f5f5f4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  smsBadgeText: { fontSize: 10, color: '#78716c' },
  chevron: { fontSize: 20, color: '#d6d3d1' },
  takenBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center',
  },
  checkDone: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center',
  },
  checkEmpty: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  // Add med button (in Current tab)
  addMedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#ffffff', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#e7e5e4', borderStyle: 'dashed',
  },
  addMedBtnText: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  addMedBtnSmall: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#1c1917',
  },
  addMedBtnSmallText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  // ── HRT tab ──
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#1c1917', marginBottom: 12 },
  timeline: { gap: 16 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#1c1917', marginTop: 4,
  },
  timelineLine: {
    position: 'absolute', left: 3.5, top: 16, width: 1, height: 28, backgroundColor: '#e7e5e4',
  },
  timelineContent: { flex: 1 },
  timelineDate: { fontSize: 12, fontWeight: '500', color: '#1c1917' },
  timelineEvent: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  chartPlaceholder: {
    height: 80, backgroundColor: '#f5f5f4', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  chartPlaceholderText: { fontSize: 12, color: '#d6d3d1' },

  // ── Labs tab ──
  labsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  premiumBadge: {
    backgroundColor: '#f5f5f4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  premiumBadgeText: { fontSize: 10, fontWeight: '600', color: '#78716c' },
  uploadGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  uploadOption: {
    flex: 1, alignItems: 'center', gap: 8, padding: 16,
    backgroundColor: '#fafaf9', borderRadius: 14,
  },
  uploadIconCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1c1917',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadOptionTitle: { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  uploadOptionDesc: { fontSize: 11, color: '#a8a29e', textAlign: 'center' },
  uploadNote: { fontSize: 11, color: '#d6d3d1', textAlign: 'center' },

  // ── Weekly adherence chart ──
  weekChart: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  weekChartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  weekChartTitle: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  weekChartAvg: { fontSize: 12, fontWeight: '500', color: '#059669' },
  weekBarsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weekBarCol: { flex: 1, alignItems: 'center' },
  weekBarTrack: {
    height: 64, width: '100%', justifyContent: 'flex-end', alignItems: 'center',
    backgroundColor: '#fafaf9', borderRadius: 6, marginBottom: 6,
  },
  weekBarFill: { width: '100%', minHeight: 4 },
  weekBarLabel: { fontSize: 11, color: '#a8a29e', fontWeight: '400' },
  weekBarLabelToday: { color: '#1c1917', fontWeight: '600' },
  weekBarDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#1c1917', marginTop: 3,
  },

  // ── Empty state ──
  emptyState: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 32, alignItems: 'center',
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#f5f5f4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#78716c', textAlign: 'center', lineHeight: 18 },

  // ── Modal ──
  modalContainer: { flex: 1, backgroundColor: '#fafaf9' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f4',
  },
  modalCancel: { fontSize: 15, color: '#78716c' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1c1917' },
  modalContent: { padding: 24, paddingBottom: 40 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 8, marginTop: 16 },
  formInput: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#1c1917',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typePill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  typePillActive: { backgroundColor: '#1c1917' },
  typePillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  typePillTextActive: { color: '#ffffff' },

  // SMS toggle
  smsToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 24, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: '#f5f5f4',
  },
  smsToggleLabel: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  smsToggleDesc: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: '#e7e5e4', padding: 2,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: '#1c1917' },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },

  // Suggestions
  suggestScroll: { marginBottom: 8, marginHorizontal: -24 },
  suggestRow: { paddingHorizontal: 24, gap: 8 },
  suggestChip: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  suggestChipText: { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  suggestChipDose: { fontSize: 11, color: '#a8a29e', marginTop: 2 },
  matchList: { gap: 4, marginBottom: 8, marginTop: 8 },
  matchItem: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  matchName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  matchMeta: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  matchType: { fontSize: 11, fontWeight: '600', color: '#78716c', textTransform: 'capitalize' },

  modalFooter: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  modalSaveBtn: {
    backgroundColor: '#1c1917', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  modalSaveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
