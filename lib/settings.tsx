// Configurações do app, salvas no próprio celular (AsyncStorage).
//
// Duas partes:
// - DO APARELHO (valem para qualquer conta neste celular): tema, idioma, dados e mídia.
// - DE CADA CONTA (privacidade, bloqueios, notificações, segurança...): guardadas por usuário.
//   `settings` sempre mostra as do aparelho + as da conta logada.
// As regras de privacidade das OUTRAS contas (quem pode comentar, mandar mensagem...) também
// são lidas daqui com `accountSettings(id)`; com o Supabase elas passam a vir do servidor.
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
  security: boolean;
};

export type Device = { id: string; name: string; where: string; lastActiveAt: number; icon: 'phone-portrait-outline' | 'desktop-outline' | 'globe-outline' };
export type Report = { id: string; text: string; createdAt: number };

export type DeviceSettings = {
  themeMode: ThemeMode;
  language: Language;
  dataSaver: boolean;
  autoplayVideos: boolean;
  deviceId: string;
};

export type AccountSettings = {
  notifications: NotificationPrefs;
  privateAccount: boolean;
  showActivityStatus: boolean;
  hideLikeCounts: boolean;
  /** "seguidores" = pessoas que ESTA conta segue */
  whoCanComment: Audience;
  whoCanMessage: Audience;
  whoCanMention: Audience;
  whoCanChallenge: Audience;
  filterOffensive: boolean;
  hiddenWords: string[];
  blockedIds: string[];
  mutedIds: string[];
  closeFriendIds: string[];
  dailyLimitMin: number;
  breakReminderMin: number;
  /** minutos de uso por dia, chave AAAA-MM-DD */
  usage: Record<string, number>;
  twoFactor: boolean;
  loginAlerts: boolean;
  /** senha local da demonstração (guardada como hash). Sem senha = conta de demonstração aceita qualquer uma. */
  passwordHash?: string;
  devices: Device[];
  phone: string;
  email: string;
  verification: { status: 'nenhuma' | 'em_analise'; requestedAt?: number; office?: string };
  reports: Report[];
};

export type Settings = DeviceSettings & AccountSettings;

export const DEFAULT_DEVICE: DeviceSettings = {
  themeMode: 'system',
  language: 'pt-BR',
  dataSaver: false,
  autoplayVideos: true,
  deviceId: '',
};

