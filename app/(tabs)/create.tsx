// Nova publicação no estilo do X/Twitter: escreve direto; foto ou vídeo são opcionais (galeria ou câmera embaixo).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { KeyboardView } from '@/components/KeyboardView';
import { MediaVideo } from '@/components/MediaVideo';
import { useOverlay } from '@/components/Overlay';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { MediaType } from '@/lib/types';

type Picked = { uri: string; type: MediaType; duration?: number };
const MAX = 2200;

export default function CreateScreen() {
  const me = useMe();
  const { createPost } = useApp();
  const { showBanner } = useOverlay();
  const [media, setMedia] = useState<Picked | null>(null);
  const [text, setText] = useState('');
  // capa do vídeo: alguns momentos do vídeo para escolher
  const [frames, setFrames] = useState<string[]>([]);
  const [cover, setCover] = useState<string | undefined>();

  useEffect(() => {
    setFrames([]);
    setCover(undefined);
    if (media?.type !== 'video') return;
    let alive = true;
    (async () => {
      const total = media.duration && media.duration > 0 ? media.duration : 15000;
      const times = Array.from({ length: 8 }, (_, i) => Math.round((total * (i + 0.5)) / 8));
      const out: string[] = [];
      for (const time of times) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(media.uri, { time, quality: 0.7 });
          out.push(uri);
          if (alive) setFrames([...out]);
        } catch {
          // momento que não deu para ler: pula
        }
      }
      if (alive && out[0]) setCover((c) => c ?? out[0]);
    })();
    return () => {
      alive = false;
    };
  }, [media]);

  const canPost = text.trim().length > 0 || !!media;

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
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image', duration: asset.duration ?? undefined });
  };

  const cancel = () => {
    setMedia(null);
    setText('');
    router.navigate('/');
  };

  const post = () => {
    if (!canPost) return;
    const created = media
      ? createPost({ type: media.type, uri: media.uri, caption: text, thumbnail: media.type === 'video' ? cover : undefined })
      : createPost({ type: 'text', uri: '', caption: text });
    if (typeof created === 'string') return showBanner(created, { icon: 'alert-circle-outline', tone: 'warning' });
    setMedia(null);
    setText('');
    if (created) router.navigate('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardView>
        {/* topo: Cancelar e Postar */}
        <View style={styles.header}>
          <Pressable onPress={cancel} hitSlop={8}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={post} disabled={!canPost} style={[styles.postBtn, !canPost && styles.postBtnOff]}>
            <Text style={[styles.postText, !canPost && styles.postTextOff]}>Postar</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
          <View style={styles.composer}>
            <Avatar uri={me.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="O que você está pensando?"
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                maxLength={MAX}
                style={styles.input}
              />
              {media ? (
                <View style={[styles.preview, media.type === 'video' && styles.previewVideo]}>
                  {media.type === 'video' ? (
                    <MediaVideo uri={media.uri} active style={StyleSheet.absoluteFill} />
                  ) : (
                    <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  )}
                  <Pressable onPress={() => setMedia(null)} style={styles.removeMedia} hitSlop={8} accessibilityLabel="Tirar foto">
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : null}
              {media?.type === 'video' ? (
                <View style={styles.coverBox}>
                  <Text style={styles.coverTitle}>Capa do vídeo</Text>
                  <Text style={styles.coverHint}>Toque no momento que você quer como capa.</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {frames.length === 0 ? <Text style={styles.coverHint}>Carregando momentos do vídeo…</Text> : null}
                    {frames.map((f) => (
                      <Pressable key={f} onPress={() => setCover(f)} style={[styles.frame, cover === f && styles.frameOn]} accessibilityLabel="Escolher como capa">
                        <Image source={{ uri: f }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>

        {/* barra de baixo: só galeria e câmera */}
        <View style={styles.toolbar}>
          <Pressable onPress={() => pick(false)} hitSlop={10} accessibilityLabel="Foto ou vídeo da galeria">
            <Ionicons name="image-outline" size={26} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => pick(true)} hitSlop={10} accessibilityLabel="Usar a câmera">
            <Ionicons name="camera-outline" size={26} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          {text.length > MAX - 200 ? <Text style={styles.counter}>{MAX - text.length}</Text> : null}
        </View>
      </KeyboardView>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancel: { color: colors.text, fontSize: 17 },
  postBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  postBtnOff: { opacity: 0.45 },
  postText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  postTextOff: { color: 'rgba(255,255,255,0.85)' },
  composer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  input: { color: colors.text, fontSize: 20, minHeight: 120, textAlignVertical: 'top', paddingTop: 8 },
  previewVideo: { aspectRatio: 9 / 16, width: '70%', backgroundColor: '#000' },
  preview: { marginTop: spacing.md, width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  removeMedia: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  coverBox: { marginTop: spacing.md, gap: 6 },
  coverTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  coverHint: { color: colors.textMuted, fontSize: 12 },
  frame: { width: 54, height: 96, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  frameOn: { borderColor: colors.primary },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  counter: { color: colors.textMuted, fontWeight: '600' },
}));
