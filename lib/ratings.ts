// Notas das lives (1 a 5 estrelas). Funciona mesmo antes do SQL 0021 ser rodado (aí fica tudo neutro).
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';

type Totals = Record<string, { total: number; votes: number }>;
let totals: Totals = {};
let mine: Record<string, number> = {};
let loadedAt = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadRatings(force = false) {
  if (!force && Date.now() - loadedAt < 60_000) return;
  loadedAt = Date.now();
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id;
  const [t, m] = await Promise.all([
    supabase.from('live_rating_totals').select('user_id, total, votes'),
    me ? supabase.from('battle_ratings').select('battle_id, stars').eq('user_id', me) : Promise.resolve({ data: [] }),
  ]);
  if (!t.error && t.data) totals = Object.fromEntries((t.data as { user_id: string; total: number; votes: number }[]).map((r) => [r.user_id, { total: r.total, votes: r.votes }]));
  if (m.data) mine = Object.fromEntries((m.data as { battle_id: string; stars: number }[]).map((r) => [r.battle_id, r.stars]));
  emit();
}

/** Dá (ou troca) a nota de uma live. Devolve uma mensagem de erro, ou null se deu certo. */
export async function rateBattle(battleId: string, stars: number): Promise<string | null> {
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id;
  if (!me) return 'Entre na sua conta para dar nota.';
  mine = { ...mine, [battleId]: stars };
  emit();
  const { error } = await supabase.from('battle_ratings').upsert({ battle_id: battleId, user_id: me, stars }, { onConflict: 'battle_id,user_id' });
  if (error) return 'Não deu para salvar a nota agora.';
  loadRatings(true);
  return null;
}

/**
 * Média "com cautela" (começa em 3 estrelas e vai mudando conforme chegam notas),
 * para 1 nota isolada não decidir tudo.
 */
export function ratingAverage(userId: string) {
  const r = totals[userId];
  return ((r?.total ?? 0) + 3 * 5) / ((r?.votes ?? 0) + 5);
}

/** Pontos de score vindos das notas: cada nota acima de 3 estrelas soma, abaixo de 3 desconta. */
export function ratingPoints(userId: string) {
  const r = totals[userId];
  return r ? (r.total - 3 * r.votes) * 6 : 0;
}

/** Impulso da próxima live: 1 = neutro (sem notas / média 3), até ~1,67 com média 5, até ~0,33 com média 1. */
export function liveBoost(userId: string) {
  return ratingAverage(userId) / 3;
}

/** lives que a pessoa assistiu nesta sessão (para pedir a nota quando terminarem) */
const watched = new Set<string>();
export function markWatched(battleId: string) {
  if (watched.has(battleId)) return;
  watched.add(battleId);
  emit();
}
/** saiu da live antes dela acabar: não pede nota (a pessoa não estava mais vendo) */
export function unmarkWatched(battleId: string) {
  if (watched.delete(battleId)) emit();
}
export function watchedLives() {
  return watched;
}

export function myRating(battleId: string) {
  return mine[battleId];
}

/** Usa as notas na tela (atualiza quando chegam notas novas). */
export function useRatings() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => totals,
  );
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mine,
  );
  useEffect(() => {
    loadRatings();
  }, []);
}
