import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { InfoText, PrimaryButton, Section, SettingsScreen } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';
import { useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function VerificationScreen() {
  const me = useMe();
  const { settings, update } = useSettings();
  const [office, setOffice] = useState(me.role ?? '');
  const [doc, setDoc] = useState('');
  const pending = settings.verification.status === 'em_analise';

  if (me.verified) {
    return (
      <SettingsScreen>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
          <Text style={styles.title}>Sua conta já é verificada</Text>
          <Text style={styles.muted}>O selo azul aparece ao lado do seu nome.</Text>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen>
      <View style={styles.center}>
        <Ionicons name="shield-checkmark" size={56} color={colors.primary} />
        <Text style={styles.title}>Selo de conta oficial</Text>
        <Text style={styles.muted}>
          Para políticos com mandato, candidatos registrados, partidos e órgãos públicos. O selo mostra aos eleitores que o
          perfil é verdadeiro.
        </Text>
      </View>
      {pending ? (
        <Section>
          <InfoText>
            Pedido enviado em {new Date(settings.verification.requestedAt ?? Date.now()).toLocaleDateString('pt-BR')} ({settings.verification.office}).
            Está em análise. Você será avisado nas notificações.
          </InfoText>
        </Section>
      ) : (
        <Section title="Pedir verificação" footer="Na versão com servidor, você poderá enviar foto do documento e comprovante do cargo ou da candidatura (TSE).">
          <View style={styles.form}>
            <TextInput placeholder="Cargo ou candidatura" placeholderTextColor={colors.textMuted} value={office} onChangeText={setOffice} style={styles.input} />
            <TextInput placeholder="CPF ou número da candidatura" placeholderTextColor={colors.textMuted} value={doc} onChangeText={setDoc} keyboardType="number-pad" style={styles.input} />
          </View>
          <PrimaryButton
            label="Enviar pedido"
            disabled={!office.trim() || doc.replace(/\D/g, '').length < 5}
            onPress={() => update({ verification: { status: 'em_analise', requestedAt: Date.now(), office: office.trim() } })}
          />
        </Section>
      )}
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    center: { alignItems: 'center', gap: 8, padding: spacing.xl, backgroundColor: colors.background, marginBottom: spacing.sm },
    title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
    muted: { color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
    form: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 44, color: colors.text, fontSize: 15 },
  }),
);
