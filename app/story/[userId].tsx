import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { recordView } from '@/lib/views';

import { themed } from '@/lib/theme';
const DURATION = 5000;

/** Visualizador de stories: avança sozinho, toque à direita/esquerda para navegar. */
export default function StoryScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useMe();
  const { storyUsers, markStorySeen, openConversationWith, sendMessage, getUser } = useApp();
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
  const openViewersRef = useRef<() => void>(() => {});
  // Arrastar para cima no próprio story abre a lista de visualizações (igual Instagram)
  const swipeUp = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy < -20 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -50) openViewersRef.current();
      },
    }),
  ).current;

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
    recordView(story.userId, 'story', story.id);
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

  type Viewer = { id: string; username: string; name: string; avatar: string };
  const loadViewers = async (storyId: string, localIds: string[]) => {
    // 1) mostra na hora quem o app já conhece; 2) completa com o servidor
    const known = localIds
      .filter((id) => id !== me.id)
      .map((id) => getUser(id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, username: u!.username, name: u!.name, avatar: u!.avatar }));
    setViewers(known.length || !localIds.filter((id) => id !== me.id).length ? known : null);
    try {
      const { data: views, error } = await supabase.from('story_views').select('user_id').eq('story_id', storyId);
      if (error) throw error;
      const ids = [...new Set([...(views ?? []).map((v: { user_id: string }) => v.user_id), ...localIds])].filter((id) => id !== me.id);
      if (!ids.length) return setViewers([]);
      const { data: profs } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', ids);
      const byId = new Map<string, Viewer>();
      for (const v of known) byId.set(v.id, v);
      for (const p of (profs ?? []) as { id: string; username: string; name: string; avatar_url: string | null }[])
        byId.set(p.id, { id: p.id, username: p.username, name: p.name, avatar: p.avatar_url || '' });
      setViewers(ids.map((id) => byId.get(id)).filter(Boolean) as Viewer[]);
    } catch {
      setViewers((v) => v ?? known);
    }
  };
  const openViewers = () => {
    setPaused(true);
    setViewersOpen(true);
    loadViewers(story.id, story.seenBy);
  };
  const closeViewers = () => {
    setViewersOpen(false);
    setPaused(false);
  };
  const pickViewerStory = (i: number) => {
    setIndex(i);
    const st = group.stories[i];
    if (st) loadViewers(st.id, st.seenBy);
  };
  openViewersRef.current = isMine ? openViewers : () => {};
  const viewCount = Math.max(0, story.seenBy.filter((id) => id !== group.user.id).length);
  const messageViewer = async (userId: string) => {
    const id = await openConversationWith(userId);
    if (id) {
      setViewersOpen(false);
      router.replace(`/messages/${id}`);
    }
  };

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
        <View style={styles.touch} {...(isMine ? swipeUp.panHandlers : {})}>
          <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
          <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        </View>

        {isMine ? (
          <Pressable style={styles.footerMine} onPress={openViewers} hitSlop={14}>
            <View style={styles.activityAvatars}>
              {story.seenBy
                .filter((id) => id !== group.user.id)
                .slice(-3)
                .map((id, i) => (
                  <View key={id} style={[styles.activityAvatar, { marginLeft: i ? -10 : 0 }]}>
                    <Avatar uri={getUser(id)?.avatar ?? ''} size={24} />
                  </View>
                ))}
            </View>
            <View>
              <Text style={styles.username}>Atividade</Text>
              <Text style={styles.activityCount}>
                {viewCount} {viewCount === 1 ? 'visualização' : 'visualizações'}
              </Text>
            </View>
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

      {viewersOpen ? (
        <SafeAreaView style={styles.viewersScreen} edges={['top', 'bottom']}>
          <View style={styles.viewersTop}>
            <Pressable onPress={closeViewers} hitSlop={12} style={styles.viewersClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <FlatList
              horizontal
              data={group.stories}
              keyExtractor={(st) => st.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}
              renderItem={({ item, index: i }) => (
                <Pressable onPress={() => (i === index ? closeViewers() : pickViewerStory(i))}>
                  <Image
                    source={{ uri: mediaUri(item.uri, dataSaver) }}
                    style={[styles.thumb, i === index && styles.thumbActive]}
                    contentFit="cover"
                  />
                </Pressable>
              )}
            />
          </View>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Ionicons name="eye-outline" size={22} color="#fff" />
              <Text style={styles.sheetTitle}>{viewers ? viewers.length : viewCount}</Text>
            </View>
            <Text style={styles.sheetSection}>Visualizadores</Text>
            {viewers === null ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
            ) : viewers.length === 0 ? (
              <Text style={styles.sheetEmpty}>Ainda não há visualizações.{'\n'}Quando alguém ver seu story, aparece aqui.</Text>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <Pressable
                      style={styles.viewerInfo}
                      onPress={() => {
                        setViewersOpen(false);
                        router.replace(`/user/${item.username}`);
                      }}>
                      <Avatar uri={item.avatar} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.viewerName} numberOfLines={1}>{item.username}</Text>
                        <Text style={styles.viewerUser} numberOfLines={1}>{item.name}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => messageViewer(item.id)} hitSlop={10}>
                      <Ionicons name="paper-plane-outline" size={24} color="#fff" />
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
        </SafeAreaView>
      ) : null}
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
  footerMine: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10 },
  activityAvatars: { flexDirection: 'row' },
  activityAvatar: { borderWidth: 1.5, borderColor: '#000', borderRadius: 14 },
  activityCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  viewersScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  viewersTop: { height: 210, justifyContent: 'center' },
  viewersClose: { position: 'absolute', top: 8, right: 12, zIndex: 2 },
  thumbs: { paddingHorizontal: 16, gap: 8, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  thumb: { width: 72, height: 128, borderRadius: 8, opacity: 0.55 },
  thumbActive: { width: 92, height: 164, opacity: 1, borderWidth: 2, borderColor: '#fff' },
  sheet: { flex: 1, backgroundColor: '#1c1c1e', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  sheetTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sheetSection: { color: '#fff', fontWeight: '700', fontSize: 15, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sheetEmpty: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 24, lineHeight: 20 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  viewerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewerName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  viewerUser: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  reply: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff' },
}));
