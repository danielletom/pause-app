import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Markdown from '@ronradtke/react-native-markdown-display';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

interface Article {
  id: number;
  title: string;
  bodyMarkdown: string | null;
  category: string | null;
  readTime: number | null;
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const data = await apiRequest(`/api/articles/${id}`, token);
        setArticle(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getToken]);

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
          <Text style={{ color: '#a8a29e', fontSize: 15 }}>Article not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back nav */}
        <AnimatedPressable
          onPress={() => { hapticLight(); router.back(); }}
          scaleDown={0.95}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </AnimatedPressable>

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
            {article.category || 'General'}{article.readTime ? ` · ${article.readTime} min read` : ''}
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
  body: { color: '#44403c', fontSize: 15, lineHeight: 24 },
  heading2: { color: '#1c1917', fontSize: 20, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  heading3: { color: '#1c1917', fontSize: 17, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  paragraph: { marginBottom: 14, lineHeight: 24 },
  strong: { fontWeight: '700', color: '#1c1917' },
  listItem: { marginBottom: 6 },
  listUnorderedItemIcon: { color: '#a8a29e', fontSize: 8, marginTop: 8, marginRight: 8 },
  bullet_list: { marginBottom: 14 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingBottom: 120 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  backButton: { paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },

  heroImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  header: { marginBottom: 20, paddingHorizontal: 24 },
  metaText: { fontSize: 12, color: '#a8a29e', marginBottom: 8 },
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
  ctaText: { fontSize: 12, color: '#78716c' },

  disclaimer: {
    fontSize: 12,
    color: '#d6d3d1',
    fontStyle: 'italic',
    marginTop: 24,
    marginHorizontal: 24,
    lineHeight: 18,
  },
});
