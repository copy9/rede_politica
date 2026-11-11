// Estado do app (modo demonstração, em memória).
// As funções aqui têm a mesma "forma" que terão com o Supabase,
// então as telas não precisam mudar quando o backend for ligado.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { newId } from './format';
import {
  DEMO_USER_ID,
  mockBattleMessages,
  mockBattles,
  mockComments,
  mockConversations,
  mockFollows,
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
import { useSettings } from './settings';

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
};
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
  signIn: (username: string, password: string) => string | null;
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
  storyUsers: () => { user: User; stories: Story[]; seen: boolean }[];
  conversationMessages: (conversationId: string) => Message[];

  // ações
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  addComment: (postId: string, text: string) => void;
  createPost: (input: { type: MediaType; uri: string; caption: string; location?: string }) => Post | null;
  deletePost: (postId: string) => void;
  addStory: (uri: string) => void;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meId, setMeId] = useState<string | null>(null);
  const { settings } = useSettings();
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

  const signIn = useCallback(
    (username: string, password: string) => {
      const clean = username.trim().replace(/^@/, '').toLowerCase();
      if (!clean || !password) return 'Preencha usuário e senha.';
      // Modo demonstração: qualquer senha é aceita para contas existentes.
      const user = users.find((u) => u.username.toLowerCase() === clean);
      if (!user) return 'Usuário não encontrado. Use "voce.demo" ou crie uma conta.';
      setMeId(user.id);
      return null;
    },
    [users],
  );

  const signUp = useCallback(
    ({ name, username, email, password, accountType = 'cidadao', role, party, city, state }: SignUpInput) => {
      const clean = username.trim().replace(/^@/, '').toLowerCase();
      if (!name.trim() || !clean || !email.trim() || !password) return 'Preencha todos os campos.';
      if (!/^[a-z0-9._]{3,30}$/.test(clean)) return 'O usuário deve ter 3 a 30 letras, números, ponto ou _.';
      if (password.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
      if (users.some((u) => u.username === clean)) return 'Esse nome de usuário já está em uso.';
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
      };
      setUsers((prev) => [...prev, user]);
      setMeId(user.id);
      return null;
    },
    [users],
  );

  const signOut = useCallback(() => setMeId(null), []);

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

  const feed = useCallback(() => {
    const following = new Set(follows.filter((f) => f.followerId === meId).map((f) => f.followingId));
    if (meId) following.add(meId);
    const visible = posts.filter((p) => !hiddenFromFeed.has(p.userId));
    const mine = visible.filter((p) => following.has(p.userId));
    const list = mine.length ? mine : visible;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [follows, posts, meId, hiddenFromFeed]);

  const storyUsers = useCallback(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const byUser = new Map<string, Story[]>();
    stories
      .filter((s) => s.createdAt > dayAgo && !hiddenFromFeed.has(s.userId))
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((s) => byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]));
    const list = [...byUser.entries()]
      .map(([userId, list]) => ({
        user: users.find((u) => u.id === userId)!,
        stories: list,
        seen: !!meId && list.every((s) => s.seenBy.includes(meId)),
      }))
      .filter((x) => !!x.user);
    // Meu story primeiro, depois não vistos, depois vistos.
    return list.sort((a, b) => {
      if (a.user.id === meId) return -1;
      if (b.user.id === meId) return 1;
      return Number(a.seen) - Number(b.seen);
    });
  }, [stories, users, meId, hiddenFromFeed]);

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
      if (!meId || !body) return;
      setComments((prev) => [...prev, { id: newId('c'), postId, userId: meId, text: body, createdAt: Date.now(), likes: [] }]);
      const post = posts.find((p) => p.id === postId);
      if (post) notify({ type: 'comment', toUserId: post.userId, postId, text: body });
    },
    [meId, posts, notify],
  );

  const createPost = useCallback(
    ({ type, uri, caption, location }: { type: MediaType; uri: string; caption: string; location?: string }) => {
      if (!meId) return null;
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
      return post;
    },
    [meId],
  );

  const deletePost = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((p) => !(p.id === postId && p.userId === meId)));
      setComments((prev) => prev.filter((c) => c.postId !== postId));
    },
    [meId],
  );

  const addStory = useCallback(
    (uri: string) => {
      if (!meId) return;
      setStories((prev) => [...prev, { id: newId('s'), userId: meId, uri, createdAt: Date.now(), seenBy: [meId] }]);
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
      setFollows((prev) =>
        already
          ? prev.filter((f) => !(f.followerId === meId && f.followingId === userId))
          : [...prev, { followerId: meId, followingId: userId }],
      );
      if (!already) notify({ type: 'follow', toUserId: userId });
    },
    [meId, follows, notify],
  );

  const openConversationWith = useCallback(
    (userId: string) => {
      if (!meId || userId === meId) return null;
      const existing = conversations.find(
        (c) => c.participantIds.length === 2 && c.participantIds.includes(meId) && c.participantIds.includes(userId),
      );
      if (existing) return existing.id;
      const conv: Conversation = { id: newId('cv'), participantIds: [meId, userId] };
      setConversations((prev) => [...prev, conv]);
      return conv.id;
    },
    [meId, conversations],
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
