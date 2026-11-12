import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { InfoText, PrimaryButton, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { timeAgo } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useApp, type TwoFactorSetup } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function SecurityScreen() {
  const { settings, update } = useSettings();
  const { changePassword, twoFactorEnabled, startTwoFactor, confirmTwoFactor, disableTwoFactor, signOutOtherDevices } = useApp();
  const { showBanner, confirm } = useOverlay();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // ligar dois fatores
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [tfError, setTfError] = useState<string | null>(null);

  const submit = async () => {
    if (next !== again) return setError('As senhas novas não conferem.');
    setBusy(true);
    const err = await changePassword(current, next);
    setBusy(false);
    if (err) return setError(err);
    setError(null);
    setCurrent('');
    setNext('');
    setAgain('');
    showBanner('Senha alterada. Use a nova senha no próximo login.', { icon: 'key-outline', tone: 'success' });
  };

  const toggleTwoFactor = async (on: boolean) => {
    setTfError(null);
    if (on) {
      const r = await startTwoFactor();
      if (typeof r === 'string') return showBanner(r, { icon: 'alert-circle-outline', tone: 'warning' });
      setSetup(r);
      setCode('');
      return;
    }
    confirm('Desligar dois fatores?', 'O login vai pedir só a senha de novo.', 'Desligar', async () => {
      const err = await disableTwoFactor();
      showBanner(err ?? 'Dois fatores desligado.', { icon: 'shield-outline', tone: err ? 'warning' : 'info' });
    });
  };

  const finishSetup = async () => {
    if (!setup) return;
    const err = await confirmTwoFactor(setup.factorId, code);
    if (err) return setTfError(err);
    setSetup(null);
    showBanner('Dois fatores ligado! Nos próximos logins o app vai pedir o código do app autenticador.', {
      icon: 'shield-checkmark',
      tone: 'success',
      durationMs: 6000,
    });
  };

  const others = settings.devices.filter((d) => d.id !== settings.deviceId);

  return (
    <SettingsScreen>
      <Section title="Alterar senha">
        <View style={styles.form}>
          <TextInput placeholder="Senha atual" placeholderTextColor={colors.textMuted} secureTextEntry value={current} onChangeText={setCurrent} style={styles.input} />
          <TextInput placeholder="Nova senha (mín. 8, com letras e números)" placeholderTextColor={colors.textMuted} secureTextEntry value={next} onChangeText={setNext} style={styles.input} />
          <TextInput placeholder="Repita a nova senha" placeholderTextColor={colors.textMuted} secureTextEntry value={again} onChangeText={setAgain} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <PrimaryButton label={busy ? 'Alterando…' : 'Alterar senha'} onPress={submit} disabled={busy} />
      </Section>

      <Section title="Proteção" footer="Recomendado para contas políticas: mesmo que descubram sua senha, ninguém entra sem o código do seu celular.">
        <ToggleRow
          icon="shield-checkmark-outline"
          label="Autenticação em dois fatores"
          description="Pede um código do app autenticador (Google Authenticator, Microsoft Authenticator…) ao entrar"
          value={twoFactorEnabled || !!setup}
          onChange={toggleTwoFactor}
        />
        {setup ? (
          <View style={styles.setup}>
            <Text style={styles.setupTitle}>Ligar dois fatores</Text>
            <Text style={styles.step}>1. Instale o Google Authenticator (Play Store / App Store), se ainda não tiver.</Text>
            {Platform.OS !== 'web' ? (
              <>
                <Text style={styles.step}>2. Toque no botão abaixo para adicionar a Rede Política no app autenticador:</Text>
                <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(setup.uri).catch(() => showBanner('Não achei um app autenticador. Use a chave abaixo.', { tone: 'warning' }))}>
                  <Ionicons name="open-outline" size={16} color={colors.white} />
                  <Text style={styles.linkText}>Abrir no app autenticador</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.step}>2. No app autenticador, escaneie este código:</Text>
                <Image source={{ uri: setup.qr }} style={styles.qr} contentFit="contain" />
              </>
            )}
            <Text style={styles.step}>Ou, no app autenticador, escolha "Inserir chave de configuração" e use esta chave:</Text>
            <Pressable onPress={() => Share.share({ message: setup.secret }).catch(() => {})}>
              <Text style={styles.secret} selectable>
                {setup.secret}
              </Text>
            </Pressable>
            <Text style={styles.step}>3. Digite o código de 6 números que aparece no app autenticador:</Text>
            <TextInput
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={[styles.input, styles.codeInput]}
            />
            {tfError ? <Text style={styles.error}>{tfError}</Text> : null}
            <PrimaryButton label="Confirmar e ligar" onPress={finishSetup} />
            <Text style={styles.cancel} onPress={() => setSetup(null)}>
              Cancelar
            </Text>
          </View>
        ) : null}
        <ToggleRow
          icon="alert-circle-outline"
          label="Alertas de login"
          description="Cria uma notificação sempre que alguém entrar na sua conta"
          value={settings.loginAlerts}
          onChange={(loginAlerts) => update({ loginAlerts })}
        />
      </Section>

      <Section title="Onde você está conectado" footer="Ao desconectar, os outros aparelhos precisam entrar com a senha de novo.">
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
                  {d.where} · {isThis ? 'ativo agora' : `entrou há ${timeAgo(d.lastActiveAt)}`}
                </Text>
              </View>
            </View>
          );
        })}
        {others.length ? (
          <PrimaryButton
            label="Sair de todos os outros aparelhos"
            onPress={() =>
              confirm('Sair dos outros aparelhos?', 'Todos os outros celulares e navegadores vão precisar entrar de novo.', 'Sair dos outros', async () => {
                const err = await signOutOtherDevices();
                showBanner(err ?? 'Pronto: só este aparelho continua conectado.', { icon: 'log-out-outline', tone: err ? 'warning' : 'success' });
              }, true)
            }
          />
        ) : null}
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    form: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 44, color: colors.text, fontSize: 15 },
    codeInput: { textAlign: 'center', fontSize: 22, letterSpacing: 6, marginVertical: 4 },
    error: { color: colors.like },
    setup: { margin: spacing.lg, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: 8 },
    setupTitle: { fontWeight: '800', fontSize: 16, color: colors.text },
    step: { color: colors.text, lineHeight: 19 },
    linkBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
    linkText: { color: colors.white, fontWeight: '700' },
    qr: { width: 180, height: 180, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 8 },
    secret: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.text, backgroundColor: colors.background, padding: 10, borderRadius: 8, textAlign: 'center', letterSpacing: 1 },
    cancel: { color: colors.textMuted, textAlign: 'center', paddingVertical: 6 },
    device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    deviceName: { color: colors.text, fontWeight: '600' },
    thisDevice: { color: colors.good, fontWeight: '600', fontSize: 12 },
    muted: { color: colors.textMuted, fontSize: 12 },
  }),
);
