import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { BattleScoreBar } from '@/components/BattleScoreBar';
import { LiveCamera } from '@/components/LiveCamera';
import { MediaVideo } from '@/components/MediaVideo';
import { compactNumber } from '@/lib/format';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import type { BattleMessage, BattleSide, LiveBattle, User } from '@/lib/types';

/** Tipos de apoio que a plateia pode enviar (pontos para um dos lados). */
const SUPPORTS = [
  { emoji: '👏', label: 'Aplauso', points: 1 },
  { emoji: '🇧🇷', label: 'Bandeira', points: 5 },
  { emoji: '📢', label: 'Megafone', points: 20 },
  { emoji: '🏆', label: 'Troféu', points: 100 },
];

// Frases da plateia simulada (modo demonstração)
const CROWD_LINES = [
  'Boa resposta!',
  'Quero ver os números',
  'Fonte?',
  'Concordo 100%',
  'Isso não responde a pergunta',
  'Vamos com respeito, pessoal',
  'Excelente ponto',
  'E o orçamento?',
  'Assistindo de Recife 👋',
  'Mais transparência!',
];

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function BattleRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const app = useApp();
  const { getBattle, getUser, messagesForBattle, supportBattle, sendBattleMessage, setBattleViewers, startBattle, endBattle, users } = app;
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<BattleSide | null>(null);
  const [text, setText] = useState('');

  const battle = getBattle(id);
  const host = battle ? getUser(battle.hostId) : undefined;
  const opponent = battle ? getUser(battle.opponentId) : undefined;

  // Relógio
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = battle ? (battle.startsAt + battle.durationSec * 1000 - now) / 1000 : 0;

  // Fim do tempo
  useEffect(() => {
    if (battle?.status === 'live' && remaining <= 0) endBattle(battle.id);
  }, [battle?.status, remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plateia simulada: pontos, mensagens e espectadores (só no modo demonstração)
  const latest = useRef(app);
  latest.current = app;
  useEffect(() => {
    if (battle?.status !== 'live') return;
    const crowd = users.filter((u) => u.id !== me.id);
    const t = setInterval(() => {
      const a = latest.current;
      const b = a.getBattle(id);
      if (!b || b.status !== 'live') return;
      const who = crowd[Math.floor(Math.random() * crowd.length)];
      const s: BattleSide = Math.random() < 0.5 ? 'host' : 'opponent';
      const r = Math.random();
      const pts = r < 0.6 ? 1 + Math.floor(Math.random() * 3) : r < 0.9 ? 5 : r < 0.98 ? 20 : 100;
      a.supportBattle(id, s, pts, who.id);
      if (Math.random() < 0.25) a.sendBattleMessage(id, CROWD_LINES[Math.floor(Math.random() * CROWD_LINES.length)], who.id);
      a.setBattleViewers(id, Math.max(1, b.viewers + Math.round((Math.random() - 0.4) * 12)));
    }, 1300);
    return () => clearInterval(t);
  }, [battle?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const halfHeight = Math.min(width * 0.62, 340);

  const onClose = () => {
    if (isHost && live) {
      Alert.alert('Encerrar batalha?', 'A batalha termina agora e o placar atual define o resultado.', [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            endBattle(battle.id);
          },
        },
      ]);
    } else router.back();
  };

  const send = () => {
    if (!text.trim()) return;
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
                  <Ionicons name="timer-outline" size={13} color="#fff" />
                  <Text style={styles.pillText}>{fmtTime(remaining)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.topic} numberOfLines={2}>
              {battle.topic}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            {isHost && live ? <Text style={styles.endText}>Encerrar</Text> : <Ionicons name="close" size={28} color="#fff" />}
          </Pressable>
        </View>

        {/* Os dois lados */}
        <View style={[styles.split, { height: halfHeight }]}>
          <Half user={host} battle={battle} sideKey="host" isMe={host.id === me.id} />
          <View style={styles.divider} />
          <Half user={opponent} battle={battle} sideKey="opponent" isMe={opponent.id === me.id} />
          <View style={styles.vsWrap} pointerEvents="none">
            <Text style={styles.vs}>VS</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <BattleScoreBar host={battle.scores.host} opponent={battle.scores.opponent} height={24} />
        </View>

        {/* Resultado / agendada */}
        {battle.status === 'ended' ? <Result battle={battle} host={host} opponent={opponent} /> : null}
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
              <Pressable style={styles.startButton} onPress={() => Alert.alert('Lembrete criado', 'Avisaremos quando a batalha começar.')}>
                <Text style={styles.startText}>Lembrar-me</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Chat */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <FlatList
            style={{ flex: 1 }}
            inverted
            data={[...messagesForBattle(battle.id)].reverse().slice(0, 80)}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatLine message={item} />}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 }}
          />

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

          {live ? (
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
  const leading =
    battle.status !== 'scheduled' &&
    battle.scores[sideKey] > battle.scores[sideKey === 'host' ? 'opponent' : 'host'];
  return (
    <Pressable style={styles.half} disabled={isMe} onPress={() => router.push(`/user/${user.username}`)}>
      {live && isMe ? (
        // Seu lado: a sua câmera de verdade
        <LiveCamera />
      ) : media && live ? (
        <MediaVideo uri={media} active startMuted={sideKey === 'opponent'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Avatar uri={user.avatar} size={72} />
        </View>
      )}
      <View style={[styles.sideTag, { backgroundColor: sideKey === 'host' ? colors.primary : colors.accent }]}>
        <Text style={styles.sideTagText} numberOfLines={1}>
          {leading ? '👑 ' : ''}
          {isMe ? 'Você' : user.name}
        </Text>
      </View>
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
  return (
    <View
      style={[
        styles.chatLine,
        support && { backgroundColor: support.side === 'host' ? 'rgba(29,78,216,0.55)' : 'rgba(245,158,11,0.55)' },
      ]}>
      <Avatar uri={user.avatar} size={22} />
      <Text style={styles.chatText}>
        <Text style={styles.chatUser}>{user.username} </Text>
        {message.text}
        {support ? ` ${gift?.emoji ?? '⭐'} +${support.points}` : ''}
      </Text>
    </View>
  );
}

function Result({ battle, host, opponent }: { battle: LiveBattle; host: User; opponent: User }) {
  const { host: h, opponent: o } = battle.scores;
  const winner = h === o ? null : h > o ? host : opponent;
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>{winner ? `🏆 Vitória de ${winner.name}` : 'Empate!'}</Text>
      <Text style={styles.resultText}>
        {compactNumber(h)} x {compactNumber(o)} pontos
      </Text>
      <Pressable style={styles.startButton} onPress={() => router.back()}>
        <Text style={styles.startText}>Voltar para batalhas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  topic: { color: '#fff', fontWeight: '700', fontSize: 15 },
  close: { paddingTop: 2 },
  endText: { color: '#fff', fontWeight: '700', backgroundColor: colors.like, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  split: { flexDirection: 'row' },
  half: { flex: 1, overflow: 'hidden', backgroundColor: '#111827' },
  divider: { width: 2, backgroundColor: '#0B1020' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1E293B' },
  vsWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  vs: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    backgroundColor: colors.like,
    borderRadius: 22,
    width: 44,
    height: 44,
    lineHeight: 44,
    textAlign: 'center',
    overflow: 'hidden',
  },
  sideTag: { position: 'absolute', bottom: 8, left: 8, right: 8, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  sideTagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  scheduled: { alignItems: 'center', gap: 10, padding: spacing.xl },
  scheduledText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  startButton: { backgroundColor: colors.like, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  startText: { color: '#fff', fontWeight: '700' },
  result: { alignItems: 'center', gap: 6, padding: spacing.lg },
  resultTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  resultText: { color: 'rgba(255,255,255,0.8)' },
  chatLine: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  chatText: { color: '#fff', flexShrink: 1 },
  chatUser: { fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
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
});
