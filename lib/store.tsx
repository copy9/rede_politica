// Estado do app, ligado ao banco de verdade (Supabase).
//
// Como funciona:
// - Ao entrar, o app baixa do banco tudo o que a pessoa pode ver (perfis, posts, mensagens...).
// - Cada ação (curtir, comentar, postar...) aparece na tela na hora e é gravada no banco em seguida.
//   Se o banco recusar (ex.: regra de privacidade), a tela volta ao normal e aparece um aviso.
// - Batalhas, mensagens e notificações chegam em tempo real; o resto é atualizado a cada 30 s
//   e sempre que o app volta a ficar aberto.
// - As regras de segurança ficam NO BANCO (supabase/migrations). As checagens daqui só servem
//   para mostrar a mensagem certa mais rápido.
import type { RealtimeChannel } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, AppState as RNAppState } from 'react-native';

import { ageRangeOf } from './analytics';
import { timeAgo } from './format';
import { useSettings, type AccountSettings, type Audience, type Device, type ShareProfile } from './settings';
import { supabase } from './supabase';
import type {
  AppNotification,
  BattleMessage,
  BattleSide,
  Comment,
  Conversation,
  Follow,
  FollowRequest,
  LiveBattle,
  MediaType,
  Message,
  NotificationType,
  Post,
  ShareField,
  Story,
  Supporter,
  SupporterConsent,
  User,
} from './types';

type SignUpInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  accountType?: User['accountType'];
  role?: string;
  party?: string;
  city?: string;
  state?: string;
  /** data de nascimento DD/MM/AAAA: a rede é só para maiores de 18 */
  birthDate: string;
  /** "Tenho 18 anos ou mais e aceito os Termos de uso e a Política de Privacidade" */
  acceptedTerms: boolean;
  shareProfile?: ShareProfile;
};
export type SignInResult = { ok: true } | { ok: false; error: string } | { ok: false; needsCode: true };
/** Dados para ligar a autenticação em dois fatores (app autenticador, ex.: Google Authenticator) */
export type TwoFactorSetup = { factorId: string; qr: string; secret: string; uri: string };
export type ReportTarget = 'post' | 'comment' | 'profile' | 'battle' | 'app' | 'verificacao';
export type InteractionKind = 'comment' | 'message' | 'mention' | 'challenge';
type ConsentInput = { fields: ShareField[]; email?: string; whatsapp?: string; interests: string[] };
type ProfileUpdate = Partial<
  Pick<
    User,
    | 'name'
    | 'username'
    | 'bio'
    | 'role'
    | 'party'
    | 'website'
    | 'avatar'
    | 'accountType'
    | 'city'
    | 'state'
    | 'gender'
    | 'birthYear'
    | 'interests'
  >
>;

