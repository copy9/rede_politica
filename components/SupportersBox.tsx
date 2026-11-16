// Canal dos apoiadores (aba Apoiadores das Mensagens).
// "Meu canal": o perfil publica para todos os apoiadores. "Canais que apoio": os apoiadores só reagem com emoji, não respondem.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardView } from '@/components/KeyboardView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { useOverlay } from '@/components/Overlay';
import { useApp, useMe } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { colors, spacing, themed } from '@/lib/theme';

const EMOJIS = ['👍', '❤️', '👏', '🔥', '😮', '😢'] as const;
type ChannelPost = { id: string; politician_id: string; text: string; created_at: string };
type Reaction = { post_id: string; user_id: string; emoji: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function SupportersBox() {
  const me = useMe();
  const { supportersFor, consents, getUser } = useApp();
  const { showBanner } = useOverlay();
  const insets = useSafeAreaInsets();
  const mySupporters = supportersFor(me.id).length;
  const following = useMemo(() => consents.filter((c) => c.userId === me.id).map((c) => c.politicianId), [consents, me.id]);
  const [tab, setTab] = useState<'meu' | 'apoio'>(mySupporters > 0 || me.accountType === 'politico' ? 'meu' : 'apoio');
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const ids = tab === 'meu' ? [me.id] : following;
    if (!ids.length) {
      setPosts([]);
      setReactions([]);
      return;
    }
    const { data, error } = await supabase
      .from('supporter_posts')
      .select('*')
      .in('politician_id', ids)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      showBanner('O canal ainda não está ativo no banco. Rode a migração 0015 no Supabase.', { icon: 'alert-circle-outline', tone: 'warning' });
      return;
    }
    const list = (data ?? []) as ChannelPost[];
    setPosts(list);
    if (list.length) {
      const r = await supabase.from('supporter_reactions').select('post_id,user_id,emoji').in('post_id', list.map((p) => p.id));
      setReactions((r.data ?? []) as Reaction[]);
    } else setReactions([]);
  }, [tab, me.id, following, showBanner]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`canal-${me.id}-${tab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supporter_posts' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supporter_reactions' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, me.id, tab]);

  const publish = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from('supporter_posts').insert({ politician_id: me.id, text: body.slice(0, 2000) });
    setSending(false);
    if (error) return showBanner(`Não deu para publicar: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    setText('');
    showBanner(`Publicado para ${mySupporters} ${mySupporters === 1 ? 'apoiador' : 'apoiadores'}.`, { icon: 'megaphone-outline', tone: 'success' });
    load();
  };

  const react = async (post: ChannelPost, emoji: string) => {
    const mine = reactions.find((r) => r.post_id === post.id && r.user_id === me.id);
    // toque na mesma reação tira; em outra, troca
    setReactions((prev) => {
      const rest = prev.filter((r) => !(r.post_id === post.id && r.user_id === me.id));
      return mine?.emoji === emoji ? rest : [...rest, { post_id: post.id, user_id: me.id, emoji }];
    });
    const res =
      mine?.emoji === emoji
        ? await supabase.from('supporter_reactions').delete().eq('post_id', post.id).eq('user_id', me.id)
        : await supabase.from('supporter_reactions').upsert({ post_id: post.id, user_id: me.id, emoji });
    if (res.error) {
      showBanner('Não deu para reagir agora.', { icon: 'alert-circle-outline', tone: 'warning' });
      load();
    }
  };

  const renderPost = ({ item }: { item: ChannelPost }) => {
    const author = getUser(item.politician_id);
    const counts = EMOJIS.map((e) => ({ e, n: reactions.filter((r) => r.post_id === item.id && r.emoji === e).length }));
    const mine = reactions.find((r) => r.post_id === item.id && r.user_id === me.id)?.emoji;
    const isMine = item.politician_id === me.id;
    return (
      <View style={styles.card}>
        {!isMine && author ? (
          <Pressable style={styles.author} onPress={() => router.push(`/user/${author.username}`)}>
            <Avatar uri={author.avatar} size={28} />
            <Text style={styles.authorName}>{author.name}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.text}>{item.text}</Text>
        <Text style={styles.meta}>{when(item.created_at)}</Text>
        {isMine ? (
          // quem publicou vê o total de cada reação (não responde, só acompanha)
          <View style={styles.reactRow}>
            {counts.filter((c) => c.n > 0).map((c) => (
              <View key={c.e} style={styles.countPill}>
                <Text style={styles.emoji}>{c.e}</Text>
                <Text style={styles.count}>{c.n}</Text>
              </View>
            ))}
            {counts.every((c) => c.n === 0) ? <Text style={styles.meta}>Sem reações ainda</Text> : null}
          </View>
        ) : (
          <View style={styles.reactRow}>
            {counts.map((c) => (
              <Pressable key={c.e} onPress={() => react(item, c.e)} style={[styles.reactBtn, mine === c.e && styles.reactBtnOn]} accessibilityLabel={`Reagir ${c.e}`}>
                <Text style={styles.emoji}>{c.e}</Text>
                {c.n ? <Text style={styles.count}>{c.n}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardView style={styles.container} withHeader>
      <View style={styles.tabs}>
        {(
          [
            ['meu', `Meu canal${mySupporters ? ` · ${mySupporters}` : ''}`],
            ['apoio', `Canais que apoio${following.length ? ` · ${following.length}` : ''}`],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]} maxFontSizeMultiplier={1.15}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {tab === 'meu'
          ? `Publique para ${mySupporters} ${mySupporters === 1 ? 'apoiador' : 'apoiadores'}. Eles só reagem com emoji, não respondem.`
          : 'Novidades dos perfis que você apoia. Você pode reagir com emoji.'}
      </Text>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderPost}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'meu' ? 'Nada publicado ainda.' : following.length ? 'Nenhuma novidade ainda.' : 'Você ainda não apoia nenhum perfil. Toque em "Quero receber novidades" num perfil.'}
          </Text>
        }
      />
      {tab === 'meu' ? (
        <View style={[styles.composer, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            placeholder="Escreva para os apoiadores..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
          />
          {text.trim() ? (
            <Pressable onPress={publish} hitSlop={8} style={[styles.send, sending && { opacity: 0.5 }]} disabled={sending} accessibilityLabel="Publicar para apoiadores">
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </KeyboardView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  tab: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.like },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  hint: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorName: { color: colors.text, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 11 },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  reactBtnOn: { borderColor: colors.like, backgroundColor: colors.dangerBg },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.background },
  emoji: { fontSize: 16 },
  count: { color: colors.text, fontWeight: '700', fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingLeft: spacing.lg, paddingRight: 6, minHeight: 46 },
  input: { flex: 1, color: colors.text, fontSize: 15, maxHeight: 110, paddingVertical: 10 },
  send: { backgroundColor: colors.like, borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
}));
