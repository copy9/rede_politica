import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { useOverlay } from '@/components/Overlay';
import { SupportersToggle, useSupportersBroadcast } from '@/components/SupportersToggle';
import { UserName } from '@/components/UserName';
import { timeAgo } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function InboxScreen() {
  const me = useMe();
  const { conversations, conversationMessages, getUser, users, openConversationWith, activityText, broadcastToSupporters } = useApp();
  const broadcast = useSupportersBroadcast();
  const [draft, setDraft] = useState('');
  const sendToSupporters = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const n = await broadcastToSupporters(text);
    showBanner(n ? `Enviada por direct para ${n} ${n === 1 ? 'apoiador' : 'apoiadores'}.` : 'Você ainda não tem apoiadores.', { icon: 'people', tone: n ? 'success' : 'warning' });
  };
  const { showBanner } = useOverlay();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const items = conversations
    .filter((c) => c.participantIds.includes(me.id))
    .map((c) => {
      const other = getUser(c.participantIds.find((id) => id !== me.id) ?? '');
      const msgs = conversationMessages(c.id);
      return { conversation: c, other, last: msgs[msgs.length - 1] };
    })
    .filter((x) => !!x.other && x.last)
    .filter((x) => !q || x.other!.username.includes(q) || x.other!.name.toLowerCase().includes(q))
    .sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

  // Ao pesquisar, mostra também pessoas para iniciar conversa
  const people = q
    ? users.filter((u) => u.id !== me.id && (u.username.includes(q) || u.name.toLowerCase().includes(q)) && !items.some((i) => i.other?.id === u.id))
    : [];

  const start = async (userId: string) => {
    const id = await openConversationWith(userId);
    if (id) router.push(`/messages/${id}`);
    else showBanner('Essa conta não está recebendo mensagens de você.', { icon: 'chatbubbles-outline', tone: 'warning' });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: me.username }} />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          placeholder="Pesquisar"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.headRow}>
        <Text style={[styles.heading, { paddingHorizontal: 0 }]}>Mensagens</Text>
        <SupportersToggle />
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.conversation.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/messages/${item.conversation.id}`)}>
            <Avatar uri={item.other!.avatar} size={54} />
            <View style={{ flex: 1 }}>
              <UserName user={item.other!} />
              <Text style={styles.preview} numberOfLines={1}>
                {item.last!.senderId === me.id ? 'Você: ' : ''}
                {item.last!.text} · {timeAgo(item.last!.createdAt)}
              </Text>
              {activityText(item.other!.id) ? <Text style={styles.active}>● {activityText(item.other!.id)}</Text> : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          people.length ? (
            <View>
              <Text style={styles.heading}>Iniciar conversa</Text>
              {people.map((u) => (
                <Pressable key={u.id} style={styles.row} onPress={() => start(u.id)}>
                  <Avatar uri={u.avatar} size={54} />
                  <View style={{ flex: 1 }}>
                    <UserName user={u} />
                    <Text style={styles.preview}>{u.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !people.length ? <Text style={styles.empty}>Nenhuma conversa. Pesquise alguém para começar.</Text> : undefined
        }
      />
      {broadcast.on ? (
        <View style={styles.composer}>
          <TextInput
            placeholder={`Mensagem para ${broadcast.count} ${broadcast.count === 1 ? 'apoiador' : 'apoiadores'}...`}
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            multiline
          />
          {draft.trim() ? (
            <Pressable onPress={sendToSupporters} hitSlop={8} style={styles.send} accessibilityLabel="Enviar para apoiadores">
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 38,
    margin: spacing.lg,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, gap: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'center', margin: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingLeft: spacing.lg, paddingRight: 6, minHeight: 46 },
  send: { backgroundColor: colors.primary, borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontWeight: '700', fontSize: 16, color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  preview: { color: colors.textMuted, marginTop: 2 },
  active: { color: colors.good, fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted, paddingHorizontal: spacing.xl },
}));
