// Identidade visual da Rede Política, com tema claro e escuro.
//
// Como funciona:
// - `colors.X` sempre devolve a cor do tema ATUAL (são "getters").
// - Estilos criados com `themed(() => StyleSheet.create({...}))` são recalculados
//   automaticamente quando o tema muda.
// - Quem troca o tema é o ThemeModeProvider (lib/themeMode.tsx).
import type { ColorSchemeName } from 'react-native';

type Palette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  accent: string;
  like: string;
  /** fundo e texto de avisos informativos (azul claro no tema claro) */
  infoBg: string;
  infoText: string;
  /** fundo de item selecionado */
  selectedBg: string;
  /** fundo de item selecionado em vermelho (ex.: batalha) */
  dangerBg: string;
  /** gráficos: série 1 e série 2 (validadas para daltonismo em cada tema) */
  series1: string;
  series2: string;
  good: string;
  neutral: string;
  critical: string;
};

const light: Palette = {
  background: '#FFFFFF',
  surface: '#F4F6FA',
  border: '#E3E7EE',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#1D4ED8',
  primaryDark: '#1E3A8A',
  accent: '#F59E0B',
  like: '#E11D48',
  infoBg: '#EFF6FF',
  infoText: '#1E3A8A',
  selectedBg: '#DBEAFE',
  dangerBg: '#FFF1F2',
  series1: '#1D4ED8',
  series2: '#F59E0B',
  good: '#15803D',
  neutral: '#94A3B8',
  critical: '#B91C1C',
};

const dark: Palette = {
  background: '#0B0F17',
  surface: '#161C28',
  border: '#273244',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  primary: '#3987E5',
  primaryDark: '#1E40AF',
  accent: '#C98500',
  like: '#F43F5E',
  infoBg: '#14213D',
  infoText: '#BFDBFE',
  selectedBg: '#1E3A8A',
  dangerBg: '#3B1424',
  series1: '#3987E5',
  series2: '#C98500',
  good: '#22C55E',
  neutral: '#64748B',
  critical: '#F87171',
};

export type Scheme = 'light' | 'dark';

let current: Scheme = 'light';
let version = 0;

export function setScheme(scheme: Scheme) {
  if (scheme === current) return;
  current = scheme;
  version += 1;
}

export function getScheme(): Scheme {
  return current;
}

export function schemeFrom(mode: 'light' | 'dark' | 'system', system: ColorSchemeName | null | undefined): Scheme {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

const palettes = { light, dark };

type Colors = Palette & { white: string; black: string; storyRing: readonly [string, string, string] };

export const colors = {} as Colors;
(Object.keys(light) as (keyof Palette)[]).forEach((key) => {
  Object.defineProperty(colors, key, { enumerable: true, get: () => palettes[current][key] });
});
Object.defineProperty(colors, 'white', { enumerable: true, value: '#FFFFFF' });
Object.defineProperty(colors, 'black', { enumerable: true, value: '#000000' });
Object.defineProperty(colors, 'storyRing', {
  enumerable: true,
  get: () => [palettes[current].primary, '#16A34A', palettes[current].accent] as const,
});

/**
 * Estilos que acompanham o tema. Uso:
 *   const styles = themed(() => StyleSheet.create({ ... }));
 * Depois é só usar `styles.algo` normalmente.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let cachedVersion = -1;
  const get = () => {
    if (!cache || cachedVersion !== version) {
      cache = factory();
      cachedVersion = version;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_target, prop) => get()[prop as keyof T],
    has: (_target, prop) => prop in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_target, prop) => Object.getOwnPropertyDescriptor(get(), prop),
  });
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
