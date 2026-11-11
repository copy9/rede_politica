import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaVideo } from '@/components/MediaVideo';
import { useOverlay } from '@/components/Overlay';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { MediaType } from '@/lib/types';

type Picked = { uri: string; type: MediaType };

export default function CreateScreen() {
  const me = useMe();
  const { createPost } = useApp();
  const { showBanner } = useOverlay();
  const [media, setMedia] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');

  const pick = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o uso da câmera nas configurações do celular.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      videoMaxDuration: 90,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' });
  };

  const reset = () => {
    setMedia(null);
    setCaption('');
    setLocation('');
  };

  const share = () => {
    if (!media) return;
    const post = createPost({ ...media, caption, location });
    if (typeof post === 'string') return showBanner(post, { icon: 'alert-circle-outline', tone: 'warning' });
    reset();
    if (post) router.navigate('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {media ? (
          <Pressable onPress={reset} hitSlop={8}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text style={styles.title}>Nova publicação</Text>
        {media ? (
          <Pressable onPress={share} hitSlop={8}>
            <Text style={styles.shareText}>Compartilhar</Text>
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {!media ? (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={72} color={colors.text} />
          <Text style={styles.emptyTitle}>Compartilhe fotos e vídeos</Text>
          <Text style={styles.emptyText}>Mostre o que acontece na sua cidade, fiscalize, proponha.</Text>
          <Pressable style={styles.primary} onPress={() => pick(false)}>
            <Text style={styles.primaryText}>Escolher da galeria</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => pick(true)}>
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryText}>Usar a câmera</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.preview}>
              {media.type === 'video' ? (
                <MediaVideo uri={media.uri} active style={StyleSheet.absoluteFill} />
              ) : (
                <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>
            <View style={styles.captionRow}>
              <Image source={{ uri: me.avatar }} style={styles.avatar} />
              <TextInput
                placeholder="Escreva uma legenda..."
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={2200}
                style={styles.caption}
              />
            </View>
            <View style={styles.option}>
              <Ionicons name="location-outline" size={22} color={colors.text} />
              <TextInput
                placeholder="Adicionar localização"
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
                style={styles.optionInput}
              />
            </View>
            <Pressable style={[styles.primary, { margin: spacing.lg }]} onPress={share}>
              <Text style={styles.primaryText}>Compartilhar</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  shareText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  primary: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '700' },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  secondaryText: { color: colors.text, fontWeight: '600' },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  captionRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  caption: { flex: 1, minHeight: 60, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionInput: { flex: 1, fontSize: 15, color: colors.text },
}));
