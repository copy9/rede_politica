import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BattleCard } from '@/components/BattleCard';
import { useApp } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

type Filter = 'all' | 'following';

/** Aba "Batalhas": debates ao vivo entre duas pessoas, a plateia apoia um lado. */
export default function BattlesScreen() {
  const { battles, follows, me } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const followingIds = new Set(follows.filter((f) => f.followerId === me?.id).map((f) => f.followingId));
  const visible = battles.filter(
    (b) => filter === 'all' || followingIds.has(b.hostId) || followingIds.has(b.opponentId) || b.hostId === me?.id,
  );

  const sections = [
    { title: 'Ao vivo agora', data: visible.filter((b) => b.status === 'live').sort((a, b) => b.viewers - a.viewers) },
    { title: 'Agendadas', data: visible.filter((b) => b.status === 'scheduled').sort((a, b) => a.startsAt - b.startsAt) },
    { title: 'Encerradas', data: visible.filter((b) => b.status === 'ended') },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Batalhas</Text>
        <Pressable style={styles.newButton} onPress={() => router.push('/battle/new')}>
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.newText}>Iniciar batalha</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        <FilterChip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip label="Quem eu sigo" active={filter === 'following'} onPress={() => setFilter('following')} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BattleCard battle={item} />}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma batalha agora</Text>
            <Text style={styles.muted}>Desafie alguém para um debate ao vivo.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.like,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newText: { color: '#fff', fontWeight: '700' },
  filters: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.background },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: '500' },
  section: { fontWeight: '700', fontSize: 16, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
});
