/** cidadão = usuário normal; politico = candidatos e políticos (têm o Painel do político) */
export type AccountType = 'cidadao' | 'politico';
export type Gender = 'F' | 'M' | 'O';

export type User = {
  id: string;
  accountType: AccountType;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  /** Cargo ou ocupação, ex.: "Vereadora em Recife", "Eleitor", "Jornalista" */
  role?: string;
  party?: string;
  website?: string;
  verified?: boolean;
  /** Dados declarados pelo próprio usuário (usados só em estatísticas agregadas) */
  city?: string;
  state?: string;
  gender?: Gender;
  birthYear?: number;
  interests?: string[];
};

export type MediaType = 'image' | 'video';

export type Post = {
  id: string;
  userId: string;
  type: MediaType;
  uri: string;
  /** Miniatura usada nas grades (para vídeos) */
  thumbnail?: string;
  caption: string;
  location?: string;
  createdAt: number;
  likes: string[];
  savedBy: string[];
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
  likes: string[];
};

export type Story = {
  id: string;
  userId: string;
  uri: string;
  createdAt: number;
  seenBy: string[];
  /** só para Melhores amigos */
  closeFriends?: boolean;
};

export type Follow = {
  followerId: string;
  followingId: string;
};

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'security' | 'request' | 'battle';

export type AppNotification = {
  id: string;
  type: NotificationType;
  toUserId: string;
  fromUserId: string;
  postId?: string;
  battleId?: string;
  text?: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  participantIds: string[];
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: number;
};

export type BattleSide = 'host' | 'opponent';
export type BattleStatus = 'invited' | 'live' | 'scheduled' | 'ended';

/** Batalha de lives: duas pessoas ao vivo, a plateia apoia um lado com pontos. */
export type LiveBattle = {
  id: string;
  hostId: string;
  opponentId: string;
  topic: string;
  status: BattleStatus;
  /** Início (ou horário agendado) em ms */
  startsAt: number;
  durationSec: number;
  viewers: number;
  scores: Record<BattleSide, number>;
  /** curtidas (coraçõezinhos) da plateia */
  likes?: number;
  /** Vídeo de cada lado (no modo demonstração, vídeos de exemplo) */
  media: Partial<Record<BattleSide, string>>;
};

export type BattleMessage = {
  id: string;
  battleId: string;
  userId: string;
  text: string;
  /** Quando a mensagem é um apoio: lado e pontos */
  support?: { side: BattleSide; points: number };
  createdAt: number;
};

/** Campos que o eleitor pode escolher compartilhar com um político */
export type ShareField = 'nome' | 'cidade' | 'faixaEtaria' | 'interesses' | 'email' | 'whatsapp';

/**
 * Autorização (consentimento LGPD) de um usuário para um político:
 * só quem autoriza entra no banco de apoiadores, e pode revogar quando quiser.
 */
export type SupporterConsent = {
  id: string;
  politicianId: string;
  userId: string;
  fields: ShareField[];
  email?: string;
  whatsapp?: string;
  interests: string[];
  createdAt: number;
};

/** Apoiador como o político enxerga (só com os campos autorizados) */
export type Supporter = {
  consentId: string;
  userId?: string;
  name?: string;
  username?: string;
  avatar?: string;
  city?: string;
  state?: string;
  ageRange?: string;
  interests: string[];
  email?: string;
  whatsapp?: string;
  createdAt: number;
  demo?: boolean;
};

/** Pedido para seguir uma conta privada */
export type FollowRequest = { fromId: string; toId: string; createdAt: number };
