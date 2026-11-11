import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text } from 'react-native';

import { UserRow } from '@/components/UserRow';
import { useApp } from '@/lib/store';
import { colors, themed } from '@/lib/theme';
import type { User } from '@/lib/types';

export default function LikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPost, getUser } = useApp();
  const users = (getPost(id)?.likes ?? []).map(getUser).filter((u): u is User => !!u);

  return (
    <FlatList
      style={styles.container}
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <UserRow user={item} />}
      ListEmptyComponent={<Text style={styles.empty}>Ninguém curtiu ainda.</Text>}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
}));
