import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { MediaVideo } from '@/components/MediaVideo';
import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import type { Post } from '@/lib/types';

/** Vídeos curtos em tela cheia, rolagem vertical (um por vez). */
export default function VideosScreen() {
  const { posts } = useApp();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const videos = [...posts].filter((p) => p.type === 'video').sort((a, b) => b.createdAt - a.createdAt);

  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Post; isViewable: boolean }[] }) => {
    setActiveId(viewableItems[0]?.item?.id ?? null);
  }).current;

  return (
    <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <Reel post={item} height={height} active={focused && (item.id === activeId || (!activeId && index === 0))} />
          )}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          ListEmptyComponent={
            <View style={[styles.empty, { height }]}>
              <Text style={styles.emptyText}>Nenhum vídeo ainda</Text>
            </View>
          }
        />
      ) : null}
      <Text style={[styles.title, { top: insets.top + 8 }]}>Vídeos</Text>
    </View>
  );
}

function Reel({ post, height, active }: { post: Post; height: number; active: boolean }) {
  const me = useMe();
  const { getUser, toggleLike, toggleSave, commentsFor, isFollowing, toggleFollow } = useApp();
  const author = getUser(post.userId);
  if (!author) return null;
  const liked = post.likes.includes(me.id);
  const saved = post.savedBy.includes(me.id);

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <MediaVideo uri={post.uri} active={active} startMuted={false} style={StyleSheet.absoluteFill} />

      <View style={styles.side}>
        <Action icon={liked ? 'heart' : 'heart-outline'} color={liked ? '#E11D48' : '#fff'} label={compactNumber(post.likes.length)} onPress={() => toggleLike(post.id)} />
        <Action icon="chatbubble-outline" label={compactNumber(commentsFor(post.id).length)} onPress={() => router.push(`/comments/${post.id}`)} />
        <Action
          icon="paper-plane-outline"
          label="Enviar"
          onPress={() => Share.share({ message: `Veja o vídeo de @${author.username} na Rede Política` }).catch(() => {})}
        />
        <Action icon={saved ? 'bookmark' : 'bookmark-outline'} label="Salvar" onPress={() => toggleSave(post.id)} />
      </View>

      <View style={styles.bottom}>
        <View style={styles.authorRow}>
          <Pressable onPress={() => router.push(`/user/${author.username}`)} style={styles.authorRow}>
            <Avatar uri={author.avatar} size={32} />
            <Text style={styles.username}>{author.username}</Text>
            {author.verified ? <Ionicons name="checkmark-circle" size={14} color="#fff" /> : null}
          </Pressable>
          {author.id !== me.id ? (
            <Pressable onPress={() => toggleFollow(author.id)} style={styles.follow}>
              <Text style={styles.followText}>{isFollowing(author.id) ? 'Seguindo' : 'Seguir'}</Text>
            </Pressable>
          ) : null}
        </View>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  color = '#fff',
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={6}>
      <Ionicons name={icon} size={30} color={color} style={styles.shadow} />
      <Text style={[styles.actionLabel, styles.shadow]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { position: 'absolute', left: 16, color: '#fff', fontSize: 22, fontWeight: '800' },
  side: { position: 'absolute', right: 12, bottom: 110, alignItems: 'center', gap: 20 },
  action: { alignItems: 'center' },
  actionLabel: { color: '#fff', fontSize: 12, marginTop: 2, fontWeight: '600' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  bottom: { position: 'absolute', left: 14, right: 80, bottom: 24, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: '#fff', fontWeight: '700' },
  follow: { borderWidth: 1, borderColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  followText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  caption: { color: '#fff' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff' },
});
