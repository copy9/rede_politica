import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIVACY, TERMS } from '@/lib/legal';
import { colors, spacing, themed } from '@/lib/theme';

/** Termos de uso e Política de Privacidade: abre também antes do login (pelo cadastro). */
export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Termos e Privacidade' }} />
      <Text style={styles.h1}>Termos de uso</Text>
      {TERMS.map(([title, body]) => (
        <View key={title} style={styles.block}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
      <Text style={styles.h1}>Política de Privacidade</Text>
      {PRIVACY.map(([title, body]) => (
        <View key={title} style={styles.block}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
      <Text style={styles.note}>Texto resumido de demonstração. A versão final deve ser revisada por um advogado.</Text>
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
    h1: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
    block: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, gap: 4 },
    title: { fontWeight: '700', color: colors.text },
    body: { color: colors.text, lineHeight: 20 },
    note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  }),
);
