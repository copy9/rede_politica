// Uma campanha de impulsionamento: pagamento por Pix (ou créditos), andamento e controles.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BRAND_BLUE } from '@/components/Logo';
import { useOverlay } from '@/components/Overlay';
import {
  checkPix,
  createPix,
  getCampaign,
  getWallet,
  KIND_LABEL,
  money,
  payWithCredit,
  setBoostStatus,
  STATUS_COLOR,
  STATUS_LABEL,
  type BoostCampaign,
} from '@/lib/boost';
import { compactNumber } from '@/lib/format';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function BoostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, battles } = useApp();
  const { showBanner, confirm } = useOverlay();
  const [c, setC] = useState<BoostCampaign | null | undefined>(undefined);
  const [pix, setPix] = useState<{ qr: string | null; copyPaste: string } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [wallet, setWallet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [camp, w] = await Promise.all([getCampaign(id), getWallet()]);
    setC(camp);
    setWallet(w);
    return camp;
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  // aguardando pagamento: gera o Pix e confere sozinho a cada 5 segundos
  const askedPix = useRef(false);
  useEffect(() => {
    if (c?.status !== 'pending_payment') return;
    if (!askedPix.current) {
      askedPix.current = true;
      if (c.pix_copy_paste) setPix({ qr: c.pix_qr_base64, copyPaste: c.pix_copy_paste });
      else
        createPix(c.id)
          .then(setPix)
          .catch((e) => setPixError((e as Error).message));
    }
    const t = setInterval(async () => {
      const st = await checkPix(c.id);
      if (st && st !== 'pending_payment') {
        load();
        showBanner('Pagamento confirmado!', { icon: 'checkmark-circle', tone: 'success' });
      }
    }, 5000);
    return () => clearInterval(t);
  }, [c?.status, c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (c === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.text} />;
  if (!c)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Campanha não encontrada.</Text>
      </View>
    );

  const post = c.target_kind === 'post' ? posts.find((p) => p.id === c.target_id) : undefined;
  const battle = c.target_kind === 'battle' ? battles.find((b) => b.id === c.target_id) : undefined;
  const what = c.target_kind === 'profile' ? 'Seu perfil' : c.target_kind === 'battle' ? battle?.topic || 'Sua live' : post?.caption || 'Sua publicação';
  const pct = Math.min(100, Math.round((c.delivered / c.reach_goal) * 100));
  const spent = (c.amount * c.delivered) / c.reach_goal;
  const f = c.filters ?? {};
  const audience = [
    f.states?.length ? `Estados: ${f.states.join(', ')}` : '',
    f.cities?.length ? `Cidades: ${f.cities.join(', ')}` : '',
    f.genders?.length ? `Gênero: ${f.genders.map((g) => (g === 'F' ? 'Mulheres' : g === 'M' ? 'Homens' : 'Outros')).join(', ')}` : '',
    f.ages?.length ? `Idade: ${f.ages.join(', ')}` : '',
    f.interests?.length ? `Interesses: ${f.interests.join(', ')}` : '',
  ].filter(Boolean);

  const act = async (action: 'pause' | 'resume' | 'cancel' | 'stop', ok: string) => {
    setBusy(true);
    try {
      await setBoostStatus(c.id, action);
      showBanner(ok, { icon: 'checkmark-circle', tone: 'success' });
      await load();
    } catch (e) {
      showBanner((e as Error).message, { icon: 'alert-circle-outline', tone: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.text} />}>
      <View style={styles.head}>
        <View style={[styles.status, { backgroundColor: STATUS_COLOR[c.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABEL[c.status]}</Text>
        </View>
        <Text style={styles.muted}>{KIND_LABEL[c.target_kind]}</Text>
      </View>
      <Text style={styles.title} numberOfLines={3}>{what}</Text>

      {/* ---------- pagamento ---------- */}
      {c.status === 'pending_payment' ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Pague {money(c.amount)} com Pix</Text>
          {pixError ? (
            <Text style={styles.warn}>{pixError}</Text>
          ) : !pix ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              {pix.qr ? <Image source={{ uri: `data:image/png;base64,${pix.qr}` }} style={styles.qr} contentFit="contain" /> : null}
              <Text style={styles.muted}>Abra o app do seu banco, escolha Pix e leia o QR Code — ou copie o código:</Text>
              <Pressable
                style={styles.copyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(pix.copyPaste);
                  showBanner('Código Pix copiado!', { icon: 'copy-outline', tone: 'success' });
                }}>
                <Ionicons name="copy-outline" size={18} color="#fff" />
                <Text style={styles.copyText}>Copiar código Pix</Text>
              </Pressable>
              <Text style={[styles.muted, { textAlign: 'center' }]}>Assim que o Pix cair, a campanha começa sozinha.</Text>
            </>
          )}
          <Pressable
            style={styles.secondaryBtn}
            onPress={async () => {
              const st = await checkPix(c.id);
              if (st && st !== 'pending_payment') {
                showBanner('Pagamento confirmado!', { icon: 'checkmark-circle', tone: 'success' });
                load();
              } else showBanner('Ainda não recebemos o Pix. Pode levar alguns segundos.', { icon: 'time-outline' });
            }}>
            <Text style={styles.secondaryText}>Já paguei</Text>
          </Pressable>
          {wallet >= c.amount ? (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: BRAND_BLUE }]}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await payWithCredit(c.id);
                  showBanner('Pago com seus créditos!', { icon: 'checkmark-circle', tone: 'success' });
                  await load();
                } catch (e) {
                  showBanner((e as Error).message, { icon: 'alert-circle-outline', tone: 'warning' });
                } finally {
                  setBusy(false);
                }
              }}>
              <Text style={[styles.secondaryText, { color: BRAND_BLUE }]}>Pagar com créditos (saldo {money(wallet)})</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => confirm('Cancelar impulsionamento?', 'Nada foi cobrado ainda.', 'Cancelar', () => act('cancel', 'Cancelado.'), true)}>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}

      {c.status === 'pending_review' ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Pagamento recebido</Text>
          <Text style={styles.muted}>Seu impulsionamento está em análise e vai ao ar assim que for aprovado.</Text>
        </View>
      ) : null}
      {c.status === 'rejected' ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Impulsionamento recusado</Text>
          {c.reject_reason ? <Text style={styles.muted}>Motivo: {c.reject_reason}</Text> : null}
          <Text style={styles.muted}>O valor de {money(c.refunded_credit)} voltou como crédito para usar em outro impulsionamento.</Text>
        </View>
      ) : null}

      {/* ---------- resultados ---------- */}
      {c.paid_at ? (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Alcance</Text>
            <Text style={styles.big}>
              {compactNumber(c.delivered)} <Text style={styles.muted}>de {compactNumber(c.reach_goal)} pessoas</Text>
            </Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.muted}>{pct}% entregue</Text>
          </View>
          <View style={styles.tiles}>
            <Tile label="Cliques" value={compactNumber(c.clicks)} />
            <Tile label="Novos seguidores" value={compactNumber(c.follows)} />
            <Tile label="Investido" value={money(c.amount)} />
            <Tile label="Gasto até agora" value={money(spent)} />
          </View>
          {c.refunded_credit > 0 && c.status === 'completed' ? (
            <Text style={styles.muted}>Sobra de {money(c.refunded_credit)} voltou como crédito.</Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Detalhes</Text>
        <Text style={styles.text}>{money(c.amount)} · {c.days === 1 ? '1 dia' : `${c.days} dias`}</Text>
        <Text style={styles.text}>Público: {audience.length ? audience.join(' · ') : 'Automático'}</Text>
        {c.starts_at ? <Text style={styles.text}>Começou: {new Date(c.starts_at).toLocaleString('pt-BR')}</Text> : null}
        {c.ends_at ? <Text style={styles.text}>Termina: {new Date(c.ends_at).toLocaleString('pt-BR')}</Text> : null}
      </View>

      {c.status === 'active' ? (
        <View style={styles.row}>
          <Pressable style={styles.secondaryBtnFlex} disabled={busy} onPress={() => act('pause', 'Pausado.')}>
            <Text style={styles.secondaryText}>Pausar</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtnFlex}
            disabled={busy}
            onPress={() => confirm('Encerrar agora?', 'O que não foi entregue volta como crédito.', 'Encerrar', () => act('stop', 'Encerrado.'), true)}>
            <Text style={[styles.secondaryText, { color: colors.accent }]}>Encerrar agora</Text>
          </Pressable>
        </View>
      ) : null}
      {c.status === 'paused' ? (
        <View style={styles.row}>
          <Pressable style={[styles.secondaryBtnFlex, { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE }]} disabled={busy} onPress={() => act('resume', 'De volta ao ar.')}>
            <Text style={[styles.secondaryText, { color: '#fff' }]}>Retomar</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtnFlex}
            disabled={busy}
            onPress={() => confirm('Encerrar agora?', 'O que não foi entregue volta como crédito.', 'Encerrar', () => act('stop', 'Encerrado.'), true)}>
            <Text style={[styles.secondaryText, { color: colors.accent }]}>Encerrar agora</Text>
          </Pressable>
        </View>
      ) : null}

      {c.status === 'completed' || c.status === 'rejected' || c.status === 'canceled' ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace({ pathname: '/boost/new', params: { kind: c.target_kind, id: c.target_id } })}>
          <Text style={styles.primaryText}>Impulsionar de novo</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60, backgroundColor: colors.background, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    title: { color: colors.text, fontSize: 18, fontWeight: '800' },
    h2: { color: colors.text, fontSize: 16, fontWeight: '800' },
    label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    muted: { color: colors.textMuted, fontSize: 13 },
    text: { color: colors.text, fontSize: 14 },
    warn: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
    qr: { width: 220, height: 220, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 8 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND_BLUE, borderRadius: 12, paddingVertical: 13 },
    copyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    secondaryBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    secondaryBtnFlex: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    secondaryText: { color: colors.text, fontWeight: '700' },
    primaryBtn: { backgroundColor: BRAND_BLUE, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    big: { color: colors.text, fontSize: 24, fontWeight: '800' },
    bar: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: BRAND_BLUE },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { width: '48.5%', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 4 },
    tileValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
    row: { flexDirection: 'row', gap: spacing.sm },
  }),
);
