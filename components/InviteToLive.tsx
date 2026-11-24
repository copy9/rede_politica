// "Chamar" na live: o anfitrião escolhe alguém (quem ele segue aparece primeiro) e a pessoa recebe o convite na hora.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { useOverlay } from '@/components/Overlay';
import { useApp, useMe } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/lib/theme';

export function InviteToLive({
  battleId,
  visible,
  onClose,
  exclude,
}: {
  battleId: string;
  visible: boolean;
  onClose: () => void;
  /** quem já está na live */
  exclude: string[];
}) {
  const me = useMe();
  const { users, followingOf } = useApp();
  const { showBanner } = useOverlay();
  const [q, setQ] = useState('');
  const [sent, setSent] = useState<string[]>([]);

  const list = useMemo(() => {
    const following = followingOf(me.id);
    const fIds = new Set(following.map((u) => u.id));
    const all = [...following, ...users.filter((u) => !fIds.has(u.id))].filter((u) => u.id !== me.id && !exclude.includes(u.id));
    const t = q.trim().toLowerCase();
    return (t ? all.filter((u) => u.name.toLowerCase().includes(t) || u.username.toLowerCase().includes(t)) : all).slice(0, 60);
  }, [users, followingOf, me.id, exclude, q]);

  const invite = async (userId: string, name: string) => {
    setSent((s) => [...s, userId]);
    const { data, error } = await supabase.rpc('invite_to_live', { p_battle: battleId, p_user: userId });
    if (error) {
      setSent((s) => s.filter((x) => x !== userId));
      return showBanner(`Não deu para chamar: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    }
    showBanner(data === 'ja_esta' ? `${name} já está na live.` : `Convite enviado para ${name}. Quando aceitar, entra na live.`, {
      icon: 'person-add',
      tone: 'success',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Chamar para a live</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar pessoa"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <FlatList
            data={list}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Ninguém encontrado.</Text>}
            renderItem={({ item: u }) => {
              const done = sent.includes(u.id);
              return (
                <View style={styles.row}>
                  <Avatar uri={u.avatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                    <Text style={styles.user} numberOfLines={1}>@{u.username}</Text>
                  </View>
                  <Pressable disabled={done} onPress={() => invite(u.id, u.name)} style={[styles.btn, done && styles.btnDone]}>
                    <Text style={styles.btnText}>{done ? 'Chamado' : 'Chamar'}</Text>
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { height: '70%', backgroundColor: '#111827', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 15 },
  empty: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 8 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15 },
  user: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  btn: { backgroundColor: '#F43F5E', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  btnDone: { backgroundColor: '#4B5563' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
