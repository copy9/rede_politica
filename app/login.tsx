import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { useApp } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => setError(signIn(username, password));
  const demo = () => setError(signIn('voce.demo', 'demo'));
  const demoPolitician = () => setError(signIn('ana.ribeiro.ver', 'demo'));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.logo}>
          <Logo size={30} />
          <Text style={styles.tagline}>Participe, debata, fiscalize.</Text>
        </View>

        <View style={styles.form}>
          <Field placeholder="Nome de usuário ou e-mail" value={username} onChangeText={setUsername} autoCorrect={false} />
          <Field placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>Entrar</Text>
          </Pressable>
          <Pressable onPress={demo}>
            <Text style={styles.demo}>Entrar com a conta de demonstração</Text>
          </Pressable>
          <Pressable onPress={demoPolitician}>
            <Text style={styles.demo}>Entrar como político (demonstração)</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Não tem uma conta?{' '}
            <Link href="/signup" style={styles.footerLink}>
              Cadastre-se
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, maxWidth: 420, width: '100%', alignSelf: 'center' },
  logo: { alignItems: 'center', marginBottom: 36, gap: 8 },
  tagline: { color: colors.textMuted },
  form: { gap: spacing.md },
  error: { color: colors.like, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  demo: { color: colors.primary, textAlign: 'center', fontWeight: '600', marginTop: 8 },
  footer: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  footerText: { color: colors.textMuted },
  footerLink: { color: colors.primary, fontWeight: '700' },
});
