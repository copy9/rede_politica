import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { Post } from '@/lib/types';

export default function FeedScreen() {
  const { feed, notifications, me } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const posts = feed();
  const { settings } = useSettings();
  const hasNotifications = !settings.notifications.pauseAll && notifications.some((n) => n.toUserId === me?.id);

  // Só o vídeo que está visível toca
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Post; isViewable: boolean }[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    setActiveId(first?.item?.id ?? null);
  }).current;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Logo size={22} />
        <View style={styles.headerIcons}>
          <Pressable onPress={() => router.navigate('/create')} hitSlop={8} accessibilityLabel="Nova publicação">
            <Ionicons name="add-outline" size={28} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
            {hasNotifications ? <View style={styles.dot} /> : null}
          </Pressable>
          <Pressable onPress={() => router.push('/messages')} hitSlop={8}>
            <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} active={item.id === activeId} />}
        ListHeaderComponent={<StoriesBar />}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerIcons: { flexDirection: 'row', gap: 20 },
  dot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.like },
}));
