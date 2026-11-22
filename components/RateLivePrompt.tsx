// Pop-up em qualquer tela: quando termina uma live que a pessoa estava assistindo, pede uma nota de 1 a 5 estrelas.
// A nota entra no score de quem fez a live e impulsiona as próximas lives dessa pessoa.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { myRating, rateBattle, useRatings, watchedLives } from '@/lib/ratings';
import { useApp } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

export function RateLivePrompt() {
  const { battles, getUser } = useApp();
  const { showBanner } = useOverlay();
  useRatings();
  const [done, setDone] = useState<string[]>([]);
  const [stars, setStars] = useState(0);

  const watched = watchedLives();
  const battle = battles.find((b) => watched.has(b.id) && b.status === 'ended' && !done.includes(b.id) && myRating(b.id) === undefined);
  if (!battle) return null;
  const host = getUser(battle.hostId);
  const opponent = battle.opponentId ? getUser(battle.opponentId) : undefined;
  const who = opponent ? `${host?.name ?? ''} x ${opponent.name}` : host?.name ?? '';

  const close = () => {
    setDone((d) => [...d, battle.id]);
    setStars(0);
  };
  const send = async () => {
    const n = stars;
    close();
    const err = await rateBattle(battle.id, n);
    showBanner(err ?? 'Obrigado pela nota!', { icon: err ? 'alert-circle-outline' : 'star', tone: err ? 'warning' : 'success' });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>A live terminou. Como foi?</Text>
          {who ? <Text style={styles.who} numberOfLines={1}>{who}</Text> : null}
          <Text style={styles.sub} numberOfLines={2}>{battle.topic}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} hitSlop={6} accessibilityLabel={`${n} estrela${n > 1 ? 's' : ''}`}>
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={40} color="#FACC15" />
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Sua nota ajuda as melhores lives a chegarem a mais gente.</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: '#374151' }]} onPress={close}>
              <Text style={styles.btnText}>Agora não</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: stars ? colors.like : '#4B5563' }]} disabled={!stars} onPress={send}>
              <Text style={styles.btnText}>Enviar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#111827', borderRadius: 18, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  who: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 6, marginVertical: spacing.sm },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