type AppState = {
  me: User | null;
  /** false enquanto verifica se já havia login salvo neste aparelho */
  ready: boolean;
  /** último erro ao gravar no banco (a tela mostra um aviso) */
  syncError: string | null;
  clearSyncError: () => void;
  /** baixa tudo de novo do banco */
  refresh: () => Promise<void>;
  users: User[];
  posts: Post[];
  comments: Comment[];
  stories: Story[];
  follows: Follow[];
  notifications: AppNotification[];
  conversations: Conversation[];
  messages: Message[];
  battles: LiveBattle[];
  battleMessages: BattleMessage[];

  // autenticação
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** confere o código do app autenticador no login */
  verifyLoginCode: (code: string) => Promise<string | null>;
  cancelLoginCode: () => void;
  // dois fatores de verdade (Supabase MFA / TOTP)
  twoFactorEnabled: boolean;
  startTwoFactor: () => Promise<TwoFactorSetup | string>;
  confirmTwoFactor: (factorId: string, code: string) => Promise<string | null>;
  disableTwoFactor: () => Promise<string | null>;
  /** desconecta a conta de todos os outros aparelhos */
  signOutOtherDevices: () => Promise<string | null>;
  /** denúncia / pedido gravado no banco para a equipe analisar */
  report: (targetType: ReportTarget, targetId: string | null, reason: string) => Promise<string | null>;
  /** avisa quando a batalha agendada começar */
  remindBattle: (battleId: string) => Promise<string | null>;
  acceptBattle: (battleId: string) => void;
  declineBattle: (battleId: string) => void;
  changePassword: (current: string, next: string) => Promise<string | null>;
  deleteAccount: () => Promise<void>;
  exportMyData: () => string;
  signUp: (input: SignUpInput) => Promise<string | null>;
  signOut: () => void;
  updateProfile: (changes: ProfileUpdate) => string | null;

  // consultas
  getUser: (id: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;
  getPost: (id: string) => Post | undefined;
  postsBy: (userId: string) => Post[];
  commentsFor: (postId: string) => Comment[];
  followersOf: (userId: string) => User[];
  followingOf: (userId: string) => User[];
  isFollowing: (userId: string) => boolean;
  feed: () => Post[];
  storyUsers: () => { user: User; stories: Story[]; seen: boolean; closeFriends: boolean }[];
  conversationMessages: (conversationId: string) => Message[];

  // privacidade
  canInteract: (userId: string, kind: InteractionKind) => boolean;
  canSeeContent: (userId: string) => boolean;
  activityText: (userId: string) => string | null;
  mentionError: (text: string) => string | null;
  followRequests: FollowRequest[];
  hasRequested: (userId: string) => boolean;
  respondFollowRequest: (fromId: string, accept: boolean) => void;

  // ações
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  addComment: (postId: string, text: string) => string | null;
  createPost: (input: { type: MediaType; uri: string; caption: string; location?: string }) => Post | string | null;
  deletePost: (postId: string) => void;
  addStory: (uri: string, closeFriends?: boolean) => void;
  markStorySeen: (storyId: string) => void;
  toggleFollow: (userId: string) => void;
  /** abre (ou reaproveita) a conversa; null se a pessoa não recebe mensagens de você */
  openConversationWith: (userId: string) => Promise<string | null>;
  sendMessage: (conversationId: string, text: string) => void;

  // batalhas de lives
  getBattle: (id: string) => LiveBattle | undefined;
  messagesForBattle: (battleId: string) => BattleMessage[];
  createBattle: (input: { opponentId: string; topic: string; durationSec: number; scheduleAt?: number }) => LiveBattle | null;
  supportBattle: (battleId: string, side: BattleSide, points: number) => void;
  sendBattleMessage: (battleId: string, text: string) => void;
  /** curtidas da plateia (o app junta vários toques num envio só) */
  likeBattle: (battleId: string, amount: number, side?: 'host' | 'opponent' | null) => void;
  /** entra na sala (conta quem está assistindo); devolve a função para sair */
  joinBattle: (battleId: string) => () => void;
  startBattle: (battleId: string) => void;
  endBattle: (battleId: string) => void;

  // apoiadores (consentimento LGPD)
  consents: SupporterConsent[];
  consentFor: (politicianId: string) => SupporterConsent | undefined;
  giveConsent: (politicianId: string, input: ConsentInput) => string | null;
  revokeConsent: (consentId: string) => void;
  supportersFor: (politicianId: string) => Supporter[];
};

const AppContext = createContext<AppState | null>(null);

/** Idade a partir de "DD/MM/AAAA" (null se a data for inválida) */
export function ageFrom(date: string, now = new Date()): number | null {
  const m = date.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(y, mo - 1, d);
  if (birth.getDate() !== d || birth.getMonth() !== mo - 1 || y < now.getFullYear() - 120 || birth > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age -= 1;
  return age;
}

/** id no formato do banco (uuid v4), criado no celular para a tela não precisar esperar o banco */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
const SUPPORT_POINTS = [1, 5, 20, 100];

// ---------- conversão linha do banco -> formato das telas ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function toUser(p: Row): User {
  return {
    id: p.id,
    accountType: p.account_type,
    username: p.username,
    name: p.name,
    avatar: p.avatar_url || '',
    bio: p.bio ?? '',
    role: p.role ?? undefined,
    party: p.party ?? undefined,
    website: p.website ?? undefined,
    verified: !!p.verified,
    city: p.city ?? undefined,
    state: p.state ?? undefined,
    gender: p.gender ?? undefined,
    birthYear: p.birth_year ?? undefined,
    interests: p.interests ?? [],
  };
}

function toBattle(b: Row, viewers = 0): LiveBattle {
  return {
    id: b.id,
    hostId: b.host_id,
    opponentId: b.opponent_id,
    topic: b.topic,
    status: b.status,
    startsAt: ms(b.starts_at),
    durationSec: b.duration_sec,
    viewers,
    scores: { host: b.score_host, opponent: b.score_opponent },
    likes: b.likes ?? 0,
    media: {},
  };
}

function toBattleMessage(e: Row, users: User[], battles: LiveBattle[]): BattleMessage {
  if (e.kind === 'support') {
    const b = battles.find((x) => x.id === e.battle_id);
    const target = b && users.find((u) => u.id === (e.side === 'host' ? b.hostId : b.opponentId));
    return {
      id: e.id,
      battleId: e.battle_id,
      userId: e.user_id,
      text: `apoiou ${target?.name ?? ''}`.trim(),
      support: { side: e.side, points: e.points },
      createdAt: ms(e.created_at),
    };
  }
  return { id: e.id, battleId: e.battle_id, userId: e.user_id, text: e.text ?? '', createdAt: ms(e.created_at) };
}

function toNotification(n: Row): AppNotification {
  return {
    id: n.id,
    type: n.type as NotificationType,
    toUserId: n.to_user_id,
    fromUserId: n.from_user_id ?? '',
    postId: n.post_id ?? undefined,
    battleId: n.battle_id ?? undefined,
    text: n.text ?? undefined,
    createdAt: ms(n.created_at),
  };
}

function toMessage(m: Row): Message {
  return { id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, createdAt: ms(m.created_at) };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Envia foto/vídeo do celular para o armazenamento e devolve o link público. */
async function uploadMedia(userId: string, uri: string, type: MediaType): Promise<string> {
  if (/^https?:\/\//.test(uri)) return uri;
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const header = res.headers.get('content-type') ?? '';
  const contentType = header && header !== 'application/octet-stream' ? header : type === 'video' ? 'video/mp4' : 'image/jpeg';
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('quicktime')
        ? 'mov'
        : type === 'video'
          ? 'mp4'
          : 'jpg';
  const path = `${userId}/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

function friendlyError(message: string | undefined) {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (m.includes('database error saving new user') || m.includes('duplicate key')) return 'Esse nome de usuário já está em uso.';
  if (m.includes('password should be') || m.includes('weak')) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem conexão com a internet.';
  if (m.includes('row-level security') || m.includes('violates')) return 'Essa ação não é permitida pelas regras de privacidade.';
  return message || 'Algo deu errado. Tente de novo.';
}

/** Configurações de privacidade que ficam no banco (para as outras pessoas também respeitarem) */
type ServerPrivacy = Pick<
  AccountSettings,
  'privateAccount' | 'showActivityStatus' | 'whoCanComment' | 'whoCanMessage' | 'whoCanMention' | 'whoCanChallenge' | 'blockedIds' | 'mutedIds' | 'closeFriendIds'
> & { reportIds: string[] };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { settings, accountSettings, updateAccount, removeAccount, setActiveAccount, activeAccountId } = useSettings();
  const [pendingLogin, setPendingLogin] = useState<{ userId: string; factorId: string; email?: string } | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [lastActive, setLastActive] = useState<Record<string, number>>({});

  useEffect(() => setActiveAccount(meId), [meId, setActiveAccount]);
  const blocked = useMemo(() => new Set(settings.blockedIds), [settings.blockedIds]);
  const hiddenFromFeed = useMemo(() => new Set([...settings.blockedIds, ...settings.mutedIds]), [settings.blockedIds, settings.mutedIds]);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [battles, setBattles] = useState<LiveBattle[]>([]);
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>([]);
  const [consents, setConsents] = useState<SupporterConsent[]>([]);

  const me = useMemo(() => users.find((u) => u.id === meId) ?? null, [users, meId]);

  // refs para usar o valor mais novo dentro de funções assíncronas e do tempo real
  const usersRef = useRef(users);
  usersRef.current = users;
  const battlesRef = useRef(battles);
  battlesRef.current = battles;
  const meIdRef = useRef(meId);
  meIdRef.current = meId;
  /** gravações no banco ainda em andamento */
  const pendingWrites = useRef(0);
  const writeVersion = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const accountSettingsRef = useRef(accountSettings);
  accountSettingsRef.current = accountSettings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** quantas pessoas estão em cada sala de batalha (presença em tempo real) */
  const viewersRef = useRef<Record<string, number>>({});
  /** o que o banco tem de privacidade da minha conta (para saber o que mudou e precisa ser enviado) */
  const synced = useRef<ServerPrivacy | null>(null);

  const fail = useCallback((message?: string) => setSyncError(friendlyError(message)), []);
  const clearSyncError = useCallback(() => setSyncError(null), []);

  // ---------- baixar tudo do banco ----------
  const loadAll = useCallback(
    /** devolve false se algo foi gravado durante a leitura (aí os dados lidos já estão velhos e não são aplicados) */
    async (uid: string, version?: number): Promise<boolean> => {
      const q = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('follows').select('follower_id, following_id'),
        supabase.from('follow_requests').select('*'),
        supabase.from('blocks').select('*'),
        supabase.from('mutes').select('*'),
        supabase.from('close_friends').select('*'),
        supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('likes').select('post_id, user_id'),
        supabase.from('saves').select('post_id, user_id'),
        supabase.from('comments').select('*').order('created_at').limit(3000),
        supabase.from('comment_likes').select('*'),
        supabase.from('stories').select('*'),
        supabase.from('story_views').select('*'),
        supabase.from('conversation_members').select('*'),
        supabase.from('messages').select('*').order('created_at').limit(3000),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('battles').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('battle_events').select('*').order('created_at', { ascending: false }).limit(1500),
        supabase.from('consents').select('*'),
        supabase.from('devices').select('*').order('last_active_at', { ascending: false }),
      ]);
      const err = q.find((r) => r.error)?.error;
      if (err) throw err;
      if (version !== undefined && (version !== writeVersion.current || pendingWrites.current > 0)) return false;
      const [profiles, fo, fr, bl, mu, cf, po, li, sa, co, cl, st, sv, cm, me_, no, ba, be, cs, dv] = q.map((r) => (r.data ?? []) as Row[]);

      const userList = profiles.map(toUser);
      setUsers(userList);
      setLastActive(Object.fromEntries(profiles.filter((p) => p.last_active_at).map((p) => [p.id, ms(p.last_active_at)])));
      setFollows(fo.map((f) => ({ followerId: f.follower_id, followingId: f.following_id })));
      setFollowRequests(fr.map((r) => ({ fromId: r.from_id, toId: r.to_id, createdAt: ms(r.created_at) })));

      const group = (rows: Row[], key: string, val: string) => {
        const m = new Map<string, string[]>();
        rows.forEach((r) => m.set(r[key], [...(m.get(r[key]) ?? []), r[val]]));
        return m;
      };
      const likesBy = group(li, 'post_id', 'user_id');
      const savesBy = group(sa, 'post_id', 'user_id');
      setPosts(
        po.map((p) => ({
          id: p.id,
          userId: p.user_id,
          type: p.type,
          uri: p.media_url,
          thumbnail: p.thumbnail_url ?? undefined,
          caption: p.caption ?? '',
          location: p.location ?? undefined,
          createdAt: ms(p.created_at),
          likes: likesBy.get(p.id) ?? [],
          savedBy: savesBy.get(p.id) ?? [],
        })),
      );
      const commentLikes = group(cl, 'comment_id', 'user_id');
      setComments(
        co.map((c) => ({ id: c.id, postId: c.post_id, userId: c.user_id, text: c.text, createdAt: ms(c.created_at), likes: commentLikes.get(c.id) ?? [] })),
      );
      const views = group(sv, 'story_id', 'user_id');
      setStories(
        st.map((s) => ({
          id: s.id,
          userId: s.user_id,
          uri: s.media_url,
          createdAt: ms(s.created_at),
          seenBy: [...new Set([s.user_id, ...(views.get(s.id) ?? [])])],
          closeFriends: s.close_friends || undefined,
        })),
      );
      const members = group(cm, 'conversation_id', 'user_id');
      setConversations([...members.entries()].map(([id, participantIds]) => ({ id, participantIds })));
      setMessages(me_.map(toMessage));
      setNotifications(no.map(toNotification));

      const battleList = ba.map((b) => toBattle(b));
      setBattles(battleList.map((b) => ({ ...b, viewers: viewersRef.current[b.id] ?? 0 })));
      setBattleMessages(be.filter((e) => e.kind !== 'like').reverse().map((e) => toBattleMessage(e, userList, battleList)));
      setConsents(
        cs.map((c) => ({
          id: c.id,
          politicianId: c.politician_id,
          userId: c.user_id,
          fields: c.fields,
          email: c.email ?? undefined,
          whatsapp: c.whatsapp ?? undefined,
          interests: c.interests ?? [],
          createdAt: ms(c.created_at),
        })),
      );

      // Aparelhos conectados (vêm do banco: valem para todos os aparelhos da conta)
      updateAccount(uid, {
        devices: dv.map(
          (d): Device => ({
            id: d.device_id,
            name: d.name,
            where: d.platform === 'web' ? 'Navegador' : 'Celular',
            lastActiveAt: ms(d.last_active_at),
            icon: d.platform === 'web' ? 'globe-outline' : 'phone-portrait-outline',
          }),
        ),
      });

      // Regras de privacidade de cada conta (as telas leem por accountSettings(id))
      const myBlocks = bl.filter((b) => b.blocker_id === uid).map((b) => b.blocked_id as string);
      const blockedMe = new Set(bl.filter((b) => b.blocked_id === uid).map((b) => b.blocker_id as string));
      const myMutes = mu.filter((m) => m.muter_id === uid).map((m) => m.muted_id as string);
      const myFriends = cf.filter((c) => c.owner_id === uid).map((c) => c.friend_id as string);
      const listedMe = new Set(cf.filter((c) => c.friend_id === uid).map((c) => c.owner_id as string));
      profiles.forEach((p) => {
        const privacy = {
          privateAccount: !!p.private_account,
          showActivityStatus: p.show_activity !== false,
          whoCanComment: p.who_can_comment as Audience,
          whoCanMessage: p.who_can_message as Audience,
          whoCanMention: p.who_can_mention as Audience,
          whoCanChallenge: p.who_can_challenge as Audience,
        };
        if (p.id === uid) {
          const mine = { ...privacy, blockedIds: myBlocks, mutedIds: myMutes, closeFriendIds: myFriends };
          synced.current = { ...mine, reportIds: accountSettingsRef.current(uid).reports.map((r) => r.id) };
          updateAccount(uid, mine);
        } else {
          updateAccount(p.id, {
            ...privacy,
            blockedIds: blockedMe.has(p.id) ? [uid] : [],
            closeFriendIds: listedMe.has(p.id) ? [uid] : [],
            mutedIds: [],
          });
        }
      });
      return true;
    },
    [updateAccount],
  );

  const refresh = useCallback(async (): Promise<void> => {
    const uid = meIdRef.current;
    if (!uid) return;
    // se ainda tem algo sendo gravado, espera terminar (senão a tela "desfaz" o toque por um instante)
    if (pendingWrites.current > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      return refreshRef.current();
    }
    try {
      await supabase.rpc('end_expired_battles');
      const applied = await loadAll(uid, writeVersion.current);
      if (!applied) {
        await new Promise((r) => setTimeout(r, 1200));
        return refreshRef.current();
      }
    } catch (e) {
      fail((e as Error).message);
    }
  }, [loadAll, fail]);
  refreshRef.current = refresh;

  /** Conclui o login: guarda o e-mail, registra este aparelho e carrega os dados. */
  const completeLogin = useCallback(
    async (userId: string, email?: string, fresh = false) => {
      const acctBefore = accountSettingsRef.current(userId);
      // registra este aparelho; num login novo, cria o alerta "Novo acesso" (se ligado)
      const deviceName = Platform.OS === 'web' ? 'Navegador' : Platform.OS === 'ios' ? 'iPhone' : 'Celular Android';
      await supabase
        .rpc('register_login', { p_device_id: settingsRef.current.deviceId || 'aparelho', p_name: deviceName, p_platform: Platform.OS, p_alert: fresh && acctBefore.loginAlerts })
        .then(() => {}, () => {});
      const factors = await supabase.auth.mfa.listFactors().catch(() => null);
      setTwoFactorEnabled(!!factors?.data?.totp?.some((f) => f.status === 'verified'));
      await loadAll(userId);
      const acct = accountSettingsRef.current(userId);
      updateAccount(userId, {
        email: acct.email || email || '',
        // a senha agora é do servidor; isso só faz a tela de segurança mostrar "Alterar senha"
        passwordHash: 'servidor',
      });
      setPendingLogin(null);
      setMeId(userId);
    },
    [loadAll, updateAccount],
  );

  // Login que já estava salvo neste aparelho
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (user && alive) {
          // conta com dois fatores e sessão sem o código: pede login de novo
          const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => null);
          if (aal?.data?.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') await supabase.auth.signOut().catch(() => {});
          else await completeLogin(user.id, user.email);
        }
      } catch {
        // sem internet ou sessão vencida: mostra a tela de login
      } finally {
        if (alive) setReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setMeId(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // só na abertura do app
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tempo real (batalhas, mensagens, notificações) + atualização periódica + "visto por último"
  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`app-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, (payload) => {
        const row = payload.new as Row;
        if (!row?.id) return;
        setBattles((prev) => {
          const old = prev.find((b) => b.id === row.id);
          const next = toBattle(row, old?.viewers ?? 0);
          return old ? prev.map((b) => (b.id === row.id ? next : b)) : [next, ...prev];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_events' }, (payload) => {
        const row = payload.new as Row;
        if (row.kind === 'like') return; // curtidas só mudam o total (chega pela batalha)
        setBattleMessages((prev) =>
          prev.some((m) => m.id === row.id) ? prev : [...prev, toBattleMessage(row, usersRef.current, battlesRef.current)],
        );
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Row;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, toMessage(row)]));
        setConversations((prev) => {
          if (!prev.some((c) => c.id === row.conversation_id)) setTimeout(() => refresh(), 0);
          return prev;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const row = payload.new as Row;
        setNotifications((prev) => (prev.some((n) => n.id === row.id) ? prev : [toNotification(row), ...prev]));
        // seguidor novo, pedido, curtida: atualiza o resto também
        if (row.type === 'follow' || row.type === 'request') setTimeout(() => refresh(), 300);
      })
      .subscribe();

    const ping = () => supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', meId).then(() => {});
    ping();
    const every30 = setInterval(() => refresh(), 30000);
    const every60 = setInterval(ping, 60000);
    const appState = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh();
        ping();
      }
    });
    return () => {
      supabase.removeChannel(channel);
      clearInterval(every30);
      clearInterval(every60);
      appState.remove();
    };
  }, [meId, refresh]);

  // Envia ao banco as mudanças de privacidade/bloqueios que a pessoa fez nas Configurações
  useEffect(() => {
    const prev = synced.current;
    // só depois que as configurações exibidas já são as desta conta
    if (!meId || !prev || activeAccountId !== meId) return;
    const now: ServerPrivacy = {
      privateAccount: settings.privateAccount,
      showActivityStatus: settings.showActivityStatus,
      whoCanComment: settings.whoCanComment,
      whoCanMessage: settings.whoCanMessage,
      whoCanMention: settings.whoCanMention,
      whoCanChallenge: settings.whoCanChallenge,
      blockedIds: settings.blockedIds,
      mutedIds: settings.mutedIds,
      closeFriendIds: settings.closeFriendIds,
      reportIds: settings.reports.map((r) => r.id),
    };
    synced.current = now;
    const jobs: PromiseLike<{ error: { message: string } | null }>[] = [];
    if (
      prev.privateAccount !== now.privateAccount ||
      prev.showActivityStatus !== now.showActivityStatus ||
      prev.whoCanComment !== now.whoCanComment ||
      prev.whoCanMessage !== now.whoCanMessage ||
      prev.whoCanMention !== now.whoCanMention ||
      prev.whoCanChallenge !== now.whoCanChallenge
    ) {
      jobs.push(
        supabase
          .from('profiles')
          .update({
            private_account: now.privateAccount,
            show_activity: now.showActivityStatus,
            who_can_comment: now.whoCanComment,
            who_can_message: now.whoCanMessage,
            who_can_mention: now.whoCanMention,
            who_can_challenge: now.whoCanChallenge,
          })
          .eq('id', meId),
      );
    }
    const diff = (table: string, mineCol: string, otherCol: string, before: string[], after: string[]) => {
      const added = after.filter((x) => !before.includes(x));
      const removed = before.filter((x) => !after.includes(x));
      if (added.length) jobs.push(supabase.from(table).upsert(added.map((id) => ({ [mineCol]: meId, [otherCol]: id })), { ignoreDuplicates: true }));
      if (removed.length) jobs.push(supabase.from(table).delete().eq(mineCol, meId).in(otherCol, removed));
    };
    diff('blocks', 'blocker_id', 'blocked_id', prev.blockedIds, now.blockedIds);
    diff('mutes', 'muter_id', 'muted_id', prev.mutedIds, now.mutedIds);
    diff('close_friends', 'owner_id', 'friend_id', prev.closeFriendIds, now.closeFriendIds);
    // Bloquear também desfaz o "seguir" nos dois sentidos (como nas grandes redes)
    const newlyBlocked = now.blockedIds.filter((x) => !prev.blockedIds.includes(x));
    newlyBlocked.forEach((id) => {
      jobs.push(supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', id));
      jobs.push(supabase.from('follows').delete().eq('follower_id', id).eq('following_id', meId));
    });
    if (newlyBlocked.length)
      setFollows((f) => f.filter((x) => !(newlyBlocked.includes(x.followerId) && x.followingId === meId) && !(x.followerId === meId && newlyBlocked.includes(x.followingId))));
    // Relatos de problema (Ajuda) viram denúncias no banco
    settings.reports
      .filter((r) => !prev.reportIds.includes(r.id))
      .forEach((r) => jobs.push(supabase.from('reports').insert({ reporter_id: meId, target_type: 'app', reason: r.text.slice(0, 2000) })));
    if (!jobs.length) return;
    Promise.all(jobs).then((results) => {
      const err = results.find((r) => r.error)?.error;
      if (err) {
        fail(err.message);
        refresh();
      }
    });
  }, [
    meId,
    activeAccountId,
    settings.privateAccount,
    settings.showActivityStatus,
    settings.whoCanComment,
    settings.whoCanMessage,
    settings.whoCanMention,
    settings.whoCanChallenge,
    settings.blockedIds,
    settings.mutedIds,
    settings.closeFriendIds,
    settings.reports,
    fail,
    refresh,
  ]);

  /** grava no banco; se der erro, avisa e recarrega (a tela volta ao estado real) */
  const write = useCallback(
    (job: PromiseLike<{ error: { message: string } | null }>) => {
      pendingWrites.current += 1;
      writeVersion.current += 1;
      Promise.resolve(job)
        .finally(() => {
          pendingWrites.current -= 1;
        })
        .then(
        (r) => {
          if (r.error) {
            fail(r.error.message);
            refresh();
          }
        },
        (e: Error) => {
          fail(e.message);
          refresh();
        },
      );
    },
    [fail, refresh],
  );

  // ---------- autenticação ----------
  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const clean = email.trim().toLowerCase();
      if (!clean || !password) return { ok: false, error: 'Preencha e-mail e senha.' };
      if (!clean.includes('@')) return { ok: false, error: 'Entre com o e-mail que você usou no cadastro.' };
      const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (error || !data.user) return { ok: false, error: friendlyError(error?.message) };
      // dois fatores ligado: pede o código do app autenticador
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => null);
      if (aal?.data?.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
        const factors = await supabase.auth.mfa.listFactors();
        const factor = factors.data?.totp?.find((f) => f.status === 'verified');
        if (factor) {
          setPendingLogin({ userId: data.user.id, factorId: factor.id, email: data.user.email });
          return { ok: false, needsCode: true };
        }
      }
      try {
        await completeLogin(data.user.id, data.user.email, true);
      } catch (e) {
        return { ok: false, error: friendlyError((e as Error).message) };
      }
      return { ok: true };
    },
    [completeLogin],
  );

  const verifyLoginCode = useCallback(
    async (code: string) => {
      if (!pendingLogin) return 'Comece o login de novo.';
      const clean = code.replace(/\D/g, '');
      if (clean.length !== 6) return 'Digite os 6 números do app autenticador.';
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pendingLogin.factorId, code: clean });
      if (error) return 'Código incorreto ou vencido. Use o código que está aparecendo agora no app.';
      try {
        await completeLogin(pendingLogin.userId, pendingLogin.email, true);
      } catch (e) {
        return friendlyError((e as Error).message);
      }
      return null;
    },
    [pendingLogin, completeLogin],
  );

  // ---------- dois fatores (app autenticador) ----------
  const startTwoFactor = useCallback(async (): Promise<TwoFactorSetup | string> => {
    // remove tentativas antigas não concluídas
    const old = await supabase.auth.mfa.listFactors();
    for (const f of old.data?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Rede Política ${Date.now()}` });
    if (error || !data) return friendlyError(error?.message);
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
  }, []);

  const confirmTwoFactor = useCallback(async (factorId: string, code: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) return 'Digite os 6 números que aparecem no app autenticador.';
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (error) return 'Código incorreto. Confira se o relógio do celular está certo e use o código atual.';
    setTwoFactorEnabled(true);
    return null;
  }, []);

  const disableTwoFactor = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.totp ?? []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) return 'Para desligar, saia e entre de novo usando o código do app autenticador.';
    }
    setTwoFactorEnabled(false);
    return null;
  }, []);

  const signOutOtherDevices = useCallback(async () => {
    if (!meId) return 'Não autenticado.';
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) return friendlyError(error.message);
    await supabase.from('devices').delete().eq('user_id', meId).neq('device_id', settingsRef.current.deviceId || 'aparelho');
    await refresh();
    return null;
  }, [meId, refresh]);

  const report = useCallback(
    async (targetType: ReportTarget, targetId: string | null, reason: string) => {
      if (!meId) return 'Não autenticado.';
      const text = reason.trim().slice(0, 2000);
      if (!text) return 'Escreva o motivo.';
      const { error } = await supabase.from('reports').insert({ reporter_id: meId, target_type: targetType, target_id: targetId, reason: text });
      return error ? friendlyError(error.message) : null;
    },
    [meId],
  );

  const remindBattle = useCallback(
    async (battleId: string) => {
      if (!meId) return 'Não autenticado.';
      const { error } = await supabase.from('battle_reminders').upsert({ battle_id: battleId, user_id: meId }, { ignoreDuplicates: true });
      return error ? friendlyError(error.message) : null;
    },
    [meId],
  );

  const cancelLoginCode = useCallback(() => {
    setPendingLogin(null);
    supabase.auth.signOut().catch(() => {});
  }, []);

  const signUp = useCallback(
    async ({ name, username, email, password, accountType = 'cidadao', role, party, city, state, birthDate, acceptedTerms }: SignUpInput) => {
      const clean = username.trim().replace(/^@/, '').toLowerCase();
      if (!name.trim() || !clean || !email.trim() || !password) return 'Preencha todos os campos.';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Informe um e-mail válido.';
      if (!/^[a-z0-9._]{3,30}$/.test(clean)) return 'O usuário deve ter 3 a 30 letras, números, ponto ou _.';
      if (password.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
      const age = ageFrom(birthDate);
      if (age === null) return 'Informe a data de nascimento no formato DD/MM/AAAA.';
      if (age < 18) return 'A Rede Política é só para maiores de 18 anos.';
      if (!acceptedTerms) return 'Para criar a conta, confirme que tem 18 anos ou mais e aceite os Termos.';
      if (accountType === 'politico' && (!role?.trim() || !city?.trim() || !state?.trim()))
        return 'Para conta política, informe cargo/pretensão, cidade e UF.';
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            username: clean,
            name: name.trim(),
            account_type: accountType,
            role: accountType === 'politico' ? role!.trim() : 'Cidadão',
            party: party?.trim() || null,
            city: city?.trim() || null,
            state: state?.trim().toUpperCase() || null,
            birth_year: Number(birthDate.trim().slice(-4)),
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (error) return friendlyError(error.message);
      if (!data.user) return 'Não foi possível criar a conta.';
      // Sem sessão = o projeto está pedindo confirmação de e-mail
      if (!data.session) return 'Conta criada! Abra o e-mail de confirmação e depois toque em "Entrar".';
      updateAccount(data.user.id, { termsAcceptedAt: Date.now(), email: email.trim() });
      try {
        await completeLogin(data.user.id, data.user.email, true);
      } catch (e) {
        return friendlyError((e as Error).message);
      }
      return null;
    },
    [updateAccount, completeLogin],
  );

  const signOut = useCallback(() => {
    synced.current = null;
    setMeId(null);
    setUsers([]);
    setPosts([]);
    setComments([]);
    setStories([]);
    setFollows([]);
    setNotifications([]);
    setConversations([]);
    setMessages([]);
    setBattles([]);
    setBattleMessages([]);
    setConsents([]);
    setFollowRequests([]);
    supabase.auth.signOut().catch(() => {});
  }, []);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!meId) return 'Não autenticado.';
      if (!current || !next) return 'Preencha as senhas.';
      if (next.length < 8) return 'A nova senha precisa de pelo menos 8 caracteres.';
      if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) return 'Use letras e números na nova senha.';
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) return 'Entre de novo e tente outra vez.';
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) return 'A senha atual está errada.';
      const { error } = await supabase.auth.updateUser({ password: next });
      return error ? friendlyError(error.message) : null;
    },
    [meId],
  );

  const updateProfile = useCallback(
    (changes: ProfileUpdate) => {
      if (!meId) return 'Não autenticado.';
      if (changes.username !== undefined) {
        const clean = changes.username.trim().replace(/^@/, '').toLowerCase();
        if (!/^[a-z0-9._]{3,30}$/.test(clean)) return 'O usuário deve ter 3 a 30 letras, números, ponto ou _.';
        if (users.some((u) => u.username === clean && u.id !== meId)) return 'Esse nome de usuário já está em uso.';
        changes = { ...changes, username: clean };
      }
      setUsers((prev) => prev.map((u) => (u.id === meId ? { ...u, ...changes } : u)));
      const { avatar, accountType, birthYear, ...rest } = changes;
      const row: Row = { ...rest };
      if (accountType !== undefined) row.account_type = accountType;
      if (birthYear !== undefined) row.birth_year = birthYear;
      ['role', 'party', 'website', 'city', 'state', 'gender'].forEach((k) => {
        if (k in row && !row[k]) row[k] = null;
      });
      write(
        (async () => {
          if (avatar !== undefined) row.avatar_url = avatar ? await uploadMedia(meId, avatar, 'image') : null;
          const r = await supabase.from('profiles').update(row).eq('id', meId);
          if (!r.error && row.avatar_url) setUsers((prev) => prev.map((u) => (u.id === meId ? { ...u, avatar: row.avatar_url } : u)));
          return r;
        })(),
      );
      return null;
    },
    [meId, users, write],
  );

  // ---------- consultas ----------
  const getUser = useCallback((id: string) => users.find((u) => u.id === id), [users]);
  const getUserByUsername = useCallback((username: string) => users.find((u) => u.username === username), [users]);
  const getPost = useCallback((id: string) => posts.find((p) => p.id === id), [posts]);
  const postsBy = useCallback(
    (userId: string) => posts.filter((p) => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
    [posts],
  );
  const commentsFor = useCallback(
    (postId: string) =>
      comments.filter((c) => c.postId === postId && !blocked.has(c.userId)).sort((a, b) => a.createdAt - b.createdAt),
    [comments, blocked],
  );
  const followersOf = useCallback(
    (userId: string) =>
      follows
        .filter((f) => f.followingId === userId)
        .map((f) => users.find((u) => u.id === f.followerId))
        .filter((u): u is User => !!u),
    [follows, users],
  );
  const followingOf = useCallback(
    (userId: string) =>
      follows
        .filter((f) => f.followerId === userId)
        .map((f) => users.find((u) => u.id === f.followingId))
        .filter((u): u is User => !!u),
    [follows, users],
  );
  const isFollowing = useCallback(
    (userId: string) => follows.some((f) => f.followerId === meId && f.followingId === userId),
    [follows, meId],
  );

  const canInteract = useCallback(
    (userId: string, kind: InteractionKind) => {
      if (!meId || userId === meId) return true;
      if (settings.blockedIds.includes(userId) || accountSettings(userId).blockedIds.includes(meId)) return false;
      const a = accountSettings(userId);
      const rule =
        kind === 'comment' ? a.whoCanComment : kind === 'message' ? a.whoCanMessage : kind === 'mention' ? a.whoCanMention : a.whoCanChallenge;
      if (rule === 'todos') return true;
      if (rule === 'ninguem') return false;
      return follows.some((f) => f.followerId === userId && f.followingId === meId);
    },
    [meId, settings.blockedIds, accountSettings, follows],
  );

  const canSeeContent = useCallback(
    (userId: string) =>
      !meId ||
      userId === meId ||
      !accountSettings(userId).privateAccount ||
      follows.some((f) => f.followerId === meId && f.followingId === userId),
    [meId, accountSettings, follows],
  );

  const activityText = useCallback(
    (userId: string) => {
      if (!settings.showActivityStatus || !accountSettings(userId).showActivityStatus) return null;
      const ts = lastActive[userId];
      if (!ts) return null;
      return Date.now() - ts < 2 * 60 * 1000 ? 'Ativo agora' : `Ativo há ${timeAgo(ts)}`;
    },
    [settings.showActivityStatus, accountSettings, lastActive],
  );

  const mentioned = useCallback(
    (text: string) =>
      [...new Set([...text.matchAll(/@([a-z0-9._]+)/gi)].map((m) => m[1].toLowerCase()))]
        .map((u) => users.find((x) => x.username === u))
        .filter((u): u is User => !!u && u.id !== meId),
    [users, meId],
  );

  const mentionError = useCallback(
    (text: string) => {
      const blockedMention = mentioned(text).find((u) => !canInteract(u.id, 'mention'));
      return blockedMention ? `@${blockedMention.username} não permite ser mencionado(a) por você.` : null;
    },
    [mentioned, canInteract],
  );

  const hasRequested = useCallback(
    (userId: string) => followRequests.some((r) => r.fromId === meId && r.toId === userId),
    [followRequests, meId],
  );

  const respondFollowRequest = useCallback(
    (fromId: string, accept: boolean) => {
      if (!meId) return;
      setFollowRequests((prev) => prev.filter((r) => !(r.fromId === fromId && r.toId === meId)));
      if (accept) setFollows((prev) => [...prev, { followerId: fromId, followingId: meId }]);
      write(
        (async () => {
          // aceitar: primeiro cria o "seguir" (o banco confere que o pedido existe), depois apaga o pedido
          if (accept) {
            const r = await supabase.from('follows').insert({ follower_id: fromId, following_id: meId });
            if (r.error) return r;
          }
          return supabase.from('follow_requests').delete().eq('from_id', fromId).eq('to_id', meId);
        })(),
      );
    },
    [meId, write],
  );

  const feed = useCallback(() => {
    const following = new Set(follows.filter((f) => f.followerId === meId).map((f) => f.followingId));
    if (meId) following.add(meId);
    const visible = posts.filter((p) => !hiddenFromFeed.has(p.userId) && canSeeContent(p.userId));
    const mine = visible.filter((p) => following.has(p.userId));
    // Com poucas pessoas na rede, mostra todas as publicações (seguindo primeiro)
    const others = visible.filter((p) => !following.has(p.userId));
    const byDate = (a: Post, b: Post) => b.createdAt - a.createdAt;
    return [...mine.sort(byDate), ...others.sort(byDate)];
  }, [follows, posts, meId, hiddenFromFeed, canSeeContent]);

  const storyUsers = useCallback(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const byUser = new Map<string, Story[]>();
    stories
      .filter(
        (s) =>
          s.createdAt > dayAgo &&
          !hiddenFromFeed.has(s.userId) &&
          canSeeContent(s.userId) &&
          (!s.closeFriends || s.userId === meId || (!!meId && accountSettings(s.userId).closeFriendIds.includes(meId))),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((s) => byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]));
    const list = [...byUser.entries()]
      .map(([userId, list]) => ({
        user: users.find((u) => u.id === userId)!,
        stories: list,
        seen: !!meId && list.every((s) => s.seenBy.includes(meId)),
        closeFriends: list.some((s) => s.closeFriends),
      }))
      .filter((x) => !!x.user);
    return list.sort((a, b) => {
      if (a.user.id === meId) return -1;
      if (b.user.id === meId) return 1;
      return Number(a.seen) - Number(b.seen);
    });
  }, [stories, users, meId, hiddenFromFeed, canSeeContent, accountSettings]);

  const conversationMessages = useCallback(
    (conversationId: string) =>
      messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt),
    [messages],
  );

  // ---------- ações ----------
  const toggleLike = useCallback(
    (postId: string) => {
      if (!meId) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const liked = post.likes.includes(meId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: liked ? p.likes.filter((id) => id !== meId) : [...p.likes, meId] } : p)),
      );
      write(
        liked
          ? supabase.from('likes').delete().eq('post_id', postId).eq('user_id', meId)
          : supabase.from('likes').upsert({ post_id: postId, user_id: meId }, { ignoreDuplicates: true }),
      );
    },
    [meId, posts, write],
  );

  const toggleSave = useCallback(
    (postId: string) => {
      if (!meId) return;
      const saved = !!posts.find((p) => p.id === postId)?.savedBy.includes(meId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, savedBy: saved ? p.savedBy.filter((id) => id !== meId) : [...p.savedBy, meId] } : p,
        ),
      );
      write(
        saved
          ? supabase.from('saves').delete().eq('post_id', postId).eq('user_id', meId)
          : supabase.from('saves').upsert({ post_id: postId, user_id: meId }, { ignoreDuplicates: true }),
      );
    },
    [meId, posts, write],
  );

  const toggleCommentLike = useCallback(
    (commentId: string) => {
      if (!meId) return;
      const liked = !!comments.find((c) => c.id === commentId)?.likes.includes(meId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, likes: liked ? c.likes.filter((id) => id !== meId) : [...c.likes, meId] } : c)),
      );
      write(
        liked
          ? supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', meId)
          : supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: meId }, { ignoreDuplicates: true }),
      );
    },
    [meId, comments, write],
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      const body = text.trim();
      if (!meId || !body) return null;
      if (body.length > 1000) return 'Comentário muito longo (máx. 1000 caracteres).';
      const post = posts.find((p) => p.id === postId);
      if (post && !canInteract(post.userId, 'comment')) return 'Essa conta limitou quem pode comentar.';
      const err = mentionError(body);
      if (err) return err;
      const id = uuid();
      setComments((prev) => [...prev, { id, postId, userId: meId, text: body, createdAt: Date.now(), likes: [] }]);
      // as notificações (comentário e menções) são criadas pelo próprio banco
      write(supabase.from('comments').insert({ id, post_id: postId, user_id: meId, text: body }));
      return null;
    },
    [meId, posts, canInteract, mentionError, write],
  );

  const createPost = useCallback(
    ({ type, uri, caption, location }: { type: MediaType; uri: string; caption: string; location?: string }) => {
      if (!meId) return null;
      const err = mentionError(caption);
      if (err) return err;
      if (caption.length > 2200) return 'Legenda muito longa (máx. 2200 caracteres).';
      const post: Post = {
        id: uuid(),
        userId: meId,
        type,
        uri,
        caption: caption.trim(),
        location: location?.trim() || undefined,
        createdAt: Date.now(),
        likes: [],
        savedBy: [],
      };
      setPosts((prev) => [post, ...prev]);
      write(
        (async () => {
          const url = await uploadMedia(meId, uri, type);
          const r = await supabase
            .from('posts')
            .insert({ id: post.id, user_id: meId, type, media_url: url, caption: post.caption, location: post.location ?? null });
          if (!r.error) setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, uri: url } : p)));
          return r;
        })(),
      );
      return post;
    },
    [meId, mentionError, write],
  );

  const deletePost = useCallback(
    (postId: string) => {
      if (!meId) return;
      setPosts((prev) => prev.filter((p) => !(p.id === postId && p.userId === meId)));
      setComments((prev) => prev.filter((c) => c.postId !== postId));
      write(supabase.from('posts').delete().eq('id', postId).eq('user_id', meId));
    },
    [meId, write],
  );

  const addStory = useCallback(
    (uri: string, closeFriends = false) => {
      if (!meId) return;
      const id = uuid();
      const type: MediaType = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri) ? 'video' : 'image';
      setStories((prev) => [...prev, { id, userId: meId, uri, createdAt: Date.now(), seenBy: [meId], closeFriends: closeFriends || undefined }]);
      write(
        (async () => {
          const url = await uploadMedia(meId, uri, type);
          const r = await supabase.from('stories').insert({ id, user_id: meId, media_url: url, close_friends: closeFriends });
          if (!r.error) setStories((prev) => prev.map((s) => (s.id === id ? { ...s, uri: url } : s)));
          return r;
        })(),
      );
    },
    [meId, write],
  );

  const markStorySeen = useCallback(
    (storyId: string) => {
      if (!meId) return;
      const story = stories.find((s) => s.id === storyId);
      if (!story || story.seenBy.includes(meId)) return;
      setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, seenBy: [...s.seenBy, meId] } : s)));
      supabase
        .from('story_views')
        .upsert({ story_id: storyId, user_id: meId }, { ignoreDuplicates: true })
        .then(() => {});
    },
    [meId, stories],
  );

  const toggleFollow = useCallback(
    (userId: string) => {
      if (!meId || userId === meId) return;
      const already = follows.some((f) => f.followerId === meId && f.followingId === userId);
      // Conta privada: em vez de seguir direto, envia (ou cancela) um pedido
      if (!already && accountSettings(userId).privateAccount) {
        const requested = followRequests.some((r) => r.fromId === meId && r.toId === userId);
        setFollowRequests((prev) =>
          requested
            ? prev.filter((r) => !(r.fromId === meId && r.toId === userId))
            : [...prev, { fromId: meId, toId: userId, createdAt: Date.now() }],
        );
        write(
          requested
            ? supabase.from('follow_requests').delete().eq('from_id', meId).eq('to_id', userId)
            : supabase.from('follow_requests').upsert({ from_id: meId, to_id: userId }, { ignoreDuplicates: true }),
        );
        return;
      }
      setFollows((prev) =>
        already
          ? prev.filter((f) => !(f.followerId === meId && f.followingId === userId))
          : [...prev, { followerId: meId, followingId: userId }],
      );
      write(
        already
          ? supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', userId)
          : supabase.from('follows').insert({ follower_id: meId, following_id: userId }),
      );
    },
    [meId, follows, accountSettings, followRequests, write],
  );

  const openConversationWith = useCallback(
    async (userId: string) => {
      if (!meId || userId === meId) return null;
      const existing = conversations.find(
        (c) => c.participantIds.length === 2 && c.participantIds.includes(meId) && c.participantIds.includes(userId),
      );
      if (existing) return existing.id;
      if (!canInteract(userId, 'message')) return null;
      const { data, error } = await supabase.rpc('open_conversation', { other: userId });
      if (error || !data) return null;
      const id = data as string;
      setConversations((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, { id, participantIds: [meId, userId] }]));
      return id;
    },
    [meId, conversations, canInteract],
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const body = text.trim().slice(0, 2000);
      if (!meId || !body) return;
      const id = uuid();
      setMessages((prev) => [...prev, { id, conversationId, senderId: meId, text: body, createdAt: Date.now() }]);
      write(supabase.from('messages').insert({ id, conversation_id: conversationId, sender_id: meId, text: body }));
    },
    [meId, write],
  );

  // ---------- batalhas ----------
  const getBattle = useCallback((id: string) => battles.find((b) => b.id === id), [battles]);

  const messagesForBattle = useCallback(
    (battleId: string) => battleMessages.filter((m) => m.battleId === battleId).sort((a, b) => a.createdAt - b.createdAt),
    [battleMessages],
  );

  const createBattle = useCallback(
    ({ opponentId, topic, durationSec, scheduleAt }: { opponentId: string; topic: string; durationSec: number; scheduleAt?: number }) => {
      if (!meId || opponentId === meId || topic.trim().length < 3) return null;
      const battle: LiveBattle = {
        id: uuid(),
        hostId: meId,
        opponentId,
        topic: topic.trim().slice(0, 90),
        status: scheduleAt ? 'scheduled' : 'invited',
        startsAt: scheduleAt ?? Date.now(),
        durationSec: Math.min(3600, Math.max(60, durationSec)),
        viewers: 0,
        scores: { host: 0, opponent: 0 },
        media: {},
      };
      setBattles((prev) => [battle, ...prev]);
      write(
        supabase.from('battles').insert({
          id: battle.id,
          host_id: meId,
          opponent_id: opponentId,
          topic: battle.topic,
          status: battle.status,
          starts_at: new Date(battle.startsAt).toISOString(),
          duration_sec: battle.durationSec,
        }),
      );
      return battle;
    },
    [meId, write],
  );

  const supportBattle = useCallback(
    (battleId: string, side: BattleSide, points: number) => {
      const battle = battles.find((b) => b.id === battleId);
      if (!meId || !SUPPORT_POINTS.includes(points) || !battle || battle.status !== 'live') return;
      if (battle.hostId === meId || battle.opponentId === meId) return;
      const id = uuid();
      const target = users.find((u) => u.id === (side === 'host' ? battle.hostId : battle.opponentId));
      // placar sobe na hora; o valor oficial chega do banco em tempo real
      setBattles((prev) => prev.map((b) => (b.id === battleId ? { ...b, scores: { ...b.scores, [side]: b.scores[side] + points } } : b)));
      setBattleMessages((prev) => [
        ...prev,
        { id, battleId, userId: meId, text: `apoiou ${target?.name ?? ''}`.trim(), support: { side, points }, createdAt: Date.now() },
      ]);
      write(supabase.from('battle_events').insert({ id, battle_id: battleId, user_id: meId, kind: 'support', side, points }));
    },
    [meId, battles, users, write],
  );

  const sendBattleMessage = useCallback(
    (battleId: string, text: string) => {
      const body = text.trim().slice(0, 300);
      if (!meId || !body) return;
      const id = uuid();
      setBattleMessages((prev) => [...prev, { id, battleId, userId: meId, text: body, createdAt: Date.now() }]);
      write(supabase.from('battle_events').insert({ id, battle_id: battleId, user_id: meId, kind: 'chat', text: body }));
    },
    [meId, write],
  );

  const likeBattle = useCallback(
    (battleId: string, amount: number, side?: 'host' | 'opponent' | null) => {
      const n = Math.max(1, Math.min(50, Math.round(amount)));
      if (!meId) return;
      // a barra anda na hora para o lado escolhido; o valor oficial vem do banco
      setBattles((prev) =>
        prev.map((b) =>
          b.id === battleId
            ? { ...b, likes: (b.likes ?? 0) + n, scores: side ? { ...b.scores, [side]: b.scores[side] + n } : b.scores }
            : b,
        ),
      );
      write(supabase.from('battle_events').insert({ id: uuid(), battle_id: battleId, user_id: meId, kind: 'like', amount: n, side: side ?? null }));
    },
    [meId, write],
  );

  const joinBattle = useCallback(
    (battleId: string) => {
      if (!meId) return () => {};
      const channel: RealtimeChannel = supabase.channel(`sala-${battleId}`, { config: { presence: { key: meId } } });
      channel
        .on('presence', { event: 'sync' }, () => {
          const count = Object.keys(channel.presenceState()).length;
          viewersRef.current[battleId] = count;
          setBattles((prev) => prev.map((b) => (b.id === battleId ? { ...b, viewers: count } : b)));
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') channel.track({ at: Date.now() });
        });
      return () => {
        supabase.removeChannel(channel);
      };
    },
    [meId],
  );

  // o desafiado aceita (a batalha começa) ou recusa (a batalha é encerrada)
  const acceptBattle = useCallback(
    (battleId: string) => {
      setBattles((prev) =>
        prev.map((b) => (b.id === battleId && b.status === 'invited' ? { ...b, status: 'live', startsAt: Date.now() } : b)),
      );
      write(supabase.from('battles').update({ status: 'live' }).eq('id', battleId).eq('status', 'invited'));
    },
    [write],
  );
  const declineBattle = useCallback(
    (battleId: string) => {
      setBattles((prev) => prev.map((b) => (b.id === battleId && b.status === 'invited' ? { ...b, status: 'ended' } : b)));
      write(supabase.from('battles').update({ status: 'ended' }).eq('id', battleId).eq('status', 'invited'));
    },
    [write],
  );

  const startBattle = useCallback(
    (battleId: string) => {
      setBattles((prev) =>
        prev.map((b) => (b.id === battleId && b.status === 'scheduled' ? { ...b, status: 'live', startsAt: Date.now() } : b)),
      );
      write(supabase.from('battles').update({ status: 'live' }).eq('id', battleId).eq('status', 'scheduled'));
    },
    [write],
  );

  const endBattle = useCallback(
    (battleId: string) => {
      const battle = battles.find((b) => b.id === battleId);
      if (!battle || battle.status !== 'live') return;
      setBattles((prev) => prev.map((b) => (b.id === battleId ? { ...b, status: 'ended' } : b)));
      // quem abriu encerra na hora; para os outros o banco encerra quando o tempo acabou
      if (battle.hostId === meId) write(supabase.from('battles').update({ status: 'ended' }).eq('id', battleId));
      else supabase.rpc('end_expired_battles').then(() => {});
    },
    [battles, meId, write],
  );

  // ---------- autorizações a políticos ----------
  const consentFor = useCallback(
    (politicianId: string) => consents.find((c) => c.politicianId === politicianId && c.userId === meId),
    [consents, meId],
  );

  const giveConsent = useCallback(
    (politicianId: string, { fields, email, whatsapp, interests }: ConsentInput) => {
      if (!meId || politicianId === meId) return 'Não é possível.';
      if (!fields.length) return 'Escolha pelo menos uma informação para compartilhar.';
      if (fields.includes('email') && !/^\S+@\S+\.\S+$/.test(email ?? '')) return 'Informe um e-mail válido.';
      if (fields.includes('whatsapp') && (whatsapp ?? '').replace(/\D/g, '').length < 10)
        return 'Informe um WhatsApp válido, com DDD.';
      const old = consents.find((c) => c.politicianId === politicianId && c.userId === meId);
      const consent: SupporterConsent = {
        id: old?.id ?? uuid(),
        politicianId,
        userId: meId,
        fields,
        email: fields.includes('email') ? email?.trim() : undefined,
        whatsapp: fields.includes('whatsapp') ? whatsapp?.trim() : undefined,
        interests: fields.includes('interesses') ? interests : [],
        createdAt: old?.createdAt ?? Date.now(),
      };
      setConsents((prev) => [...prev.filter((c) => !(c.politicianId === politicianId && c.userId === meId)), consent]);
      write(
        supabase.from('consents').upsert(
          {
            id: consent.id,
            politician_id: politicianId,
            user_id: meId,
            fields,
            email: consent.email ?? null,
            whatsapp: consent.whatsapp ?? null,
            interests: consent.interests,
          },
          { onConflict: 'politician_id,user_id' },
        ),
      );
      return null;
    },
    [meId, consents, write],
  );

  const revokeConsent = useCallback(
    (consentId: string) => {
      if (!meId) return;
      setConsents((prev) => prev.filter((c) => !(c.id === consentId && c.userId === meId)));
      write(supabase.from('consents').delete().eq('id', consentId).eq('user_id', meId));
    },
    [meId, write],
  );

  const supportersFor = useCallback(
    (politicianId: string) =>
      consents
        .filter((c) => c.politicianId === politicianId)
        .map((c): Supporter => {
          const u = users.find((x) => x.id === c.userId);
          const has = (f: ShareField) => c.fields.includes(f);
          return {
            consentId: c.id,
            userId: c.userId,
            name: has('nome') ? u?.name : undefined,
            username: has('nome') ? u?.username : undefined,
            avatar: has('nome') ? u?.avatar : undefined,
            city: has('cidade') ? u?.city : undefined,
            state: has('cidade') ? u?.state : undefined,
            ageRange: has('faixaEtaria') && u?.birthYear ? ageRangeOf(u.birthYear) : undefined,
            interests: has('interesses') ? c.interests : [],
            email: has('email') ? c.email : undefined,
            whatsapp: has('whatsapp') ? c.whatsapp : undefined,
            createdAt: c.createdAt,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [consents, users],
  );

  // ---------- meus dados ----------
  const exportMyData = useCallback(() => {
    if (!me) return '{}';
    const { passwordHash: _hidden, ...acct } = accountSettings(me.id);
    const data = {
      geradoEm: new Date().toISOString(),
      perfil: me,
      configuracoes: acct,
      publicacoes: posts.filter((p) => p.userId === me.id),
      comentarios: comments.filter((c) => c.userId === me.id),
      seguindo: follows.filter((f) => f.followerId === me.id).map((f) => users.find((u) => u.id === f.followingId)?.username),
      seguidores: follows.filter((f) => f.followingId === me.id).map((f) => users.find((u) => u.id === f.followerId)?.username),
      mensagens: messages.filter((m) => m.senderId === me.id),
      autorizacoesAPoliticos: consents.filter((c) => c.userId === me.id),
    };
    return JSON.stringify(data, null, 2);
  }, [me, accountSettings, posts, comments, follows, users, messages, consents]);

  const deleteAccount = useCallback(async () => {
    if (!meId) return;
    const id = meId;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      fail(error.message);
      return;
    }
    removeAccount(id);
    signOut();
  }, [meId, removeAccount, signOut, fail]);

  const value: AppState = {
    me,
    ready,
    syncError,
    clearSyncError,
    refresh,
    users,
    posts,
    comments,
    stories,
    follows,
    notifications,
    conversations,
    messages,
    battles,
    battleMessages,
    signIn,
    verifyLoginCode,
    cancelLoginCode,
    twoFactorEnabled,
    startTwoFactor,
    confirmTwoFactor,
    disableTwoFactor,
    signOutOtherDevices,
    report,
    remindBattle,
    acceptBattle,
    declineBattle,
    changePassword,
    deleteAccount,
    exportMyData,
    signUp,
    signOut,
    updateProfile,
    getUser,
    getUserByUsername,
    getPost,
    postsBy,
    commentsFor,
    followersOf,
    followingOf,
    isFollowing,
    feed,
    storyUsers,
    conversationMessages,
    canInteract,
    canSeeContent,
    activityText,
    mentionError,
    followRequests,
    hasRequested,
    respondFollowRequest,
    toggleLike,
    toggleSave,
    toggleCommentLike,
    addComment,
    createPost,
    deletePost,
    addStory,
    markStorySeen,
    toggleFollow,
    openConversationWith,
    sendMessage,
    getBattle,
    messagesForBattle,
    createBattle,
    supportBattle,
    sendBattleMessage,
    likeBattle,
    joinBattle,
    startBattle,
    endBattle,
    consents,
    consentFor,
    giveConsent,
    revokeConsent,
    supportersFor,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>');
  return ctx;
}

/** Usuário logado (as telas internas só aparecem com login, então nunca é nulo lá). */
export function useMe() {
  const { me } = useApp();
  if (!me) throw new Error('Nenhum usuário logado');
  return me;
}
