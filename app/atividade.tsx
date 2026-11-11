import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PostGrid } from '@/components/PostGrid';
import { RadioGroup, Section, SettingsScreen } from '@/components/SettingsUI';
import { timeAgo } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

type Tab = 'curtidas' | 'comentarios' | 'tempo';

// Tempo de uso de demonstração (minutos por dia, últimos 7 dias)
const USAGE = [34, 52, 41, 18, 63, 47, 29];
const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const me = useMe();
  const { posts, comments, getPost } = useApp();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'curtidas');

  const liked = posts.filter((p) => p.likes.includes(me.id));
  const myComments = comments.filter((c) => c.userId === me.id).sort((a, b) => b.createdAt - a.createdAt);
  const avg = Math.round(USAGE.reduce((a, b) => a + b, 0) / USAGE.length);
  const max = Math.max(...USAGE);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(
          [
            ['curtidas', 'Curtidas'],
            ['comentarios', 'Comentários'],
            ['tempo', 'Tempo de uso'],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab !== key && { color: colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'curtidas' ? (
        <FlatList data={[0]} keyExtractor={() => 'g'} renderItem={() => <PostGrid posts={liked} emptyText="Você ainda não curtiu nada" />} />
      ) : null}

      {tab === 'comentarios' ? (
        <FlatList
          data={myComments}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const post = getPost(item.postId);
            return (
              <Pressable style={styles.comment} onPress={() => post && router.push(`/comments/${post.id}`)}>
                <Text style={styles.commentText}>{item.text}</Text>
                <Text style={styles.muted}>
                  {timeAgo(item.createdAt)} · em “{(post?.caption ?? '').slice(0, 40)}…”
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Você ainda não comentou.</Text>}
        />
      ) : null}

      {tab === 'tempo' ? (
        <SettingsScreen>
          <View style={styles.usage}>
            <Text style={styles.big}>{avg} min</Text>
            <Text style={styles.muted}>média por dia nos últimos 7 dias</Text>
            <View style={styles.bars}>
              {USAGE.map((m, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{m}</Text>
                  <View style={[styles.bar, { height: (m / max) * 110 }]} />
                  <Text style={styles.muted}>{DAYS[i]}</Text>
                </View>
              ))}
            </View>
          </View>
          <Section title="Limite diário" footer="Quando passar do limite, o app mostra um aviso.">
            <RadioGroup
              value={String(settings.dailyLimitMin)}
              onChange={(v) => update({ dailyLimitMin: Number(v) })}
              options={[
                { value: '0', label: 'Sem limite' },
                { value: '30', label: '30 minutos' },
                { value: '60', label: '1 hora' },
                { value: '120', label: '2 horas' },
              ]}
            />
          </Section>
          <Section title="Lembrete de pausa">
            <RadioGroup
              value={String(settings.breakReminderMin)}
              onChange={(v) => update({ breakReminderMin: Number(v) })}
              options={[
                { value: '0', label: 'Desligado' },
                { value: '10', label: 'A cada 10 minutos' },
                { value: '20', label: 'A cada 20 minutos' },
                { value: '30', label: 'A cada 30 minutos' },
              ]}
            />
          </Section>
        </SettingsScreen>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
    tabText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    comment: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 4 },
    commentText: { color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12 },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
    usage: { backgroundColor: colors.background, alignItems: 'center', padding: spacing.xl, gap: 4, marginBottom: spacing.sm },
    big: { fontSize: 32, fontWeight: '800', color: colors.text },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: spacing.lg, height: 160 },
    barCol: { alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
    barValue: { color: colors.text, fontSize: 11, fontWeight: '600' },
    bar: { width: 26, backgroundColor: colors.series1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  }),
);
