// Lives ao vivo, uma por tela: arraste para cima para ir para a próxima (como o TikTok).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BattleView } from '@/app/battle/[id]';
import { useApp } from '@/lib/store';
import { liveBoost } from '@/lib/ratings';
import { colors, spacing } from '@/lib/theme';

export default function LivesFeed() {
  const { battles, getUser } = useApp();
  const { height } = useWindowDimensions();
  // ordem sorteada (fixa enquanto a tela está aberta), mas quem tem nota melhor nas lives aparece antes para mais gente
  const seed = useRef(Math.random()).current;
  const lives = useMemo(
    () =>
      battles
        .filter((b) => b.status === 'live')
        .map((b) => {
          const boost = Math.max(liveBoost(b.hostId), b.opponentId ? liveBoost(b.opponentId) : 0);
          return { b, k: Math.abs(Math.sin(seed * 1000 + b.id.charCodeAt(0) * 31 + b.id.charCodeAt(5))) / (boost * boost) };
        })
        .sort((x, y) => x.k - y.k)
        .map((x) => x.b),
    [battles, seed],
  );
  const [current, setCurrent] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrent(first.index);
  }).current;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {lives.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="radio-outline" size={56} color="rgba(255,255,255,0.6)" />
          <Text style={styles.emptyTitle}>Nenhuma live agora</Text>
          <Text style={styles.emptyText}>Quando alguém entrar ao vivo, aparece aqui.</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/battle/new')}>
            <Text style={styles.btnText}>Fazer uma live</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.emptyText}>Voltar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lives}
          keyExtractor={(b) => b.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={3}
          renderItem={({ item, index }) => {
            const host = getUser(item.hostId);
            return (
              <View style={{ height }}>
                {/* só a live da tela atual entra na sala de vídeo */}
                {index === current ? (
                  <BattleView id={item.id} />
                ) : (
                  <View style={styles.preview}>
                    <Avatar uri={host?.avatar ?? ''} size={90} ring="unseen" />
                    <Text style={styles.previewName}>{host?.name}</Text>
                    <Text style={styles.previewTopic}>{item.topic}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1020' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptyText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  btn: { backgroundColor: colors.like, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: spacing.sm },
  btnText: { color: '#fff', fontWeight: '800' },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  previewName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  previewTopic: { color: 'rgba(255,255,255,0.75)', paddingHorizontal: spacing.lg, textAlign: 'center' },
});