export const DEFAULT_ACCOUNT: AccountSettings = {
  notifications: {
    pauseAll: false,
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    battles: true,
    mentions: true,
    politicians: true,
    security: true,
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
  usage: {},
  twoFactor: false,
  loginAlerts: true,
  devices: [],
  phone: '',
  email: '',
  verification: { status: 'nenhuma' },
  reports: [],
};

// Regras de privacidade de algumas contas fictícias, para dar para ver as opções funcionando.
const MOCK_ACCOUNTS: Record<string, Partial<AccountSettings>> = {
  u_carlos: { whoCanMessage: 'ninguem', whoCanChallenge: 'ninguem' },
  u_marta: { whoCanComment: 'seguidores' },
  u_obs: { privateAccount: true, showActivityStatus: false },
  u_rafa: { whoCanMention: 'seguidores', closeFriendIds: ['u_demo'], whoCanChallenge: 'todos' },
  u_julia: { whoCanChallenge: 'todos', whoCanMention: 'seguidores' },
  u_demo: {
    phone: '(81) 99999-0000',
    devices: [
      { id: 'mock-web', name: 'Chrome no Windows', where: 'Recife, PE', lastActiveAt: Date.now() - 2 * 86400000, icon: 'desktop-outline' },
    ],
  },
};

const STORAGE_KEY = 'rede-politica:settings:v2';
const OLD_KEY = 'rede-politica:settings:v1';

const DEVICE_KEYS = new Set<keyof DeviceSettings>(Object.keys(DEFAULT_DEVICE) as (keyof DeviceSettings)[]);

/** Palavras ofensivas comuns escondidas quando o filtro está ligado. */
export const OFFENSIVE_WORDS = ['idiota', 'burro', 'lixo', 'otário', 'vagabundo', 'imbecil', 'canalha'];

type ListKey = 'blockedIds' | 'mutedIds' | 'closeFriendIds' | 'hiddenWords';

type Stored = { device: DeviceSettings; accounts: Record<string, Partial<AccountSettings>> };

type SettingsState = {
  /** aparelho + conta logada */
  settings: Settings;
  loaded: boolean;
  activeAccountId: string | null;
  setActiveAccount: (id: string | null) => void;
  /** muda configurações da conta logada (ou do aparelho, conforme a chave) */
  update: (changes: Partial<Settings>) => void;
  updateNotifications: (changes: Partial<NotificationPrefs>) => void;
  toggleIn: (key: ListKey, value: string) => void;
  /** configurações de QUALQUER conta (para aplicar as regras de privacidade dela) */
  accountSettings: (userId: string) => AccountSettings;
  updateAccount: (userId: string, changes: Partial<AccountSettings>) => void;
  removeAccount: (userId: string) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

function mergeAccount(saved?: Partial<AccountSettings>, mock?: Partial<AccountSettings>): AccountSettings {
  return {
    ...DEFAULT_ACCOUNT,
    ...(mock ?? {}),
    ...(saved ?? {}),
    notifications: { ...DEFAULT_ACCOUNT.notifications, ...(mock?.notifications ?? {}), ...(saved?.notifications ?? {}) },
  };
}

function randomId() {
  return `dev_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<Stored>({ device: { ...DEFAULT_DEVICE, deviceId: randomId() }, accounts: {} });
  const [loaded, setLoaded] = useState(false);
  const [activeAccountId, setActiveAccount] = useState<string | null>(null);

  // Carrega o que estava salvo (e aproveita o tema da versão anterior, se houver)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Stored;
          const device = { ...DEFAULT_DEVICE, ...(saved.device ?? {}) };
          if (!device.deviceId) device.deviceId = randomId();
          setStored({ device, accounts: saved.accounts ?? {} });
        } else {
          const old = await AsyncStorage.getItem(OLD_KEY);
          if (old) {
            const o = JSON.parse(old) as Partial<DeviceSettings>;
            setStored((s) => ({
              ...s,
              device: {
                ...s.device,
                themeMode: o.themeMode ?? s.device.themeMode,
                language: o.language ?? s.device.language,
                dataSaver: o.dataSaver ?? s.device.dataSaver,
                autoplayVideos: o.autoplayVideos ?? s.device.autoplayVideos,
              },
            }));
          }
        }
      } catch {
        // sem configurações salvas: usa o padrão
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Salva a cada mudança
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {});
  }, [stored, loaded]);

  const accountSettings = useCallback(
    (userId: string) => mergeAccount(stored.accounts[userId], MOCK_ACCOUNTS[userId]),
    [stored.accounts],
  );

  const updateAccount = useCallback((userId: string, changes: Partial<AccountSettings>) => {
    setStored((s) => {
      const current = mergeAccount(s.accounts[userId], MOCK_ACCOUNTS[userId]);
      return { ...s, accounts: { ...s.accounts, [userId]: { ...current, ...changes } } };
    });
  }, []);

  const removeAccount = useCallback((userId: string) => {
    setStored((s) => {
      const accounts = { ...s.accounts };
      delete accounts[userId];
      return { ...s, accounts };
    });
  }, []);

  const update = useCallback(
    (changes: Partial<Settings>) => {
      const device: Partial<DeviceSettings> = {};
      const account: Partial<AccountSettings> = {};
      (Object.keys(changes) as (keyof Settings)[]).forEach((k) => {
        if (DEVICE_KEYS.has(k as keyof DeviceSettings)) (device as Record<string, unknown>)[k] = changes[k];
        else (account as Record<string, unknown>)[k] = changes[k];
      });
      if (Object.keys(device).length) setStored((s) => ({ ...s, device: { ...s.device, ...device } }));
      if (Object.keys(account).length && activeAccountId) updateAccount(activeAccountId, account);
    },
    [activeAccountId, updateAccount],
  );

  const settings = useMemo<Settings>(
    () => ({ ...(activeAccountId ? accountSettings(activeAccountId) : DEFAULT_ACCOUNT), ...stored.device }),
    [activeAccountId, accountSettings, stored.device],
  );

  const updateNotifications = useCallback(
    (changes: Partial<NotificationPrefs>) => update({ notifications: { ...settings.notifications, ...changes } }),
    [update, settings.notifications],
  );

  const toggleIn = useCallback(
    (key: ListKey, value: string) => {
      const list = settings[key];
      update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as Partial<Settings>);
    },
    [settings, update],
  );

  const value = useMemo(
    () => ({
      settings,
      loaded,
      activeAccountId,
      setActiveAccount,
      update,
      updateNotifications,
      toggleIn,
      accountSettings,
      updateAccount,
      removeAccount,
    }),
    [settings, loaded, activeAccountId, update, updateNotifications, toggleIn, accountSettings, updateAccount, removeAccount],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>');
  return ctx;
}

/** true se o comentário deve ficar escondido pelas configurações do usuário */
export function isHiddenText(text: string, settings: Pick<Settings, 'hiddenWords' | 'filterOffensive'>) {
  const t = text.toLowerCase();
  const words = [...settings.hiddenWords, ...(settings.filterOffensive ? OFFENSIVE_WORDS : [])];
  return words.some((w) => w.trim() && t.includes(w.trim().toLowerCase()));
}

/** Data de hoje no formato AAAA-MM-DD (chave do tempo de uso) */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
