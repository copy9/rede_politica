// Estatísticas do Painel do político, calculadas com dados reais do banco.
// Tudo é AGREGADO (percentuais e totais): nenhum dado individual sai daqui.
import type { Post, Supporter, User } from './types';

export const AGE_RANGES = ['18-24', '25-34', '35-44', '45-59', '60+'] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const INTERESTS = [
  'Saúde',
  'Educação',
  'Segurança',
  'Emprego',
  'Mobilidade',
  'Orçamento',
  'Cultura',
  'Meio ambiente',
  'Moradia',
  'Esporte',
] as const;

export function ageRangeOf(birthYear: number, now = new Date()): AgeRange {
  const age = now.getFullYear() - birthYear;
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 60) return '45-59';
  return '60+';
}

const CITIES: Record<string, string[]> = {
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Paulista', 'Caruaru', 'Petrolina', 'Cabo de Santo Agostinho', 'Camaragibe'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Lauro de Freitas', 'Itabuna', 'Juazeiro', 'Ilhéus'],
  SP: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Sorocaba', 'Ribeirão Preto'],
};

const NEIGHBORHOODS: Record<string, string[]> = {
  Recife: ['Boa Viagem', 'Casa Amarela', 'Ibura', 'Várzea', 'Imbiribeira', 'Água Fria', 'Cordeiro', 'Espinheiro'],
  Salvador: ['Cajazeiras', 'Liberdade', 'Itapuã', 'Pituba', 'Brotas', 'São Marcos', 'Pernambués', 'Federação'],
  'São Paulo': ['Grajaú', 'Capão Redondo', 'Sapopemba', 'Itaim Paulista', 'Mooca', 'Pinheiros', 'Tatuapé', 'Santana'],
};

const NEIGHBOR_STATES: Record<string, string[]> = {
  PE: ['PB', 'AL', 'BA', 'SP', 'CE'],
  BA: ['SE', 'PE', 'MG', 'SP', 'RJ'],
  SP: ['RJ', 'MG', 'PR', 'BA', 'PE'],
};

// ---------- números pseudoaleatórios determinísticos ----------
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distribui 100% entre os pesos e arredonda para 1 casa, garantindo que soma 100. */
function toPercents(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / total) * 1000);
  const floored = raw.map(Math.floor);
  let rest = 1000 - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floored[i] += 1;
    rest -= 1;
  }
  return floored.map((v) => v / 10);
}

export type Period = 7 | 30 | 90;

export type DailyPoint = { date: number; views: number; reach: number; gained: number; lost: number };
export type Share = { label: string; pct: number };

export type Dashboard = {
  period: Period;
  daily: DailyPoint[];
  totals: {
    views: number;
    reach: number;
    followers: number;
    netFollowers: number;
    gained: number;
    lost: number;
    profileVisits: number;
    supporters: number;
  };
  /** variação % em relação ao período anterior */
  deltas: { views: number; reach: number; followers: number };
  byContent: { label: string; followers: number; nonFollowers: number }[];
  interactions: { label: string; value: number }[];
  gender: { F: number; M: number; O: number };
  age: { range: AgeRange; F: number; M: number }[];
  cities: Share[];
  states: Share[];
  neighborhoods: Share[];
  interests: Share[];
  hours: number[];
  sentiment: { positive: number; neutral: number; negative: number };
  topPosts: { post: Post; views: number; engagement: number }[];
};

/** Linhas vindas do banco para montar o painel (tudo do próprio político). */
export type PainelRaw = {
  /** visualizações e compartilhamentos (tabela content_views) */
  views: { viewer_id: string; kind: string; ref_id: string | null; created_at: string }[];
  /** quem segue hoje e desde quando (tabela follows) */
  follows: { follower_id: string; created_at: string }[];
  /** quando deixaram de seguir (tabela follow_events) */
  unfollows: { created_at: string }[];
};

const VIEW_KINDS = new Set(['post', 'video', 'story', 'battle']);

// palavras para medir o tom dos comentários de verdade (positivo / negativo)
const POSITIVE = ['parab', 'ótim', 'otim', 'excelent', 'apoio', 'concordo', 'bom ', 'boa ', 'top', 'show', 'obrigad', 'verdade', 'maravilh', 'lind', 'gostei', 'força', 'forca', 'sucesso', 'merece', 'perfeit', 'incrível', 'incrivel', 'amei', 'isso aí', 'isso ai', 'conte comigo', 'tamo junto', '👏', '❤', '👍', '🙏', '💪', '🔥'];
const NEGATIVE = ['lixo', 'ladr', 'mentir', 'vergonha', 'ruim', 'péssim', 'pessim', 'corrupt', 'discordo', 'absurd', 'nojo', 'fora ', 'palhaç', 'palhac', 'safad', 'nunca mais', 'decepc', 'decepç', 'horrível', 'horrivel', 'pior', 'idiota', 'burr', 'falso', 'golpe', '👎', '😡', '🤮', '💩'];
function tone(text: string): 'positive' | 'negative' | 'neutral' {
  const t = ` ${text.toLowerCase()} `;
  const p = POSITIVE.filter((w) => t.includes(w)).length;
  const n = NEGATIVE.filter((w) => t.includes(w)).length;
  return p > n ? 'positive' : n > p ? 'negative' : 'neutral';
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : now ? 100 : 0);
function shares(values: (string | undefined)[], empty = 'Não informado', limit = 6): Share[] {
  const total = values.length;
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v || empty, (counts.get(v || empty) ?? 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit).map(([label, n]) => ({ label, pct: pct(n, total) }));
  const rest = sorted.slice(limit).reduce((acc, [, n]) => acc + n, 0);
  return rest ? [...top, { label: 'Outros', pct: pct(rest, total) }] : top;
}

