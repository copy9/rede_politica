import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { compactNumber, pluralize, timeAgo } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { Post } from '@/lib/types';
import { Avatar } from './Avatar';
import { MediaVideo } from './MediaVideo';
import { shareText } from '@/lib/share';
import { useOverlay } from './Overlay';
import { useReport } from './useReport';
import { UserName } from './UserName';

export function PostCard({ post, active = false }: { post: Post; active?: boolean }) {
  const { me, getUser, commentsFor, toggleLike, toggleDislike, deletePost, storyUsers } = useApp();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const { showSheet, confirm, showBanner } = useOverlay();
  const reportIt = useReport();
  const autoplay = settings.autoplayVideos && !settings.dataSaver;
  const [expanded, setExpanded] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  const author = getUser(post.userId);
  if (!author || !me) return null;

  const liked = post.likes.includes(me.id);
  const comments = commentsFor(post.id);
  const hasStory = storyUsers().find((s) => s.user.id === author.id);
  const mediaSize = Math.min(width, 640);

  const openProfile = () => router.push(`/user/${author.username}`);
  const openComments = () => router.push(`/comments/${post.id}`);

  // Toque duplo na mídia = curtir (com animação de coração)
  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike(post.id);
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 300, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  };

  const onShare = () => {
    Share.share({ message: shareText(`Veja a publicação de @${author.username} na Rede Política${post.caption ? `: ${post.caption}` : ''}`, `post/${post.id}`) }).catch(() => {});
  };

  const onMore = () => {
    if (author.id === me.id) {
      showSheet({
        title: 'Publicação',
        options: [
          {
            label: 'Excluir',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => confirm('Excluir publicação?', 'Ela some do seu perfil e do feed.', 'Excluir', () => deletePost(post.id), true),
          },
        ],
      });
    } else {
      showSheet({
        title: 'Publicação',
        options: [
          { label: 'Ver perfil', icon: 'person-outline', onPress: openProfile },
          {
            label: 'Denunciar',
            icon: 'flag-outline',
            destructive: true,
            onPress: () => reportIt('post', post.id, 'publicação'),
          },
        ],
      });
    }
  };

  const caption = post.caption;
  const longCaption = caption.length > 110;

  return (
    <View style={styles.card}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable
          onPress={() => (hasStory ? router.push(`/story/${author.id}`) : openProfile())}
          style={styles.headerLeft}>
          <Avatar uri={author.avatar} size={32} ring={hasStory ? (hasStory.seen ? 'seen' : hasStory.closeFriends ? 'close' : 'unseen') : 'none'} />
        </Pressable>
        <Pressable onPress={openProfile} style={styles.headerInfo}>
          <UserName user={author} />
          {post.location ? (
            <Text style={styles.location} numberOfLines={1}>
              {post.location}
            </Text>
          ) : author.role ? (
            <Text style={styles.location} numberOfLines={1}>
              {author.role}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={onMore} hitSlop={10} accessibilityLabel="Mais opções">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Mídia (ou o texto, quando a publicação é só texto) */}
      {post.type === 'text' ? (
        <Pressable onPress={onMediaPress} style={styles.textPost}>
          <Text style={[styles.textPostText, post.caption.length > 140 && { fontSize: 16 }]}>{post.caption}</Text>
        </Pressable>
      ) : (
      <View style={{ width: mediaSize, height: mediaSize, alignSelf: 'center', backgroundColor: colors.surface }}>
        {post.type === 'video' ? (
          <MediaVideo uri={post.uri} active={active && autoplay} style={StyleSheet.absoluteFill} onPress={onMediaPress} />
        ) : (
          <Pressable style={StyleSheet.absoluteFill} onPress={onMediaPress}>
            <Image source={{ uri: mediaUri(post.uri, settings.dataSaver) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          </Pressable>
        )}
        <Animated.View
          pointerEvents="none"
          style={[styles.bigHeart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }]}>
          <Ionicons name="thumbs-up" size={96} color="#fff" />
        </Animated.View>
      </View>
      )}

      {/* Ações */}
      <View style={styles.actions}>
        <Pressable onPress={() => toggleLike(post.id)} hitSlop={8} style={styles.thumb} accessibilityLabel="Curtir" accessibilityState={{ selected: liked }}>
          <Image source={liked ? THUMB.like : THUMB.likeOff} style={styles.thumbIcon} contentFit="contain" />
          {post.likes.length && !settings.hideLikeCounts ? (
            <Text style={[styles.countText, liked && { color: '#16A34A' }]}>{post.likes.length}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={() => toggleDislike(post.id)} hitSlop={8} style={styles.thumb} accessibilityLabel="Não curti" accessibilityState={{ selected: !!post.dislikedByMe }}>
          <Image source={post.dislikedByMe ? THUMB.dislike : THUMB.dislikeOff} style={styles.thumbIcon} contentFit="contain" />
          {post.dislikes ? <Text style={[styles.countText, post.dislikedByMe && { color: '#DC2626' }]}>{post.dislikes}</Text> : null}
        </Pressable>
        <Pressable onPress={openComments} hitSlop={8} style={styles.action} accessibilityLabel="Comentar">
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8} style={styles.action} accessibilityLabel="Compartilhar">
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Curtidas, legenda, comentários */}
      <View style={styles.body}>
        {post.likes.length > 0 && !settings.hideLikeCounts ? (
          <Pressable onPress={() => router.push(`/likes/${post.id}`)}>
            <Text style={styles.bold}>{pluralize(post.likes.length, 'curtida', 'curtidas')}</Text>
          </Pressable>
        ) : null}
        {caption && post.type !== 'text' ? (
          <Text style={styles.caption} onPress={() => setExpanded(true)}>
            <Text style={styles.bold} onPress={openProfile}>
              {author.username}{' '}
            </Text>
            {longCaption && !expanded ? `${caption.slice(0, 110).trim()}… ` : caption}
            {longCaption && !expanded ? <Text style={styles.muted}>mais</Text> : null}
          </Text>
        ) : null}
        {comments.length > 0 ? (
          <Pressable onPress={openComments}>
            <Text style={styles.muted}>
              {comments.length === 1 ? 'Ver 1 comentário' : `Ver todos os ${compactNumber(comments.length)} comentários`}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
      </View>
    </View>
  );
}

// mãos de curtir / não curtir (coloridas quando escolhidas, cinza quando não)
const THUMB = {
  like: require('@/assets/images/like.png'),
  likeOff: require('@/assets/images/like-off.png'),
  dislike: require('@/assets/images/dislike.png'),
  dislikeOff: require('@/assets/images/dislike-off.png'),
};

const styles = themed(() => StyleSheet.create({
  thumb: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.xl },
  textPost: { marginHorizontal: spacing.md, padding: spacing.lg, borderRadius: 14, backgroundColor: colors.surface },
  textPostText: { color: colors.text, fontSize: 19, lineHeight: 26, fontWeight: '600' },
  thumbIcon: { width: 26, height: 26 },
  countText: { color: colors.text, fontWeight: '600', fontSize: 13, marginLeft: 3 },
  card: { backgroundColor: colors.background, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  headerLeft: {},
  headerInfo: { flex: 1 },
  location: { fontSize: 12, color: colors.text, marginTop: 1 },
  bigHeart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  action: { marginRight: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: 4 },
  bold: { fontWeight: '600', color: colors.text },
  caption: { color: colors.text, lineHeight: 19 },
  muted: { color: colors.textMuted },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
}));
