// Estado do app (modo demonstração, em memória).
// As funções aqui têm a mesma "forma" que terão com o Supabase,
// então as telas não precisam mudar quando o backend for ligado.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { newId, timeAgo } from './format';
import { hashPassword } from './hash';
import {
  DEMO_USER_ID,
  mockBattleMessages,
  mockBattles,
  mockComments,
  mockConversations,
  mockFollowRequests,
  mockFollows,
  mockLastActive,
  mockConsents,
  mockMessages,
  mockNotifications,
  mockPosts,
  mockStories,
  mockUsers,
} from './mockData';
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
  Post,
  ShareField,
  Story,
  Supporter,
  SupporterConsent,
  User,
} from './types';
import { ageRangeOf } from './analytics';
import { useSettings, type ShareProfile } from './settings';

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
  /** opcional: o que compartilhar com políticos ao tocar em "Quero receber novidades" */
  shareProfile?: ShareProfile;
};
export type SignInResult = { ok: true } | { ok: false; error: string } | { ok: false; needsCode: true; sentTo: string; demoCode: string };
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
  /** entra; com dois fatores ligado, pede o código antes */
  signIn: (username: string, password: string) => SignInResult;
  verifyLoginCode: (code: string) => string | null;
  cancelLoginCode: () => void;
  changePassword: (current: string, next: string) => string | null;
  /** apaga a conta logada e tudo dela (neste aparelho) */
  deleteAccount: () => void;
  /** cópia dos dados da conta logada (JSON) */
  exportMyData: () => string;
  signUp: (input: SignUpInput) => string | null;
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
  /** a conta permite esse tipo de interação comigo? */
  canInteract: (userId: string, kind: InteractionKind) => boolean;
  /** posso ver publicações dessa conta? (contas privadas: só seguidores) */
  canSeeContent: (userId: string) => boolean;
  /** "Ativo agora", "Ativo há 5 min" ou null se o status estiver oculto */
  activityText: (userId: string) => string | null;
  /** texto de erro se o texto menciona alguém que não permite, senão null */
  mentionError: (text: string) => string | null;
  followRequests: FollowRequest[];
  hasRequested: (userId: string) => boolean;
  respondFollowRequest: (fromId: string, accept: boolean) => void;

  // ações
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  /** devolve um erro (ex.: menção não permitida) ou null */
  addComment: (postId: string, text: string) => string | null;
  createPost: (input: { type: MediaType; uri: string; caption: string; location?: string }) => Post | string | null;
  deletePost: (postId: string) => void;
  addStory: (uri: string, closeFriends?: boolean) => void;
  markStorySeen: (storyId: string) => void;
  toggleFollow: (userId: string) => void;
  openConversationWith: (userId: string) => string | null;
  sendMessage: (conversationId: string, text: string) => void;

  // batalhas de lives
  getBattle: (id: string) => LiveBattle | undefined;
  messagesForBattle: (battleId: string) => BattleMessage[];
  createBattle: (input: { opponentId: string; topic: string; durationSec: number; scheduleAt?: number }) => LiveBattle | null;
  /** Apoio da plateia. fromUserId é usado pela simulação de outros espectadores. */
  supportBattle: (battleId: string, side: BattleSide, points: number, fromUserId?: string) => void;
  sendBattleMessage: (battleId: string, text: string, fromUserId?: string) => void;
  setBattleViewers: (battleId: string, viewers: number) => void;
  startBattle: (battleId: string) => void;
  endBattle: (battleId: string) => void;

  // apoiadores (consentimento LGPD)
  consents: SupporterConsent[];
  consentFor: (politicianId: string) => SupporterConsent | undefined;
  giveConsent: (politicianId: string, input: ConsentInput) => string | null;
  revokeConsent: (consentId: string) => void;
  /** Apoiadores do político, mostrando só os campos que cada um autorizou */
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meId, setMeId] = useState<string | null>(null);
  const { settings, accountSettings, updateAccount, removeAccount, setActiveAccount } = useSettings();
  const [pendingLogin, setPendingLogin] = useState<{ userId: string; code: string } | null>(null);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>(mockFollowRequests);
  const [lastActive] = useState<Record<string, number>>(mockLastActive);

  // As configurações "da conta" passam a ser as da pessoa logada
  useEffect(() => setActiveAccount(meId), [meId, setActiveAccount]);
  const blocked = useMemo(() => new Set(settings.blockedIds), [settings.blockedIds]);
  const hiddenFromFeed = useMemo(() => new Set([...settings.blockedIds, ...settings.mutedIds]), [settings.blockedIds, settings.mutedIds]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [stories, setStories] = useState<Story[]>(mockStories);
  const [follows, setFollows] = useState<Follow[]>(mockFollows);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [battles, setBattles] = useState<LiveBattle[]>(mockBattles);
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>(mockBattleMessages);
  const [consents, setConsents] = useState<SupporterConsent[]>(mockConsents);

  const me = useMemo(() => users.find((u) => u.id === meId) ?? null, [users, meId]);

  const notify = useCallback(
    (n: Omit<AppNotification, 'id' | 'createdAt' | 'fromUserId'>) => {
      if (!meId || n.toUserId === meId) return;
      setNotifications((prev) => [{ ...n, id: newId('n'), fromUserId: meId, createdAt: Date.now() }, ...prev]);
    },
    [meId],
  );

  /** Conclui o login: registra este aparelho e, se ligado, avisa sobre o novo acesso. */
  const completeLogin = useCallback(
    (userId: string) => {
      const acct = accountSettings(userId);
      const name = Platform.OS === 'web' ? 'Navegador' : Platform.OS === 'ios' ? 'iPhone' : 'Celular Android';
      const icon = Platform.OS === 'web' ? ('globe-outline' as const) : ('phone-portrait-outline' as const);
      const device = { id: settings.deviceId, name, where: 'Este aparelho', lastActiveAt: Date.now(), icon };
      updateAccount(userId, { devices: [device, ...acct.devices.filter((d) => d.id !== settings.deviceId)] });
      if (acct.loginAlerts) {
        setNotifications((prev) => [
          {
            id: newId('n'),
            type: 'security',
            toUserId: userId,
            fromUserId: userId,
            text: `Novo acesso à sua conta: ${name}. Se não foi você, troque a senha.`,
            createdAt: Date.now(),
          },
          ...prev,
        ]);
      }
      setPendingLogin(null);
      setMeId(userId);
    },
    [accountSettings, updateAccount, settings.deviceId],
  );

  const signIn = useCallback(
    (username: string, password: string): SignInResult => {
      const clean = username.trim().replace(/^@/, '').toLowerCase();
      if (!clean || !password) return { ok: false, error: 'Preencha usuário e senha.' };
      const user = users.find((u) => u.username.toLowerCase() === clean);
      if (!user) return { ok: false, error: 'Usuário não encontrado. Use "voce.demo" ou crie uma conta.' };
      const acct = accountSettings(user.id);
      // Contas de demonstração sem senha definida aceitam qualquer senha.
      if (acct.passwordHash && acct.passwordHash !== hashPassword(user.id, password)) {
        return { ok: false, error: 'Senha incorreta.' };
      }
      if (acct.twoFactor) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setPendingLogin({ userId: user.id, code });
        const sentTo = acct.phone ? `celular terminado em ${acct.phone.replace(/\D/g, '').slice(-4)}` : acct.email || 'seu contato';
        return { ok: false, needsCode: true, sentTo, demoCode: code };
      }
      completeLogin(user.id);
      return { ok: true };
    },
    [users, accountSettings, completeLogin],
  );

  const verifyLoginCode = useCallback(
    (code: string) => {
      if (!pendingLogin) return 'Comece o login de novo.';
      if (code.replace(/\D/g, '') !== pendingLogin.code) return 'Código incorreto.';
      completeLogin(pendingLogin.userId);
      return null;
    },
    [pendingLogin, completeLogin],
  );

  const cancelLoginCode = useCallback(() => setPendingLogin(null), []);

  const signUp = useCallback(
    ({ name, username, email, password, accountType = 'cidadao', role, party, city, state, birthDate, acceptedTerms, shareProfile }: SignUpInput) => {
      const clean = username.trim().replace(/^@/, '').toLowerCase();
      if (!name.trim() || !clean || !email.trim() || !password) return 'Preencha todos os campos.';
      if (!/^[a-z0-9._]{3,30}$/.test(clean)) return 'O usuário deve ter 3 a 30 letras, números, ponto ou _.';
      if (password.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
      if (users.some((u) => u.username === clean)) return 'Esse nome de usuário já está em uso.';
      const age = ageFrom(birthDate);
      if (age === null) return 'Informe a data de nascimento no formato DD/MM/AAAA.';
      if (age < 18) return 'A Rede Política é só para maiores de 18 anos.';
      if (!acceptedTerms) return 'Para criar a conta, confirme que tem 18 anos ou mais e aceite os Termos.';
      if (shareProfile?.fields.includes('whatsapp') && (shareProfile.whatsapp ?? '').replace(/\D/g, '').length < 10)
        return 'Informe o WhatsApp com DDD, ou desmarque essa opção.';
      if (accountType === 'politico' && (!role?.trim() || !city?.trim() || !state?.trim()))
        return 'Para conta política, informe cargo/pretensão, cidade e UF.';
      const user: User = {
        id: newId('u'),
        accountType,
        username: clean,
        name: name.trim(),
        avatar: `https://i.pravatar.cc/300?u=${encodeURIComponent(clean)}`,
        bio: '',
        role: accountType === 'politico' ? role!.trim() : 'Cidadão',
        party: party?.trim() || undefined,
        city: city?.trim() || undefined,
        state: state?.trim().toUpperCase() || undefined,
        // guarda só o ano (o suficiente para a faixa etária)
        birthYear: Number(birthDate.trim().slice(-4)),
      };
      setUsers((prev) => [...prev, user]);
      updateAccount(user.id, {
        passwordHash: hashPassword(user.id, password),
        email: email.trim(),
        phone: shareProfile?.whatsapp?.trim() ?? '',
        termsAcceptedAt: Date.now(),
        shareProfile: shareProfile?.fields.length
          ? { ...shareProfile, email: shareProfile.fields.includes('email') ? email.trim() : undefined }
          : undefined,
      });
      completeLogin(user.id);
      return null;
    },
    [users, updateAccount, completeLogin],
  );

  const signOut = useCallback(() => setMeId(null), []);

  const changePassword = useCallback(
    (current: string, next: string) => {
      if (!meId) return 'Não autenticado.';
      const acct = accountSettings(meId);
      if (!next || (acct.passwordHash && !current)) return 'Preencha as senhas.';
      if (acct.passwordHash && acct.passwordHash !== hashPassword(meId, current)) return 'A senha atual está errada.';
      if (next.length < 8) return 'A nova senha precisa de pelo menos 8 caracteres.';
      if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) return 'Use letras e números na nova senha.';
      updateAccount(meId, { passwordHash: hashPassword(meId, next) });
      return null;
    },
    [meId, accountSettings, updateAccount],
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
      return null;
    },
    [meId, users],
  );

  const getUser = useCallback((id: string) => users.find((u) => u.id === id), [users]);
  const getUserByUsername = useCallback(
    (username: string) => users.find((u) => u.username === username),
    [users],
  );
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
      // "seguidores" = pessoas que essa conta segue
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
      // Como nas grandes redes: quem esconde o próprio status também não vê o dos outros.
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
    },
    [meId],
  );

  const feed = useCallback(() => {
    const following = new Set(follows.filter((f) => f.followerId === meId).map((f) => f.followingId));
    if (meId) following.add(meId);
    const visible = posts.filter((p) => !hiddenFromFeed.has(p.userId) && canSeeContent(p.userId));
    const mine = visible.filter((p) => following.has(p.userId));
    const list = mine.length ? mine : visible;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
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
          // stories de "Melhores amigos": só para quem está na lista da pessoa
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
    // Meu story primeiro, depois não vistos, depois vistos.
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

  const toggleLike = useCallback(
    (postId: string) => {
      if (!meId) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const liked = post.likes.includes(meId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: liked ? p.likes.filter((id) => id !== meId) : [...p.likes, meId] } : p,
        ),
      );
      if (!liked) notify({ type: 'like', toUserId: post.userId, postId });
    },
    [meId, posts, notify],
  );

  const toggleSave = useCallback(
    (postId: string) => {
      if (!meId) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, savedBy: p.savedBy.includes(meId) ? p.savedBy.filter((id) => id !== meId) : [...p.savedBy, meId] }
            : p,
        ),
      );
    },
    [meId],
  );

  const toggleCommentLike = useCallback(
    (commentId: string) => {
      if (!meId) return;
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likes: c.likes.includes(meId) ? c.likes.filter((id) => id !== meId) : [...c.likes, meId] }
            : c,
        ),
      );
    },
    [meId],
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      const body = text.trim();
      if (!meId || !body) return null;
      const post = posts.find((p) => p.id === postId);
      if (post && !canInteract(post.userId, 'comment')) return 'Essa conta limitou quem pode comentar.';
      const err = mentionError(body);
      if (err) return err;
      setComments((prev) => [...prev, { id: newId('c'), postId, userId: meId, text: body, createdAt: Date.now(), likes: [] }]);
      if (post) notify({ type: 'comment', toUserId: post.userId, postId, text: body });
      mentioned(body).forEach((u) => notify({ type: 'mention', toUserId: u.id, postId, text: body }));
      return null;
    },
    [meId, posts, notify, canInteract, mentionError, mentioned],
  );

  const createPost = useCallback(
    ({ type, uri, caption, location }: { type: MediaType; uri: string; caption: string; location?: string }) => {
      if (!meId) return null;
      const err = mentionError(caption);
      if (err) return err;
      const post: Post = {
        id: newId('p'),
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
      mentioned(caption).forEach((u) => notify({ type: 'mention', toUserId: u.id, postId: post.id, text: post.caption }));
      return post;
    },
    [meId, mentionError, mentioned, notify],
  );

  const deletePost = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((p) => !(p.id === postId && p.userId === meId)));
      setComments((prev) => prev.filter((c) => c.postId !== postId));
    },
    [meId],
  );

  const addStory = useCallback(
    (uri: string, closeFriends = false) => {
      if (!meId) return;
      setStories((prev) => [
        ...prev,
        { id: newId('s'), userId: meId, uri, createdAt: Date.now(), seenBy: [meId], closeFriends: closeFriends || undefined },
      ]);
    },
    [meId],
  );

  const markStorySeen = useCallback(
    (storyId: string) => {
      if (!meId) return;
      setStories((prev) =>
        prev.map((s) => (s.id === storyId && !s.seenBy.includes(meId) ? { ...s, seenBy: [...s.seenBy, meId] } : s)),
      );
    },
    [meId],
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
        if (!requested) notify({ type: 'request', toUserId: userId });
        return;
      }
      setFollows((prev) =>
        already
          ? prev.filter((f) => !(f.followerId === meId && f.followingId === userId))
          : [...prev, { followerId: meId, followingId: userId }],
      );
      if (!already) notify({ type: 'follow', toUserId: userId });
    },
    [meId, follows, notify, accountSettings, followRequests],
  );

  const openConversationWith = useCallback(
    (userId: string) => {
      if (!meId || userId === meId) return null;
      const existing = conversations.find(
        (c) => c.participantIds.length === 2 && c.participantIds.includes(meId) && c.participantIds.includes(userId),
      );
      if (existing) return existing.id;
      if (!canInteract(userId, 'message')) return null;
      const conv: Conversation = { id: newId('cv'), participantIds: [meId, userId] };
      setConversations((prev) => [...prev, conv]);
      return conv.id;
    },
    [meId, conversations, canInteract],
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const body = text.trim();
      if (!meId || !body) return;
      setMessages((prev) => [...prev, { id: newId('m'), conversationId, senderId: meId, text: body, createdAt: Date.now() }]);
    },
    [meId],
  );

  const getBattle = useCallback((id: string) => battles.find((b) => b.id === id), [battles]);

  const messagesForBattle = useCallback(
    (battleId: string) => battleMessages.filter((m) => m.battleId === battleId).sort((a, b) => a.createdAt - b.createdAt),
    [battleMessages],
  );

  const createBattle = useCallback(
    ({ opponentId, topic, durationSec, scheduleAt }: { opponentId: string; topic: string; durationSec: number; scheduleAt?: number }) => {
      if (!meId || opponentId === meId || !topic.trim()) return null;
      const battle: LiveBattle = {
        id: newId('b'),
        hostId: meId,
        opponentId,
        topic: topic.trim(),
        status: scheduleAt ? 'scheduled' : 'live',
        startsAt: scheduleAt ?? Date.now(),
        durationSec,
        viewers: 0,
        scores: { host: 0, opponent: 0 },
        media: {},
      };
      setBattles((prev) => [battle, ...prev]);
      return battle;
    },
    [meId],
  );

  const supportBattle = useCallback(
    (battleId: string, side: BattleSide, points: number, fromUserId?: string) => {
      const from = fromUserId ?? meId;
      const battle = battles.find((b) => b.id === battleId);
      if (!from || points <= 0 || !battle || battle.status !== 'live') return;
      setBattles((prev) =>
        prev.map((b) => (b.id === battleId ? { ...b, scores: { ...b.scores, [side]: b.scores[side] + points } } : b)),
      );
      // Aparece no chat: apoios meus e apoios grandes (os pontinhos automáticos da simulação não)
      if (!fromUserId || points >= 5) {
        const target = users.find((u) => u.id === (side === 'host' ? battle.hostId : battle.opponentId));
        setBattleMessages((prev) => [
          ...prev,
          {
            id: newId('bm'),
            battleId,
            userId: from,
            text: `apoiou ${target?.name ?? ''}`.trim(),
            support: { side, points },
            createdAt: Date.now(),
          },
        ]);
      }
    },
    [meId, battles, users],
  );

  const sendBattleMessage = useCallback(
    (battleId: string, text: string, fromUserId?: string) => {
      const from = fromUserId ?? meId;
      const body = text.trim();
      if (!from || !body) return;
      setBattleMessages((prev) => [...prev, { id: newId('bm'), battleId, userId: from, text: body, createdAt: Date.now() }]);
    },
    [meId],
  );

  const setBattleViewers = useCallback((battleId: string, viewers: number) => {
    setBattles((prev) => prev.map((b) => (b.id === battleId ? { ...b, viewers: Math.max(0, Math.round(viewers)) } : b)));
  }, []);

  const startBattle = useCallback((battleId: string) => {
    setBattles((prev) =>
      prev.map((b) => (b.id === battleId && b.status === 'scheduled' ? { ...b, status: 'live', startsAt: Date.now() } : b)),
    );
  }, []);

  const endBattle = useCallback((battleId: string) => {
    setBattles((prev) => prev.map((b) => (b.id === battleId && b.status === 'live' ? { ...b, status: 'ended' } : b)));
  }, []);

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
      const consent: SupporterConsent = {
        id: newId('cs'),
        politicianId,
        userId: meId,
        fields,
        email: fields.includes('email') ? email?.trim() : undefined,
        whatsapp: fields.includes('whatsapp') ? whatsapp?.trim() : undefined,
        interests: fields.includes('interesses') ? interests : [],
        createdAt: Date.now(),
      };
      setConsents((prev) => [...prev.filter((c) => !(c.politicianId === politicianId && c.userId === meId)), consent]);
      return null;
    },
    [meId],
  );

  const revokeConsent = useCallback(
    (consentId: string) => setConsents((prev) => prev.filter((c) => !(c.id === consentId && c.userId === meId))),
    [meId],
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
            email: c.email,
            whatsapp: c.whatsapp,
            createdAt: c.createdAt,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [consents, users],
  );

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

  const deleteAccount = useCallback(() => {
    if (!meId) return;
    const id = meId;
    const myPosts = new Set(posts.filter((p) => p.userId === id).map((p) => p.id));
    const myConvs = new Set(conversations.filter((c) => c.participantIds.includes(id)).map((c) => c.id));
    setPosts((prev) => prev.filter((p) => p.userId !== id).map((p) => ({ ...p, likes: p.likes.filter((x) => x !== id), savedBy: p.savedBy.filter((x) => x !== id) })));
    setComments((prev) => prev.filter((c) => c.userId !== id && !myPosts.has(c.postId)));
    setStories((prev) => prev.filter((st) => st.userId !== id));
    setFollows((prev) => prev.filter((f) => f.followerId !== id && f.followingId !== id));
    setFollowRequests((prev) => prev.filter((r) => r.fromId !== id && r.toId !== id));
    setNotifications((prev) => prev.filter((n) => n.toUserId !== id && n.fromUserId !== id));
    setConversations((prev) => prev.filter((c) => !myConvs.has(c.id)));
    setMessages((prev) => prev.filter((m) => !myConvs.has(m.conversationId)));
    setConsents((prev) => prev.filter((c) => c.userId !== id && c.politicianId !== id));
    setUsers((prev) => prev.filter((u) => u.id !== id));
    removeAccount(id);
    setMeId(null);
  }, [meId, posts, conversations, removeAccount]);

  const value: AppState = {
    me,
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
    setBattleViewers,
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

export { DEMO_USER_ID };
