import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { useApp } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

export default function SignUpScreen() {
  const { signUp } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => setError(signUp({ email, name, username, password }));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Logo size={28} />
            <Text style={styles.tagline}>Cadastre-se para acompanhar quem representa você.</Text>
          </View>

          <View style={styles.form}>
            <Field placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
            <Field placeholder="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field placeholder="Nome de usuário" value={username} onChangeText={setUsername} autoCorrect={false} />
            <Field placeholder="Senha (mín. 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={submit}>
              <Text style={styles.buttonText}>Cadastrar</Text>
            </Pressable>
            <Text style={styles.terms}>
              Ao se cadastrar, você concorda com os Termos de Uso e a Política de Privacidade.
            </Text>
          </View>

          <Text style={styles.footerText}>
            Já tem uma conta?{' '}
            <Link href="/login" style={styles.footerLink}>
              Entrar
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, maxWidth: 420, width: '100%', alignSelf: 'center', gap: 28 },
  logo: { alignItems: 'center', gap: 8 },
  tagline: { color: colors.textMuted, textAlign: 'center' },
  form: { gap: spacing.md },
  error: { color: colors.like, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  terms: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  footerText: { color: colors.textMuted, textAlign: 'center' },
  footerLink: { color: colors.primary, fontWeight: '700' },
});
