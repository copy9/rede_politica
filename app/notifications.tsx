import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';
import { timeAgo } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;

export default function NotificationsScreen() {
  const me = useMe();
  const { notifications } = useApp();
  const mine = notifications.filter((n) => n.toUserId === me.id).sort((a, b) => b.createdAt - a.createdAt);
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
      ListEmptyComponent={<Text style={styles.empty}>Nenhuma notificação ainda.</Text>}
      stickySectionHeadersEnabled={false}
    />
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const { getUser, getPost } = useApp();
  const from = getUser(n.fromUserId);
  const post = n.postId ? getPost(n.postId) : undefined;
  if (!from) return null;

  const text =
    n.type === 'like'
      ? 'curtiu sua publicação.'
      : n.type === 'comment'
        ? `comentou: ${n.text ?? ''}`
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
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
}));
