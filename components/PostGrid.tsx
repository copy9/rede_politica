import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { mediaUri } from '@/lib/media';
import { useSettings } from '@/lib/settings';
import { colors, themed } from '@/lib/theme';
import type { Post } from '@/lib/types';

/** Grade de 3 colunas (perfil e explorar). Não rola sozinha: fica dentro de outra lista. */
export function PostGrid({
  posts,
  emptyText = 'Nenhuma publicação ainda',
  portrait = false,
  onPressPost,
}: {
  posts: Post[];
  emptyText?: string;
  portrait?: boolean;
  onPressPost?: (post: Post) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((Math.min(width, 640) - 4) / 3);
  const { settings } = useSettings();

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
        <Pressable key={p.id} onPress={() => (onPressPost ? onPressPost(p) : router.push(`/post/${p.id}`))} style={{ width: size, height: portrait ? Math.round((size * 16) / 9) : size }}>
          {p.type === 'text' ? (
            <View style={[StyleSheet.absoluteFill, styles.textTile]}>
              <Text style={styles.textTileText} numberOfLines={5}>
                {p.caption}
              </Text>
            </View>
          ) : p.type === 'video' && !p.thumbnail ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
          ) : (
            <Image
              source={{ uri: mediaUri(p.type === 'video' ? p.thumbnail : p.uri, settings.dataSaver) }}
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

const styles = themed(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  textTile: { backgroundColor: colors.surface, padding: 8, justifyContent: 'center' },
  textTileText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  icon: { position: 'absolute', top: 6, right: 6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
}));
