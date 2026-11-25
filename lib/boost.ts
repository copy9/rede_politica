// Impulsionamento (tráfego pago): só contas de político compram.
// Tudo que importa (preço, alcance, quem vê, quanto já foi entregue) é decidido no banco.
import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export type BoostKind = 'post' | 'profile' | 'battle';
export type BoostStatus = 'pending_payment' | 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected' | 'canceled';
export type BoostFilters = { states?: string[]; cities?: string[]; genders?: string[]; ages?: string[]; interests?: string[] };

export type BoostSettings = {
  price_per_thousand: number;
  targeting_multiplier: number;
  min_amount: number;
  max_amount: number;
  feed_every: number;
  reels_every: number;
  auto_approve: boolean;
};

export type BoostCampaign = {
  id: string;
  user_id: string;
  target_kind: BoostKind;
  target_id: string;
  amount: number;
  reach_goal: number;
  delivered: number;
  clicks: number;
  follows: number;
  days: number;
  filters: BoostFilters;
  status: BoostStatus;
  starts_at: string | null;
  ends_at: string | null;
  paid_at: string | null;
  paid_with: string | null;
  pix_qr_base64: string | null;
  pix_copy_paste: string | null;
  refunded_credit: number;
  reject_reason: string | null;
  created_at: string;
};

export const STATUS_LABEL: Record<BoostStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  pending_review: 'Em análise',
  active: 'No ar',
  paused: 'Pausada',
  completed: 'Concluída',
  rejected: 'Recusada',
  canceled: 'Cancelada',
};
export const STATUS_COLOR: Record<BoostStatus, string> = {
  pending_payment: '#F59E0B',
  pending_review: '#F59E0B',
  active: '#16A34A',
  paused: '#6B7280',
  completed: '#1082EE',
  rejected: '#DC2626',
  canceled: '#6B7280',
};
export const KIND_LABEL: Record<BoostKind, string> = { post: 'Publicação', profile: 'Perfil', battle: 'Live / debate' };

export const money = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;

export const DEFAULT_SETTINGS: BoostSettings = {
  price_per_thousand: 10,
  targeting_multiplier: 1.5,
  min_amount: 10,
  max_amount: 1000,
  feed_every: 7,
  reels_every: 5,
  auto_approve: true,
};

export function isTargeted(f: BoostFilters) {
  return !!(f.states?.length || f.cities?.length || f.genders?.length || f.ages?.length || f.interests?.length);
}
/** mesmo cálculo do banco: valor ÷ preço por mil (público personalizado custa mais) */
export function estimateReach(amount: number, filters: BoostFilters, s: BoostSettings) {
  const per = s.price_per_thousand * (isTargeted(filters) ? s.targeting_multiplier : 1);
  return Math.max(1, Math.floor((amount / per) * 1000));
}

// ---------- configurações ----------
let settingsCache: BoostSettings | null = null;
export async function getBoostSettings(force = false): Promise<BoostSettings> {
  if (settingsCache && !force) return settingsCache;
  const { data } = await supabase.from('boost_settings').select('*').eq('id', 1).maybeSingle();
  settingsCache = data ? { ...DEFAULT_SETTINGS, ...(data as Partial<BoostSettings>) } : DEFAULT_SETTINGS;
  // números do banco chegam como texto
  settingsCache = Object.fromEntries(
    Object.entries(settingsCache).map(([k, v]) => [k, typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : v]),
  ) as BoostSettings;
  return settingsCache;
}
export function useBoostSettings() {
  const [s, setS] = useState<BoostSettings>(settingsCache ?? DEFAULT_SETTINGS);
  useEffect(() => {
    getBoostSettings().then(setS);
  }, []);
  return s;
}

// ---------- campanhas do político ----------
const num = (c: Record<string, unknown>) =>
  ({ ...c, amount: Number(c.amount), refunded_credit: Number(c.refunded_credit ?? 0) }) as unknown as BoostCampaign;

