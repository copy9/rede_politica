import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardView } from '@/components/KeyboardView';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaVideo } from '@/components/MediaVideo';
import { useOverlay } from '@/components/Overlay';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { MediaType } from '@/lib/types';

type Picked = { uri: string; type: MediaType | 'text' };

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
          <Text style={styles.emptyTitle}>O que você quer publicar?</Text>
          <Text style={styles.emptyText}>Mostre o que acontece na sua cidade, fiscalize, proponha.</Text>
          <View style={styles.options}>
            {(
              [
                { icon: 'images', color: colors.primary, title: 'Foto ou vídeo da galeria', desc: 'Escolha algo que já está no celular', onPress: () => pick(false) },
                { icon: 'camera', color: colors.like, title: 'Usar a câmera', desc: 'Tire uma foto ou grave um vídeo agora', onPress: () => pick(true) },
                { icon: 'text', color: '#22C55E', title: 'Só texto', desc: 'Escreva uma opinião, aviso ou proposta', onPress: () => setMedia({ uri: '', type: 'text' }) },
              ] as const
            ).map((o) => (
              <Pressable key={o.title} style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.7 }]} onPress={o.onPress}>
                <View style={[styles.optionIcon, { backgroundColor: o.color }]}>
                  <Ionicons name={o.icon} size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{o.title}</Text>
                  <Text style={styles.optionDesc}>{o.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <KeyboardView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {media.type === 'text' ? null : (
            <View style={styles.preview}>
              {media.type === 'video' ? (
                <MediaVideo uri={media.uri} active style={StyleSheet.absoluteFill} />
              ) : (
                <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>
            )}
            <View style={styles.captionRow}>
              <Image source={{ uri: me.avatar }} style={styles.avatar} />
              <TextInput
                placeholder={media.type === 'text' ? 'O que você quer dizer?' : 'Escreva uma legenda...'}
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                autoFocus={media.type === 'text'}
                maxLength={2200}
                style={[styles.caption, media.type === 'text' && { minHeight: 160, fontSize: 18 }]}
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
        </KeyboardView>
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
  empty: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.md },
  options: { gap: spacing.md },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  optionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  optionDesc: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  primary: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '700' },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  secondaryText: { color: colors.text, fontWeight: '600' },
  textOnly: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  captionRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  caption: { flex: 1, minHeight: 60, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionInput: { flex: 1, fontSize: 15, color: colors.text },
}));
