import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';
import { timeAgo } from '@/lib/format';
import { useSettings, type NotificationPrefs } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;

export default function NotificationsScreen() {
  const me = useMe();
  const { notifications, followRequests, getUser, respondFollowRequest } = useApp();
  const { settings } = useSettings();
  const prefs = settings.notifications;
  // Cada tipo de notificação obedece à chave correspondente em Configurações › Notificações
  const PREF: Record<AppNotification['type'], keyof NotificationPrefs> = {
    like: 'likes',
    comment: 'comments',
    follow: 'follows',
    request: 'follows',
    mention: 'mentions',
    security: 'security',
  };
  const mine = prefs.pauseAll
    ? []
    : notifications
        .filter((n) => n.toUserId === me.id && prefs[PREF[n.type]])
        .sort((a, b) => b.createdAt - a.createdAt);
  const requests = settings.privateAccount ? followRequests.filter((r) => r.toId === me.id) : [];
  const now = Date.now();

  const sections = [
    { title: 'Hoje', data: mine.filter((n) => now - n.createdAt < DAY) },
    { title: 'Esta semana', data: mine.filter((n) => now - n.createdAt >= DAY && now - n.createdAt < 7 * DAY) },
    { title: 'Anteriores', data: mine.filter((n) => now - n.createdAt >= 7 * DAY) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(n) => n.id}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => <NotificationRow n={item} />}
      ListHeaderComponent={
        <View>
          {prefs.pauseAll ? (
            <Pressable style={styles.paused} onPress={() => router.push('/config/notificacoes')}>
              <Ionicons name="notifications-off-outline" size={20} color={colors.text} />
              <Text style={styles.pausedText}>Notificações pausadas. Toque para reativar.</Text>
            </Pressable>
          ) : null}
          {requests.length ? <Text style={styles.section}>Pedidos para seguir</Text> : null}
          {requests.map((r) => {
            const u = getUser(r.fromId);
            if (!u) return null;
            return (
              <View key={r.fromId} style={styles.row}>
                <Pressable onPress={() => router.push(`/user/${u.username}`)}>
                  <Avatar uri={u.avatar} size={44} />
                </Pressable>
                <Text style={styles.text} numberOfLines={2}>
                  <Text style={styles.bold}>{u.username} </Text>quer seguir você.
                </Text>
                <Pressable style={styles.accept} onPress={() => respondFollowRequest(u.id, true)}>
                  <Text style={styles.acceptText}>Aceitar</Text>
                </Pressable>
                <Pressable style={styles.reject} onPress={() => respondFollowRequest(u.id, false)}>
                  <Text style={styles.rejectText}>Recusar</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      }
      ListEmptyComponent={prefs.pauseAll ? undefined : <Text style={styles.empty}>Nenhuma notificação ainda.</Text>}
      stickySectionHeadersEnabled={false}
    />
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const { getUser, getPost } = useApp();
  const from = getUser(n.fromUserId);
  const post = n.postId ? getPost(n.postId) : undefined;
  if (n.type === 'security') {
    return (
      <Pressable style={styles.row} onPress={() => router.push('/config/seguranca')}>
        <View style={styles.securityIcon}>
          <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
        </View>
        <Text style={styles.text} numberOfLines={3}>
          {n.text} <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
        </Text>
      </Pressable>
    );
  }
  if (!from) return null;

  const text =
    n.type === 'like'
      ? 'curtiu sua publicação.'
      : n.type === 'comment'
        ? `comentou: ${n.text ?? ''}`
        : n.type === 'request'
          ? 'pediu para seguir você.'
          : n.type === 'mention'
          ? `mencionou você: ${n.text ?? ''}`
          : 'começou a seguir você.';

  return (
    <Pressable
      style={styles.row}
      onPress={() => (post ? router.push(n.type === 'comment' ? `/comments/${post.id}` : `/post/${post.id}`) : router.push(`/user/${from.username}`))}>
      <Pressable onPress={() => router.push(`/user/${from.username}`)}>
        <Avatar uri={from.avatar} size={44} />
      </Pressable>
      <Text style={styles.text} numberOfLines={3}>
        <Text style={styles.bold}>{from.username} </Text>
        {text} <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
      </Text>
      {n.type === 'follow' ? (
        <FollowButton userId={from.id} compact />
      ) : post ? (
        <Image source={{ uri: post.type === 'video' ? post.thumbnail : post.uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View />
      )}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { fontWeight: '700', fontSize: 16, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  text: { flex: 1, color: colors.text, lineHeight: 19 },
  bold: { fontWeight: '600' },
  time: { color: colors.textMuted },
  thumb: { width: 44, height: 44, backgroundColor: colors.surface },
  paused: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, margin: spacing.lg, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  pausedText: { flex: 1, color: colors.text },
  securityIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  reject: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  rejectText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
}));
