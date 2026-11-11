export type User = {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  /** Cargo ou ocupação, ex.: "Vereadora em Recife", "Eleitor", "Jornalista" */
  role?: string;
  party?: string;
  website?: string;
  verified?: boolean;
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
};

export type Follow = {
  followerId: string;
  followingId: string;
};

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention';

export type AppNotification = {
  id: string;
  type: NotificationType;
  toUserId: string;
  fromUserId: string;
  postId?: string;
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
export type BattleStatus = 'live' | 'scheduled' | 'ended';

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
