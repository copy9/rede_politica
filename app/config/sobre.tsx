import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { SettingsScreen } from '@/components/SettingsUI';
import { PRIVACY, TERMS } from '@/lib/legal';
import { colors, spacing, themed } from '@/lib/theme';

export default function AboutScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'sobre' | 'termos' | 'privacidade'>(params.tab === 'termos' ? 'termos' : 'sobre');
  const list = tab === 'termos' ? TERMS : PRIVACY;

  return (
    <SettingsScreen>
      <View style={styles.tabs}>
        {(
          [
            ['sobre', 'Sobre'],
            ['termos', 'Termos de uso'],
            ['privacidade', 'Privacidade'],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab !== key && { color: colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'sobre' ? (
        <View style={styles.about}>
          <Logo size={28} />
          <Text style={styles.text}>Rede social para participar, debater e fiscalizar a política da sua cidade.</Text>
          <Text style={styles.muted}>Versão de teste (MVP) 0.2</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map(([title, body]) => (
            <View key={title} style={styles.block}>
              <Text style={styles.blockTitle}>{title}</Text>
              <Text style={styles.text}>{body}</Text>
            </View>
          ))}
          <Text style={styles.muted}>Texto resumido de demonstração. A versão final deve ser revisada por um advogado.</Text>
        </View>
      )}
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', backgroundColor: colors.background },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
    tabText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    about: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background, marginTop: spacing.sm },
    list: { padding: spacing.lg, gap: spacing.md },
    block: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, gap: 4 },
    blockTitle: { fontWeight: '700', color: colors.text },
    text: { color: colors.text, lineHeight: 20, textAlign: 'left' },
    muted: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  }),
);
