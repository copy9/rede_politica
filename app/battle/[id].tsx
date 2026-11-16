import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BattleActions } from '@/components/BattleActions';
import { BattleScoreBar } from '@/components/BattleScoreBar';
import { BattleGuestsControls, answerGuestInvite, requestToJoin, useBattleGuests, type GuestRow } from '@/components/BattleGuests';
import { LiveCamera } from '@/components/LiveCamera';
import { useOverlay } from '@/components/Overlay';
import { Linking } from 'react-native';
import { MediaVideo } from '@/components/MediaVideo';
import { compactNumber } from '@/lib/format';
import { getLiveVideo } from '@/lib/livekit';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { BattleMessage, BattleSide, LiveBattle, User } from '@/lib/types';

/** Tipos de apoio que a plateia pode enviar (pontos para um dos lados). */
const SUPPORTS = [
  { emoji: '👏', label: 'Aplauso', points: 1 },
  { emoji: '🇧🇷', label: 'Bandeira', points: 5 },
  { emoji: '📢', label: 'Megafone', points: 20 },
  { emoji: '🏆', label: 'Troféu', points: 100 },
];


const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function BattleRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const app = useApp();
  const { getBattle, getUser, messagesForBattle, supportBattle, sendBattleMessage, joinBattle, startBattle, endBattle, remindBattle, acceptBattle, declineBattle, refreshBattle } = app;
  const { width, height } = useWindowDimensions();
  const { confirm, showBanner } = useOverlay();
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<BattleSide | null>(null);
  const [text, setText] = useState('');
  const chatRef = useRef<FlatList<BattleMessage>>(null);
  const guests = useBattleGuests(id);
  const battleStatus = getBattle(id)?.status;
  useEffect(() => {
    if (!id || battleStatus === 'ended') return;
    refreshBattle(id);
    const t = setInterval(() => refreshBattle(id), battleStatus === 'live' ? 10000 : 3000);
    return () => clearInterval(t);
  }, [id, battleStatus, refreshBattle]);
  const isGuestSpeaker = guests.some((g) => g.user_id === me.id && g.status === 'accepted');

  const battle = getBattle(id);
  const host = battle ? getUser(battle.hostId) : undefined;
  const opponent = battle ? getUser(battle.opponentId) : undefined;

  // Relógio
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // sem tempo fixo: mostra há quanto tempo o debate está no ar; quem criou encerra no botão
  const elapsed = battle ? Math.max(0, (now - battle.startsAt) / 1000) : 0;

  // Conta quem está assistindo (tempo real)
  useEffect(() => joinBattle(id), [id, joinBattle]);

  if (!battle || !host || !opponent) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.white}>Batalha não encontrada.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.white, { marginTop: 12, fontWeight: '700' }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const isHost = battle.hostId === me.id;
  const isParticipant = isHost || battle.opponentId === me.id;
  const live = battle.status === 'live';
  // mais de 2 pessoas na batalha: some a barra de placar (curtidas) e o grid ganha o espaço
  const multiPeople = guests.some(
    (g) => (g.status === 'accepted' || g.status === 'convidado') && g.user_id !== battle.hostId && g.user_id !== battle.opponentId,
  );
  // Palco ocupa metade da tela: as duas telas ficam grandes, como nas batalhas de 2
  const halfHeight = Math.round(height * 0.5);

  const onClose = () => {
    if (isHost && live) {
      confirm('Encerrar debate?', 'O debate termina agora para todos.', 'Encerrar', () => endBattle(battle.id), true);
      return;
    }
    // convidado ao vivo que sai: libera o lugar e desliga a câmera
    if (guests.some((g) => g.user_id === me.id && g.status === 'accepted')) answerGuestInvite(battle.id, me.id, 'declined');
    router.back();
  };

  const send = () => {
    if (!text.trim()) return;
    if (!live) {
      showBanner('Os comentários abrem quando a batalha começar.', { icon: 'chatbubble-outline', tone: 'warning' });
      return;
    }
    sendBattleMessage(battle.id, text);
    setText('');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.badges}>
              {live ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.badgeText}>AO VIVO</Text>
                </View>
              ) : (
                <View style={[styles.liveBadge, { backgroundColor: '#475569' }]}>
                  <Text style={styles.badgeText}>{battle.status === 'ended' ? 'ENCERRADA' : 'AGENDADA'}</Text>
                </View>
              )}
              {live ? (
                <View style={styles.pill}>
                  <Ionicons name="eye-outline" size={13} color="#fff" />
                  <Text style={styles.pillText}>{compactNumber(battle.viewers)}</Text>
                </View>
              ) : null}
              {live ? (
                <View style={styles.pill}>
                  <Ionicons name="time-outline" size={13} color="#fff" />
                  <Text style={styles.pillText}>{fmtTime(elapsed)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.topic} numberOfLines={2}>
              {battle.topic}
            </Text>
            {battle.description ? <LinkText text={battle.description} style={styles.description} /> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            {isHost && live ? (
              <Text style={styles.endText}>Encerrar</Text>
            ) : live ? (
              <Text style={styles.endText}>Sair</Text>
            ) : (
              <Ionicons name="close" size={28} color="#fff" />
            )}
          </Pressable>
        </View>

        {/* Placar no topo: cresce para o lado com mais presentes e curtidas */}
        {multiPeople ? null : (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <BattleScoreBar host={battle.scores.host} opponent={battle.scores.opponent} height={24} />
          </View>
        )}

        {battle.status === 'invited' && isHost ? (
          <View style={styles.scheduled}>
            <Ionicons name="flash-outline" size={28} color="#fff" />
            {battle.opponentId === me.id ? (
              <>
                <Text style={styles.scheduledText}>{host.name} te desafiou: {battle.topic}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable style={styles.startButton} onPress={() => acceptBattle(battle.id)}>
                    <Text style={styles.startText}>Aceitar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.startButton, { backgroundColor: '#374151' }]}
                    onPress={() => {
                      declineBattle(battle.id);
                      router.back();
                    }}>
                    <Text style={styles.startText}>Recusar</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.scheduledText}>Aguardando {opponent.name} aceitar o desafio…</Text>
            )}
          </View>
        ) : null}

        {battle.status === 'scheduled' ? (
          <View style={styles.scheduled}>
            <Ionicons name="calendar-outline" size={28} color="#fff" />
            <Text style={styles.scheduledText}>
              Começa em {new Date(battle.startsAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(battle.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isHost ? (
              <Pressable style={styles.startButton} onPress={() => startBattle(battle.id)}>
                <Text style={styles.startText}>Começar agora</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.startButton} onPress={async () => {
                  const err = await remindBattle(battle.id);
                  showBanner(err ?? 'Lembrete criado: você recebe uma notificação quando a batalha começar.', { icon: 'alarm-outline', tone: err ? 'warning' : 'success' });
                }}>
                <Text style={styles.startText}>Lembrar-me</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Os dois lados */}
        {(() => {
          // quem foi desafiado ou convidado só entra no vídeo depois de aceitar
          const myGuest = guests.find((g) => g.user_id === me.id);
          const awaitingMyAnswer = (battle.status === 'invited' && battle.opponentId === me.id) || myGuest?.status === 'convidado';
          if (awaitingMyAnswer) {
            const challenged = battle.status === 'invited' && battle.opponentId === me.id;
            const answerInvite = () => (challenged ? acceptBattle(battle.id) : answerGuestInvite(battle.id, me.id, 'accepted'));
            const declineInvite = async () => {
              if (challenged) declineBattle(battle.id);
              else await answerGuestInvite(battle.id, me.id, 'declined');
              router.back();
            };
            return (
              <View style={styles.inviteBox}>
                <Ionicons name="flash-outline" size={34} color="#fff" />
                <Text style={styles.inviteTitle}>
                  {challenged ? `${host.name} te desafiou` : `${host.name} te convidou para participar`}
                </Text>
                <Text style={styles.inviteTopic}>{battle.topic}</Text>
                <Text style={styles.inviteNote}>Você só entra no vídeo depois de aceitar.</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable style={styles.startButton} onPress={answerInvite}>
                    <Text style={styles.startText}>Aceitar</Text>
                  </Pressable>
                  <Pressable style={[styles.startButton, { backgroundColor: '#374151' }]} onPress={declineInvite}>
                    <Text style={styles.startText}>Recusar</Text>
                  </Pressable>
                </View>
              </View>
            );
          }
          // Todos os participantes num grid só, do mesmo tamanho (2 colunas até 4 pessoas, 3 colunas acima)
          type Slot = { key: string; user?: User; isMe: boolean; kind: 'side' | 'accepted' | 'invited' | 'join' };
          const guestSlots = (status: GuestRow['status'], kind: 'accepted' | 'invited'): Slot[] =>
            guests
              .filter((g) => g.status === status && g.user_id !== host.id && g.user_id !== opponent.id)
              .map((g) => ({ key: g.user_id, user: app.users.find((u) => u.id === g.user_id), isMe: g.user_id === me.id, kind }));
          const showJoin = live && !isParticipant && !isHost && myGuest?.status !== 'accepted' && myGuest?.status !== 'convidado';
          const slots: Slot[] = [
            { key: host.id, user: host, isMe: host.id === me.id, kind: 'side' },
            { key: opponent.id, user: opponent, isMe: opponent.id === me.id, kind: 'side' },
            ...guestSlots('accepted', 'accepted'),
            ...guestSlots('convidado', 'invited'),
            ...(showJoin ? [{ key: 'join', isMe: false, kind: 'join' as const }] : []),
          ];
          const cols = slots.length <= 4 ? 2 : 3;
          const rows = Math.ceil(slots.length / cols);
          const tileW = Math.floor(width / cols);
          // o grid ocupa até 42% da altura, para sobrar espaço para o chat e o campo de comentário
          const reserved = 300 + (battle.status === 'invited' || battle.status === 'scheduled' ? 120 : 0);
          const gridH = Math.max(150, Math.min(height * 0.42, height - reserved));
          const tileH = Math.round(gridH / rows);
          const LVx = getLiveVideo();
          const leads = (side: 'host' | 'opponent') =>
            battle.status !== 'scheduled' && battle.scores[side] > battle.scores[side === 'host' ? 'opponent' : 'host'];

          const tile = (s: Slot) => {
            if (s.kind === 'join') {
              const label = myGuest?.status === 'pending' ? 'Pedido enviado' : myGuest?.status === 'declined' ? 'Pedir de novo' : 'Participar';
              return (
                <View key="join" style={{ width: tileW, height: tileH, padding: 3 }}>
                  <Pressable
                    style={styles.joinTile}
                    accessibilityLabel="Participar da batalha"
                    onPress={async () => {
                      const msg = await requestToJoin(battle.id, me.id, myGuest?.status);
                      if (msg) showBanner(msg, { icon: 'people-outline', tone: 'success' });
                    }}>
                    <Text style={styles.joinPlus}>+</Text>
                    <Text style={styles.joinLabel}>{label}</Text>
                  </Pressable>
                </View>
              );
            }
            const sideKey = s.key === host.id ? 'host' : s.key === opponent.id ? 'opponent' : null;
            const crown = '';
            const name = s.isMe ? 'Você' : s.user?.name ?? '';
            const fallback = (
              <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
                <Avatar uri={s.user?.avatar ?? ''} size={Math.min(56, Math.round(tileH * 0.35))} />
                {s.kind === 'invited' ? <Text style={styles.waiting}>aguardando</Text> : null}
              </View>
            );
            const canShowVideo = live && s.kind !== 'invited';
            // ao vivo: vídeo da sala; antes de começar: a própria câmera de quem está na batalha
            const video =
              canShowVideo && LVx ? (
                <LVx.SideVideo userId={s.key} isMe={s.isMe} fallback={fallback} />
              ) : s.isMe && s.kind !== 'invited' ? (
                <LiveCamera />
              ) : (
                fallback
              );
            return (
              <View key={s.key} style={{ width: tileW, height: tileH, padding: 3 }}>
                <View style={styles.tileBox}>{video}</View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {crown}
                  {name}
                </Text>
              </View>
            );
          };

          const stage = (
            <View>
              <BattleGuestsControls
                battleId={battle.id}
                isHost={isHost}
                users={app.users}
                guests={guests}
                onMessage={(t) => showBanner(t, { icon: 'people-outline', tone: 'success' })}
              />
              <View style={styles.tileGrid}>{slots.map(tile)}</View>
            </View>
          );
          // No app instalado: vídeo e áudio ao vivo de um celular para o outro (LiveKit)
          const LV = getLiveVideo();
          return LV && live ? (
            <LV.BattleRoom key={`${isParticipant}-${isGuestSpeaker}`} battleId={battle.id} speaker={isParticipant || isGuestSpeaker}>
              {stage}
            </LV.BattleRoom>
          ) : (
            stage
          );
        })()}

        {/* Resultado / agendada */}
        {battle.status === 'ended' ? <Result battle={battle} host={host} opponent={opponent} /> : null}

        {/* Chat */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Comentários embaixo do palco, mais recentes por último */}
          <View style={{ flex: 1, minHeight: 0 }}>
            <FlatList
              ref={chatRef}
              style={{ flex: 1 }}
              data={messagesForBattle(battle.id).slice(-80)}
              onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <ChatLine message={item} />}
              ListEmptyComponent={
                <Text style={styles.chatHint}>
                  {live ? 'Seja o primeiro a comentar.' : 'Os comentários abrem quando a batalha começar.'}
                </Text>
              }
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingLeft: spacing.md, paddingRight: 96, paddingVertical: spacing.sm, gap: 10 }}
            />
            {/* Curtir, compartilhar e seguir (para quem está assistindo engajar) */}
            <BattleActions battle={battle} host={host} opponent={opponent} meId={me.id} side={side} />
          </View>

          {live && !isParticipant && side ? (
            <View style={styles.gifts}>
              <Text style={styles.giftsTitle}>
                Apoiar {side === 'host' ? host.name : opponent.name}
              </Text>
              <View style={styles.giftRow}>
                {SUPPORTS.map((s) => (
                  <Pressable
                    key={s.label}
                    style={[styles.gift, { borderColor: side === 'host' ? colors.primary : colors.accent }]}
                    onPress={() => supportBattle(battle.id, side, s.points)}>
                    <Text style={styles.giftEmoji}>{s.emoji}</Text>
                    <Text style={styles.giftLabel}>+{s.points}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {battle.status !== 'ended' ? (
            <View style={styles.bottom}>
              <TextInput
                placeholder="Comente..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                style={styles.input}
              />
              {!isParticipant ? (
                <>
                  <SideButton label={firstName(host)} color={colors.primary} active={side === 'host'} onPress={() => setSide(side === 'host' ? null : 'host')} />
                  <SideButton label={firstName(opponent)} color={colors.accent} active={side === 'opponent'} onPress={() => setSide(side === 'opponent' ? null : 'opponent')} />
                </>
              ) : (
                <Pressable onPress={send} hitSlop={8}>
                  <Ionicons name="send" size={22} color="#fff" />
                </Pressable>
              )}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const firstName = (u: User) => u.name.split(' ')[0];

function Half({ user, battle, sideKey, isMe }: { user: User; battle: LiveBattle; sideKey: BattleSide; isMe: boolean }) {
  const media = battle.media[sideKey];
  const live = battle.status === 'live';
  const LV = getLiveVideo();
  const leading =
    battle.status !== 'scheduled' &&
    battle.scores[sideKey] > battle.scores[sideKey === 'host' ? 'opponent' : 'host'];
  return (
    <Pressable style={styles.half} disabled={isMe} onPress={() => router.push(`/user/${user.username}`)}>
      <View style={styles.halfVideo}>
      {live && LV ? (
        // App instalado: vídeo ao vivo de cada lado
        <LV.SideVideo
          userId={user.id}
          isMe={isMe}
          fallback={
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Avatar uri={user.avatar} size={72} />
              <Text style={styles.waiting}>{isMe ? 'Ligando sua câmera…' : 'Aguardando vídeo…'}</Text>
            </View>
          }
        />
      ) : live && isMe ? (
        // Expo Go / navegador: só a prévia da sua câmera
        <LiveCamera />
      ) : media && live ? (
        <MediaVideo uri={media} active startMuted={sideKey === 'opponent'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Avatar uri={user.avatar} size={72} />
        </View>
      )}
      </View>
      <Text style={styles.sideName} numberOfLines={1}>
        {isMe ? 'Você' : user.name}
      </Text>
    </Pressable>
  );
}

function SideButton({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.sideButton, { backgroundColor: active ? color : 'transparent', borderColor: color }]}>
      <Ionicons name="heart" size={14} color={active ? '#fff' : color} />
      <Text style={[styles.sideButtonText, { color: active ? '#fff' : color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChatLine({ message }: { message: BattleMessage }) {
  const { getUser } = useApp();
  const user = getUser(message.userId);
  if (!user) return null;
  const support = message.support;
  const gift = support ? SUPPORTS.find((s) => s.points === support.points) : undefined;
  // estilo TikTok: foto pequena, nome em cinza e texto em branco, sem fundo
  return (
    <View style={styles.chatLine}>
      <Avatar uri={user.avatar} size={30} />
      <View style={styles.chatBody}>
        <Text style={styles.chatUser} numberOfLines={1}>{user.username}</Text>
        <Text style={[styles.chatText, support && { color: support.side === 'host' ? '#60A5FA' : '#F87171' }]}>
          {message.text}
          {support ? ` ${gift?.emoji ?? '⭐'} +${support.points}` : ''}
        </Text>
      </View>
    </View>
  );
}

function Result({ battle }: { battle: LiveBattle; host: User; opponent: User }) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>Debate encerrado</Text>
      <Text style={styles.resultText}>{battle.topic}</Text>
      <Pressable style={styles.startButton} onPress={() => router.back()}>
        <Text style={styles.startText}>Voltar</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1020' },
  center: { alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.like, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  description: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  link: { color: '#60A5FA', textDecorationLine: 'underline' },
  topic: { color: '#fff', fontWeight: '700', fontSize: 15 },
  close: { paddingTop: 2 },
  endText: { color: '#fff', fontWeight: '700', backgroundColor: colors.like, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  split: { flexDirection: 'row' },
  half: { flex: 1, backgroundColor: '#0B1020' },
  halfVideo: { flex: 1, overflow: 'hidden', backgroundColor: '#111827' },
  inviteBox: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, minHeight: 280, backgroundColor: '#0B1020' },
  inviteTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  inviteTopic: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center' },
  inviteNote: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginBottom: spacing.xs },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#0B1020' },
  chatHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tileBox: { flex: 1, overflow: 'hidden', borderRadius: 10, backgroundColor: '#111827' },
  tileName: { color: '#fff', fontWeight: '700', fontSize: 12, paddingTop: 3, paddingHorizontal: 4 },
  joinTile: { flex: 1, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  joinPlus: { color: '#fff', fontSize: 26, fontWeight: '300', lineHeight: 28 },
  joinLabel: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  sideName: { color: '#fff', fontWeight: '700', fontSize: 14, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  divider: { width: 2, backgroundColor: '#0B1020' },
  waiting: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1E293B' },
  sideTag: { position: 'absolute', bottom: 8, left: 8, right: 8, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  sideTagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  scheduled: { alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  scheduledText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  startButton: { backgroundColor: colors.like, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  startText: { color: '#fff', fontWeight: '700' },
  result: { alignItems: 'center', gap: 6, padding: spacing.lg },
  resultTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  resultText: { color: 'rgba(255,255,255,0.8)' },
  chatLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, alignSelf: 'flex-start', maxWidth: '85%' },
  chatBody: { flexShrink: 1 },
  chatUser: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600' },
  chatText: { color: '#fff', fontSize: 14, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 4 },
  gifts: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 6 },
  giftsTitle: { color: '#fff', fontWeight: '700' },
  giftRow: { flexDirection: 'row', gap: spacing.sm },
  gift: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  giftEmoji: { fontSize: 22 },
  giftLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  input: { flex: 1, minWidth: 0, color: '#fff', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  sideButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 7, maxWidth: 88, flexShrink: 0 },
  sideButtonText: { fontWeight: '700', fontSize: 12, flexShrink: 1 },
}));

/** Texto da descrição com links que abrem no navegador. */
function LinkText({ text, style }: { text: string; style: object }) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  return (
    <Text style={style} numberOfLines={4}>
      {parts.map((part, i) =>
        /^(https?:\/\/|www\.)/.test(part) ? (
          <Text
            key={i}
            style={styles.link}
            onPress={() => Linking.openURL(part.startsWith('www.') ? `https://${part}` : part).catch(() => {})}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
