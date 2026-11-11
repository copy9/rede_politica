import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Animated, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { compactNumber, pluralize, timeAgo } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { Post } from '@/lib/types';
import { Avatar } from './Avatar';
import { MediaVideo } from './MediaVideo';
import { UserName } from './UserName';

export function PostCard({ post, active = false }: { post: Post; active?: boolean }) {
  const { me, getUser, commentsFor, toggleLike, toggleSave, deletePost, storyUsers } = useApp();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const autoplay = settings.autoplayVideos && !settings.dataSaver;
  const [expanded, setExpanded] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  const author = getUser(post.userId);
  if (!author || !me) return null;

  const liked = post.likes.includes(me.id);
  const saved = post.savedBy.includes(me.id);
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
    Share.share({ message: `Veja a publicação de @${author.username} na Rede Política: ${post.caption}` }).catch(() => {});
  };

  const onMore = () => {
    if (author.id === me.id) {
      Alert.alert('Publicação', undefined, [
        { text: 'Excluir', style: 'destructive', onPress: () => deletePost(post.id) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Publicação', undefined, [
        { text: 'Denunciar', style: 'destructive', onPress: () => Alert.alert('Obrigado', 'Sua denúncia foi registrada.') },
        { text: 'Ver perfil', onPress: openProfile },
        { text: 'Cancelar', style: 'cancel' },
      ]);
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
          <Avatar uri={author.avatar} size={32} ring={hasStory ? (hasStory.seen ? 'seen' : 'unseen') : 'none'} />
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
        <Pressable onPress={onMore} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Mídia */}
      <View style={{ width: mediaSize, height: mediaSize, alignSelf: 'center', backgroundColor: colors.surface }}>
        {post.type === 'video' ? (
          <MediaVideo uri={post.uri} active={active && autoplay} style={StyleSheet.absoluteFill} onPress={onMediaPress} />
        ) : (
          <Pressable style={StyleSheet.absoluteFill} onPress={onMediaPress}>
            <Image source={{ uri: post.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          </Pressable>
        )}
        <Animated.View
          pointerEvents="none"
          style={[styles.bigHeart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }]}>
          <Ionicons name="heart" size={96} color="#fff" />
        </Animated.View>
      </View>

      {/* Ações */}
      <View style={styles.actions}>
        <Pressable onPress={() => toggleLike(post.id)} hitSlop={8} style={styles.action}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? colors.like : colors.text} />
        </Pressable>
        <Pressable onPress={openComments} hitSlop={8} style={styles.action}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8} style={styles.action}>
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => toggleSave(post.id)} hitSlop={8}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Curtidas, legenda, comentários */}
      <View style={styles.body}>
        {post.likes.length > 0 && !settings.hideLikeCounts ? (
          <Pressable onPress={() => router.push(`/likes/${post.id}`)}>
            <Text style={styles.bold}>{pluralize(post.likes.length, 'curtida', 'curtidas')}</Text>
          </Pressable>
        ) : null}
        {caption ? (
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

const styles = themed(() => StyleSheet.create({
  card: { backgroundColor: colors.background, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  headerLeft: {},
  headerInfo: { flex: 1 },
  location: { fontSize: 12, color: colors.text, marginTop: 1 },
  bigHeart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  action: { marginRight: spacing.lg },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: 4 },
  bold: { fontWeight: '600', color: colors.text },
  caption: { color: colors.text, lineHeight: 19 },
  muted: { color: colors.textMuted },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
}));
