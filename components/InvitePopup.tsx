// Pop-up em qualquer tela: quando alguém te chama para um debate (como lado ou como convidado ao vivo).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

type Invite = { battleId: string; kind: 'lado' | 'convidado' };

export function InvitePopup() {
  const { me, battles, getUser, acceptBattle, declineBattle } = useApp();
  const meId = me?.id;
  const [guestInvites, setGuestInvites] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // convites como participante ao vivo (tabela battle_guests), em tempo real
  useEffect(() => {
    if (!meId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('battle_guests').select('battle_id').eq('user_id', meId).eq('status', 'convidado');
      if (alive) setGuestInvites((data ?? []).map((r: { battle_id: string }) => r.battle_id));
    };
    load();
    const ch = supabase
      .channel(`meus-convites-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_guests', filter: `user_id=eq.${meId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [meId]);

  if (!meId) return null;

  const invites: Invite[] = [
    ...battles.filter((b) => b.status === 'invited' && b.opponentId === meId).map((b) => ({ battleId: b.id, kind: 'lado' as const })),
    ...guestInvites
      .filter((id) => battles.some((b) => b.id === id && b.status !== 'ended'))
      .map((id) => ({ battleId: id, kind: 'convidado' as const })),
  ].filter((i) => !dismissed.includes(i.battleId));

  const current = invites[0];
  const battle = current ? battles.find((b) => b.id === current.battleId) : undefined;
  const host = battle ? getUser(battle.hostId) : undefined;
  if (!current || !battle || !host) return null;

  const close = () => setDismissed((d) => [...d, current.battleId]);
  const accept = async () => {
    close();
    if (current.kind === 'lado') acceptBattle(battle.id);
    else await supabase.from('battle_guests').update({ status: 'accepted' }).eq('battle_id', battle.id).eq('user_id', meId);
    router.push(`/battle/${battle.id}`);
  };
  const decline = async () => {
    close();
    if (current.kind === 'lado') declineBattle(battle.id);
    else await supabase.from('battle_guests').update({ status: 'declined' }).eq('battle_id', battle.id).eq('user_id', meId);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="flash" size={28} color={colors.like} />
          <Avatar uri={host.avatar} size={64} />
          <Text style={styles.title}>{host.name} te chamou para um debate</Text>
          <Text style={styles.topic}>{battle.topic}</Text>
          <Text style={styles.muted}>
            {current.kind === 'lado' ? 'Você será o outro lado do debate.' : 'Você entra ao vivo como convidado.'} Sua câmera só abre se você aceitar.
          </Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: '#374151' }]} onPress={decline}>
              <Text style={styles.btnText}>Recusar</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.like }]} onPress={accept}>
              <Text style={styles.btnText}>Aceitar</Text>
            </Pressable>
          </View>
          <Pressable onPress={close} hitSlop={8}>
            <Text style={styles.later}>Decidir depois</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.background, borderRadius: 18, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  topic: { color: colors.text, fontSize: 15, textAlign: 'center' },
  muted: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignSelf: 'stretch' },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  later: { color: colors.textMuted, fontWeight: '600', marginTop: 4 },
}));
