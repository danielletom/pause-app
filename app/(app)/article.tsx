import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Markdown from '@ronradtke/react-native-markdown-display';
import BackButton from '@/components/BackButton';
import { apiRequest } from '@/lib/api';

interface Article {
  id: number;
  title: string;
  bodyMarkdown: string | null;
  category: string | null;
  readTime: number | null;
  durationMinutes?: number | null;
  format?: string | null;
}

export default function ArticleScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { getToken } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        let data: any;

        if (source === 'content') {
          // Fetch from content API (lessons, guides, medication articles, recipes)
          data = await apiRequest(`/api/content?id=${id}`, token);
          // Map content fields to article shape
          if (data) {
            data = {
              ...data,
              readTime: data.durationMinutes || data.readTime || null,
            };
          }
        } else {
          // Default: fetch from articles API
          data = await apiRequest(`/api/articles/${id}`, token);
        }

        setArticle(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [id, source, getToken]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#78716c', fontSize: 16 }}>Article not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Sticky back header */}
      <View style={styles.stickyHeader}>
        <BackButton />
        <Text style={styles.stickyTitle} numberOfLines={1}>
          {article.title}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero image placeholder */}
        <View style={styles.heroImage}>
          <Text style={{ fontSize: 32 }}>
            {article.category === 'Sleep'
              ? '🌙'
              : article.category === 'Hot Flashes'
                ? '❄️'
                : article.category === 'Mood'
                  ? '🧠'
                  : article.category === 'Nutrition'
                    ? '🥗'
                    : article.category === 'Movement'
                      ? '🏃‍♀️'
                      : '📖'}
          </Text>
        </View>

        {/* Header meta */}
        <View style={styles.header}>
          <Text style={styles.metaText}>
            {article.category || 'General'}{article.readTime ? ` · ${article.readTime} min read` : article.durationMinutes ? ` · ${article.durationMinutes} min` : ''}
          </Text>
          <Text style={styles.title}>{article.title}</Text>
        </View>

        {/* Markdown body */}
        <View style={styles.body}>
          <Markdown style={markdownStyles}>
            {article.bodyMarkdown || 'No content available.'}
          </Markdown>
        </View>

        {/* CTA card */}
        <View style={styles.ctaCard}>
          <Text style={styles.ctaText}>Track your symptoms in Pause to see what's working →</Text>
        </View>

        {/* Medical disclaimer */}
        <Text style={styles.disclaimer}>
          This article is for informational purposes only and is not medical advice. Always consult your healthcare provider.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: '#44403c', fontSize: 16, lineHeight: 24 },
  heading2: { color: '#1c1917', fontSize: 20, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  heading3: { color: '#1c1917', fontSize: 17, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  paragraph: { marginBottom: 14, lineHeight: 24 },
  strong: { fontWeight: '700', color: '#1c1917' },
  listItem: { marginBottom: 6 },
  listUnorderedItemIcon: { color: '#78716c', fontSize: 8, marginTop: 8, marginRight: 8 },
  bullet_list: { marginBottom: 14 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingBottom: 120 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    backgroundColor: '#fafaf9',
  },
  stickyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
    textAlign: 'center',
  },
  heroImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  header: { marginBottom: 20, paddingHorizontal: 24 },
  metaText: { fontSize: 14, color: '#78716c', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917', lineHeight: 30 },

  body: { paddingHorizontal: 24 },

  ctaCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 24,
    marginTop: 20,
  },
  ctaText: { fontSize: 16, color: '#78716c' },

  disclaimer: {
    fontSize: 14,
    color: '#78716c',
    fontStyle: 'italic',
    marginTop: 24,
    marginHorizontal: 24,
    lineHeight: 18,
  },
});
