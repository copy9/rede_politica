// Configurações do usuário (tema, notificações, privacidade, bloqueios...).
// Ficam salvas no próprio celular (AsyncStorage) e continuam depois de fechar o app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Audience = 'todos' | 'seguidores' | 'ninguem';
export type Language = 'pt-BR' | 'en' | 'es';

export type NotificationPrefs = {
  pauseAll: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  battles: boolean;
  mentions: boolean;
  politicians: boolean;
};

export type Settings = {
  themeMode: ThemeMode;
  language: Language;
  notifications: NotificationPrefs;
  privateAccount: boolean;
  showActivityStatus: boolean;
  hideLikeCounts: boolean;
  whoCanComment: Audience;
  whoCanMessage: Audience;
  whoCanMention: Audience;
  whoCanChallenge: Audience;
  /** esconde comentários com palavras ofensivas comuns */
  filterOffensive: boolean;
  /** palavras escolhidas pelo usuário para esconder dos comentários */
  hiddenWords: string[];
  blockedIds: string[];
  mutedIds: string[];
  closeFriendIds: string[];
  /** limite diário em minutos (0 = sem limite) */
  dailyLimitMin: number;
  breakReminderMin: number;
  twoFactor: boolean;
  loginAlerts: boolean;
  dataSaver: boolean;
  autoplayVideos: boolean;
  phone: string;
  email: string;
  verification: { status: 'nenhuma' | 'em_analise'; requestedAt?: number; office?: string };
};

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  language: 'pt-BR',
  notifications: {
    pauseAll: false,
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    battles: true,
    mentions: true,
    politicians: true,
  },
  privateAccount: false,
  showActivityStatus: true,
  hideLikeCounts: false,
  whoCanComment: 'todos',
  whoCanMessage: 'todos',
  whoCanMention: 'todos',
  whoCanChallenge: 'seguidores',
  filterOffensive: true,
  hiddenWords: [],
  blockedIds: [],
  mutedIds: [],
  closeFriendIds: [],
  dailyLimitMin: 0,
  breakReminderMin: 0,
  twoFactor: false,
  loginAlerts: true,
  dataSaver: false,
  autoplayVideos: true,
  phone: '',
  email: '',
  verification: { status: 'nenhuma' },
};

const STORAGE_KEY = 'rede-politica:settings:v1';

/** Palavras ofensivas comuns escondidas quando "filtro de comentários ofensivos" está ligado. */
export const OFFENSIVE_WORDS = ['idiota', 'burro', 'lixo', 'otário', 'vagabundo', 'imbecil', 'canalha'];

type SettingsState = {
  settings: Settings;
  loaded: boolean;
  update: (changes: Partial<Settings>) => void;
  updateNotifications: (changes: Partial<NotificationPrefs>) => void;
  toggleIn: (key: 'blockedIds' | 'mutedIds' | 'closeFriendIds' | 'hiddenWords', value: string) => void;
  reset: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Carrega o que estava salvo
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Settings>;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...saved,
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved.notifications ?? {}) },
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Salva a cada mudança (depois de carregar)
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  const update = useCallback((changes: Partial<Settings>) => setSettings((s) => ({ ...s, ...changes })), []);
  const updateNotifications = useCallback(
    (changes: Partial<NotificationPrefs>) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, ...changes } })),
    [],
  );
  const toggleIn = useCallback(
    (key: 'blockedIds' | 'mutedIds' | 'closeFriendIds' | 'hiddenWords', value: string) =>
      setSettings((s) => ({
        ...s,
        [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
      })),
    [],
  );
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo(
    () => ({ settings, loaded, update, updateNotifications, toggleIn, reset }),
    [settings, loaded, update, updateNotifications, toggleIn, reset],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>');
  return ctx;
}

/** true se o comentário deve ficar escondido pelas configurações do usuário */
export function isHiddenText(text: string, settings: Settings) {
  const t = text.toLowerCase();
  const words = [...settings.hiddenWords, ...(settings.filterOffensive ? OFFENSIVE_WORDS : [])];
  return words.some((w) => w.trim() && t.includes(w.trim().toLowerCase()));
}
