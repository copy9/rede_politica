import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { InfoText, PrimaryButton, Section, SettingsScreen } from '@/components/SettingsUI';
import { newId, timeAgo } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { colors, spacing, themed } from '@/lib/theme';

const FAQ = [
  {
    q: 'O que é a conta política?',
    a: 'É o tipo de conta para candidatos e políticos. Ela libera o Painel do político, com estatísticas do público e o banco de apoiadores.',
  },
  {
    q: 'Os políticos veem meus dados?',
    a: 'Só em números gerais e anônimos (ex.: "30% do público tem 25 a 34 anos"). Seu nome e contato só aparecem para um político se você tocar em "Quero receber novidades" e autorizar.',
  },
  {
    q: 'Como cancelo uma autorização?',
    a: 'Em Configurações › Minhas autorizações a políticos. O político deixa de ver seus dados na hora.',
  },
  {
    q: 'Como funcionam as batalhas?',
    a: 'Duas pessoas debatem ao vivo. A plateia apoia um dos lados com pontos e, no fim do tempo, quem tiver mais pontos vence.',
  },
  {
    q: 'Como denuncio um conteúdo?',
    a: 'Toque no menu (•••) da publicação ou do perfil e escolha Denunciar. Desinformação e discurso de ódio são analisados com prioridade.',
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  const [report, setReport] = useState('');
  const { settings, update } = useSettings();
  const { showBanner } = useOverlay();

  return (
    <SettingsScreen>
      <Section title="Perguntas frequentes">
        {FAQ.map((f, i) => (
          <Pressable key={f.q} style={styles.item} onPress={() => setOpen(open === i ? null : i)}>
            <View style={styles.qRow}>
              <Text style={styles.q}>{f.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </View>
            {open === i ? <Text style={styles.a}>{f.a}</Text> : null}
          </Pressable>
        ))}
      </Section>
      <Section title="Relatar um problema" footer="Conte o que aconteceu e em qual tela. Prints ajudam muito.">
        <TextInput
          placeholder="Descreva o problema..."
          placeholderTextColor={colors.textMuted}
          value={report}
          onChangeText={setReport}
          multiline
          style={styles.input}
        />
        <PrimaryButton
          label="Enviar"
          disabled={report.trim().length < 10}
          onPress={() => {
            update({ reports: [{ id: newId('r'), text: report.trim(), createdAt: Date.now() }, ...settings.reports] });
            setReport('');
            showBanner('Obrigado! Seu relato foi registrado.', { icon: 'checkmark-circle', tone: 'success' });
          }}
        />
      </Section>
      {settings.reports.length ? (
        <Section title="Seus relatos">
          {settings.reports.map((r) => (
            <View key={r.id} style={styles.item}>
              <Text style={styles.a}>{r.text}</Text>
              <Text style={styles.reportMeta}>Enviado há {timeAgo(r.createdAt)} · aguardando resposta</Text>
            </View>
          ))}
          <InfoText>Com o servidor ligado, os relatos chegam para a equipe e a resposta aparece aqui.</InfoText>
        </Section>
      ) : null}
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    item: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    q: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 },
    a: { color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  reportMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    input: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, minHeight: 100, color: colors.text, fontSize: 15, marginHorizontal: spacing.lg, marginVertical: spacing.sm, textAlignVertical: 'top' },
  }),
);
