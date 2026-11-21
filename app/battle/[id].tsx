import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { recordView } from '@/lib/views';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BattleActions } from '@/components/BattleActions';
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
  return <BattleView id={id} />;
}

/** Tela da live/debate (usada também no feed de lives, que rola como o TikTok). */
export function BattleView({ id }: { id: string }) {
  const me = useMe();
  const app = useApp();
  const { getBattle, getUser, messagesForBattle, supportBattle, sendBattleMessage, joinBattle, startBattle, endBattle, remindBattle, acceptBattle, declineBattle, refreshBattle } = app;
  const { width, height } = useWindowDimensions();
  const { confirm, showBanner } = useOverlay();
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<BattleSide | null>(null);
  const [text, setText] = useState('');
  // altura real disponível (diminui quando o teclado abre e o celular encolhe a tela)
  const [availH, setAvailH] = useState(0);
  // teclado aberto: mede onde o teclado começa na tela e põe o campo de comentário logo acima,
  // funcione o celular encolhendo a tela com o teclado ou não (cada aparelho faz de um jeito)
  const [kbHeight, setKbHeight] = useState(0);
  const [kbOpen, setKbOpen] = useState(false);
  const chatAreaRef = useRef<React.ComponentRef<typeof View>>(null);
  const kbTopRef = useRef(0);
  useEffect(() => {
    const place = (kbTop: number) => {
      chatAreaRef.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => setKbHeight(Math.max(0, Math.round(y + h - kbTop))));
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKbOpen(true);
      kbTopRef.current = e.endCoordinates.screenY;
      place(e.endCoordinates.screenY);
      setTimeout(() => place(e.endCoordinates.screenY), 400);
      // mede de novo depois que a tela termina de se ajustar
      setTimeout(() => place(e.endCoordinates.screenY), 150);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKbOpen(false);
      setKbHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    if (!kbOpen) return;
    const t = setTimeout(() => {
      chatAreaRef.current?.measureInWindow((_x: number, y: number, _w: number, h: number) =>
        setKbHeight(Math.max(0, Math.round(y + h - kbTopRef.current))),
      );
    }, 80);
    return () => clearTimeout(t);
  }, [kbOpen, availH]);
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
  // quem assiste a live conta no painel de quem está debatendo
  const viewBattle = getBattle(id);
  useEffect(() => {
    if (!viewBattle || viewBattle.status !== 'live') return;
    recordView(viewBattle.hostId, 'battle', viewBattle.id);
    if (viewBattle.opponentId) recordView(viewBattle.opponentId, 'battle', viewBattle.id);
  }, [viewBattle?.id, viewBattle?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const battle = getBattle(id);
  const host = battle ? getUser(battle.hostId) : undefined;
  // live sozinho: não tem o outro lado (as outras pessoas podem pedir para entrar)
  const solo = !!battle && !battle.opponentId;
  const opponent = battle ? (battle.opponentId ? getUser(battle.opponentId) : host) : undefined;

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

  // fim da live: volta para a tela principal (Início)
  const goHome = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  };
  const leave = () => {
    // convidado ao vivo que sai: libera o lugar e desliga a câmera
    if (guests.some((g) => g.user_id === me.id && g.status === 'accepted')) answerGuestInvite(battle.id, me.id, 'declined');
    router.back();
  };
  const onClose = () => {
    if (isHost && live) {
      confirm('Tem certeza que você deseja sair?', 'A live termina agora para todos.', 'Sair', () => {
        endBattle(battle.id);
        goHome();
      }, true);
      return;
    }
    if (live) {
      confirm('Tem certeza que você deseja sair?', 'Você sai desta live.', 'Sair', leave, true);
      return;
    }
    if (battle.status === 'ended') return goHome();
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
    <View style={styles.container} onLayout={(e) => setAvailH(Math.round(e.nativeEvent.layout.height))}>
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
        {multiPeople || solo ? null : (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            {null}
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
            ...(solo ? [] : [{ key: opponent.id, user: opponent, isMe: opponent.id === me.id, kind: 'side' as const }]),
            ...guestSlots('accepted', 'accepted'),
            ...guestSlots('convidado', 'invited'),
          ];
          // Disposições iguais às da live do TikTok:
          // 1 pessoa: tela inteira | 2 (batalha): meia tela para cada um, lado a lado em pé (9:16)
          // 3: quem criou grande à esquerda e os outros dois empilhados à direita | 4: 2x2 | 5-6: 3x2 | 7-9: 3x3
          const people = slots.length;
          const fullScreen = people === 1;
          const reserved = 260 + (battle.status === 'invited' || battle.status === 'scheduled' ? 120 : 0);
          const stageW = width;
          // teclado aberto: o palco diminui para sobrar espaço para o campo de comentário
          const screenH = kbOpen && availH ? Math.min(height, availH) : height;
          const stageH = kbOpen
            ? Math.max(120, Math.min(Math.round((width / 2) * (16 / 9)), screenH - 210))
            : Math.max(200, Math.min(Math.round((width / 2) * (16 / 9)), height - reserved));
          type Rect = { x: number; y: number; w: number; h: number };
          const grid = (cols: number, rows: number): Rect[] =>
            Array.from({ length: cols * rows }, (_, i) => ({
              x: (i % cols) * (stageW / cols),
              y: Math.floor(i / cols) * (stageH / rows),
              w: stageW / cols,
              h: stageH / rows,
            }));
          const rects: Rect[] =
            people <= 1
              ? [{ x: 0, y: 0, w: stageW, h: stageH }]
              : people === 2
                ? grid(2, 1)
                : people === 3
                  ? [
                      { x: 0, y: 0, w: stageW / 2, h: stageH },
                      { x: stageW / 2, y: 0, w: stageW / 2, h: stageH / 2 },
                      { x: stageW / 2, y: stageH / 2, w: stageW / 2, h: stageH / 2 },
                    ]
                  : people === 4
                    ? grid(2, 2)
                    : people <= 6
                      ? grid(3, 2)
                      : grid(3, 3);
          const LVx = getLiveVideo();

          const tile = (s: Slot, i: number) => {
            const r = rects[i];
            if (!r && !fullScreen) return null;
            const name = s.isMe ? 'Você' : s.user?.name ?? '';
            const fallback = (
              <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
                <Avatar uri={s.user?.avatar ?? ''} size={Math.min(64, Math.round((fullScreen ? 200 : r.h) * 0.3))} />
                {s.kind === 'invited' ? <Text style={styles.waiting}>aguardando</Text> : null}
              </View>
            );
            const canShowVideo = live && s.kind !== 'invited';
            // ao vivo: só o vídeo da sala (a câmera do celular fica livre para a transmissão);
            // antes de começar: a própria câmera de quem está na batalha
            const video =
              canShowVideo && LVx ? (
                <LVx.SideVideo userId={s.key} isMe={s.isMe} fallback={fallback} controlsTop={fullScreen ? 130 : 8} />
              ) : !live && s.isMe && s.kind !== 'invited' ? (
                <LiveCamera />
              ) : (
                fallback
              );
            if (fullScreen) {
              return (
                <View key={s.key} style={StyleSheet.absoluteFill}>
                  {video}
                </View>
              );
            }
            return (
              <View key={s.key} style={[styles.tileAbs, { left: r.x, top: r.y, width: r.w, height: r.h }]}>
                {video}
                {/* nome por cima do vídeo, embaixo à esquerda, como no TikTok */}
                <Text style={styles.tileNameOver} numberOfLines={1}>
                  {name}
                </Text>
                {s.key === host.id || (!solo && s.key === opponent.id) ? (
                  <View style={styles.likeCount}>
                    <Ionicons name="heart" size={12} color="#F43F5E" />
                    <Text style={styles.likeCountText}>{compactNumber(battle.scores[s.key === host.id ? 'host' : 'opponent'])}</Text>
                  </View>
                ) : null}
              </View>
            );
          };

          const joinLabel = myGuest?.status === 'pending' ? 'Pedido enviado' : myGuest?.status === 'declined' ? 'Pedir de novo' : 'Participar';
          const joinButton = showJoin ? (
            <Pressable
              style={styles.joinPill}
              accessibilityLabel="Participar da live"
              onPress={async () => {
                const msg = await requestToJoin(battle.id, me.id, myGuest?.status);
                if (msg) showBanner(msg, { icon: 'people-outline', tone: 'success' });
              }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.joinPillText}>{joinLabel}</Text>
            </Pressable>
          ) : null;

          // sozinho: a câmera fica atrás de tudo, ocupando a tela inteira (cabeçalho e comentários por cima)
          if (fullScreen) {
            const solo1 = (
              <>
                {slots.map(tile)}
                <View style={styles.fullTop}>
                  <BattleGuestsControls
                    battleId={battle.id}
                    isHost={isHost && live}
                    users={app.users}
                    guests={guests}
                    onMessage={(t) => showBanner(t, { icon: 'people-outline', tone: 'success' })}
                  />
                </View>
              </>
            );
            const LVf = getLiveVideo();
            return (
              <>
                {LVf && live ? (
                  <LVf.BattleRoom key={`${isParticipant}-${isGuestSpeaker}`} battleId={battle.id} speaker={isParticipant || isGuestSpeaker} style={styles.fullStage}>
                    {solo1}
                  </LVf.BattleRoom>
                ) : (
                  <View style={styles.fullStage}>{solo1}</View>
                )}
                {joinButton ? <View style={styles.joinRow}>{joinButton}</View> : null}
              </>
            );
          }

          const stage = (
            <View>
              <BattleGuestsControls
                battleId={battle.id}
                isHost={isHost && live}
                users={app.users}
                guests={guests}
                onMessage={(t) => showBanner(t, { icon: 'people-outline', tone: 'success' })}
              />
              <View style={[styles.tileGrid, { width: stageW, height: stageH }]}>{slots.map(tile)}</View>
              {joinButton ? <View style={styles.joinRow}>{joinButton}</View> : null}
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
        <View style={{ flex: 1 }} ref={chatAreaRef} collapsable={false}>
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
            <BattleActions battle={battle} host={host} opponent={opponent} meId={me.id} side={side} speaker={isGuestSpeaker} />
          </View>

          {live && !isParticipant && side && !solo ? (
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
            <View
              // collapsable={false}: a caixa nunca é recriada quando o teclado abre (senão o campo perde o foco e o teclado fecha sozinho)
              collapsable={false}
              style={[styles.bottom, kbOpen && [styles.bottomOverKeyboard, { bottom: kbHeight }]]}>
              <TextInput
                placeholder="Comente..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                style={styles.input}
              />
              {!isParticipant && !solo ? (
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
        </View>
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
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1020' },
  // live sozinho: vídeo atrás de tudo
  fullStage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  fullTop: { position: 'absolute', top: 120, left: 0, right: 0 },
  joinRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6 },
  joinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.like, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  joinPillText: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  tileGrid: { position: 'relative', backgroundColor: '#000' },
  tileAbs: { position: 'absolute', overflow: 'hidden', backgroundColor: '#111827', borderWidth: StyleSheet.hairlineWidth, borderColor: '#000' },
  likeCount: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  likeCountText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  tileNameOver: { position: 'absolute', left: 8, bottom: 6, right: 8, color: '#fff', fontWeight: '700', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
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
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'transparent' },
  bottomOverKeyboard: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0B1020', zIndex: 10, elevation: 10 },
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
