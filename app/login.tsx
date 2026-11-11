import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { useT } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn, verifyLoginCode, cancelLoginCode } = useApp();
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Etapa do código (autenticação em dois fatores)
  const [codeStep, setCodeStep] = useState<{ sentTo: string; demoCode: string } | null>(null);
  const [code, setCode] = useState('');

  const [busy, setBusy] = useState(false);
  const attempt = async (u: string, p: string) => {
    if (busy) return;
    setBusy(true);
    const r = await signIn(u, p);
    setBusy(false);
    if (r.ok) return setError(null);
    if ('needsCode' in r) {
      setError(null);
      setCode('');
      setCodeStep({ sentTo: r.sentTo, demoCode: r.demoCode });
      return;
    }
    setError(r.error);
  };
  const submit = () => attempt(username, password);
  const confirmCode = () => setError(verifyLoginCode(code));

  if (codeStep) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.logo}>
            <Logo size={26} />
            <Text style={styles.codeTitle}>Confirme que é você</Text>
            <Text style={styles.tagline}>Enviamos um código de 6 dígitos para o {codeStep.sentTo}.</Text>
          </View>
          <View style={styles.form}>
            <Field
              placeholder="Código de 6 dígitos"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              onSubmitEditing={confirmCode}
              style={styles.codeInput}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={confirmCode}>
              <Text style={styles.buttonText}>Confirmar</Text>
            </Pressable>
            <Text style={styles.demoCode}>Demonstração (sem SMS de verdade): o código é {codeStep.demoCode}</Text>
            <Pressable
              onPress={() => {
                cancelLoginCode();
                setCodeStep(null);
                setError(null);
              }}>
              <Text style={styles.demo}>Voltar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.logo}>
          <Logo size={30} />
          <Text style={styles.tagline}>{t('Participe, debata, fiscalize.')}</Text>
        </View>

        <View style={styles.form}>
          <Field placeholder={t('E-mail')} value={username} onChangeText={setUsername} autoCorrect={false} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field placeholder={t('Senha')} value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? '…' : t('Entrar')}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('Não tem uma conta?')}{' '}
            <Link href="/signup" style={styles.footerLink}>
              {t('Cadastre-se')}
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, maxWidth: 420, width: '100%', alignSelf: 'center' },
  logo: { alignItems: 'center', marginBottom: 36, gap: 8 },
  tagline: { color: colors.textMuted },
  form: { gap: spacing.md },
  error: { color: colors.like, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  demo: { color: colors.primary, textAlign: 'center', fontWeight: '600', marginTop: 8 },
  codeTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  codeInput: { textAlign: 'center', fontSize: 22, letterSpacing: 8 },
  demoCode: { color: colors.textMuted, textAlign: 'center', fontSize: 12 },
  footer: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  footerText: { color: colors.textMuted },
  footerLink: { color: colors.primary, fontWeight: '700' },
}));
