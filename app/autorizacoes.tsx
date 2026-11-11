import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { UserName } from '@/components/UserName';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';
import type { ShareField } from '@/lib/types';

const LABELS: Record<ShareField, string> = {
  nome: 'nome',
  cidade: 'cidade',
  faixaEtaria: 'faixa etária',
  interesses: 'interesses',
  whatsapp: 'WhatsApp',
  email: 'e-mail',
};

/** Onde o cidadão vê e cancela as autorizações que deu a políticos. */
export default function MyConsentsScreen() {
  const me = useMe();
  const { consents, getUser, revokeConsent } = useApp();
  const mine = consents.filter((c) => c.userId === me.id).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <FlatList
      style={styles.container}
      data={mine}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <Text style={styles.intro}>
          Políticos que você autorizou a enviar novidades. Eles veem só os dados listados. Cancele quando quiser.
        </Text>
      }
      renderItem={({ item }) => {
        const p = getUser(item.politicianId);
        if (!p) return null;
        return (
          <View style={styles.row}>
            <Pressable onPress={() => router.push(`/user/${p.username}`)}>
              <Avatar uri={p.avatar} size={46} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <UserName user={p} />
              <Text style={styles.muted}>Compartilhado: {item.fields.map((f) => LABELS[f]).join(', ')}</Text>
              <Text style={styles.muted}>Desde {new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => router.push(`/apoiar/${p.username}`)}>
                  <Text style={styles.link}>Alterar</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Cancelar autorização?', `${p.name} deixará de ver seus dados.`, [
                      { text: 'Voltar', style: 'cancel' },
                      { text: 'Cancelar autorização', style: 'destructive', onPress: () => revokeConsent(item.id) },
                    ])
                  }>
                  <Text style={[styles.link, { color: colors.like }]}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>Você ainda não autorizou nenhum político.</Text>}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  intro: { color: colors.textMuted, padding: spacing.lg, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  muted: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: 6 },
  link: { color: colors.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
}));
