import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp, useMe } from '@/lib/store';
import { useStoryPicker } from './useStoryPicker';
import { colors, spacing, themed } from '@/lib/theme';
import { Avatar } from './Avatar';

const SIZE = 64;

export function StoriesBar() {
  const me = useMe();
  const { storyUsers } = useApp();
  const list = storyUsers();
  const mine = list.find((s) => s.user.id === me.id);
  const others = list.filter((s) => s.user.id !== me.id);


  const pickStory = useStoryPicker();


  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={others}
        keyExtractor={(item) => item.user.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable style={styles.item} onPress={() => (mine ? router.push(`/story/${me.id}`) : pickStory())}>
            <View>
              <Avatar uri={me.avatar} size={SIZE} ring={mine ? (mine.closeFriends ? 'close' : 'seen') : 'none'} />
              <Pressable onPress={pickStory} style={styles.plus} hitSlop={6}>
                <Ionicons name="add" size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              Seu story
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => router.push(`/story/${item.user.id}`)}>
            <Avatar uri={item.user.avatar} size={SIZE} ring={item.seen ? 'seen' : item.closeFriends ? 'close' : 'unseen'} />
            <Text style={[styles.label, item.seen && { color: colors.textMuted }]} numberOfLines={1}>
              {item.user.username}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  list: { paddingHorizontal: spacing.sm, gap: spacing.md },
  item: { alignItems: 'center', width: SIZE + 14 },
  label: { fontSize: 12, marginTop: 4, color: colors.text, maxWidth: SIZE + 14 },
  plus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 11,
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