/**
 * Painel com números REAIS: visualizações, alcance, visitas ao perfil, compartilhamentos,
 * seguidores ganhos e perdidos, horários do público, tom dos comentários e o público (gênero,
 * idade, cidades, estados, interesses). Nada é inventado: sem dados, mostra zero.
 */
export function buildDashboard(input: {
  politician: User;
  posts: Post[];
  supporters: number;
  period: Period;
  followers: User[];
  raw: PainelRaw;
  commentsOnPost: (postId: string) => { text: string; createdAt: number }[];
  /** curtidas e apoios recebidos em batalhas no período */
  battlePoints: number;
}): Dashboard {
  const { politician, posts, supporters, period, followers, raw, commentsOnPost, battlePoints } = input;
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (period - 1) * dayMs;
  const prevStart = start - period * dayMs;
  const t = (iso: string) => new Date(iso).getTime();
  const dayIndex = (ms: number) => Math.floor((ms - start) / dayMs);

  const inPeriod = raw.views.filter((v) => t(v.created_at) >= start);
  const inPrev = raw.views.filter((v) => t(v.created_at) >= prevStart && t(v.created_at) < start);
  const views = inPeriod.filter((v) => VIEW_KINDS.has(v.kind));
  const prevViews = inPrev.filter((v) => VIEW_KINDS.has(v.kind));

  const daily: DailyPoint[] = Array.from({ length: period }, (_, i) => ({ date: start + i * dayMs, views: 0, reach: 0, gained: 0, lost: 0 }));
  const dailyViewers = daily.map(() => new Set<string>());
  views.forEach((v) => {
    const i = dayIndex(t(v.created_at));
    if (i >= 0 && i < period) {
      daily[i].views += 1;
      dailyViewers[i].add(v.viewer_id);
    }
  });
  dailyViewers.forEach((set, i) => (daily[i].reach = set.size));
  raw.follows.forEach((f) => {
    const i = dayIndex(t(f.created_at));
    if (i >= 0 && i < period) daily[i].gained += 1;
  });
  raw.unfollows.forEach((u) => {
    const i = dayIndex(t(u.created_at));
    if (i >= 0 && i < period) daily[i].lost += 1;
  });

  const reach = new Set(views.map((v) => v.viewer_id)).size;
  const prevReach = new Set(prevViews.map((v) => v.viewer_id)).size;
  const gained = daily.reduce((a, d) => a + d.gained, 0);
  const lost = daily.reduce((a, d) => a + d.lost, 0);
  const n = followers.length;
  const followersAtStart = Math.max(0, n - (gained - lost));

  const followerSet = new Set(followers.map((u) => u.id));
  const byContent = [
    { label: 'Vídeos', kind: 'video' },
    { label: 'Publicações', kind: 'post' },
    { label: 'Batalhas ao vivo', kind: 'battle' },
    { label: 'Stories', kind: 'story' },
  ].map((c) => {
    const list = views.filter((v) => v.kind === c.kind);
    const f = list.filter((v) => followerSet.has(v.viewer_id)).length;
    return { label: c.label, followers: f, nonFollowers: list.length - f };
  });

  const own = posts.filter((p) => p.userId === politician.id);
  const periodComments = own.flatMap((p) => commentsOnPost(p.id)).filter((c) => c.createdAt >= start);
  const interactions = [
    { label: 'Curtidas', value: own.reduce((a, p) => a + p.likes.length, 0) },
    { label: 'Comentários', value: periodComments.length },
    { label: 'Compartilhamentos', value: inPeriod.filter((v) => v.kind === 'share').length },
    { label: 'Salvos', value: own.reduce((a, p) => a + p.savedBy.length, 0) },
    { label: 'Curtidas e apoios em batalhas', value: battlePoints },
  ];

  // horário em que o público vê seus conteúdos (hora do celular)
  const hourCount = Array.from({ length: 24 }, () => 0);
  views.forEach((v) => (hourCount[new Date(v.created_at).getHours()] += 1));
  const hours = hourCount.map((c) => pct(c, views.length));

  const tones = { positive: 0, neutral: 0, negative: 0 };
  periodComments.forEach((c) => (tones[tone(c.text)] += 1));
  const sentiment = {
    positive: pct(tones.positive, periodComments.length),
    neutral: pct(tones.neutral, periodComments.length),
    negative: pct(tones.negative, periodComments.length),
  };

  const viewsByPost = new Map<string, number>();
  views.forEach((v) => v.ref_id && viewsByPost.set(v.ref_id, (viewsByPost.get(v.ref_id) ?? 0) + 1));
  const topPosts = own
    .map((post) => {
      const v = viewsByPost.get(post.id) ?? 0;
      const eng = post.likes.length + commentsOnPost(post.id).length + post.savedBy.length;
      return { post, views: v, engagement: v ? Math.min(100, Math.round((eng / v) * 1000) / 10) : 0 };
    })
    .filter((x) => x.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // público: o que cada seguidor declarou no perfil
  const g = { F: 0, M: 0, O: 0 };
  followers.forEach((u) => (g[u.gender ?? 'O'] += 1));
  const age = AGE_RANGES.map((range) => {
    const inRange = followers.filter((u) => u.birthYear && ageRangeOf(u.birthYear) === range);
    return { range, F: pct(inRange.filter((u) => u.gender === 'F').length, n), M: pct(inRange.filter((u) => u.gender !== 'F').length, n) };
  });
  const interestCounts = new Map<string, number>();
  followers.forEach((u) => (u.interests ?? []).forEach((i) => interestCounts.set(i, (interestCounts.get(i) ?? 0) + 1)));
  const interests = [...interestCounts.entries()].map(([label, c]) => ({ label, pct: pct(c, n) })).sort((a, b) => b.pct - a.pct);

  return {
    period,
    daily,
    totals: {
      views: views.length,
      reach,
      followers: n,
      netFollowers: gained - lost,
      gained,
      lost,
      profileVisits: inPeriod.filter((v) => v.kind === 'profile').length,
      supporters,
    },
    deltas: {
      views: change(views.length, prevViews.length),
      reach: change(reach, prevReach),
      followers: change(n, followersAtStart),
    },
    byContent,
    interactions,
    gender: { F: pct(g.F, n), M: pct(g.M, n), O: pct(g.O, n) },
    age,
    cities: shares(followers.map((u) => u.city)),
    states: shares(followers.map((u) => u.state)),
    neighborhoods: [],
    interests,
    hours,
    sentiment,
    topPosts,
  };
}

// ---------- apoiadores de demonstração (fictícios, todos "com consentimento") ----------
const FIRST = ['Maria', 'José', 'Ana', 'João', 'Francisca', 'Antônio', 'Juliana', 'Carlos', 'Patrícia', 'Paulo', 'Aline', 'Marcos', 'Fernanda', 'Lucas', 'Adriana', 'Rafael', 'Camila', 'Bruno', 'Larissa', 'Diego'];
const LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Barbosa', 'Melo'];

export function demoSupporters(politician: User, count = 40): Supporter[] {
  const r = rng(`supporters:${politician.id}`);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const state = politician.state ?? 'PE';
  const cityList = CITIES[state] ?? CITIES.PE;
  const ddd = state === 'BA' ? '71' : state === 'SP' ? '11' : '81';
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const slug = `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const showName = r() > 0.1;
    const wantsWhats = r() > 0.35;
    const wantsEmail = r() > 0.5;
    const nInterests = 1 + Math.floor(r() * 3);
    const interests = Array.from(new Set(Array.from({ length: nInterests }, () => pick(INTERESTS))));
    return {
      consentId: `demo_${politician.id}_${i}`,
      name: showName ? name : undefined,
      username: showName ? `${slug}${Math.floor(r() * 90 + 10)}` : undefined,
      city: r() > 0.15 ? (r() < 0.55 ? (politician.city ?? cityList[0]) : pick(cityList)) : undefined,
      state: state,
      ageRange: r() > 0.25 ? pick(AGE_RANGES) : undefined,
      interests,
      whatsapp: wantsWhats ? `(${ddd}) 9${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}` : undefined,
      email: wantsEmail ? `${slug}@exemplo.com` : undefined,
      createdAt: now - Math.floor(r() * 60) * 24 * 60 * 60 * 1000 - Math.floor(r() * 86400000),
      demo: true,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

/** Planilha CSV (abre no Excel/Google Planilhas) */
export function supportersToCsv(list: Supporter[]): string {
  const esc = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Nome', 'Usuário', 'Cidade', 'UF', 'Faixa etária', 'Interesses', 'WhatsApp', 'E-mail', 'Autorizou em'];
  const rows = list.map((s) =>
    [
      s.name,
      s.username ? `@${s.username}` : '',
      s.city,
      s.state,
      s.ageRange,
      s.interests.join(', '),
      s.whatsapp,
      s.email,
      new Date(s.createdAt).toLocaleDateString('pt-BR'),
    ]
      .map(esc)
      .join(';'),
  );
  return [header.map(esc).join(';'), ...rows].join('\n');
}
