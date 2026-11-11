// Dados fictícios de demonstração. Serão substituídos pelo Supabase.
import type { AppNotification, Comment, Conversation, Follow, Message, Post, Story, User } from './types';

const now = Date.now();
const min = 60 * 1000;
const h = 60 * min;
const d = 24 * h;

const avatar = (n: number) => `https://i.pravatar.cc/300?img=${n}`;
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/1080/1080`;
const story = (seed: string) => `https://picsum.photos/seed/${seed}/1080/1920`;
const VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';

export const DEMO_USER_ID = 'u_demo';

export const mockUsers: User[] = [
  {
    id: DEMO_USER_ID,
    username: 'voce.demo',
    name: 'Você (demo)',
    avatar: avatar(12),
    bio: 'Conta de demonstração da Rede Política.\nParticipe, debata, fiscalize.',
    role: 'Cidadão',
  },
  {
    id: 'u_ana',
    username: 'ana.ribeiro.ver',
    name: 'Ana Ribeiro',
    avatar: avatar(47),
    bio: 'Vereadora • Educação e mobilidade urbana\nGabinete aberto toda sexta 📍 Câmara Municipal',
    role: 'Vereadora',
    party: 'Partido Exemplo',
    website: 'anaribeiro.exemplo.org',
    verified: true,
  },
  {
    id: 'u_carlos',
    username: 'carlosmendes.dep',
    name: 'Carlos Mendes',
    avatar: avatar(59),
    bio: 'Deputado estadual • Saúde pública e transparência\nPrestação de contas mensal aqui 👇',
    role: 'Deputado estadual',
    party: 'Partido Modelo',
    verified: true,
  },
  {
    id: 'u_julia',
    username: 'julia.observa',
    name: 'Júlia Santos',
    avatar: avatar(32),
    bio: 'Jornalista de dados 📊 Checagem de fatos e orçamento público',
    role: 'Jornalista',
  },
  {
    id: 'u_rafa',
    username: 'rafa.movimento',
    name: 'Rafael Lima',
    avatar: avatar(8),
    bio: 'Coletivo de bairro • Juventude e cultura',
    role: 'Ativista',
  },
  {
    id: 'u_marta',
    username: 'marta.prefeita',
    name: 'Marta Oliveira',
    avatar: avatar(44),
    bio: 'Prefeita • Gestão 2025–2028\nAgenda pública e obras em andamento',
    role: 'Prefeita',
    party: 'Partido Exemplo',
    verified: true,
  },
  {
    id: 'u_obs',
    username: 'observatorio.civico',
    name: 'Observatório Cívico',
    avatar: avatar(68),
    bio: 'Organização independente de fiscalização do poder público',
    role: 'Organização',
    website: 'observatorio.exemplo.org',
  },
];

export const mockPosts: Post[] = [
  {
    id: 'p1',
    userId: 'u_ana',
    type: 'image',
    uri: photo('camara1'),
    caption: 'Audiência pública sobre o novo plano de transporte. Obrigada a todos que vieram! Próxima rodada na zona norte. #mobilidade',
    location: 'Câmara Municipal',
    createdAt: now - 2 * h,
    likes: ['u_carlos', 'u_julia', 'u_rafa'],
    savedBy: [],
  },
  {
    id: 'p2',
    userId: 'u_carlos',
    type: 'video',
    uri: `${VIDEO}/ForBiggerBlazes.mp4`,
    thumbnail: photo('saude2'),
    caption: 'Prestação de contas do mês: 3 projetos protocolados e 2 visitas a postos de saúde. Assista ao resumo.',
    location: 'Assembleia Legislativa',
    createdAt: now - 5 * h,
    likes: ['u_ana', 'u_obs'],
    savedBy: [DEMO_USER_ID],
  },
  {
    id: 'p3',
    userId: 'u_julia',
    type: 'image',
    uri: photo('dados3'),
    caption: 'Fio sobre o orçamento da educação: quanto foi previsto x quanto foi executado. Spoiler: a diferença é grande.',
    createdAt: now - 9 * h,
    likes: ['u_obs', 'u_rafa', 'u_ana', DEMO_USER_ID],
    savedBy: [],
  },
  {
    id: 'p4',
    userId: 'u_marta',
    type: 'image',
    uri: photo('obra4'),
    caption: 'Visita à obra da nova escola do bairro Jardim. Entrega prevista para março.',
    location: 'Bairro Jardim',
    createdAt: now - 1 * d,
    likes: ['u_ana'],
    savedBy: [],
  },
  {
    id: 'p5',
    userId: 'u_rafa',
    type: 'video',
    uri: `${VIDEO}/ForBiggerJoyrides.mp4`,
    thumbnail: photo('cultura5'),
    caption: 'Sarau da juventude na praça! Cultura também é política 🎤',
    location: 'Praça Central',
    createdAt: now - 2 * d,
    likes: ['u_julia', DEMO_USER_ID],
    savedBy: [],
  },
  {
    id: 'p6',
    userId: 'u_obs',
    type: 'image',
    uri: photo('relatorio6'),
    caption: 'Novo relatório: frequência dos parlamentares nas sessões do semestre. Link na bio.',
    createdAt: now - 3 * d,
    likes: ['u_julia', 'u_carlos'],
    savedBy: [],
  },
  {
    id: 'p7',
    userId: 'u_ana',
    type: 'video',
    uri: `${VIDEO}/ForBiggerEscapes.mp4`,
    thumbnail: photo('escola7'),
    caption: 'Em 30 segundos: o que muda com o projeto de lei do passe livre estudantil.',
    createdAt: now - 4 * d,
    likes: ['u_rafa'],
    savedBy: [],
  },
  {
    id: 'p8',
    userId: DEMO_USER_ID,
    type: 'image',
    uri: photo('bairro8'),
    caption: 'Buraco na rua há 3 meses. Já abri chamado na prefeitura. @marta.prefeita',
    location: 'Rua das Flores',
    createdAt: now - 5 * d,
    likes: ['u_rafa', 'u_obs'],
    savedBy: [],
  },
  {
    id: 'p9',
    userId: 'u_marta',
    type: 'video',
    uri: `${VIDEO}/ForBiggerFun.mp4`,
    thumbnail: photo('agenda9'),
    caption: 'Agenda da semana em 1 minuto.',
    createdAt: now - 6 * d,
    likes: ['u_carlos', 'u_ana', 'u_obs'],
    savedBy: [],
  },
];

