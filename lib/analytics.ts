// Estatísticas do Painel do político.
// MODO DEMONSTRAÇÃO: os números são gerados de forma determinística (mesmo político = mesmos números).
// Com o Supabase, cada função aqui vira uma consulta agregada no banco.
// Tudo é AGREGADO (percentuais e totais): nenhum dado individual sai daqui.
import type { Post, Supporter, User } from './types';

export const AGE_RANGES = ['16-17', '18-24', '25-34', '35-44', '45-59', '60+'] as const;
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
  if (age < 18) return '16-17';
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

export function buildDashboard(politician: User, posts: Post[], supporters: number, period: Period): Dashboard {
  const r = rng(`${politician.id}:${period}`);
  const base = rng(politician.id); // números que não dependem do período
  const followers = Math.round(18000 + base() * 60000);
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Série diária com alguns picos (posts que viralizaram, batalhas ao vivo)
  const spikes = new Set(Array.from({ length: Math.max(1, Math.round(period / 10)) }, () => Math.floor(r() * period)));
  const daily: DailyPoint[] = Array.from({ length: period }, (_, i) => {
    const trend = 0.75 + (i / period) * 0.5;
    const spike = spikes.has(i) ? 2.5 + r() * 3 : 1;
    const views = Math.round((followers * 0.9 + r() * followers * 0.8) * trend * spike);
    const reach = Math.round(views * (0.18 + r() * 0.12));
    const gained = Math.round((followers / 300) * (0.5 + r()) * spike);
    const lost = Math.round(gained * (0.05 + r() * 0.12));
    return { date: today.getTime() - (period - 1 - i) * dayMs, views, reach, gained, lost };
  });

  const sum = (k: keyof DailyPoint) => daily.reduce((a, d) => a + (d[k] as number), 0);
  const views = sum('views');
  const reach = Math.round(sum('reach') * 0.55);
  const gained = sum('gained');
  const lost = sum('lost');

  const ownPosts = posts.filter((p) => p.userId === politician.id);
  const topPosts = ownPosts
    .map((post) => ({ post, views: Math.round(views * (0.04 + r() * 0.18)), engagement: Math.round(2 + r() * 9 * 10) / 10 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const videoShare = 0.62 + r() * 0.2;
  const byContent = [
    { label: 'Vídeos', total: views * videoShare },
    { label: 'Publicações', total: views * (1 - videoShare) * 0.75 },
    { label: 'Batalhas ao vivo', total: views * (1 - videoShare) * 0.2 },
    { label: 'Stories', total: views * (1 - videoShare) * 0.05 },
  ].map((c) => {
    const f = 0.12 + r() * 0.25;
    return { label: c.label, followers: Math.round(c.total * f), nonFollowers: Math.round(c.total * (1 - f)) };
  });

  const likes = Math.round(views * (0.02 + r() * 0.02));
  const interactions = [
    { label: 'Curtidas', value: likes },
    { label: 'Comentários', value: Math.round(likes * (0.06 + r() * 0.06)) },
    { label: 'Compartilhamentos', value: Math.round(likes * (0.1 + r() * 0.1)) },
    { label: 'Salvos', value: Math.round(likes * (0.03 + r() * 0.05)) },
    { label: 'Apoios em batalhas', value: Math.round(likes * (0.2 + r() * 0.3)) },
  ];

  const f = 46 + base() * 14;
  const o = 0.6 + base() * 0.8;
  const gender = { F: Math.round(f * 10) / 10, O: Math.round(o * 10) / 10, M: Math.round((100 - f - o) * 10) / 10 };

  // Faixa etária x gênero (percentual do público total)
  const ageWeights = [0.4, 4, 12, 22, 33, 28].map((w) => w * (0.8 + base() * 0.4));
  const agePct = toPercents(ageWeights);
  const age = AGE_RANGES.map((range, i) => {
    const fShare = gender.F / (gender.F + gender.M);
    const F = Math.round(agePct[i] * (fShare + (base() - 0.5) * 0.1) * 10) / 10;
    return { range, F, M: Math.round((agePct[i] - F) * 10) / 10 };
  });

  const state = politician.state ?? 'PE';
  const cityList = CITIES[state] ?? CITIES.PE;
  const home = politician.city && cityList.includes(politician.city) ? politician.city : cityList[0];
  const ordered = [home, ...cityList.filter((c) => c !== home)].slice(0, 6);
  const cityPct = toPercents([...ordered.map((_, i) => (i === 0 ? 45 : 18 / (i + 0.5)) * (0.8 + base() * 0.4)), 14]);
  const cities = [...ordered.map((label, i) => ({ label, pct: cityPct[i] })), { label: 'Outras cidades', pct: cityPct[ordered.length] }];

  const others = NEIGHBOR_STATES[state] ?? NEIGHBOR_STATES.PE;
  const statePct = toPercents([82, ...others.map((_, i) => 6 / (i + 1)), 2]);
  const states = [
    { label: state, pct: statePct[0] },
    ...others.map((label, i) => ({ label, pct: statePct[i + 1] })),
    { label: 'Outros', pct: statePct[others.length + 1] },
  ];

  const hoods = NEIGHBORHOODS[home] ?? [];
  const hoodPct = toPercents(hoods.map(() => 4 + base() * 12));
  const neighborhoods = hoods.map((label, i) => ({ label, pct: hoodPct[i] })).sort((a, b) => b.pct - a.pct);

  const interestPct = INTERESTS.map(() => 2 + base() * 14);
  const interests = INTERESTS.map((label, i) => ({ label, pct: Math.round(interestPct[i] * 3 * 10) / 10 }))
    .map((x) => ({ ...x, pct: Math.min(78, x.pct) }))
    .sort((a, b) => b.pct - a.pct);

  // Atividade do público por hora (picos no almoço e à noite)
  const hourWeights = Array.from({ length: 24 }, (_, h) => {
    const lunch = Math.exp(-((h - 12.5) ** 2) / 4);
    const night = Math.exp(-((h - 20.5) ** 2) / 5) * 1.6;
    const morning = Math.exp(-((h - 7.5) ** 2) / 3) * 0.6;
    return 0.05 + lunch + night + morning + base() * 0.15;
  });
  const hours = toPercents(hourWeights);

  const pos = 38 + r() * 25;
  const neg = 10 + r() * 18;
  const sentiment = {
    positive: Math.round(pos * 10) / 10,
    negative: Math.round(neg * 10) / 10,
    neutral: Math.round((100 - pos - neg) * 10) / 10,
  };

  const pctDelta = (min: number, max: number) => Math.round((min + r() * (max - min)) * 10) / 10;

  return {
    period,
    daily,
    totals: {
      views,
      reach,
      followers,
      netFollowers: gained - lost,
      gained,
      lost,
      profileVisits: Math.round(reach * (0.08 + r() * 0.05)),
      supporters,
    },
    deltas: { views: pctDelta(-15, 160), reach: pctDelta(-10, 120), followers: pctDelta(1, 40) },
    byContent,
    interactions,
    gender,
    age,
    cities,
    states,
    neighborhoods,
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
      ageRange: r() > 0.25 ? pick(AGE_RANGES.slice(1)) : undefined,
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
