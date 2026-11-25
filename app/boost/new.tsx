// Criar impulsionamento: o político escolhe o que impulsionar, o público, o valor e por quantos dias.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BRAND_BLUE } from '@/components/Logo';
import { useOverlay } from '@/components/Overlay';
import { AGE_RANGES, INTERESTS } from '@/lib/analytics';
import { createBoost, estimateReach, getWallet, isTargeted, KIND_LABEL, money, UFS, useBoostSettings, type BoostFilters, type BoostKind } from '@/lib/boost';
import { compactNumber } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

const AMOUNTS = [20, 50, 100, 200, 500];
const DAYS = [1, 3, 7, 14, 30];
const GENDERS = [
  { key: 'F', label: 'Mulheres' },
  { key: 'M', label: 'Homens' },
  { key: 'O', label: 'Outros' },
];

export default function NewBoost() {
  const params = useLocalSearchParams<{ kind?: BoostKind; id?: string }>();
  const me = useMe();
  const { posts, battles, followersOf } = useApp();
  const { showBanner } = useOverlay();
  const settings = useBoostSettings();

  const [kind, setKind] = useState<BoostKind | null>(params.kind ?? null);
  const [targetId, setTargetId] = useState<string | null>(params.id ?? (params.kind === 'profile' ? me.id : null));
  const [custom, setCustom] = useState(false);
  const [filters, setFilters] = useState<BoostFilters>({});
  const [cityText, setCityText] = useState('');
  const [amount, setAmount] = useState(50);
  const [amountText, setAmountText] = useState('50');
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [wallet, setWallet] = useState(0);
  useEffect(() => {
    getWallet().then(setWallet);
  }, []);

  const myPosts = useMemo(() => posts.filter((p) => p.userId === me.id).sort((a, b) => b.createdAt - a.createdAt), [posts, me.id]);
  const myBattles = useMemo(
    () => battles.filter((b) => b.hostId === me.id && (b.status === 'live' || b.status === 'scheduled')),
    [battles, me.id],
  );

  if (me.accountType !== 'politico') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
        <Text style={styles.muted}>O impulsionamento é só para contas de político.</Text>
      </View>
    );
  }

  const effFilters: BoostFilters = custom
    ? { ...filters, cities: cityText.split(',').map((c) => c.trim()).filter(Boolean) }
    : {};
  const reach = estimateReach(amount, effFilters, settings);
  const tooLow = amount < settings.min_amount;
  const tooHigh = amount > settings.max_amount;

  const toggle = (key: keyof BoostFilters, value: string) =>
    setFilters((f) => {
      const cur = f[key] ?? [];
      return { ...f, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  const setAmountNum = (n: number) => {
    const v = Math.max(0, Math.round(n));
    setAmount(v);
    setAmountText(String(v));
  };

  const submit = async () => {
    if (!kind || !targetId) return showBanner('Escolha o que impulsionar.', { icon: 'alert-circle-outline', tone: 'warning' });
    if (tooLow || tooHigh) return;
    setSaving(true);
    try {
      const id = await createBoost(kind, targetId, amount, days, effFilters);
      router.replace(`/boost/${id}`);
    } catch (e) {
      showBanner((e as Error).message, { icon: 'alert-circle-outline', tone: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  // ---------- passo 1: o que impulsionar ----------
  if (!kind || !targetId) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>O que você quer impulsionar?</Text>
        <Pressable style={styles.option} onPress={() => { setKind('profile'); setTargetId(me.id); }}>
          <Avatar uri={me.avatar} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Meu perfil</Text>
            <Text style={styles.muted}>Para ganhar mais seguidores ({compactNumber(followersOf(me.id).length)} hoje)</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {myBattles.length ? <Text style={styles.h2}>Live ou debate</Text> : null}
        {myBattles.map((b) => (
          <Pressable key={b.id} style={styles.option} onPress={() => { setKind('battle'); setTargetId(b.id); }}>
            <View style={[styles.iconBox, { backgroundColor: colors.like }]}>
              <Ionicons name="radio" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle} numberOfLines={1}>{b.topic || 'Live'}</Text>
              <Text style={styles.muted}>{b.status === 'live' ? 'Ao vivo agora' : `Agendada · ${new Date(b.startsAt).toLocaleString('pt-BR')}`}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        <Text style={styles.h2}>Uma publicação</Text>
        {myPosts.length === 0 ? <Text style={styles.muted}>Você ainda não publicou nada.</Text> : null}
        <View style={styles.grid}>
          {myPosts.map((p) => (
            <Pressable key={p.id} style={styles.cell} onPress={() => { setKind('post'); setTargetId(p.id); }}>
              {p.type === 'text' || !p.uri ? (
                <View style={[styles.cellImg, styles.textCell]}>
                  <Text style={styles.textCellText} numberOfLines={5}>{p.caption}</Text>
                </View>
              ) : (
                <Image source={{ uri: mediaUri(p.thumbnail || p.uri, false) }} style={styles.cellImg} contentFit="cover" />
              )}
              {p.type === 'video' ? <Ionicons name="play" size={16} color="#fff" style={styles.cellPlay} /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ---------- passo 2: público, valor, duração ----------
  const post = kind === 'post' ? posts.find((p) => p.id === targetId) : undefined;
  const battle = kind === 'battle' ? battles.find((b) => b.id === targetId) : undefined;
  const what = kind === 'profile' ? 'Seu perfil' : kind === 'battle' ? battle?.topic || 'Sua live' : post?.caption || 'Sua publicação';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.label}>{KIND_LABEL[kind]}</Text>
        <Text style={styles.optionTitle} numberOfLines={2}>{what}</Text>
        {!params.id ? (
          <Pressable onPress={() => { setKind(null); setTargetId(null); }} hitSlop={8}>
            <Text style={styles.link}>Trocar</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.h2}>Público</Text>
      <View style={styles.segment}>
        <Pressable style={[styles.segBtn, !custom && styles.segOn]} onPress={() => setCustom(false)}>
          <Text style={[styles.segText, !custom && styles.segTextOn]}>Automático</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, custom && styles.segOn]} onPress={() => setCustom(true)}>
          <Text style={[styles.segText, custom && styles.segTextOn]}>Personalizado</Text>
        </Pressable>
      </View>
      {!custom ? (
        <Text style={styles.muted}>Mostramos para quem tem mais chance de se interessar, em todo o Brasil.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Estados</Text>
          <View style={styles.chips}>
            {UFS.map((uf) => (
              <Chip key={uf} label={uf} on={!!filters.states?.includes(uf)} onPress={() => toggle('states', uf)} />
            ))}
          </View>
          <Text style={styles.label}>Cidades (separe por vírgula)</Text>
          <TextInput
            value={cityText}
            onChangeText={setCityText}
            placeholder="Ex.: Recife, Olinda"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Gênero</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => (
              <Chip key={g.key} label={g.label} on={!!filters.genders?.includes(g.key)} onPress={() => toggle('genders', g.key)} />
            ))}
          </View>
          <Text style={styles.label}>Idade</Text>
          <View style={styles.chips}>
            {AGE_RANGES.map((a) => (
              <Chip key={a} label={a} on={!!filters.ages?.includes(a)} onPress={() => toggle('ages', a)} />
            ))}
          </View>
          <Text style={styles.label}>Interesses</Text>
          <View style={styles.chips}>
            {INTERESTS.map((i) => (
              <Chip key={i} label={i} on={!!filters.interests?.includes(i)} onPress={() => toggle('interests', i)} />
            ))}
          </View>
          <Text style={styles.muted}>
            Público personalizado custa {String(settings.targeting_multiplier).replace('.', ',')}x por pessoa. Deixe vazio o que não quiser filtrar.
          </Text>
        </View>
      )}

      <Text style={styles.h2}>Quanto investir</Text>
      <View style={styles.amountRow}>
        <Pressable style={styles.stepBtn} onPress={() => setAmountNum(Math.max(settings.min_amount, amount - 10))}>
          <Ionicons name="remove" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.amountBox}>
          <Text style={styles.amountPrefix}>R$</Text>
          <TextInput
            value={amountText}
            onChangeText={(t) => {
              const clean = t.replace(/[^0-9]/g, '');
              setAmountText(clean);
              setAmount(Number(clean || 0));
            }}
            keyboardType="number-pad"
            style={styles.amountInput}
          />
        </View>
        <Pressable style={styles.stepBtn} onPress={() => setAmountNum(Math.min(settings.max_amount, amount + 10))}>
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {AMOUNTS.filter((a) => a >= settings.min_amount && a <= settings.max_amount).map((a) => (
          <Chip key={a} label={money(a)} on={amount === a} onPress={() => setAmountNum(a)} />
        ))}
      </View>
      {tooLow ? <Text style={styles.warn}>O valor mínimo é {money(settings.min_amount)}.</Text> : null}
      {tooHigh ? <Text style={styles.warn}>O valor máximo é {money(settings.max_amount)}.</Text> : null}

      <Text style={styles.h2}>Por quantos dias</Text>
      <View style={styles.chips}>
        {DAYS.map((d) => (
          <Chip key={d} label={d === 1 ? '1 dia' : `${d} dias`} on={days === d} onPress={() => setDays(d)} />
        ))}
      </View>

      <View style={styles.estimate}>
        <Text style={styles.estimateLabel}>Alcance estimado</Text>
        <Text style={styles.estimateValue}>até {compactNumber(tooLow || tooHigh ? 0 : reach)} pessoas</Text>
        <Text style={styles.muted}>
          {money(amount)} em {days === 1 ? '1 dia' : `${days} dias`} · cada pessoa conta uma vez
          {isTargeted(effFilters) ? ' · público personalizado' : ''}
        </Text>
        <Text style={styles.muted}>Se não alcançar tudo no prazo, a sobra volta como crédito.</Text>
      </View>

      <Pressable style={[styles.payBtn, (saving || tooLow || tooHigh) && { opacity: 0.5 }]} disabled={saving || tooLow || tooHigh} onPress={submit}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Continuar para o pagamento</Text>}
      </Pressable>
      {wallet > 0 ? <Text style={[styles.muted, { textAlign: 'center' }]}>Você tem {money(wallet)} em créditos.</Text> : null}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60, backgroundColor: colors.background, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
    h1: { color: colors.text, fontSize: 20, fontWeight: '800' },
    h2: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
    label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    muted: { color: colors.textMuted, fontSize: 13 },
    warn: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    link: { color: BRAND_BLUE, fontWeight: '700', marginTop: 4 },
    option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md },
    optionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
    iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    cell: { width: '32.5%', aspectRatio: 1 },
    cellImg: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: colors.surface },
    cellPlay: { position: 'absolute', top: 6, right: 6 },
    textCell: { padding: 8, justifyContent: 'center' },
    textCellText: { color: colors.text, fontSize: 12 },
    card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 4 },
    segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
    segOn: { backgroundColor: BRAND_BLUE },
    segText: { color: colors.textMuted, fontWeight: '700' },
    segTextOn: { color: '#fff' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
    chipOn: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
    chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    chipTextOn: { color: '#fff' },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    amountBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 6 },
    amountPrefix: { color: colors.textMuted, fontSize: 20, fontWeight: '700', marginRight: 4 },
    amountInput: { color: colors.text, fontSize: 30, fontWeight: '800', minWidth: 80, textAlign: 'center', paddingVertical: 4 },
    estimate: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 4, marginTop: spacing.sm, borderLeftWidth: 4, borderLeftColor: BRAND_BLUE },
    estimateLabel: { color: colors.textMuted, fontWeight: '700' },
    estimateValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
    payBtn: { backgroundColor: BRAND_BLUE, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm },
    payText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  }),
);
