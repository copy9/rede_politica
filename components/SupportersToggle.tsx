// Botão "Apoiadores": abre a caixa de mensagem só para apoiadores.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useApp, useMe } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export function SupportersButton() {
  const me = useMe();
  const { supportersFor } = useApp();
  const count = supportersFor(me.id).length;
  return (
    <Pressable onPress={() => router.push('/messages/apoiadores')} style={styles.chip} accessibilityLabel="Mensagem para apoiadores">
      <Ionicons name="people" size={15} color="#fff" />
      <Text style={styles.text} maxFontSizeMultiplier={1.15}>
        Apoiadores{count ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.like, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
}));
