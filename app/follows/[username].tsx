import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { UserRow } from '@/components/UserRow';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

type Tab = 'followers' | 'following';

export default function FollowsScreen() {
  const params = useLocalSearchParams<{ username: string; tab?: Tab }>();
  const { getUserByUsername, followersOf, followingOf } = useApp();
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const user = getUserByUsername(params.username);
  if (!user) return null;

  const followers = followersOf(user.id);
  const following = followingOf(user.id);
  const list = tab === 'followers' ? followers : following;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: user.username }} />
      <View style={styles.tabs}>
        <TabButton label={`${followers.length} seguidores`} active={tab === 'followers'} onPress={() => setTab('followers')} />
        <TabButton label={`${following.length} seguindo`} active={tab === 'following'} onPress={() => setTab('following')} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => <UserRow user={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{tab === 'followers' ? 'Nenhum seguidor ainda.' : 'Não segue ninguém ainda.'}</Text>
        }
      />
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, !active && { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 1.5, borderBottomColor: colors.text },
  tabText: { fontWeight: '600', color: colors.text },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
}));
