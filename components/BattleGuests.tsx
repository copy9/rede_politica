// Convidados da batalha: controles de pedidos e de espera.
// Os quadradinhos de vídeo ficam no grid da própria tela da batalha, todos do mesmo tamanho.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';
import { spacing, themed } from '@/lib/theme';
import type { User } from '@/lib/types';

export type GuestStatus = 'convidado' | 'pending' | 'accepted' | 'declined';
export type GuestRow = { user_id: string; status: GuestStatus };

/** Quem foi convidado responde ao convite: aceita (entra no vídeo) ou recusa. */
export function answerGuestInvite(battleId: string, userId: string, status: 'accepted' | 'declined') {
  return supabase.from('battle_guests').update({ status }).eq('battle_id', battleId).eq('user_id', userId);
}

/** Quem assiste pede para entrar. Devolve a mensagem para mostrar ao usuário. */
export async function requestToJoin(battleId: string, meId: string, mine?: GuestStatus): Promise<string | null> {
  if (mine === 'pending') return null;
  const { error } = mine
    ? await supabase.from('battle_guests').update({ status: 'pending' }).eq('battle_id', battleId).eq('user_id', meId)
    : await supabase.from('battle_guests').insert({ battle_id: battleId, user_id: meId, status: 'pending' });
  return error ? 'Não foi possível pedir agora. Tente de novo.' : 'Pedido enviado. Aguarde quem criou a batalha aceitar.';
}

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
  isHost: boolean;
  users: User[];
  guests: GuestRow[];
  onMessage: (text: string) => void;
};

/** Controles de quem criou a batalha: aceitar ou recusar pedidos, e ver quem ainda não respondeu. */
export function BattleGuestsControls({ battleId, isHost, users, guests, onMessage }: Props) {
  const styles = guestStyles;
  const pending = guests.filter((g) => g.status === 'pending');
  const invited = guests.filter((g) => g.status === 'convidado');
  const pendingCount = pending.length;
  const prevPending = useRef(0);

  // quem criou a batalha é avisado quando alguém pede para entrar
  useEffect(() => {
    if (isHost && pendingCount > prevPending.current) onMessage('Alguém pediu para entrar na batalha.');
    prevPending.current = pendingCount;
  }, [pendingCount, isHost, onMessage]);

  const userOf = (id: string) => users.find((u) => u.id === id);

  const answer = async (userId: string, status: 'accepted' | 'declined') => {
    const { error } = await answerGuestInvite(battleId, userId, status);
    if (error) onMessage('Não foi possível responder agora.');
  };

  if (!isHost || (pending.length === 0 && invited.length === 0)) return null;

  return (
    <View style={styles.wrap}>
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
      {invited.length > 0 ? (
        <Text style={styles.waitingText}>
          Aguardando {invited.map((g) => userOf(g.user_id)?.name ?? 'convidado').join(', ')} aceitar participar
        </Text>
      ) : null}
    </View>
  );
}

const guestStyles = themed(() => StyleSheet.create({
  wrap: { backgroundColor: '#0B1020', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 6 },
  pendingName: { flex: 1, color: '#fff', fontSize: 13 },
  yes: { backgroundColor: '#2563EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  no: { backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waitingText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', paddingVertical: 4 },
}));