export async function createBoost(kind: BoostKind, targetId: string, amount: number, days: number, filters: BoostFilters) {
  const { data, error } = await supabase.rpc('create_boost', { p_kind: kind, p_target: targetId, p_amount: amount, p_days: days, p_filters: filters });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getCampaign(id: string) {
  const { data } = await supabase.from('boost_campaigns').select('*').eq('id', id).maybeSingle();
  return data ? num(data) : null;
}

export function useMyCampaigns(userId: string) {
  const [list, setList] = useState<BoostCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('boost_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (e) setError('O impulsionamento ainda não está ativo no banco (SQL 0025_impulsionamento.sql).');
    else setError(null);
    setList((data ?? []).map(num));
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);
  return { list, error, reload: load };
}

export async function getWallet(): Promise<number> {
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id;
  if (!me) return 0;
  const { data } = await supabase.from('boost_wallets').select('balance').eq('user_id', me).maybeSingle();
  return Number(data?.balance ?? 0);
}

/** Gera o Pix (QR Code + copia e cola). */
export async function createPix(campaignId: string): Promise<{ qr: string | null; copyPaste: string }> {
  const { data, error } = await supabase.functions.invoke('boost-pay', { body: { action: 'create', campaignId } });
  if (error || !data?.copyPaste) {
    let reason = 'Não deu para gerar o Pix agora.';
    try {
      const body = await (error as { context?: Response })?.context?.json();
      if (body?.error) reason = body.error;
    } catch {
      if (data?.error) reason = data.error;
    }
    throw new Error(reason);
  }
  return { qr: data.qr ?? null, copyPaste: data.copyPaste };
}

/** Confere no Mercado Pago se o Pix já foi pago. */
export async function checkPix(campaignId: string): Promise<BoostStatus | null> {
  const { data } = await supabase.functions.invoke('boost-pay', { body: { action: 'check', campaignId } });
  return (data?.status as BoostStatus) ?? null;
}

export async function payWithCredit(campaignId: string) {
  const { error } = await supabase.rpc('pay_boost_with_credit', { p_campaign: campaignId });
  if (error) throw new Error(error.message);
}

export async function setBoostStatus(campaignId: string, action: 'pause' | 'resume' | 'cancel' | 'stop' | 'approve' | 'reject' | 'mark_paid', reason?: string) {
  const { error } = await supabase.rpc('set_boost_status', { p_campaign: campaignId, p_action: action, p_reason: reason ?? null });
  if (error) throw new Error(error.message);
}

// ---------- entrega (quem vê) ----------
export type BoostSlot = { campaignId: string; kind: BoostKind; targetId: string; userId: string };

/** Pede ao banco os impulsionados para quem está usando o app agora. Sem o SQL, volta vazio. */
export async function fetchBoosts(limit = 5): Promise<BoostSlot[]> {
  const { data, error } = await supabase.rpc('next_boosts', { p_limit: limit });
  if (error || !data) return [];
  return (data as { campaign_id: string; target_kind: BoostKind; target_id: string; user_id: string }[]).map((r) => ({
    campaignId: r.campaign_id,
    kind: r.target_kind,
    targetId: r.target_id,
    userId: r.user_id,
  }));
}

const seen = new Set<string>();
/** A pessoa viu o impulsionado (conta 1 vez por campanha). */
export function boostImpression(campaignId: string) {
  if (seen.has(campaignId)) return;
  seen.add(campaignId);
  supabase.rpc('record_boost_impression', { p_campaign: campaignId }).then(() => {});
}
const evs = new Set<string>();
/** Clicou ou seguiu a partir do impulsionado. */
export function boostEvent(campaignId: string, kind: 'click' | 'follow') {
  const k = `${campaignId}:${kind}`;
  if (evs.has(k)) return;
  evs.add(k);
  supabase.rpc('record_boost_event', { p_campaign: campaignId, p_kind: kind }).then(() => {});
}

/** Lista de impulsionados para um feed (recarrega quando a tela abre). */
export function useBoostSlots(limit = 5) {
  const [slots, setSlots] = useState<BoostSlot[]>([]);
  const [settings, setSettings] = useState<BoostSettings>(settingsCache ?? DEFAULT_SETTINGS);
  const load = useCallback(async () => {
    const [s, b] = await Promise.all([getBoostSettings(), fetchBoosts(limit)]);
    setSettings(s);
    setSlots(b);
  }, [limit]);
  useEffect(() => {
    load();
  }, [load]);
  return { slots, settings, reload: load };
}
