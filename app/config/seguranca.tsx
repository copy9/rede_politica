import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';
import { colors, spacing, themed } from '@/lib/theme';

const DEVICES = [
  { id: 'd1', name: 'Este celular', where: 'Recife, PE', when: 'Ativo agora', icon: 'phone-portrait-outline' as const },
  { id: 'd2', name: 'Chrome no Windows', where: 'Recife, PE', when: 'Há 2 dias', icon: 'desktop-outline' as const },
];

export default function SecurityScreen() {
  const { settings, update } = useSettings();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devices, setDevices] = useState(DEVICES);

  const changePassword = () => {
    if (!current || !next) return Alert.alert('Preencha as senhas');
    if (next.length < 8) return Alert.alert('Senha fraca', 'Use pelo menos 8 caracteres.');
    if (next !== confirm) return Alert.alert('As senhas não conferem');
    setCurrent('');
    setNext('');
    setConfirm('');
    Alert.alert('Senha alterada', 'Na versão com servidor (Supabase), a troca vale em todos os aparelhos.');
  };

  return (
    <SettingsScreen>
      <Section title="Alterar senha">
        <View style={styles.form}>
          <TextInput placeholder="Senha atual" placeholderTextColor={colors.textMuted} secureTextEntry value={current} onChangeText={setCurrent} style={styles.input} />
          <TextInput placeholder="Nova senha (mín. 8 caracteres)" placeholderTextColor={colors.textMuted} secureTextEntry value={next} onChangeText={setNext} style={styles.input} />
          <TextInput placeholder="Repita a nova senha" placeholderTextColor={colors.textMuted} secureTextEntry value={confirm} onChangeText={setConfirm} style={styles.input} />
        </View>
        <PrimaryButton label="Alterar senha" onPress={changePassword} />
      </Section>
      <Section title="Proteção" footer="Recomendado para contas políticas: dificulta que alguém invada sua conta.">
        <ToggleRow
          icon="shield-checkmark-outline"
          label="Autenticação em dois fatores"
          description="Pede um código enviado por SMS ou app ao entrar em um aparelho novo"
          value={settings.twoFactor}
          onChange={(twoFactor) => update({ twoFactor })}
        />
        <ToggleRow
          icon="alert-circle-outline"
          label="Alertas de login"
          description="Avisa quando sua conta for acessada de outro lugar"
          value={settings.loginAlerts}
          onChange={(loginAlerts) => update({ loginAlerts })}
        />
      </Section>
      <Section title="Onde você está conectado">
        {devices.map((d) => (
          <View key={d.id} style={styles.device}>
            <Ionicons name={d.icon} size={24} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.muted}>
                {d.where} · {d.when}
              </Text>
            </View>
            {d.id !== 'd1' ? (
              <Text style={styles.logout} onPress={() => setDevices((list) => list.filter((x) => x.id !== d.id))}>
                Sair
              </Text>
            ) : null}
          </View>
        ))}
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    form: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 44, color: colors.text, fontSize: 15 },
    device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    deviceName: { color: colors.text, fontWeight: '600' },
    muted: { color: colors.textMuted, fontSize: 12 },
    logout: { color: colors.like, fontWeight: '700' },
  }),
);
