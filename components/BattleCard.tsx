import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { compactNumber } from '@/lib/format';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { LiveBattle } from '@/lib/types';
import { Avatar } from './Avatar';
import { BattleScoreBar } from './BattleScoreBar';

function scheduleLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `Hoje às ${hh}:${mm}` : `${d.toLocaleDateString('pt-BR')} às ${hh}:${mm}`;
}

export function BattleCard({ battle }: { battle: LiveBattle }) {
  const { getUser } = useApp();
  const host = getUser(battle.hostId);
  const opponent = getUser(battle.opponentId);
  if (!host || !opponent) return null;

  const live = battle.status === 'live';
  const ended = battle.status === 'ended';
  const winner =
    ended && battle.scores.host !== battle.scores.opponent
      ? battle.scores.host > battle.scores.opponent
        ? host
        : opponent
      : null;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/battle/${battle.id}`)}>
      <View style={styles.topRow}>
        {live ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AO VIVO</Text>
          </View>
        ) : ended ? (
          <View style={[styles.liveBadge, { backgroundColor: colors.textMuted }]}>
            <Text style={styles.liveText}>ENCERRADA</Text>
          </View>
        ) : (
          <View style={[styles.liveBadge, { backgroundColor: colors.primaryDark }]}>
            <Ionicons name="calendar-outline" size={11} color="#fff" />
            <Text style={styles.liveText}>{scheduleLabel(battle.startsAt)}</Text>
          </View>
        )}
        {live ? (
          <View style={styles.viewers}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text style={styles.muted}>{compactNumber(battle.viewers)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.topic} numberOfLines={2}>
        {battle.topic}
      </Text>

      <View style={styles.vsRow}>
        <View style={styles.person}>
          <Avatar uri={host.avatar} size={56} ring={live ? 'unseen' : 'none'} />
          <Text style={styles.name} numberOfLines={1}>
            {host.name}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {host.role ?? ''}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.person}>
          <Avatar uri={opponent.avatar} size={56} ring={live ? 'unseen' : 'none'} />
          <Text style={styles.name} numberOfLines={1}>
            {opponent.name}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {opponent.role ?? ''}
          </Text>
        </View>
      </View>

      {battle.status !== 'scheduled' ? (
        <BattleScoreBar host={battle.scores.host} opponent={battle.scores.opponent} />
      ) : null}
      {winner ? <Text style={styles.winner}>🏆 Vitória de {winner.name}</Text> : null}
      {ended && !winner ? <Text style={styles.winner}>Empate</Text> : null}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.like,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  viewers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  muted: { color: colors.textMuted, fontSize: 13 },
  topic: { fontSize: 16, fontWeight: '700', color: colors.text },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { flex: 1, alignItems: 'center', gap: 4 },
  name: { fontWeight: '600', color: colors.text },
  role: { color: colors.textMuted, fontSize: 12 },
  vs: { fontSize: 22, fontWeight: '900', color: colors.like, marginHorizontal: spacing.sm },
  winner: { textAlign: 'center', fontWeight: '700', color: colors.text },
}));
