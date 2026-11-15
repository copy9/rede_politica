import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function SignUpScreen() {
  const { signUp } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // 31121990 -> 31/12/1990 enquanto digita
  const onBirthDate = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    setBirthDate([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/'));
  };

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(
      await signUp({
        email,
        name,
        username,
        password,
        // todos entram como usuário normal; perfil de político só por verificação
        accountType: 'cidadao',
        city,
        state,
        birthDate,
        acceptedTerms,
      }),
    );
    setBusy(false);
  };

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
            <Field placeholder="Data de nascimento (DD/MM/AAAA)" value={birthDate} onChangeText={onBirthDate} keyboardType="number-pad" maxLength={10} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field placeholder="Cidade (opcional)" value={city} onChangeText={setCity} autoCapitalize="words" style={{ flex: 1 }} />
              <Field placeholder="UF" value={state} onChangeText={setState} autoCapitalize="characters" maxLength={2} style={{ width: 70 }} />
            </View>

            {/* Obrigatório: idade e termos */}
            <Pressable style={styles.check} onPress={() => setAcceptedTerms((v) => !v)}>
              <Ionicons name={acceptedTerms ? 'checkbox' : 'square-outline'} size={22} color={acceptedTerms ? colors.primary : colors.textMuted} />
              <Text style={styles.checkText}>
                Tenho 18 anos ou mais e aceito os{' '}
                <Text style={styles.link} onPress={() => router.push('/termos')}>
                  Termos de uso e a Política de Privacidade
                </Text>
                .
              </Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? 'Criando conta…' : 'Cadastrar'}</Text>
            </Pressable>
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


const styles = themed(() => StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
  link: { color: colors.primary, fontWeight: '700' },
  label: { fontWeight: '700', color: colors.text },
  types: { flexDirection: 'row', gap: 8 },
  type: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 4 },
  typeActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  typeTitle: { fontWeight: '700', color: colors.text },
  typeText: { fontSize: 12, color: colors.textMuted },
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
}));
