import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const CATEGORIES = ['All', 'Sleep', 'Hot Flashes', 'Mood', 'Nutrition', 'Movement'];

interface Article {
  id: number;
  title: string;
  category: string | null;
  readTime: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export default function LearnScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const endpoint =
        selectedCategory === 'All'
          ? '/api/articles'
          : `/api/articles?category=${encodeURIComponent(selectedCategory)}`;
      const data = await apiRequest(endpoint, token);
      setArticles(Array.isArray(data) ? data : []);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      fetchArticles();
    }, [fetchArticles])
  );

  const renderArticle = ({ item }: { item: Article }) => (
    <AnimatedPressable
      onPress={() => {
        hapticLight();
        router.push({ pathname: '/(app)/article', params: { id: String(item.id) } });
      }}
      scaleDown={0.97}
      style={styles.articleCard}
    >
      <View style={styles.articleImage}>
        <Text style={styles.articleImageEmoji}>
          {item.category === 'Sleep'
            ? '🌙'
            : item.category === 'Hot Flashes'
              ? '❄️'
              : item.category === 'Mood'
                ? '🧠'
                : item.category === 'Nutrition'
                  ? '🥗'
                  : item.category === 'Movement'
                    ? '🏃‍♀️'
                    : '📖'}
        </Text>
      </View>
      <View style={styles.articleContent}>
        <Text style={styles.articleMeta}>
          {item.category || 'General'} · {item.readTime || 3} min read
        </Text>
        <Text style={styles.articleTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <View style={styles.articleArrow}>
        <Text style={{ color: '#a8a29e', fontSize: 16 }}>›</Text>
      </View>
    </AnimatedPressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <AnimatedPressable
        onPress={() => { hapticLight(); router.back(); }}
        scaleDown={0.95}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Back</Text>
      </AnimatedPressable>

      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <Text style={styles.subtitle}>Evidence-based menopause education</Text>
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((cat) => {
          const active = cat === selectedCategory;
          return (
            <AnimatedPressable
              key={cat}
              onPress={() => {
                hapticSelection();
                setSelectedCategory(cat);
              }}
              scaleDown={0.95}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {cat}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No articles found</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderArticle}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  backButton: { paddingHorizontal: 24, paddingTop: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },
  header: { paddingHorizontal: 24, paddingTop: 8, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 13, color: '#a8a29e', marginTop: 4 },

  filterStrip: { marginBottom: 12, maxHeight: 44 },
  filterContent: { paddingHorizontal: 24, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f4',
  },
  filterPillActive: { backgroundColor: '#1c1917' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  filterTextActive: { color: '#ffffff' },

  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#a8a29e' },

  listContent: { paddingHorizontal: 24, paddingBottom: 120, gap: 10 },

  articleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  articleImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleImageEmoji: { fontSize: 24 },
  articleContent: { flex: 1 },
  articleMeta: { fontSize: 11, color: '#a8a29e', marginBottom: 4 },
  articleTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', lineHeight: 20 },
  articleArrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
