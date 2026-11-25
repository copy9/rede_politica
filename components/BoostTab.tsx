// Aba "Impulsionar" do Painel do político: campanhas, créditos e botão para criar uma nova.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BRAND_BLUE } from '@/components/Logo';
import { getWallet, KIND_LABEL, money, STATUS_COLOR, STATUS_LABEL, useMyCampaigns } from '@/lib/boost';
import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export function BoostTab() {
  const me = useMe();
  const { posts, battles } = useApp();
  const { list, error, reload } = useMyCampaigns(me.id);
  const [wallet, setWallet] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    getWallet().then(setWallet);
  }, []);
  // volta da tela da campanha: atualiza
  useFocusEffect(
    useCallback(() => {
      reload();
      getWallet().then(setWallet);
    }, [reload]),
  );

  const active = (list ?? []).filter((c) => c.status === 'active');
  const reached = (list ?? []).reduce((a, c) => a + c.delivered, 0);
  const invested = (list ?? []).filter((c) => c.paid_at).reduce((a, c) => a + c.amount, 0);

  return (
    <FlatList
      data={list ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reload();
            setWallet(await getWallet());
            setRefreshing(false);
          }}
          tintColor={colors.text}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <Pressable style={styles.newBtn} onPress={() => router.push('/boost/new')}>
            <Ionicons name="rocket" size={20} color="#fff" />
            <Text style={styles.newText}>Novo impulsionamento</Text>
          </Pressable>
          {error ? (
            <View style={styles.notice}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.infoText} />
              <Text style={styles.noticeText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.tiles}>
            <Tile label="No ar agora" value={String(active.length)} />
            <Tile label="Pessoas alcançadas" value={compactNumber(reached)} />
            <Tile label="Investido" value={money(invested)} />
            <Tile label="Créditos" value={money(wallet)} />
          </View>
          <Text style={styles.h2}>Suas campanhas</Text>
          {list === null ? <ActivityIndicator color={colors.text} /> : null}
          {list && list.length === 0 ? (
            <Text style={styles.muted}>Você ainda não impulsionou nada. Impulsione uma publicação, uma live ou seu perfil para chegar a mais gente.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item: c }) => {
        const what =
          c.target_kind === 'profile'
            ? 'Seu perfil'
            : c.target_kind === 'battle'
              ? battles.find((b) => b.id === c.target_id)?.topic || 'Sua live'
              : posts.find((p) => p.id === c.target_id)?.caption || 'Sua publicação';
        const pct = Math.min(100, Math.round((c.delivered / c.reach_goal) * 100));
        return (
          <Pressable style={styles.item} onPress={() => router.push(`/boost/${c.id}`)}>
            <View style={styles.itemHead}>
              <View style={[styles.status, { backgroundColor: STATUS_COLOR[c.status] }]}>
                <Text style={styles.statusText}>{STATUS_LABEL[c.status]}</Text>
              </View>
              <Text style={styles.muted}>{KIND_LABEL[c.target_kind]} · {money(c.amount)}</Text>
            </View>
            <Text style={styles.itemTitle} numberOfLines={2}>{what}</Text>
            {c.paid_at ? (
              <>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.muted}>
                  {compactNumber(c.delivered)} de {compactNumber(c.reach_goal)} pessoas · {compactNumber(c.clicks)} cliques · {compactNumber(c.follows)} seguidores
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Alcance contratado: até {compactNumber(c.reach_goal)} pessoas</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
    newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND_BLUE, borderRadius: 14, paddingVertical: 14 },
    newText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    notice: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.infoBg, borderRadius: 12, padding: spacing.md },
    noticeText: { flex: 1, color: colors.infoText, fontSize: 13 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { width: '48.5%', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 4 },
    tileValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
    h2: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
    muted: { color: colors.textMuted, fontSize: 13 },
    item: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 6 },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    itemTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
    status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    statusText: { color: '#fff', fontWeight: '800', fontSize: 11 },
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: BRAND_BLUE },
  }),
);
