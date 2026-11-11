import { ScrollView, StyleSheet } from 'react-native';

import { PostGrid } from '@/components/PostGrid';
import { useApp, useMe } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export default function SavedScreen() {
  const me = useMe();
  const { posts } = useApp();
  const saved = posts.filter((p) => p.savedBy.includes(me.id));
  return (
    <ScrollView style={styles.container}>
      <PostGrid posts={saved} emptyText="Toque no marcador de uma publicação para salvar" />
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background } }));
