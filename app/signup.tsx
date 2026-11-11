import Ionicons from '@expo/vector-icons/Ionicons';
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
  const [accountType, setAccountType] = useState<'cidadao' | 'politico'>('cidadao');
  const [role, setRole] = useState('');
  const [party, setParty] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => setError(signUp({ email, name, username, password, accountType, role, party, city, state }));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Logo size={28} />
            <Text style={styles.tagline}>Cadastre-se para acompanhar quem representa você.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Tipo de conta</Text>
            <View style={styles.types}>
              <TypeCard
                icon="person-outline"
                title="Cidadão"
                text="Acompanhe, debata e fiscalize"
                active={accountType === 'cidadao'}
                onPress={() => setAccountType('cidadao')}
              />
              <TypeCard
                icon="business-outline"
                title="Político / candidato"
                text="Painel com dados do seu público e apoiadores"
                active={accountType === 'politico'}
                onPress={() => setAccountType('politico')}
              />
            </View>
            <Field placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
            <Field placeholder="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field placeholder="Nome de usuário" value={username} onChangeText={setUsername} autoCorrect={false} />
            <Field placeholder="Senha (mín. 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
            {accountType === 'politico' ? (
              <>
                <Field placeholder="Cargo ou pretensão (ex.: Vereador, Pré-candidata a prefeita)" value={role} onChangeText={setRole} autoCapitalize="sentences" />
                <Field placeholder="Partido (opcional)" value={party} onChangeText={setParty} autoCapitalize="characters" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Field placeholder="Cidade" value={city} onChangeText={setCity} autoCapitalize="words" style={{ flex: 1 }} />
                  <Field placeholder="UF" value={state} onChangeText={setState} autoCapitalize="characters" maxLength={2} style={{ width: 70 }} />
                </View>
              </>
            ) : null}
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

function TypeCard({
  icon,
  title,
  text,
  active,
  onPress,
}: {
  icon: 'person-outline' | 'business-outline';
  title: string;
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.type, active && styles.typeActive]}>
      <Ionicons name={icon} size={22} color={active ? colors.primary : colors.textMuted} />
      <Text style={styles.typeTitle}>{title}</Text>
      <Text style={styles.typeText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: colors.text },
  types: { flexDirection: 'row', gap: 8 },
  type: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 4 },
  typeActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
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
});
