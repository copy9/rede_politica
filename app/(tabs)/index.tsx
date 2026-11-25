import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { BoostedItem } from '@/components/BoostedItem';
import { PostCard } from '@/components/PostCard';
import { boostImpression, useBoostSlots, type BoostSlot } from '@/lib/boost';
import { StoriesBar } from '@/components/StoriesBar';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { Post } from '@/lib/types';

export default function FeedScreen() {
  const { feed, notifications, me } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // menu do início: tudo, só fotos, só vídeos ou só textos (Live abre as lives ao vivo)
  const [kind, setKind] = useState<'all' | 'image' | 'video' | 'text'>('all');
  const posts = kind === 'all' ? feed() : feed().filter((p) => p.type === kind);
  // impulsionados (tráfego pago): 1 a cada N publicações, marcados como "Impulsionado"
  const app = useApp();
  const { slots, settings: boostSettings, reload: reloadBoosts } = useBoostSlots(5);
  type Item = { key: string; post?: Post; boost?: BoostSlot };
  const items = useMemo<Item[]>(() => {
    // só entra o que tem para mostrar (post carregado, perfil existente, live ainda valendo)
    const fit = slots.filter((b) => {
      if (b.kind === 'profile') return kind === 'all' && !!app.getUser(b.targetId);
      if (b.kind === 'battle') {
        const bt = app.battles.find((x) => x.id === b.targetId);
        return kind === 'all' && !!bt && (bt.status === 'live' || bt.status === 'scheduled');
      }
      const p = app.posts.find((x) => x.id === b.targetId);
      return !!p && (kind === 'all' || p.type === kind);
    });
    const every = Math.max(2, boostSettings.feed_every);
    const out: Item[] = [];
    let bi = 0;
    posts.forEach((p, i) => {
      out.push({ key: p.id, post: p });
      if ((i + 1) % every === 0 && bi < fit.length) {
        const b = fit[bi++];
        out.push({ key: `boost-${b.campaignId}`, boost: b });
      }
    });
    // feed curto: mostra pelo menos 1 impulsionado no fim
    if (bi === 0 && fit.length && posts.length > 0) out.push({ key: `boost-${fit[0].campaignId}`, boost: fit[0] });
    return out;
  }, [posts, slots, boostSettings.feed_every, kind, app.posts, app.battles, app.getUser]);
  const { settings } = useSettings();
  const hasNotifications = !settings.notifications.pauseAll && notifications.some((n) => n.toUserId === me?.id);

  // Só o vídeo que está visível toca
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: { key: string; boost?: BoostSlot }; isViewable: boolean }[] }) => {
    // impulsionado que apareceu na tela conta como alcançado (mesmo que não seja o primeiro da tela)
    viewableItems.forEach((v) => v.isViewable && v.item.boost && boostImpression(v.item.boost.campaignId));
    const first = viewableItems.find((v) => v.isViewable);
    setActiveId(first?.item?.key ?? null);
  }).current;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reloadBoosts();
    setTimeout(() => setRefreshing(false), 600);
  }, [reloadBoosts]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Logo size={22} />
        <View style={styles.headerIcons}>
          <Pressable onPress={() => router.navigate('/create')} hitSlop={8} accessibilityLabel="Nova publicação">
            <Ionicons name="add-outline" size={28} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
            <Ionicons name="notifications-outline" size={26} color={colors.text} />
            {hasNotifications ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={({ item }) =>
          item.boost ? (
            <BoostedItem slot={item.boost} active={item.key === activeId} />
          ) : (
            <PostCard
              post={item.post!}
              active={item.key === activeId}
              // na aba Vídeos, tocar no vídeo abre a tela cheia rolando
              onOpen={kind === 'video' ? () => router.push(`/reels?start=${item.post!.id}`) : undefined}
            />
          )
        }
        ListHeaderComponent={
          <>
            <StoriesBar />
            <View style={styles.tabs}>
              {(
                [
                  ['image', 'grid', 'Fotos'],
                  ['video', 'play-circle', 'Vídeos'],
                  ['text', 'chatbox-ellipses', 'Textos'],
                ] as const
              ).map(([k, icon, label]) => {
                const on = kind === k;
                return (
                  <Pressable
                    key={k}
                    style={[styles.tab, on && styles.tabOn]}
                    // Vídeos abre direto em tela cheia (rolando um atrás do outro, como no TikTok)
                    onPress={() => (k === 'video' ? router.push('/reels') : setKind(on ? 'all' : k))}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: on }}>
                    <Ionicons name={on ? icon : (`${icon}-outline` as const)} size={22} color={on ? colors.text : colors.textMuted} />
                  </Pressable>
                );
              })}
              <Pressable style={styles.tab} onPress={() => router.push('/lives')} accessibilityLabel="Lives ao vivo">
                <Ionicons name="flash-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {kind === 'image' ? 'Nenhuma foto ainda.' : kind === 'video' ? 'Nenhum vídeo ainda.' : kind === 'text' ? 'Nenhum texto ainda.' : 'Nada por aqui ainda.'}
          </Text>
        }
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.text },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 48 },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.like, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.like },
  liveText: { color: colors.like, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  dot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.like },
}));
