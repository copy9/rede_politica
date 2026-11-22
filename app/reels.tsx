// Vídeos em tela cheia, rolando um por vez (como o TikTok), abertos a partir da aba Vídeos do início.
// Os botões ao lado são os da própria plataforma: curtir, não curtir, comentar e compartilhar.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { MediaVideo } from '@/components/MediaVideo';
import { compactNumber } from '@/lib/format';
import { shareText } from '@/lib/share';
import { recordView } from '@/lib/views';
import { useApp, useMe } from '@/lib/store';
import type { Post } from '@/lib/types';

const THUMB = {
  like: require('@/assets/images/like.png'),
  likeOff: require('@/assets/images/like-off.png'),
  dislike: require('@/assets/images/dislike.png'),
  dislikeOff: require('@/assets/images/dislike-off.png'),
};

export default function ReelsScreen() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { feed } = useApp();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const videos = useMemo(() => feed().filter((p) => p.type === 'video'), [feed]);
  const startIndex = Math.max(0, videos.findIndex((v) => v.id === start));
  const [activeId, setActiveId] = useState<string | null>(start ?? null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Post }[] }) => {
    const id = viewableItems[0]?.item?.id;
    if (id) setActiveId(id);
  }).current;

  return (
    <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <Stack.Screen options={{ headerShown: false }} />
      {height > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(p) => p.id}
          initialScrollIndex={videos.length ? startIndex : undefined}
          renderItem={({ item }) => <Reel post={item} height={height} active={item.id === activeId} />}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          windowSize={3}
          ListEmptyComponent={
            <View style={[styles.empty, { height }]}>
              <Text style={styles.emptyText}>Nenhum vídeo ainda</Text>
            </View>
          }
        />
      ) : null}
      <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.back, { top: insets.top + 8 }]} accessibilityLabel="Voltar">
        <Ionicons name="chevron-back" size={28} color="#fff" style={styles.shadow} />
      </Pressable>
    </View>
  );
}

function Reel({ post, height, active }: { post: Post; height: number; active: boolean }) {
  const me = useMe();
  const { getUser, toggleLike, toggleDislike, commentsFor, isFollowing, toggleFollow } = useApp();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (active) recordView(post.userId, 'video', post.id);
  }, [active, post.id, post.userId]);
  const author = getUser(post.userId);
  if (!author) return null;
  const liked = post.likes.includes(me.id);
  const disliked = !!post.dislikedByMe;
  const share = () =>
    (recordView(post.userId, 'share', post.id), Share.share({ message: shareText(`Veja o vídeo de @${author.username} no Polarizei`, `post/${post.id}`) }).catch(() => {}));

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <MediaVideo uri={post.uri} active={active} startMuted={false} style={StyleSheet.absoluteFill} />

      {/* botões ao lado (os da plataforma) */}
      <View style={[styles.side, { bottom: insets.bottom + 110 }]}>
        <Pressable onPress={() => router.push(`/user/${author.username}`)} style={styles.authorBtn}>
          <Avatar uri={author.avatar} size={46} />
          {author.id !== me.id && !isFollowing(author.id) ? (
            <Pressable onPress={() => toggleFollow(author.id)} style={styles.followPlus} hitSlop={6} accessibilityLabel="Seguir">
              <Ionicons name="add" size={14} color="#fff" />
            </Pressable>
          ) : null}
        </Pressable>
        <Pressable onPress={() => toggleLike(post.id)} style={styles.action} hitSlop={6} accessibilityLabel="Curtir">
          <Image source={liked ? THUMB.like : THUMB.likeOff} style={styles.thumb} contentFit="contain" />
          <Text style={[styles.actionLabel, styles.shadow]}>{compactNumber(post.likes.length)}</Text>
        </Pressable>
        <Pressable onPress={() => toggleDislike(post.id)} style={styles.action} hitSlop={6} accessibilityLabel="Não curti">
          <Image source={disliked ? THUMB.dislike : THUMB.dislikeOff} style={styles.thumb} contentFit="contain" />
          <Text style={[styles.actionLabel, styles.shadow]}>{compactNumber(post.dislikes ?? 0)}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/comments/${post.id}`)} style={styles.action} hitSlop={6} accessibilityLabel="Comentários">
          <Ionicons name="chatbubble-outline" size={30} color="#fff" style={styles.shadow} />
          <Text style={[styles.actionLabel, styles.shadow]}>{compactNumber(commentsFor(post.id).length)}</Text>
        </Pressable>
        <Pressable onPress={share} style={styles.action} hitSlop={6} accessibilityLabel="Compartilhar">
          <Ionicons name="share-social-outline" size={30} color="#fff" style={styles.shadow} />
          <Text style={[styles.actionLabel, styles.shadow]}>Compartilhar</Text>
        </Pressable>
      </View>

      {/* autor e legenda embaixo, à esquerda */}
      <View style={[styles.bottom, { bottom: insets.bottom + 28 }]}>
        <Pressable onPress={() => router.push(`/user/${author.username}`)} style={styles.authorRow}>
          <Text style={[styles.username, styles.shadow]}>{author.name}</Text>
          {author.verified ? <Ionicons name="checkmark-circle" size={15} color="#fff" /> : null}
        </Pressable>
        {post.caption ? (
          <Text style={[styles.caption, styles.shadow]} numberOfLines={2}>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  back: { position: 'absolute', left: 10 },
  side: { position: 'absolute', right: 10, alignItems: 'center', gap: 18 },
  authorBtn: { alignItems: 'center', marginBottom: 6 },
  followPlus: { position: 'absolute', bottom: -9, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center' },
  action: { alignItems: 'center' },
  thumb: { width: 32, height: 32 },
  actionLabel: { color: '#fff', fontSize: 12, marginTop: 3, fontWeight: '700' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  bottom: { position: 'absolute', left: 14, right: 90, gap: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: '#fff', fontWeight: '800', fontSize: 16 },
  caption: { color: '#fff', fontSize: 15 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff' },
});
