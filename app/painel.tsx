import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { SupportersTab } from '@/components/SupportersTab';
import {
  BarList,
  Card,
  ColumnChart,
  Legend,
  SegmentBar,
  SENTIMENT_COLORS,
  SERIES,
  SplitBarList,
  StatTile,
} from '@/components/charts';
import { buildDashboard, type PainelRaw, type Period } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { BoostTab } from '@/components/BoostTab';
import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

type Tab = 'inicio' | 'impulsionar' | 'desempenho' | 'publico' | 'batalhas' | 'apoiadores';
type Metric = 'views' | 'reach' | 'followers';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inicio', label: 'Início' },
  { key: 'desempenho', label: 'Desempenho' },
  { key: 'publico', label: 'Público' },
  { key: 'batalhas', label: 'Batalhas' },
  { key: 'apoiadores', label: 'Apoiadores' },
  { key: 'impulsionar', label: 'Impulsionar' },
];

const EMPTY: PainelRaw = { views: [], follows: [], unfollows: [] };

/** Busca no banco tudo o que o painel precisa (em páginas de 1000 linhas). */
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await query(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function usePainelRaw(meId: string, period: Period) {
  const [raw, setRaw] = useState<PainelRaw>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // período atual + o anterior (para comparar)
    const since = new Date(Date.now() - period * 2 * 86400000).toISOString();
    try {
      const results = await Promise.allSettled([
        fetchAll<PainelRaw['views'][number]>((a, b) =>
          supabase.from('content_views').select('viewer_id, kind, ref_id, created_at').eq('owner_id', meId).gte('created_at', since).order('created_at').range(a, b),
        ),
        fetchAll<PainelRaw['follows'][number]>((a, b) =>
          supabase.from('follows').select('follower_id, created_at').eq('following_id', meId).range(a, b),
        ),
        fetchAll<PainelRaw['unfollows'][number]>((a, b) =>
          supabase.from('follow_events').select('created_at').eq('following_id', meId).eq('kind', 'unfollow').gte('created_at', since).range(a, b),
        ),
      ]);
      const [views, follows, unfollows] = results.map((r) => (r.status === 'fulfilled' ? r.value : [])) as [PainelRaw['views'], PainelRaw['follows'], PainelRaw['unfollows']];
      setRaw({ views, follows, unfollows });
      // as tabelas de visualizações ainda não existem no banco: avisa só o que falta
      if (results.some((r) => r.status === 'rejected'))
        setError('Visualizações, visitas e "deixaram de seguir" começam a contar quando o banco for atualizado (SQL 0019_painel_real.sql).');
    } catch {
      setError('Sem conexão. Puxe para baixo para tentar de novo.');
    } finally {
      setLoading(false);
    }
  }, [meId, period]);
  useEffect(() => {
    load();
  }, [load]);
  return { raw, loading, error, reload: load };
}

const PERIODS: Period[] = [7, 30, 90];

const dayLabel = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

