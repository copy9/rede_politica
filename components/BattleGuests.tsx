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

/** Aceita/recusa e confere no banco se mudou mesmo (se as regras do banco bloquearem, avisa em vez de fingir que deu certo). */
export async function answerGuestChecked(battleId: string, userId: string, status: 'accepted' | 'declined') {
  const { data, error } = await supabase
    .from('battle_guests')
    .update({ status })
    .eq('battle_id', battleId)
    .eq('user_id', userId)
    .select('status');
  if (error) return { error: error.message };
  if (!data || data.length === 0 || data[0].status !== status) return { error: 'o banco não deixou mudar o pedido (só quem criou a live pode aceitar).' };
  return { error: null };
}

// ---------- controle do anfitrião (microfone e câmera dos participantes) ----------
export type ModerationRow = { user_id: string; mic_off: boolean; cam_off: boolean };

/** Quem o anfitrião silenciou ou teve a câmera desligada nesta live (atualiza em tempo real). */
export function useBattleModeration(battleId: string): ModerationRow[] {
  const [rows, setRows] = useState<ModerationRow[]>([]);
  useEffect(() => {
    if (!battleId) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from('battle_moderation').select('user_id,mic_off,cam_off').eq('battle_id', battleId);
      if (alive && !error && data) setRows(data as ModerationRow[]);
    };
    load();
    const poll = setInterval(load, 4000);
    const channel = supabase
      .channel(`moderacao-${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_moderation', filter: `battle_id=eq.${battleId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [battleId]);
  return rows;
}

/** Anfitrião liga/desliga o microfone ou a câmera de um participante. */
export async function setModeration(battleId: string, userId: string, patch: { mic_off?: boolean; cam_off?: boolean }) {
  const { error } = await supabase
    .from('battle_moderation')
    .upsert({ battle_id: battleId, user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'battle_id,user_id' });
  return error ? (/battle_moderation|schema cache/i.test(error.message) ? 'rode o SQL 0026 no Supabase para usar esse controle.' : error.message) : null;
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
    const poll = setInterval(load, 4000);
    const channel = supabase
      .channel(`convidados-${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_guests', filter: `battle_id=eq.${battleId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      clearInterval(poll);
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
  const [answered, setAnswered] = useState<string[]>([]);
  const pending = guests.filter((g) => g.status === 'pending' && !answered.includes(g.user_id));
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
    setAnswered((a) => [...a, userId]);
    const { error } = await answerGuestChecked(battleId, userId, status);
    if (error) {
      setAnswered((a) => a.filter((u) => u !== userId));
      onMessage(`Não foi possível responder: ${error}`);
    } else if (status === 'accepted') onMessage('Aceito! A câmera da pessoa entra na live em alguns segundos.');
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
  wrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 6, alignItems: 'center' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingVertical: 5, paddingLeft: 6, paddingRight: 6, maxWidth: '100%' },
  pendingName: { flexShrink: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  yes: { backgroundColor: '#2563EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  no: { backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waitingText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', paddingVertical: 4 },
}));
