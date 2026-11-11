import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostGrid } from '@/components/PostGrid';
import { UserRow } from '@/components/UserRow';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

const TOPICS = ['Todos', 'Educação', 'Saúde', 'Mobilidade', 'Orçamento', 'Cultura', 'Obras'];

export default function ExploreScreen() {
  const { users, posts, me } = useApp();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [topic, setTopic] = useState('Todos');

  const q = query.trim().toLowerCase().replace(/^@/, '');
  const searching = focused || q.length > 0;

  const userResults = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== me?.id &&
          !settings.blockedIds.includes(u.id) &&
          (!q || u.username.includes(q) || u.name.toLowerCase().includes(q) || (u.role ?? '').toLowerCase().includes(q)),
      ),
    [users, q, me, settings.blockedIds],
  );

  const gridPosts = useMemo(() => {
    const list = posts.filter((p) => !settings.blockedIds.includes(p.userId)).sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt);
    if (topic === 'Todos') return list;
    const t = topic.toLowerCase();
    return list.filter((p) => p.caption.toLowerCase().includes(t.slice(0, 5)));
  }, [posts, topic, settings.blockedIds]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Pesquisar pessoas, políticos, temas"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {searching ? (
          <Pressable
            onPress={() => {
              setQuery('');
              setFocused(false);
            }}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <FlatList
          data={userResults}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Nenhum resultado para “{query}”.</Text>}
        />
      ) : (
        <ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
            {TOPICS.map((t) => (
              <Pressable key={t} onPress={() => setTopic(t)} style={[styles.chip, topic === t && styles.chipActive]}>
                <Text style={[styles.chipText, topic === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <PostGrid posts={gridPosts} emptyText="Nada sobre esse tema ainda" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  cancel: { color: colors.text, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
  topics: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: '500' },
  chipTextActive: { color: colors.background },
}));
