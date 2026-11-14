// Botões da plateia na batalha ao vivo: curtir (coraçõezinhos), compartilhar e seguir.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { compactNumber } from '@/lib/format';
import { useApp } from '@/lib/store';
import type { LiveBattle, User } from '@/lib/types';
import { useOverlay } from './Overlay';

const HEART_COLORS = ['#F43F5E', '#FB7185', '#EC4899', '#F97316', '#FACC15'];

type Heart = { id: number; x: number; color: string; anim: Animated.Value };

export function BattleActions({
  battle,
  host,
  opponent,
  meId,
  side = null,
}: {
  battle: LiveBattle;
  host: User;
  opponent: User;
  meId: string;
  side?: 'host' | 'opponent' | null;
}) {
  const { likeBattle, isFollowing, toggleFollow } = useApp();
  const { showSheet, showBanner } = useOverlay();
  const [hearts, setHearts] = useState<Heart[]>([]);
  const pending = useRef(0);
  const sentByMe = useRef(0);
  const sideRef = useRef(side);
  sideRef.current = side;
  const lastTotal = useRef(battle.likes ?? 0);
  const nextId = useRef(0);
  const participant = meId === host.id || meId === opponent.id;
  const live = battle.status === 'live';

  const spawn = (count = 1) => {
    const list: Heart[] = Array.from({ length: Math.min(count, 6) }, () => ({
      id: nextId.current++,
      x: Math.random() * 36 - 18,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      anim: new Animated.Value(0),
    }));
    setHearts((h) => [...h.slice(-24), ...list]);
    list.forEach((heart, i) =>
      Animated.timing(heart.anim, {
        toValue: 1,
        duration: 1500 + Math.random() * 600,
        delay: i * 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setHearts((h) => h.filter((x) => x.id !== heart.id))),
    );
  };

  // envia os toques juntos a cada 1 segundo (para não sobrecarregar o banco)
  useEffect(() => {
    const t = setInterval(() => {
      if (!pending.current) return;
      const n = Math.min(50, pending.current);
      pending.current -= n;
      sentByMe.current += n;
      likeBattle(battle.id, n, sideRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [battle.id, likeBattle]);

  // curtidas de outras pessoas: corações sobem também na minha tela
  useEffect(() => {
    const total = battle.likes ?? 0;
    const delta = total - lastTotal.current - sentByMe.current;
    lastTotal.current = total;
    sentByMe.current = 0;
    if (delta > 0) spawn(delta);
  }, [battle.likes]); // eslint-disable-line react-hooks/exhaustive-deps

  const like = () => {
    if (!live) return;
    pending.current += 1;
    spawn(1);
  };

  const share = () =>
    Share.share({
      message: `🔴 AO VIVO na Rede Política: ${host.name} x ${opponent.name} debatem "${battle.topic}". Entre e apoie seu lado! redepolitica://battle/${battle.id}`,
    }).catch(() => {});

  const follow = () => {
    const people = [host, opponent].filter((u) => u.id !== meId);
    showSheet({
      title: 'Seguir quem está debatendo',
      options: people.map((u) => {
        const on = isFollowing(u.id);
        return {
          label: on ? `Deixar de seguir ${u.name}` : `Seguir ${u.name}`,
          icon: on ? ('person-remove-outline' as const) : ('person-add-outline' as const),
          destructive: on,
          onPress: () => {
            toggleFollow(u.id);
            if (!on) showBanner(`Você está seguindo ${u.name}.`, { icon: 'person-add', tone: 'success' });
          },
        };
      }),
    });
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* corações subindo */}
      <View style={styles.hearts} pointerEvents="none">
        {hearts.map((h) => (
          <Animated.View
            key={h.id}
            style={[
              styles.heart,
              {
                opacity: h.anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
                transform: [
                  { translateY: h.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -230] }) },
                  { translateX: h.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, h.x, -h.x / 2] }) },
                  { scale: h.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.1, 0.8] }) },
                ],
              },
            ]}>
            <Ionicons name="heart" size={28} color={h.color} />
          </Animated.View>
        ))}
      </View>

      {live ? (
        <Action icon="heart" color="#F43F5E" label={compactNumber(battle.likes ?? 0)} onPress={like} a11y="Curtir" />
      ) : null}
      <Action icon="arrow-redo" label="Compartilhar" onPress={share} a11y="Compartilhar" />
      {!participant ? <Action icon="person-add" label="Seguir" onPress={follow} a11y="Seguir" /> : null}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  color = '#fff',
  a11y,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color?: string;
  a11y: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={6} accessibilityLabel={a11y}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 8, bottom: 8, alignItems: 'center', gap: 12 },
  hearts: { position: 'absolute', bottom: '100%', right: 16, width: 44, height: 260 },
  heart: { position: 'absolute', bottom: 0, left: 8 },
  action: { alignItems: 'center', gap: 2, width: 78 },
  circle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
});
