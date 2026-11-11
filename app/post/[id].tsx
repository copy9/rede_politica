import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { useApp } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPost } = useApp();
  const post = getPost(id);

  return (
    <ScrollView style={styles.container}>
      {post ? <PostCard post={post} active /> : <Text style={styles.empty}>Publicação não encontrada.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
