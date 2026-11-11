import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import type { User } from '@/lib/types';
import { Avatar } from './Avatar';
import { FollowButton, SecondaryButton } from './FollowButton';
import { PostGrid } from './PostGrid';

type Tab = 'posts' | 'videos' | 'saved';

export function ProfileView({ user }: { user: User }) {
  const me = useMe();
  const { postsBy, posts, followersOf, followingOf, storyUsers, openConversationWith } = useApp();
  const [tab, setTab] = useState<Tab>('posts');
  const isMe = user.id === me.id;

  const userPosts = postsBy(user.id);
  const shown =
    tab === 'posts'
      ? userPosts
      : tab === 'videos'
        ? userPosts.filter((p) => p.type === 'video')
        : posts.filter((p) => p.savedBy.includes(me.id));
  const story = storyUsers().find((s) => s.user.id === user.id);

  const onMessage = () => {
    const id = openConversationWith(user.id);
    if (id) router.push(`/messages/${id}`);
  };

  const onShare = () => {
    Share.share({ message: `Siga @${user.username} na Rede Política` }).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.top}>
        <Pressable onPress={() => story && router.push(`/story/${user.id}`)}>
          <Avatar uri={user.avatar} size={84} ring={story ? (story.seen ? 'seen' : 'unseen') : 'none'} />
        </Pressable>
        <View style={styles.stats}>
          <Stat value={userPosts.length} label="publicações" />
          <Stat
            value={followersOf(user.id).length}
            label="seguidores"
            onPress={() => router.push(`/follows/${user.username}?tab=followers`)}
          />
          <Stat
            value={followingOf(user.id).length}
            label="seguindo"
            onPress={() => router.push(`/follows/${user.username}?tab=following`)}
          />
        </View>
      </View>

      <View style={styles.bio}>
        <Text style={styles.name}>{user.name}</Text>
        {user.role || user.party ? (
          <Text style={styles.role}>{[user.role, user.party].filter(Boolean).join(' • ')}</Text>
        ) : null}
        {user.bio ? <Text style={styles.bioText}>{user.bio}</Text> : null}
        {user.website ? (
          <Text style={styles.link} onPress={() => Linking.openURL(`https://${user.website}`).catch(() => {})}>
            <Ionicons name="link" size={13} /> {user.website}
          </Text>
        ) : null}
      </View>

      <View style={styles.buttons}>
        {isMe ? (
          <>
            <SecondaryButton flex label="Editar perfil" onPress={() => router.push('/edit-profile')} />
            <SecondaryButton flex label="Compartilhar perfil" onPress={onShare} />
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <FollowButton userId={user.id} />
            </View>
            <SecondaryButton flex label="Mensagem" onPress={onMessage} />
          </>
        )}
      </View>

      <View style={styles.tabs}>
        <TabIcon icon="grid" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <TabIcon icon="play-circle" active={tab === 'videos'} onPress={() => setTab('videos')} />
        {isMe ? <TabIcon icon="bookmark" active={tab === 'saved'} onPress={() => setTab('saved')} /> : null}
      </View>

      <PostGrid
        posts={shown}
        emptyText={tab === 'saved' ? 'Nada salvo ainda' : tab === 'videos' ? 'Nenhum vídeo ainda' : 'Nenhuma publicação ainda'}
      />
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{compactNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function TabIcon({
  icon,
  active,
  onPress,
}: {
  icon: 'grid' | 'play-circle' | 'bookmark';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons name={active ? icon : (`${icon}-outline` as const)} size={22} color={active ? colors.text : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.xl },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontWeight: '700', fontSize: 17, color: colors.text },
  statLabel: { fontSize: 13, color: colors.text },
  bio: { paddingHorizontal: spacing.lg, gap: 2 },
  name: { fontWeight: '600', color: colors.text },
  role: { color: colors.textMuted, fontSize: 13 },
  bioText: { color: colors.text, lineHeight: 19 },
  link: { color: colors.primaryDark, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 1.5, borderBottomColor: colors.text },
});
