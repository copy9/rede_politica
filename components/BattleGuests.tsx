// Convidados da batalha: quem não é do debate pede para entrar, quem criou a batalha aceita,
// e os aceitos transmitem câmera e microfone numa grade abaixo do palco.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';
import { colors, spacing, themed } from '@/lib/theme';
import type { User } from '@/lib/types';

export type GuestStatus = 'pending' | 'accepted' | 'declined';
export type GuestRow = { user_id: string; status: GuestStatus };

/** Lista de convidados da batalha, atualizada em tempo real. */
export function useBattleGuests(battleId: string): GuestRow[] {
  const [rows, setRows] = useState<GuestRow[]>([]);
  useEffect(() => {
    if (!battleId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('battle_guests').select('user_id,status').eq('battle_id', battleId);
      if (alive && data) setRows(data as GuestRow[]);
    };
    load();
    const channel = supabase
      .channel(`convidados-${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_guests', filter: `battle_id=eq.${battleId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [battleId]);
  return rows;
}

type Props = {
  battleId: string;
  live: boolean;
  isHost: boolean;
  isParticipant: boolean;
  meId: string;
  users: User[];
  guests: GuestRow[];
  renderTile: (userId: string, isMe: boolean, fallback: React.ReactNode) => React.ReactNode;
  onMessage: (text: string) => void;
};

export function BattleGuestsGrid({ battleId, live, isHost, isParticipant, meId, users, guests, renderTile, onMessage }: Props) {
  const styles = guestStyles;
  const pendingCount = guests.filter((g) => g.status === 'pending').length;
  const prevPending = useRef(0);

  // quem criou a batalha é avisado quando alguém pede para entrar
  useEffect(() => {
    if (isHost && pendingCount > prevPending.current) onMessage('Alguém pediu para entrar na batalha.');
    prevPending.current = pendingCount;
  }, [pendingCount, isHost, onMessage]);

  const mine = guests.find((g) => g.user_id === meId);
  const accepted = guests.filter((g) => g.status === 'accepted');
  const pending = guests.filter((g) => g.status === 'pending');
  const userOf = (id: string) => users.find((u) => u.id === id);

  const askToJoin = async () => {
    const { error } = mine
      ? await supabase.from('battle_guests').update({ status: 'pending' }).eq('battle_id', battleId).eq('user_id', meId)
      : await supabase.from('battle_guests').insert({ battle_id: battleId, user_id: meId, status: 'pending' });
    onMessage(error ? 'Não foi possível pedir agora. Tente de novo.' : 'Pedido enviado. Aguarde quem criou a batalha aceitar.');
  };

  const answer = async (userId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase.from('battle_guests').update({ status }).eq('battle_id', battleId).eq('user_id', userId);
    if (error) onMessage('Não foi possível responder agora.');
  };

  return (
    <View style={styles.wrap}>
      {/* ações de quem assiste: pedir para entrar */}
      {live && !isParticipant && !isHost ? (
        mine?.status === 'accepted' ? (
          <Text style={styles.hint}>Você está no vídeo da batalha.</Text>
        ) : mine?.status === 'pending' ? (
          <Text style={styles.hint}>Pedido enviado. Aguardando aceitação.</Text>
        ) : (
          <Pressable onPress={askToJoin} style={styles.joinBtn} accessibilityLabel="Solicitar entrada na batalha">
            <Text style={styles.joinText}>{mine?.status === 'declined' ? 'Pedir de novo' : 'Solicitar para entrar'}</Text>
          </Pressable>
        )
      ) : null}

      {/* quem criou a batalha decide os pedidos */}
      {isHost && pending.length > 0 ? (
        <View style={styles.pendingBox}>
          {pending.map((g) => {
            const u = userOf(g.user_id);
            return (
              <View key={g.user_id} style={styles.pendingRow}>
                <Avatar uri={u?.avatar ?? ''} size={28} />
                <Text style={styles.pendingName} numberOfLines={1}>{u?.name ?? 'Alguém'} quer entrar</Text>
                <Pressable onPress={() => answer(g.user_id, 'accepted')} style={styles.yes} accessibilityLabel="Aceitar">
                  <Text style={styles.btnText}>Aceitar</Text>
                </Pressable>
                <Pressable onPress={() => answer(g.user_id, 'declined')} style={styles.no} accessibilityLabel="Recusar">
                  <Text style={styles.btnText}>Recusar</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* grade com quem está transmitindo */}
      {accepted.length > 0 ? (
        <View style={styles.grid}>
          {accepted.map((g) => {
            const u = userOf(g.user_id);
            const fallback = (
              <View style={styles.fallback}>
                <Avatar uri={u?.avatar ?? ''} size={56} />
                <Text style={styles.tileName} numberOfLines={1}>{u?.name ?? ''}</Text>
              </View>
            );
            return (
              <View key={g.user_id} style={styles.tile}>
                {live ? renderTile(g.user_id, g.user_id === meId, fallback) : fallback}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const guestStyles = themed(() => StyleSheet.create({
  wrap: { backgroundColor: '#0B1020', paddingBottom: spacing.xs },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', paddingVertical: spacing.xs },
  joinBtn: { alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 8, marginVertical: spacing.xs },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingBox: { marginHorizontal: spacing.md, marginVertical: spacing.xs, gap: 6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 6 },
  pendingName: { flex: 1, color: '#fff', fontSize: 13 },
  yes: { backgroundColor: '#2563EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  no: { backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '50%', aspectRatio: 4 / 3, padding: 2 },
  fallback: { flex: 1, backgroundColor: '#111827', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tileName: { color: '#fff', fontSize: 12, maxWidth: '90%' },
}));
