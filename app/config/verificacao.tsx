import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { InfoText, NavRow, PrimaryButton, Section, SettingsScreen } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function VerificationScreen() {
  const me = useMe();
  const { settings, update } = useSettings();
  const [office, setOffice] = useState(me.role ?? '');
  const [doc, setDoc] = useState('');
  const pending = settings.verification.status === 'em_analise';
  const { showBanner } = useOverlay();
  const { report } = useApp();

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
            Está em análise pela equipe. Você será avisado nas notificações.
          </InfoText>
          <NavRow label="Cancelar pedido" danger onPress={() => update({ verification: { status: 'nenhuma' } })} />
        </Section>
      ) : (
        <Section title="Pedir verificação" footer="O número do documento vai só para a equipe de verificação (não aparece no seu perfil nem fica no aparelho). Na análise, a equipe confere o cargo ou a candidatura nos dados públicos do TSE.">
          <View style={styles.form}>
            <TextInput placeholder="Cargo ou candidatura" placeholderTextColor={colors.textMuted} value={office} onChangeText={setOffice} style={styles.input} />
            <TextInput placeholder="CPF ou número da candidatura" placeholderTextColor={colors.textMuted} value={doc} onChangeText={setDoc} keyboardType="number-pad" style={styles.input} />
          </View>
          <PrimaryButton
            label="Enviar pedido"
            disabled={!office.trim() || doc.replace(/\D/g, '').length < 5}
            onPress={async () => {
              // o pedido vai para a equipe de verificação (no banco); no aparelho fica só o status
              const err = await report('verificacao', me.id, `Pedido de verificação — cargo/candidatura: ${office.trim()} — documento: ${doc.replace(/\D/g, '')}`);
              if (err) return showBanner(err, { icon: 'alert-circle-outline', tone: 'warning' });
              update({ verification: { status: 'em_analise', requestedAt: Date.now(), office: office.trim() } });
              setDoc('');
              showBanner('Pedido de verificação enviado para a equipe.', { icon: 'shield-checkmark', tone: 'success' });
            }}
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
