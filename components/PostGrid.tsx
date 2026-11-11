import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors } from '@/lib/theme';
import type { Post } from '@/lib/types';

/** Grade de 3 colunas (perfil e explorar). Não rola sozinha: fica dentro de outra lista. */
export function PostGrid({ posts, emptyText = 'Nenhuma publicação ainda' }: { posts: Post[]; emptyText?: string }) {
  const { width } = useWindowDimensions();
  const size = (Math.min(width, 640) - 4) / 3;

  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={{ width: size, height: size }}>
          {p.type === 'video' && !p.thumbnail ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
          ) : (
            <Image
              source={{ uri: p.type === 'video' ? p.thumbnail : p.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          )}
          {p.type === 'video' ? (
            <Ionicons name="play" size={18} color="#fff" style={styles.icon} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  icon: { position: 'absolute', top: 6, right: 6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
