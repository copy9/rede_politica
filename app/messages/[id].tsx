import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { UserName } from '@/components/UserName';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { conversations, conversationMessages, getUser, sendMessage, canInteract, activityText } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const conversation = conversations.find((c) => c.id === id);
  const other = getUser(conversation?.participantIds.find((p) => p !== me.id) ?? '');
  const messages = [...conversationMessages(id)].reverse();

  const send = () => {
    if (!text.trim()) return;
    sendMessage(id, text);
    setText('');
  };

  if (!conversation || !other) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable style={styles.title} onPress={() => router.push(`/user/${other.username}`)}>
              <Avatar uri={other.avatar} size={30} />
              <View>
                <UserName user={other} />
                <Text style={styles.subtitle}>{activityText(other.id) ?? other.name}</Text>
              </View>
            </Pressable>
          ),
        }}
      />
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: 6 }}
        renderItem={({ item }) => {
          const mine = item.senderId === me.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={{ color: mine ? colors.white : colors.text }}>{item.text}</Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.intro}>
            <Avatar uri={other.avatar} size={84} />
            <UserName user={other} size={18} />
            <Text style={styles.subtitle}>{[other.name, other.role].filter(Boolean).join(' • ')}</Text>
            <Pressable style={styles.viewProfile} onPress={() => router.push(`/user/${other.username}`)}>
              <Text style={styles.viewProfileText}>Ver perfil</Text>
            </Pressable>
          </View>
        }
      />
      {!canInteract(other.id, 'message') ? (
        <Text style={[styles.limited, { marginBottom: Math.max(insets.bottom, spacing.md) }]}>
          @{other.username} não está recebendo mensagens de você.
        </Text>
      ) : (
      <View style={[styles.composer, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          placeholder="Mensagem..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          style={styles.input}
          multiline
        />
        {text.trim() ? (
          <Pressable onPress={send} hitSlop={8} style={styles.send} accessibilityLabel="Enviar">
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 12 },
  limited: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  intro: { alignItems: 'center', gap: 4, paddingVertical: spacing.xl },
  viewProfile: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8 },
  viewProfileText: { fontWeight: '600', color: colors.text },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    minHeight: 46,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, maxHeight: 110, paddingVertical: 10 },
  send: { backgroundColor: colors.primary, borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
}));
