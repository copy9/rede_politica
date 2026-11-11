import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import { isHiddenText, useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { Comment } from '@/lib/types';

const QUICK = ['👏', '👍', '🇧🇷', '🤔', '❤️', '🔥'];

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { getPost, getUser, commentsFor, addComment } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const post = getPost(id);
  const author = post ? getUser(post.userId) : undefined;

  const send = () => {
    if (!text.trim()) return;
    addComment(id, text);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <FlatList
        data={commentsFor(id)}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          post && author && post.caption ? (
            <View style={[styles.row, styles.captionRow]}>
              <Avatar uri={author.avatar} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>
                  <Text style={styles.bold}>{author.username} </Text>
                  {post.caption}
                </Text>
                <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <CommentRow comment={item} onReply={(u) => setText(`@${u} `)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ainda não há comentários</Text>
            <Text style={styles.meta}>Inicie a conversa.</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.quick}>
          {QUICK.map((e) => (
            <Pressable key={e} onPress={() => setText((t) => t + e)}>
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <Avatar uri={me.avatar} size={34} />
          <TextInput
            placeholder={author ? `Comente como ${me.username}...` : 'Adicione um comentário...'}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <Pressable onPress={send} disabled={!text.trim()} hitSlop={8}>
            <Text style={[styles.post, !text.trim() && { opacity: 0.4 }]}>Publicar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({ comment, onReply }: { comment: Comment; onReply: (username: string) => void }) {
  const me = useMe();
  const { getUser, toggleCommentLike } = useApp();
  const { settings } = useSettings();
  const [reveal, setReveal] = useState(false);
  const user = getUser(comment.userId);
  if (!user) return null;
  const liked = comment.likes.includes(me.id);
  const hidden = !reveal && comment.userId !== me.id && isHiddenText(comment.text, settings);

  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push(`/user/${user.username}`)}>
        <Avatar uri={user.avatar} size={34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          <Text style={styles.bold}>{user.username} </Text>
          {hidden ? (
            <Text style={styles.meta}>
              Comentário oculto pelos seus filtros ·{' '}
              <Text style={styles.bold} onPress={() => setReveal(true)}>
                ver
              </Text>
            </Text>
          ) : (
            comment.text
          )}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{timeAgo(comment.createdAt)}</Text>
          {comment.likes.length ? (
            <Text style={styles.meta}>
              {comment.likes.length} {comment.likes.length === 1 ? 'curtida' : 'curtidas'}
            </Text>
          ) : null}
          <Pressable onPress={() => onReply(user.username)}>
            <Text style={[styles.meta, styles.bold]}>Responder</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={() => toggleCommentLike(comment.id)} hitSlop={10}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? colors.like : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'flex-start' },
  captionRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  text: { color: colors.text, lineHeight: 19 },
  bold: { fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
  meta: { color: colors.textMuted, fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 48, gap: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  quick: { flexDirection: 'row', justifyContent: 'space-around' },
  emoji: { fontSize: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { flex: 1, color: colors.text, fontSize: 15, maxHeight: 100, paddingVertical: 8 },
  post: { color: colors.primary, fontWeight: '700' },
}));
