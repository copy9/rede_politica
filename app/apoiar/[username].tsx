import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { INTERESTS } from '@/lib/analytics';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { ShareField } from '@/lib/types';

const FIELDS: { key: ShareField; label: string; hint: string }[] = [
  { key: 'nome', label: 'Nome e foto', hint: 'Seu nome e @usuário' },
  { key: 'cidade', label: 'Cidade', hint: 'Cidade e estado do seu perfil' },
  { key: 'faixaEtaria', label: 'Faixa etária', hint: 'Só a faixa, nunca a data de nascimento' },
  { key: 'interesses', label: 'Temas de interesse', hint: 'Para receber só o que importa para você' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Para receber mensagens' },
  { key: 'email', label: 'E-mail', hint: 'Para receber e-mails' },
];

/** Tela de consentimento: o eleitor escolhe o que compartilhar com o político. */
export default function SupportScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const me = useMe();
  const { getUserByUsername, consentFor, giveConsent, revokeConsent } = useApp();
  const politician = getUserByUsername(username);
  const existing = politician ? consentFor(politician.id) : undefined;

  const [fields, setFields] = useState<ShareField[]>(existing?.fields ?? ['nome', 'cidade', 'interesses']);
  const [interests, setInterests] = useState<string[]>(existing?.interests ?? me.interests ?? []);
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [agree, setAgree] = useState(!!existing);
  const [error, setError] = useState<string | null>(null);

  if (!politician || politician.accountType !== 'politico') {
    return <Text style={styles.empty}>Perfil político não encontrado.</Text>;
  }

  const toggle = (f: ShareField) => setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  const toggleInterest = (i: string) => setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const submit = () => {
    if (!agree) return setError('Para continuar, marque que você autoriza o contato.');
    const err = giveConsent(politician.id, { fields, email, whatsapp, interests });
    if (err) return setError(err);
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: existing ? 'Sua autorização' : 'Receber novidades' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Avatar uri={politician.avatar} size={64} />
          <Text style={styles.title}>Receber novidades de {politician.name}</Text>
          <Text style={styles.muted}>
            {[politician.role, politician.party].filter(Boolean).join(' • ')}
          </Text>
        </View>

        <Text style={styles.section}>O que você quer compartilhar?</Text>
        <Text style={styles.muted}>Só o que você ligar aqui fica visível para este político. Nada mais.</Text>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.muted}>{f.hint}</Text>
            </View>
            <Switch
              value={fields.includes(f.key)}
              onValueChange={() => toggle(f.key)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}

        {fields.includes('whatsapp') ? (
          <TextInput
            placeholder="WhatsApp com DDD, ex.: (81) 99999-9999"
            placeholderTextColor={colors.textMuted}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            style={styles.input}
          />
        ) : null}
        {fields.includes('email') ? (
          <TextInput
            placeholder="seu@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        {fields.includes('interesses') ? (
          <>
            <Text style={styles.section}>Temas que interessam a você</Text>
            <View style={styles.chips}>
              {INTERESTS.map((i) => (
                <Pressable key={i} onPress={() => toggleInterest(i)} style={[styles.chip, interests.includes(i) && styles.chipActive]}>
                  <Text style={[styles.chipText, interests.includes(i) && { color: colors.white }]}>{i}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Pressable style={styles.agree} onPress={() => setAgree((a) => !a)}>
          <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? colors.primary : colors.textMuted} />
          <Text style={styles.agreeText}>
            Autorizo {politician.name} a usar as informações acima para me enviar notícias, convites e comunicados do seu
            mandato ou campanha. Sei que posso cancelar a qualquer momento em Configurações › Minhas autorizações, e que os
            dados não podem ser repassados a terceiros.
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.primary} onPress={submit}>
          <Text style={styles.primaryText}>{existing ? 'Salvar alterações' : 'Autorizar e receber novidades'}</Text>
        </Pressable>
        {existing ? (
          <Pressable
            style={styles.secondary}
            onPress={() => {
              revokeConsent(existing.id);
              router.back();
            }}>
            <Text style={styles.revoke}>Cancelar autorização</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  fieldLabel: { color: colors.text, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  agree: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.sm },
  agreeText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17 },
  error: { color: colors.like, textAlign: 'center' },
  primary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  revoke: { color: colors.like, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
}));
