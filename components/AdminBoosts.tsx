// Admin > Impulsionamento: faturamento, preços/regras e campanhas (aprovar, recusar, confirmar pagamento).
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BRAND_BLUE } from '@/components/Logo';
import { useOverlay } from '@/components/Overlay';
import { getBoostSettings, KIND_LABEL, money, setBoostStatus, STATUS_COLOR, STATUS_LABEL, type BoostCampaign, type BoostSettings } from '@/lib/boost';
import { compactNumber } from '@/lib/format';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { colors, spacing, themed } from '@/lib/theme';

type Revenue = { today: number; month: number; total: number; active: number; pending_review: number };
type Filter = 'pending_review' | 'pending_payment' | 'active' | 'all';

export function AdminBoosts() {
  const { getUser } = useApp();
  const { showBanner, confirm } = useOverlay();
  const [rev, setRev] = useState<Revenue | null>(null);
  const [cfg, setCfg] = useState<Record<keyof BoostSettings, string> | null>(null);
  const [autoApprove, setAutoApprove] = useState(true);
  const [list, setList] = useState<(BoostCampaign & { owner?: { name: string; username: string } })[]>([]);
  const [filter, setFilter] = useState<Filter>('pending_review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([supabase.rpc('admin_boost_revenue'), getBoostSettings(true)]);
    if (r.error) setError('O impulsionamento ainda não está ativo no banco (rode o SQL 0025_impulsionamento.sql).');
    else {
      setError(null);
      const row = (Array.isArray(r.data) ? r.data[0] : r.data) as Record<string, unknown> | undefined;
      if (row) setRev({ today: Number(row.today), month: Number(row.month), total: Number(row.total), active: Number(row.active), pending_review: Number(row.pending_review) });
    }
    setCfg(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as Record<keyof BoostSettings, string>);
    setAutoApprove(!!s.auto_approve);
    let q = supabase.from('boost_campaigns').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    const rows = (data ?? []) as BoostCampaign[];
    // nome de quem comprou
    const ids = [...new Set(rows.map((c) => c.user_id))];
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, name, username').in('id', ids) : { data: [] };
    const byId = new Map((profs ?? []).map((p: { id: string; name: string; username: string }) => [p.id, p]));
    setList(rows.map((c) => ({ ...c, amount: Number(c.amount), owner: byId.get(c.user_id) ?? getUser(c.user_id) })));
    setLoading(false);
  }, [filter, getUser]);
  useEffect(() => {
    load();
  }, [load]);

  const saveCfg = async () => {
    if (!cfg) return;
    const n = (k: keyof BoostSettings) => Number(String(cfg[k]).replace(',', '.'));
    const patch = {
      price_per_thousand: n('price_per_thousand'),
      targeting_multiplier: n('targeting_multiplier'),
      min_amount: n('min_amount'),
      max_amount: n('max_amount'),
      feed_every: Math.round(n('feed_every')),
      reels_every: Math.round(n('reels_every')),
      auto_approve: autoApprove,
      updated_at: new Date().toISOString(),
    };
    if (Object.values(patch).some((v) => typeof v === 'number' && (!isFinite(v) || v <= 0)))
      return showBanner('Confira os números: todos precisam ser maiores que zero.', { icon: 'alert-circle-outline', tone: 'warning' });
    const { error: e } = await supabase.from('boost_settings').update(patch).eq('id', 1);
    if (e) return showBanner(`Erro: ${e.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    await getBoostSettings(true);
    showBanner('Regras do impulsionamento salvas.', { icon: 'checkmark-circle', tone: 'success' });
  };

  const act = async (c: BoostCampaign, action: 'approve' | 'reject' | 'mark_paid') => {
    try {
      await setBoostStatus(c.id, action, action === 'reject' ? 'Conteúdo fora das regras da plataforma' : undefined);
      showBanner(action === 'approve' ? 'Aprovado: já está no ar.' : action === 'reject' ? 'Recusado: o valor voltou como crédito.' : 'Pagamento confirmado.', {
        icon: 'checkmark-circle',
        tone: 'success',
      });
      load();
    } catch (e) {
      showBanner((e as Error).message, { icon: 'alert-circle-outline', tone: 'warning' });
    }
  };

  const field = (k: keyof BoostSettings, label: string, suffix?: string) => (
    <View style={styles.field} key={k}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={cfg?.[k] ?? ''}
          onChangeText={(t) => setCfg((c) => (c ? { ...c, [k]: t } : c))}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        {suffix ? <Text style={styles.muted}>{suffix}</Text> : null}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {error ? <Text style={styles.warn}>{error}</Text> : null}

      <Text style={styles.groupTitle}>Faturamento</Text>
      <View style={styles.grid}>
        <Tile label="Hoje" value={money(rev?.today ?? 0)} />
        <Tile label="Este mês" value={money(rev?.month ?? 0)} />
        <Tile label="Total" value={money(rev?.total ?? 0)} />
        <Tile label="No ar agora" value={String(rev?.active ?? 0)} />
      </View>

      <Text style={styles.groupTitle}>Regras e preços</Text>
      {cfg ? (
        <View style={styles.card}>
          {field('price_per_thousand', 'Preço por mil pessoas alcançadas', 'R$')}
          {field('targeting_multiplier', 'Público personalizado custa (vezes o preço)', 'x')}
          {field('min_amount', 'Valor mínimo', 'R$')}
          {field('max_amount', 'Valor máximo', 'R$')}
          {field('feed_every', 'No feed: 1 impulsionado a cada', 'posts')}
          {field('reels_every', 'Nos vídeos: 1 impulsionado a cada', 'vídeos')}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>Vai ao ar sozinho depois de pago</Text>
              <Text style={styles.muted}>Desligado: cada campanha espera você aprovar aqui.</Text>
            </View>
            <Switch value={autoApprove} onValueChange={setAutoApprove} />
          </View>
          <Pressable style={styles.saveBtn} onPress={saveCfg}>
            <Text style={styles.saveText}>Salvar regras</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator />
      )}

      <Text style={styles.groupTitle}>Campanhas</Text>
      <View style={styles.filters}>
        {(
          [
            ['pending_review', `Para aprovar${rev?.pending_review ? ` (${rev.pending_review})` : ''}`],
            ['pending_payment', 'Aguardando pagamento'],
            ['active', 'No ar'],
            ['all', 'Todas'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[styles.chip, filter === k && styles.chipOn]}>
            <Text style={[styles.chipText, filter === k && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {!loading && list.length === 0 ? <Text style={styles.muted}>Nenhuma campanha aqui.</Text> : null}
      {list.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.status, { backgroundColor: STATUS_COLOR[c.status] }]}>
              <Text style={styles.statusText}>{STATUS_LABEL[c.status]}</Text>
            </View>
            <Text style={styles.muted}>{KIND_LABEL[c.target_kind]}</Text>
          </View>
          <Pressable onPress={() => c.owner && router.push(`/user/${c.owner.username}`)}>
            <Text style={styles.text}>
              {c.owner?.name ?? 'Político'} {c.owner ? <Text style={styles.muted}>@{c.owner.username}</Text> : null}
            </Text>
          </Pressable>
          <Text style={styles.muted}>
            {money(c.amount)} · {c.days} dias · até {compactNumber(c.reach_goal)} pessoas · entregue {compactNumber(c.delivered)}
          </Text>
          <Text style={styles.muted}>Criada em {new Date(c.created_at).toLocaleString('pt-BR')}</Text>
          {c.target_kind === 'post' ? (
            <Pressable onPress={() => router.push(`/post/${c.target_id}`)}>
              <Text style={styles.link}>Ver publicação</Text>
            </Pressable>
          ) : c.target_kind === 'battle' ? (
            <Pressable onPress={() => router.push(`/battle/${c.target_id}`)}>
              <Text style={styles.link}>Ver live</Text>
            </Pressable>
          ) : null}
          <View style={styles.row}>
            {c.status === 'pending_review' ? (
              <>
                <Pressable style={[styles.btn, { backgroundColor: '#16A34A' }]} onPress={() => act(c, 'approve')}>
                  <Text style={styles.btnText}>Aprovar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: '#991B1B' }]}
                  onPress={() => confirm('Recusar impulsionamento?', 'O valor pago volta como crédito para o político.', 'Recusar', () => act(c, 'reject'), true)}>
                  <Text style={styles.btnText}>Recusar</Text>
                </Pressable>
              </>
            ) : null}
            {c.status === 'pending_payment' ? (
              <Pressable
                style={[styles.btn, { backgroundColor: '#4B5563' }]}
                onPress={() => confirm('Confirmar pagamento?', 'Use só se o dinheiro já caiu na conta (ex.: Pix fora do app).', 'Confirmar', () => act(c, 'mark_paid'))}>
                <Text style={styles.btnText}>Confirmar pagamento</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
    groupTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { width: '48.5%', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 2 },
    tileValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
    card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
    field: { gap: 4 },
    label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 15 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    saveBtn: { backgroundColor: BRAND_BLUE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    saveText: { color: '#fff', fontWeight: '800' },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
    chipOn: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
    chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    statusText: { color: '#fff', fontWeight: '800', fontSize: 11 },
    text: { color: colors.text, fontSize: 15, fontWeight: '600' },
    muted: { color: colors.textMuted, fontSize: 13 },
    warn: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    link: { color: BRAND_BLUE, fontWeight: '700' },
    btn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
  }),
);