export const mockComments: Comment[] = [
  { id: 'c1', postId: 'p1', userId: 'u_rafa', text: 'Vai ter na zona leste também?', createdAt: now - 1 * h, likes: ['u_ana'] },
  { id: 'c2', postId: 'p1', userId: 'u_ana', text: '@rafa.movimento sim! Data sai essa semana.', createdAt: now - 50 * min, likes: [] },
  { id: 'c3', postId: 'p3', userId: 'u_obs', text: 'Excelente levantamento. Vamos compartilhar.', createdAt: now - 8 * h, likes: [] },
  { id: 'c4', postId: 'p8', userId: 'u_marta', text: 'Obrigada pelo aviso, já encaminhamos para a secretaria de obras.', createdAt: now - 4 * d, likes: [DEMO_USER_ID] },
  { id: 'c5', postId: 'p2', userId: 'u_julia', text: 'Quais postos foram visitados?', createdAt: now - 4 * h, likes: [] },
];

export const mockStories: Story[] = [
  { id: 's1', userId: 'u_ana', uri: story('st-ana1'), createdAt: now - 1 * h, seenBy: [] },
  { id: 's2', userId: 'u_ana', uri: story('st-ana2'), createdAt: now - 40 * min, seenBy: [] },
  { id: 's3', userId: 'u_carlos', uri: story('st-carlos'), createdAt: now - 3 * h, seenBy: [] },
  { id: 's4', userId: 'u_julia', uri: story('st-julia'), createdAt: now - 5 * h, seenBy: [] },
  { id: 's5', userId: 'u_marta', uri: story('st-marta'), createdAt: now - 7 * h, seenBy: [DEMO_USER_ID] },
  { id: 's6', userId: 'u_rafa', uri: story('st-rafa'), createdAt: now - 10 * h, seenBy: [] },
];

export const mockFollows: Follow[] = [
  { followerId: DEMO_USER_ID, followingId: 'u_ana' },
  { followerId: DEMO_USER_ID, followingId: 'u_carlos' },
  { followerId: DEMO_USER_ID, followingId: 'u_julia' },
  { followerId: DEMO_USER_ID, followingId: 'u_marta' },
  { followerId: DEMO_USER_ID, followingId: 'u_rafa' },
  { followerId: 'u_rafa', followingId: DEMO_USER_ID },
  { followerId: 'u_obs', followingId: DEMO_USER_ID },
  { followerId: 'u_julia', followingId: 'u_ana' },
  { followerId: 'u_carlos', followingId: 'u_ana' },
  { followerId: 'u_rafa', followingId: 'u_ana' },
  { followerId: 'u_obs', followingId: 'u_ana' },
  { followerId: 'u_ana', followingId: 'u_marta' },
  { followerId: 'u_julia', followingId: 'u_obs' },
];

export const mockNotifications: AppNotification[] = [
  { id: 'n1', type: 'like', toUserId: DEMO_USER_ID, fromUserId: 'u_rafa', postId: 'p8', createdAt: now - 30 * min },
  { id: 'n2', type: 'follow', toUserId: DEMO_USER_ID, fromUserId: 'u_obs', createdAt: now - 3 * h },
  { id: 'n3', type: 'comment', toUserId: DEMO_USER_ID, fromUserId: 'u_marta', postId: 'p8', text: 'Obrigada pelo aviso, já encaminhamos para a secretaria de obras.', createdAt: now - 4 * d },
  { id: 'n4', type: 'like', toUserId: DEMO_USER_ID, fromUserId: 'u_obs', postId: 'p8', createdAt: now - 4 * d },
  { id: 'n5', type: 'follow', toUserId: DEMO_USER_ID, fromUserId: 'u_rafa', createdAt: now - 8 * d },
];

export const mockConversations: Conversation[] = [
  { id: 'cv1', participantIds: [DEMO_USER_ID, 'u_ana'] },
  { id: 'cv2', participantIds: [DEMO_USER_ID, 'u_julia'] },
];

export const mockMessages: Message[] = [
  { id: 'm1', conversationId: 'cv1', senderId: DEMO_USER_ID, text: 'Olá vereadora, quando será a audiência na zona leste?', createdAt: now - 6 * h },
  { id: 'm2', conversationId: 'cv1', senderId: 'u_ana', text: 'Oi! Estamos fechando a data, devo anunciar até sexta.', createdAt: now - 5 * h },
  { id: 'm3', conversationId: 'cv2', senderId: 'u_julia', text: 'Vi seu post do buraco na rua, posso usar na matéria?', createdAt: now - 2 * d },
];
