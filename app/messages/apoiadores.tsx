// Caixa de mensagem dos apoiadores: tudo o que for escrito aqui vai por direct para todos os apoiadores.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOverlay } from '@/components/Overlay';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function SupportersInbox() {
  const me = useMe();
  const { supportersFor, broadcastToSupporters } = useApp();
  const { settings, update } = useSettings();
  const { showBanner } = useOverlay();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const count = supportersFor(me.id).length;
  const history = settings.supporterBroadcasts ?? [];

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (!count) return showBanner('Você ainda não tem apoiadores.', { icon: 'people-outline', tone: 'warning' });
    setSending(true);
    setText('');
    const n = await broadcastToSupporters(body);
    update({ supporterBroadcasts: [...history, { text: body, at: Date.now(), count: n }].slice(-100) });
    setSending(false);
    showBanner(`Enviada por direct para ${n} ${n === 1 ? 'apoiador' : 'apoiadores'}.`, { icon: 'people', tone: 'success' });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.head}>
        <Ionicons name="people" size={20} color={colors.like} />
        <Text style={styles.headText}>
          Tudo o que você escrever aqui vai por direct para {count} {count === 1 ? 'apoiador' : 'apoiadores'}.
        </Text>
      </View>
      <FlatList
        data={[...history].reverse()}
        inverted
        keyExtractor={(m) => String(m.at)}
        contentContainerStyle={{ padding: spacing.md, gap: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma mensagem enviada ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={{ color: colors.white }}>{item.text}</Text>
            <Text style={styles.meta}>
              {new Date(item.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {item.count}{' '}
              {item.count === 1 ? 'apoiador' : 'apoiadores'}
            </Text>
          </View>
        )}
      />
      <View style={[styles.composer, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          placeholder="Mensagem para os apoiadores..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          style={styles.input}
          multiline
        />
        {text.trim() ? (
          <Pressable onPress={send} hitSlop={8} style={[styles.send, sending && { opacity: 0.5 }]} disabled={sending} accessibilityLabel="Enviar para apoiadores">
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  headText: { flex: 1, color: colors.text },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  bubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 4 },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  composer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingLeft: spacing.lg, paddingRight: 6, minHeight: 46 },
  input: { flex: 1, color: colors.text, fontSize: 15, maxHeight: 110, paddingVertical: 10 },
  send: { backgroundColor: colors.like, borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
}));
