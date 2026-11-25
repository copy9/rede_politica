// Conteúdo impulsionado no feed: publicação, perfil ou live de um político, com a marca "Impulsionado".
// Conta "visto" quando aparece na tela, e "clique"/"seguiu" quando a pessoa interage.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BRAND_BLUE } from '@/components/Logo';
import { PostCard } from '@/components/PostCard';
import { boostEvent, boostImpression, type BoostSlot } from '@/lib/boost';
import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

/** Devolve se o impulsionado tem o que mostrar (post carregado, live ainda valendo etc.). */
export function useBoostVisible(slot: BoostSlot) {
  const { posts, battles, getUser } = useApp();
  if (slot.kind === 'post') return !!posts.find((p) => p.id === slot.targetId);
  if (slot.kind === 'profile') return !!getUser(slot.targetId);
  const b = battles.find((x) => x.id === slot.targetId);
  return !!b && (b.status === 'live' || b.status === 'scheduled');
}

export function BoostedItem({ slot, active }: { slot: BoostSlot; active: boolean }) {
  const me = useMe();
  const { posts, battles, getUser, isFollowing, toggleFollow, followersOf } = useApp();
  const visible = useBoostVisible(slot);

  // apareceu na tela: conta como alcançado (1 vez por pessoa)
  useEffect(() => {
    if (active && visible) boostImpression(slot.campaignId);
  }, [active, visible, slot.campaignId]);

  if (!visible) return null;
  const owner = getUser(slot.userId);
  const openProfile = () => {
    boostEvent(slot.campaignId, 'click');
    if (owner) router.push(`/user/${owner.username}`);
  };

  if (slot.kind === 'post') {
    const post = posts.find((p) => p.id === slot.targetId)!;
    return (
      <View>
        <Pressable style={styles.strip} onPress={openProfile}>
          <Ionicons name="rocket-outline" size={14} color={BRAND_BLUE} />
          <Text style={styles.stripText}>Impulsionado</Text>
          <Text style={styles.stripCta}>Ver perfil</Text>
          <Ionicons name="chevron-forward" size={14} color={BRAND_BLUE} />
        </Pressable>
        <PostCard post={post} active={active} />
      </View>
    );
  }

  if (slot.kind === 'profile') {
    const u = getUser(slot.targetId)!;
    const following = isFollowing(u.id);
    return (
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <Ionicons name="rocket-outline" size={14} color={BRAND_BLUE} />
          <Text style={styles.stripText}>Impulsionado</Text>
        </View>
        <Pressable style={styles.profileRow} onPress={openProfile}>
          <Avatar uri={u.avatar} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>@{u.username} · {compactNumber(followersOf(u.id).length)} seguidores</Text>
          </View>
        </Pressable>
        {u.bio ? <Text style={styles.bio} numberOfLines={3}>{u.bio}</Text> : null}
        <View style={styles.row}>
          {u.id !== me.id ? (
            <Pressable
              style={[styles.btn, following ? styles.btnGhost : { backgroundColor: BRAND_BLUE }]}
              onPress={() => {
                if (!following) boostEvent(slot.campaignId, 'follow');
                toggleFollow(u.id);
              }}>
              <Text style={[styles.btnText, following && { color: colors.text }]}>{following ? 'Seguindo' : 'Seguir'}</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={openProfile}>
            <Text style={[styles.btnText, { color: colors.text }]}>Ver perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // live / debate
  const b = battles.find((x) => x.id === slot.targetId)!;
  const live = b.status === 'live';
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Ionicons name="rocket-outline" size={14} color={BRAND_BLUE} />
        <Text style={styles.stripText}>Impulsionado</Text>
      </View>
      <Pressable
        style={styles.profileRow}
        onPress={() => {
          boostEvent(slot.campaignId, 'click');
          router.push(`/battle/${b.id}`);
        }}>
        <View style={[styles.liveBox, { backgroundColor: live ? colors.like : '#374151' }]}>
          <Ionicons name={live ? 'radio' : 'calendar'} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.liveTag, { color: live ? colors.like : colors.textMuted }]}>
            {live ? 'AO VIVO AGORA' : `AGENDADA · ${new Date(b.startsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
          </Text>
          <Text style={styles.name} numberOfLines={2}>{b.topic || 'Live'}</Text>
          {owner ? <Text style={styles.muted} numberOfLines={1}>{owner.name}</Text> : null}
        </View>
      </Pressable>
      <Pressable
        style={[styles.btn, { backgroundColor: live ? colors.like : BRAND_BLUE }]}
        onPress={() => {
          boostEvent(slot.campaignId, 'click');
          router.push(`/battle/${b.id}`);
        }}>
        <Text style={styles.btnText}>{live ? 'Assistir agora' : 'Ver detalhes'}</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    strip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    stripText: { color: BRAND_BLUE, fontWeight: '800', fontSize: 12, flex: 1 },
    stripCta: { color: BRAND_BLUE, fontWeight: '700', fontSize: 12 },
    card: { marginHorizontal: spacing.lg, marginVertical: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface, gap: spacing.sm },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    name: { color: colors.text, fontWeight: '800', fontSize: 16 },
    muted: { color: colors.textMuted, fontSize: 13 },
    bio: { color: colors.text, fontSize: 14 },
    row: { flexDirection: 'row', gap: spacing.sm },
    btn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    btnGhost: { borderWidth: 1, borderColor: colors.border },
    btnText: { color: '#fff', fontWeight: '800' },
    liveBox: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    liveTag: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  }),
);
