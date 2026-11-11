import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { InfoText, PrimaryButton, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { timeAgo } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function SecurityScreen() {
  const { settings, update } = useSettings();
  const { changePassword } = useApp();
  const { showBanner, confirm } = useOverlay();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasPassword = !!settings.passwordHash;

  const submit = () => {
    if (next !== again) return setError('As senhas novas não conferem.');
    const err = changePassword(current, next);
    if (err) return setError(err);
    setError(null);
    setCurrent('');
    setNext('');
    setAgain('');
    showBanner(hasPassword ? 'Senha alterada. Use a nova senha no próximo login.' : 'Senha criada. A partir de agora ela será pedida no login.', {
      icon: 'key-outline',
      tone: 'success',
    });
  };

  const toggleTwoFactor = (on: boolean) => {
    if (on && !settings.phone && !settings.email) {
      showBanner('Cadastre um telefone ou e-mail em Informações pessoais para receber o código.', { icon: 'alert-circle-outline', tone: 'warning' });
      return;
    }
    update({ twoFactor: on });
    showBanner(on ? 'Dois fatores ligado: o próximo login vai pedir um código.' : 'Dois fatores desligado.', { icon: 'shield-checkmark-outline' });
  };

  return (
    <SettingsScreen>
      <Section title={hasPassword ? 'Alterar senha' : 'Criar senha'}>
        {!hasPassword ? (
          <InfoText>Esta conta de demonstração ainda aceita qualquer senha. Crie uma para proteger o acesso neste aparelho.</InfoText>
        ) : null}
        <View style={styles.form}>
          {hasPassword ? (
            <TextInput placeholder="Senha atual" placeholderTextColor={colors.textMuted} secureTextEntry value={current} onChangeText={setCurrent} style={styles.input} />
          ) : null}
          <TextInput placeholder="Nova senha (mín. 8, com letras e números)" placeholderTextColor={colors.textMuted} secureTextEntry value={next} onChangeText={setNext} style={styles.input} />
          <TextInput placeholder="Repita a nova senha" placeholderTextColor={colors.textMuted} secureTextEntry value={again} onChangeText={setAgain} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <PrimaryButton label={hasPassword ? 'Alterar senha' : 'Criar senha'} onPress={submit} />
      </Section>
      <Section title="Proteção" footer="Recomendado para contas políticas: dificulta que alguém invada sua conta.">
        <ToggleRow
          icon="shield-checkmark-outline"
          label="Autenticação em dois fatores"
          description={`Pede um código ao entrar${settings.phone ? ` (enviado para ${settings.phone})` : settings.email ? ` (enviado para ${settings.email})` : ''}`}
          value={settings.twoFactor}
          onChange={toggleTwoFactor}
        />
        <ToggleRow
          icon="alert-circle-outline"
          label="Alertas de login"
          description="Cria uma notificação sempre que alguém entrar na sua conta"
          value={settings.loginAlerts}
          onChange={(loginAlerts) => update({ loginAlerts })}
        />
      </Section>
      <Section title="Onde você está conectado" footer="Ao sair de um aparelho, ele precisa entrar com a senha de novo.">
        {settings.devices.length === 0 ? <InfoText>Nenhum aparelho registrado.</InfoText> : null}
        {settings.devices.map((d) => {
          const isThis = d.id === settings.deviceId;
          return (
            <View key={d.id} style={styles.device}>
              <Ionicons name={d.icon} size={24} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>
                  {d.name}
                  {isThis ? <Text style={styles.thisDevice}>  · este aparelho</Text> : null}
                </Text>
                <Text style={styles.muted}>
                  {d.where} · {isThis ? 'ativo agora' : `ativo há ${timeAgo(d.lastActiveAt)}`}
                </Text>
              </View>
              {!isThis ? (
                <Text
                  style={styles.logout}
                  onPress={() =>
                    confirm(`Sair de ${d.name}?`, 'Esse aparelho vai precisar entrar de novo.', 'Sair', () => {
                      update({ devices: settings.devices.filter((x) => x.id !== d.id) });
                      showBanner(`Você saiu de ${d.name}.`, { icon: 'log-out-outline' });
                    }, true)
                  }>
                  Sair
                </Text>
              ) : null}
            </View>
          );
        })}
      </Section>
    </SettingsScreen>
  );

}

const styles = themed(() =>
  StyleSheet.create({
    form: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 44, color: colors.text, fontSize: 15 },
    error: { color: colors.like },
    device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    deviceName: { color: colors.text, fontWeight: '600' },
    thisDevice: { color: colors.good, fontWeight: '600', fontSize: 12 },
    muted: { color: colors.textMuted, fontSize: 12 },
    logout: { color: colors.like, fontWeight: '700' },
  }),
);
