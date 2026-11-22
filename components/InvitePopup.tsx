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
// o pop-up só aparece na hora do convite (até 2 minutos depois), não fica voltando depois
const FRESH_MS = 5 * 60 * 1000;

export function InvitePopup() {
  const { me, battles, getUser, acceptBattle, declineBattle, refreshBattle } = useApp();
  const meId = me?.id;
  const [guestInvites, setGuestInvites] = useState<{ id: string; at: number }[]>([]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // quem convidou pode ser uma conta nova que o app ainda não carregou: busca nome e foto direto
  const [hosts, setHosts] = useState<Record<string, { name: string; avatar: string }>>({});

  // convites como participante ao vivo (tabela battle_guests), em tempo real
  useEffect(() => {
    if (!meId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('battle_guests').select('battle_id, created_at').eq('user_id', meId).eq('status', 'convidado');
      if (!alive) return;
      const rows = (data ?? []) as { battle_id: string; created_at: string }[];
      setGuestInvites(rows.map((r) => ({ id: r.battle_id, at: new Date(r.created_at).getTime() })));
      // a live do convite precisa estar na lista do app para o pop-up aparecer (sem fechar e abrir o app)
      rows.forEach((r) => refreshBattle(r.battle_id));
    };
    load();
    // além do tempo real, confere no banco a cada 8 segundos se chegou convite (caso o aviso em tempo real falhe)
    const poll = setInterval(async () => {
      load();
      const since = new Date(Date.now() - FRESH_MS).toISOString();
      const { data } = await supabase.from('battles').select('id').eq('opponent_id', meId).eq('status', 'invited').gte('created_at', since);
      (data ?? []).forEach((b: { id: string }) => refreshBattle(b.id));
    }, 8000);
    const ch = supabase
      .channel(`meus-convites-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_guests', filter: `user_id=eq.${meId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [meId, refreshBattle]);

  // busca nome e foto de quem convidou, se o app ainda não tiver essa conta
  useEffect(() => {
    const ids = battles
      .filter((b) => (b.status === 'invited' && b.opponentId === meId) || guestInvites.some((g) => g.id === b.id))
      .map((b) => b.hostId)
      .filter((id) => !getUser(id) && !(id in hosts));
    if (!ids.length) return;
    setHosts((h) => Object.fromEntries([...Object.entries(h), ...ids.map((id) => [id, { name: '', avatar: '' }])]));
    supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', ids)
      .then(({ data }) =>
        setHosts((h) => ({ ...h, ...Object.fromEntries((data ?? []).map((p: { id: string; name: string; avatar_url: string | null }) => [p.id, { name: p.name, avatar: p.avatar_url ?? '' }])) })),
      );
  }, [battles, guestInvites, meId, getUser, hosts]);

  if (!meId) return null;

  const now = Date.now();
  const invites: Invite[] = [
    ...battles
      .filter((b) => b.status === 'invited' && b.opponentId === meId && now - b.startsAt < FRESH_MS)
      .map((b) => ({ battleId: b.id, kind: 'lado' as const })),
    ...guestInvites
      .filter((g) => battles.some((b) => b.id === g.id && (b.status === 'live' || (b.status !== 'ended' && now - g.at < FRESH_MS))))
      .map((g) => ({ battleId: g.id, kind: 'convidado' as const })),
  ].filter((i) => !dismissed.includes(i.battleId));

  const current = invites[0];
  const battle = current ? battles.find((b) => b.id === current.battleId) : undefined;
  const hostId = battle?.hostId;
  const host = hostId ? (getUser(hostId) ?? (hosts[hostId]?.name ? hosts[hostId] : undefined)) : undefined;
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
    <Modal transparent animationType="fade" visible onRequestClose={decline}>
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
