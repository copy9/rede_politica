import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { User } from '@/lib/types';
import { colors, spacing } from '@/lib/theme';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { UserName } from './UserName';

export function UserRow({ user, showFollow = true, subtitle }: { user: User; showFollow?: boolean; subtitle?: string }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/user/${user.username}`)}>
      <Avatar uri={user.avatar} size={48} />
      <View style={styles.info}>
        <UserName user={user} />
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle ?? [user.name, user.role].filter(Boolean).join(' • ')}
        </Text>
      </View>
      {showFollow ? <FollowButton userId={user.id} compact /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.md },
  info: { flex: 1 },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
