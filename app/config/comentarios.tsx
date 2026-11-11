import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AUDIENCE_OPTIONS, RadioGroup, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { OFFENSIVE_WORDS, useSettings } from '@/lib/settings';
import { colors, spacing, themed } from '@/lib/theme';

export default function CommentsSettingsScreen() {
  const { settings, update, toggleIn } = useSettings();
  const [word, setWord] = useState('');

  const add = () => {
    const w = word.trim().toLowerCase();
    if (w && !settings.hiddenWords.includes(w)) toggleIn('hiddenWords', w);
    setWord('');
  };

  return (
    <SettingsScreen>
      <Section title="Quem pode comentar nas suas publicações">
        <RadioGroup value={settings.whoCanComment} onChange={(whoCanComment) => update({ whoCanComment })} options={AUDIENCE_OPTIONS} />
      </Section>
      <Section
        title="Filtros"
        footer={`O filtro padrão esconde xingamentos comuns (ex.: ${OFFENSIVE_WORDS.slice(0, 3).join(', ')}...). Comentários escondidos podem ser vistos tocando em "ver".`}>
        <ToggleRow
          icon="shield-outline"
          label="Ocultar comentários ofensivos"
          value={settings.filterOffensive}
          onChange={(filterOffensive) => update({ filterOffensive })}
        />
      </Section>
      <Section title="Palavras ocultas" footer="Comentários com estas palavras ou frases ficam escondidos para você.">
        <View style={styles.addRow}>
          <TextInput
            placeholder="Adicionar palavra ou frase"
            placeholderTextColor={colors.textMuted}
            value={word}
            onChangeText={setWord}
            onSubmitEditing={add}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable style={styles.addBtn} onPress={add}>
            <Text style={styles.addText}>Adicionar</Text>
          </Pressable>
        </View>
        <View style={styles.words}>
          {settings.hiddenWords.map((w) => (
            <Pressable key={w} style={styles.word} onPress={() => toggleIn('hiddenWords', w)}>
              <Text style={styles.wordText}>{w}</Text>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
          {!settings.hiddenWords.length ? <Text style={styles.muted}>Nenhuma palavra adicionada.</Text> : null}
        </View>
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    addRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    input: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 40, color: colors.text },
    addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
    addText: { color: colors.white, fontWeight: '700' },
    words: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    word: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
    wordText: { color: colors.text },
    muted: { color: colors.textMuted, fontSize: 13 },
  }),
);
