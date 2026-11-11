import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { User } from '@/lib/types';
import { colors, themed } from '@/lib/theme';

/** Nome de usuário com selo de verificado (contas oficiais de políticos/órgãos). */
export function UserName({ user, style, size = 14 }: { user: User; style?: TextStyle; size?: number }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.name, { fontSize: size }, style]} numberOfLines={1}>
        {user.username}
      </Text>
      {user.verified ? <Ionicons name="checkmark-circle" size={size} color={colors.primary} style={styles.badge} /> : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  name: { fontWeight: '600', color: colors.text, flexShrink: 1 },
  badge: { marginLeft: 3 },
}));