/** Painel do político: estatísticas agregadas do público + banco de apoiadores (com consentimento). */
export default function PainelScreen() {
  const me = useMe();
  const { posts, supportersFor, followersOf, commentsFor, battles, getUser } = useApp();
  const [tab, setTab] = useState<Tab>('inicio');
  const [period, setPeriod] = useState<Period>(30);
  const [metric, setMetric] = useState<Metric>('views');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const openTab = (t: Tab) => {
    setTab(t);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const { raw, loading, error, reload } = usePainelRaw(me.id, period);

  const supporters = useMemo(() => supportersFor(me.id), [supportersFor, me]);
  const followers = useMemo(() => followersOf(me.id), [followersOf, me]);
  // minhas batalhas e lives (as curtidas e apoios que eu recebi em cada uma)
  const myBattles = useMemo(
    () =>
      battles
        .filter((b) => b.hostId === me.id || b.opponentId === me.id)
        .map((b) => ({ b, mine: b.hostId === me.id ? b.scores.host : b.scores.opponent }))
        .sort((x, y) => y.b.startsAt - x.b.startsAt),
    [battles, me.id],
  );
  const d = useMemo(() => {
    const since = Date.now() - period * 86400000;
    return buildDashboard({
      politician: me,
      posts,
      supporters: supporters.length,
      period,
      followers,
      raw,
      commentsOnPost: commentsFor,
      battlePoints: myBattles.filter((x) => x.b.startsAt >= since).reduce((a, x) => a + x.mine, 0),
    });
  }, [me, posts, supporters.length, period, followers, raw, commentsFor, myBattles]);

  if (me.accountType !== 'politico' || !me.verified) {
    return (
      <View style={styles.locked}>
        <Ionicons name="bar-chart-outline" size={48} color={colors.textMuted} />
        <Text style={styles.lockedTitle}>Painel liberado só para perfis verificados</Text>
        <Text style={styles.muted}>Peça o perfil público em Configurações. Depois da aprovação, o painel completo é liberado.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/config/verificacao')}>
          <Text style={styles.primaryBtnText}>Solicitar verificação</Text>
        </Pressable>
      </View>
    );
  }

  const first = d.daily[0]?.date ?? Date.now();
  const last = d.daily[d.daily.length - 1]?.date ?? Date.now();
  const mid = d.daily[Math.floor(d.daily.length / 2)]?.date ?? Date.now();
  const axis = [dayLabel(first), dayLabel(mid), dayLabel(last)];
  const series =
    metric === 'views' ? d.daily.map((x) => x.views) : metric === 'reach' ? d.daily.map((x) => x.reach) : d.daily.map((x) => x.gained - x.lost);
  const metricName = metric === 'views' ? 'visualizações' : metric === 'reach' ? 'contas alcançadas' : 'seguidores líquidos';

  const shareSummary = () =>
    Share.share({
      message:
        `Painel ${me.name} – últimos ${period} dias\n` +
        `Visualizações: ${compactNumber(d.totals.views)}\n` +
        `Alcance: ${compactNumber(d.totals.reach)}\n` +
        `Seguidores: ${compactNumber(d.totals.followers)} (+${compactNumber(d.totals.netFollowers)})\n` +
        `Apoiadores cadastrados: ${d.totals.supporters}`,
    }).catch(() => {});

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Painel do político',
          headerRight: () => (
            <Pressable onPress={shareSummary} hitSlop={8}>
              <Ionicons name="share-social-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      {/* abas roláveis para os lados: nenhum nome fica cortado, mesmo com letra grande */}
      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => openTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab !== t.key && { color: colors.textMuted }]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {tab === 'impulsionar' ? (
        <BoostTab />
      ) : tab === 'apoiadores' ? (
        <SupportersTab supporters={supporters} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading && raw !== EMPTY} onRefresh={reload} tintColor={colors.text} />}>
          {error ? (
            <View style={styles.notice}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.infoText} />
              <Text style={styles.noticeText}>{error}</Text>
            </View>
          ) : null}
          {loading && raw === EMPTY ? <ActivityIndicator color={colors.text} /> : null}
          <View style={styles.periodRow}>
            <Text style={styles.sectionTitle}>
              {tab === 'inicio' ? 'Resumo' : tab === 'desempenho' ? 'Todos os conteúdos' : tab === 'batalhas' ? 'Suas batalhas e lives' : 'Seu público'}
            </Text>
            <View style={styles.periods}>
              {PERIODS.map((p) => (
                <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.period, period === p && styles.periodActive]}>
                  <Text style={[styles.periodText, period === p && { color: colors.background }]}>{p} dias</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {tab === 'inicio' ? (
            <>
              <View style={styles.tiles}>
                <StatTile label="Visualizações" value={compactNumber(d.totals.views)} delta={d.deltas.views} />
                <StatTile label="Seguidores" value={compactNumber(d.totals.followers)} delta={d.deltas.followers} />
                <StatTile label="Seguidores líquidos" value={`+${compactNumber(d.totals.netFollowers)}`} />
                <StatTile label="Apoiadores cadastrados" value={compactNumber(d.totals.supporters)} onPress={() => openTab('apoiadores')} />
              </View>

              <Card title="Visualizações por dia" info={`Últimos ${period} dias · toque numa coluna para ver o dia`}>
                <ColumnChart
                  values={d.daily.map((x) => x.views)}
                  labels={d.daily.map((x) => dayLabel(x.date))}
                  format={(v) => `${compactNumber(v)} visualizações`}
                  axisLabels={axis}
                />
              </Card>

              <Card title="Ferramentas">
                <View style={styles.tools}>
                  <Tool icon="people" label="Público" onPress={() => openTab('publico')} />
                  <Tool icon="trending-up" label="Desempenho" onPress={() => openTab('desempenho')} />
                  <Tool icon="id-card" label="Apoiadores" onPress={() => openTab('apoiadores')} />
                  <Tool icon="flash" label="Batalhas" onPress={() => openTab('batalhas')} />
                  <Tool
                    icon="add-circle"
                    label="Publicar"
                    onPress={() => {
                      // volta para as abas e abre a tela de postar
                      if (router.canDismiss()) router.dismissAll();
                      router.navigate('/(tabs)/create');
                    }}
                  />
                  <Tool icon="calendar" label="Agendar batalha" onPress={() => router.push('/battle/new')} />
                  <Tool icon="rocket" label="Impulsionar" onPress={() => openTab('impulsionar')} />
                </View>
              </Card>
            </>
          ) : null}

          {tab === 'desempenho' ? (
            <>
              <View style={styles.tiles}>
                <StatTile label="Visualizações" value={compactNumber(d.totals.views)} delta={d.deltas.views} selected={metric === 'views'} onPress={() => setMetric('views')} />
                <StatTile label="Contas alcançadas" value={compactNumber(d.totals.reach)} delta={d.deltas.reach} selected={metric === 'reach'} onPress={() => setMetric('reach')} />
                <StatTile label="Seguidores líquidos" value={`+${compactNumber(d.totals.netFollowers)}`} delta={d.deltas.followers} selected={metric === 'followers'} onPress={() => setMetric('followers')} />
                <StatTile label="Visitas ao perfil" value={compactNumber(d.totals.profileVisits)} />
              </View>

              <Card title={`${metricName[0].toUpperCase()}${metricName.slice(1)} por dia`} info="Toque nos quadros acima para trocar o indicador">
                <ColumnChart
                  values={series}
                  labels={d.daily.map((x) => dayLabel(x.date))}
                  format={(v) => `${compactNumber(v)} ${metricName}`}
                  axisLabels={axis}
                />
              </Card>

              <Card title="Visualizações por tipo de conteúdo" info="Quem viu: seus seguidores x pessoas que ainda não seguem você">
                <Legend
                  items={[
                    { label: 'Seguidores', color: SERIES.one },
                    { label: 'Não seguidores', color: SERIES.two },
                  ]}
                />
                <ContentBars rows={d.byContent} />
              </Card>

              <Card title="Interações">
                {d.interactions.map((i) => (
                  <View key={i.label} style={styles.kv}>
                    <Text style={styles.kvLabel}>{i.label}</Text>
                    <Text style={styles.kvValue}>{compactNumber(i.value)}</Text>
                  </View>
                ))}
              </Card>

              <Card title="Termômetro dos comentários" info="Tom geral dos comentários nas suas publicações">
                <SegmentBar
                  parts={[
                    { label: 'Positivos', value: d.sentiment.positive, color: SENTIMENT_COLORS.good },
                    { label: 'Neutros', value: d.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
                    { label: 'Negativos', value: d.sentiment.negative, color: SENTIMENT_COLORS.critical },
                  ]}
                />
              </Card>

              <Card title="Publicações com mais visualizações">
                {d.topPosts.length === 0 ? <Text style={styles.muted}>Publique para ver o desempenho aqui.</Text> : null}
                {d.topPosts.map(({ post, views, engagement }) => (
                  <Pressable key={post.id} style={styles.topPost} onPress={() => router.push(`/post/${post.id}`)}>
                    <Image source={{ uri: post.type === 'video' ? post.thumbnail : post.uri }} style={styles.topThumb} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topCaption} numberOfLines={2}>
                        {post.caption || (post.type === 'video' ? 'Vídeo' : 'Foto')}
                      </Text>
                      <Text style={styles.muted}>
                        {compactNumber(views)} visualizações · {engagement.toLocaleString('pt-BR')}% de engajamento
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}

          {tab === 'batalhas' ? (
            <>
              <View style={styles.tiles}>
                <StatTile label="Batalhas e lives" value={compactNumber(myBattles.length)} />
                <StatTile label="Ao vivo agora" value={compactNumber(myBattles.filter((x) => x.b.status === 'live').length)} />
                <StatTile label="Curtidas e apoios recebidos" value={compactNumber(myBattles.reduce((a, x) => a + x.mine, 0))} />
                <StatTile label="Agendadas" value={compactNumber(myBattles.filter((x) => x.b.status === 'scheduled').length)} />
              </View>
              <Card
                title="Suas batalhas"
                right={
                  <Pressable onPress={() => router.push('/battle/new')} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.text} />
                  </Pressable>
                }>
                {myBattles.length === 0 ? <Text style={styles.muted}>Você ainda não fez nenhuma batalha ou live.</Text> : null}
                {myBattles.map(({ b, mine }) => {
                  const other = b.opponentId ? getUser(b.hostId === me.id ? b.opponentId : b.hostId) : undefined;
                  const status = b.status === 'live' ? 'Ao vivo' : b.status === 'ended' ? 'Encerrada' : b.status === 'scheduled' ? 'Agendada' : 'Convite';
                  return (
                    <Pressable key={b.id} style={styles.topPost} onPress={() => router.push(`/battle/${b.id}`)}>
                      <View style={[styles.battleIcon, b.status === 'live' && { backgroundColor: colors.like }]}>
                        <Ionicons name={b.opponentId ? 'flash' : 'radio'} size={20} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topCaption} numberOfLines={1}>
                          {b.topic || (b.opponentId ? 'Debate' : 'Live')}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                          {status} · {new Date(b.startsAt).toLocaleDateString('pt-BR')}
                          {other ? ` · com ${other.name}` : ''}
                        </Text>
                        <Text style={styles.muted}>
                          ❤ {compactNumber(mine)} suas · {compactNumber(b.likes ?? 0)} no total
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </Card>
            </>
          ) : null}

          {tab === 'publico' ? (
            <>
              <View style={styles.notice}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.infoText} />
                <Text style={styles.noticeText}>
                  Dados agregados e anônimos dos seus seguidores, a partir do que cada pessoa declarou no perfil.
                </Text>
              </View>

              <View style={styles.tiles}>
                <StatTile label="Seguidores" value={compactNumber(d.totals.followers)} delta={d.deltas.followers} />
                <StatTile label="Novos no período" value={`+${compactNumber(d.totals.gained)}`} />
                <StatTile label="Deixaram de seguir" value={compactNumber(d.totals.lost)} />
              </View>

              <Card title="Gênero">
                <SegmentBar
                  parts={[
                    { label: 'Mulheres', value: d.gender.F, color: SERIES.one },
                    { label: 'Homens', value: d.gender.M, color: SERIES.two },
                    { label: 'Outro / não informado', value: d.gender.O, color: SENTIMENT_COLORS.neutral },
                  ]}
                />
              </Card>

              <Card title="Faixa etária" info="A rede é só para maiores de 18 anos">
                <SplitBarList rows={d.age.map((a) => ({ label: a.range, a: a.F, b: a.M }))} names={['Mulheres', 'Homens']} />
              </Card>

              <Card title="Principais cidades">
                <BarList items={d.cities} />
              </Card>

              {d.neighborhoods.length ? (
                <Card title={`Bairros de ${d.cities[0]?.label}`} info="Entre seguidores que moram na cidade">
                  <BarList items={d.neighborhoods} />
                </Card>
              ) : null}

              <Card title="Estados">
                <BarList items={d.states} />
              </Card>

              <Card title="Temas de interesse" info="Uma pessoa pode marcar mais de um tema">
                <BarList items={d.interests} max={100} />
              </Card>

              <Card title="Horários em que seu público está ativo" info="Bom para escolher a hora de publicar ou abrir uma batalha">
                <ColumnChart
                  values={d.hours}
                  labels={d.hours.map((_, h) => `${h}h às ${h + 1}h`)}
                  format={(v) => `${v.toLocaleString('pt-BR')}% do público ativo`}
                  axisLabels={['0h', '6h', '12h', '18h', '23h']}
                  height={110}
                />
              </Card>
            </>
          ) : null}

          <Text style={styles.footnote}>
            Todos os números são reais, medidos no app. Puxe para baixo para atualizar. Gênero, idade, cidade e interesses vêm do que cada seguidor
            declarou no perfil; o tom dos comentários é medido pelas palavras usadas.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function ContentBars({ rows }: { rows: { label: string; followers: number; nonFollowers: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.followers + r.nonFollowers));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => {
        const total = r.followers + r.nonFollowers;
        return (
          <View key={r.label} style={{ gap: 5 }}>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>{r.label}</Text>
              <Text style={styles.kvValue}>{compactNumber(total)}</Text>
            </View>
            <View style={styles.track}>
              <View style={{ width: `${(r.followers / max) * 100}%`, backgroundColor: SERIES.one, borderRadius: 5 }} />
              <View style={{ width: 2 }} />
              <View style={{ width: `${(r.nonFollowers / max) * 100}%`, backgroundColor: SERIES.two, borderRadius: 5 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Tool({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tool} onPress={onPress}>
      <Ionicons name={`${icon}-outline` as React.ComponentProps<typeof Ionicons>['name']} size={22} color={colors.text} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabsRow: { flexGrow: 1, paddingHorizontal: spacing.sm },
  tab: { flexGrow: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  periods: { flexDirection: 'row', gap: 6 },
  period: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  periodActive: { backgroundColor: colors.text, borderColor: colors.text },
  periodText: { fontSize: 12, fontWeight: '600', color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tool: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 8 },
  toolText: { fontWeight: '600', color: colors.text, fontSize: 13 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  kvLabel: { color: colors.text, fontSize: 14 },
  kvValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  track: { height: 10, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  topPost: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  topThumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.surface },
  topCaption: { color: colors.text, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: colors.infoBg, borderRadius: 12, padding: spacing.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, color: colors.infoText, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 13 },
  battleIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  footnote: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
}));
