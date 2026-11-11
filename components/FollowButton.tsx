import { Pressable, StyleSheet, Text } from 'react-native';

import { useApp } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export function FollowButton({ userId, compact }: { userId: string; compact?: boolean }) {
  const { me, isFollowing, toggleFollow, hasRequested } = useApp();
  if (!me || me.id === userId) return null;
  const following = isFollowing(userId);
  const requested = !following && hasRequested(userId);
  return (
    <Pressable
      onPress={() => toggleFollow(userId)}
      style={[styles.btn, compact && styles.compact, following || requested ? styles.secondary : styles.primary]}>
      <Text style={[styles.text, following || requested ? styles.textSecondary : styles.textPrimary]}>
        {following ? 'Seguindo' : requested ? 'Solicitado' : 'Seguir'}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, flex }: { label: string; onPress: () => void; flex?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, styles.secondary, flex && { flex: 1 }]}>
      <Text style={[styles.text, styles.textSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  compact: { paddingVertical: 6, paddingHorizontal: 14 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface },
  text: { fontWeight: '600', fontSize: 14 },
  textPrimary: { color: colors.white },
  textSecondary: { color: colors.text },
}));
