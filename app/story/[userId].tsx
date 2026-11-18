import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { supabase } from '@/lib/supabase';

import { themed } from '@/lib/theme';
const DURATION = 5000;

/** Visualizador de stories: avança sozinho, toque à direita/esquerda para navegar. */
export default function StoryScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useMe();
  const { storyUsers, markStorySeen, openConversationWith, sendMessage } = useApp();
  const dataSaver = useSettings().settings.dataSaver;

  // Lista fixa ao abrir (para não reordenar enquanto assiste)
  const [groups] = useState(() => storyUsers());
  const [groupIndex, setGroupIndex] = useState(() => Math.max(0, groups.findIndex((g) => g.user.id === userId)));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  // Lista de quem visualizou (igual Instagram): só o dono vê
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; username: string; name: string; avatar: string }[] | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const group = groups[groupIndex];
  const story = group?.stories[index];

  const next = () => {
    if (!group) return router.back();
    if (index < group.stories.length - 1) setIndex(index + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setIndex(0);
    } else router.back();
  };

  const prev = () => {
    if (index > 0) setIndex(index - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setIndex(0);
    }
  };

  useEffect(() => {
    if (!story) return;
    markStorySeen(story.id);
    progress.setValue(0);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!story || paused) return;
    // Continua de onde parou
    const current = (progress as unknown as { _value: number })._value ?? 0;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION * (1 - current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => finished && next());
    return () => anim.stop();
  }, [story?.id, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !story) return null;
  const isMine = group.user.id === me.id;

  const openViewers = async () => {
    setPaused(true);
    setViewersOpen(true);
    setViewers(null);
    try {
      const { data: views } = await supabase.from('story_views').select('user_id').eq('story_id', story.id);
      const ids = [...new Set((views ?? []).map((v: { user_id: string }) => v.user_id))].filter((id) => id !== me.id);
      if (!ids.length) return setViewers([]);
      const { data: profs } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', ids);
      const byId = new Map((profs ?? []).map((p: { id: string; username: string; name: string; avatar_url: string | null }) => [p.id, p]));
      setViewers(
        ids.map((id) => byId.get(id)).filter(Boolean).map((p) => ({ id: p!.id, username: p!.username, name: p!.name, avatar: p!.avatar_url || '' })),
      );
    } catch {
      setViewers([]);
    }
  };
  const closeViewers = () => {
    setViewersOpen(false);
    setPaused(false);
  };
  const viewCount = viewers ? viewers.length : Math.max(0, story.seenBy.length - 1);

  const sendReply = async () => {
    const conv = await openConversationWith(group.user.id);
    if (conv && reply.trim()) sendMessage(conv, `Respondeu ao seu story: ${reply.trim()}`);
    setReply('');
    setPaused(false);
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: mediaUri(story.uri, dataSaver) }} style={StyleSheet.absoluteFill} contentFit="cover" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.bars}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.barBg}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < index ? '100%' : i > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <Pressable style={styles.author} onPress={() => router.replace(`/user/${group.user.username}`)}>
            <Avatar uri={group.user.avatar} size={32} />
            <Text style={styles.username}>{group.user.username}</Text>
            <Text style={styles.time}>{timeAgo(story.createdAt)}</Text>
            {story.closeFriends ? (
              <View style={styles.closeBadge}>
                <Ionicons name="star" size={11} color="#fff" />
                <Text style={styles.closeText}>Melhores amigos</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>

        {/* Áreas de toque: esquerda volta, direita avança, segurar pausa */}
        <View style={styles.touch}>
          <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
          <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        </View>

        {isMine ? (
          <Pressable style={styles.footerMine} onPress={openViewers} hitSlop={10}>
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={styles.username}>{viewCount} {viewCount === 1 ? 'visualização' : 'visualizações'}</Text>
            <Ionicons name="chevron-up" size={18} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.footer}>
            <TextInput
              placeholder={`Responder a ${group.user.username}...`}
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={reply}
              onChangeText={setReply}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onSubmitEditing={sendReply}
              style={styles.reply}
              returnKeyType="send"
            />
            <Pressable onPress={sendReply} hitSlop={8}>
              <Ionicons name="paper-plane-outline" size={26} color="#fff" />
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={closeViewers}>
        <Pressable style={styles.sheetBackdrop} onPress={closeViewers} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={styles.sheetTitle}>
              {viewers ? `${viewers.length} ${viewers.length === 1 ? 'visualização' : 'visualizações'}` : 'Visualizações'}
            </Text>
          </View>
          {viewers === null ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
          ) : viewers.length === 0 ? (
            <Text style={styles.sheetEmpty}>Ninguém visualizou ainda.</Text>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.viewerRow}
                  onPress={() => {
                    setViewersOpen(false);
                    router.replace(`/user/${item.username}`);
                  }}>
                  <Avatar uri={item.avatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerName} numberOfLines={1}>{item.name || item.username}</Text>
                    <Text style={styles.viewerUser} numberOfLines={1}>@{item.username}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
  barBg: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  time: { color: 'rgba(255,255,255,0.8)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  touch: { flex: 1, flexDirection: 'row' },
  closeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  closeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 8 },
  footerMine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { height: '55%', backgroundColor: '#1c1c1e', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  sheetTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sheetEmpty: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 24 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  viewerName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  viewerUser: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  reply: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff' },
}));
