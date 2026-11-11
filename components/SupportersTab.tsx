import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { INTERESTS, supportersToCsv } from '@/lib/analytics';
import { timeAgo } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import type { Supporter } from '@/lib/types';
import { Avatar } from './Avatar';

type Contact = 'todos' | 'whatsapp' | 'email';

/**
 * Banco de apoiadores: SÓ pessoas que tocaram em "Quero receber novidades"
 * e autorizaram, mostrando apenas os campos que cada uma escolheu compartilhar.
 */
export function SupportersTab({ supporters }: { supporters: Supporter[] }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>('todos');

  const cities = useMemo(() => {
    const count = new Map<string, number>();
    supporters.forEach((s) => s.city && count.set(s.city, (count.get(s.city) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [supporters]);

  const q = query.trim().toLowerCase();
  const list = supporters.filter(
    (s) =>
      (!q || [s.name, s.username, s.city, s.email, s.whatsapp].some((v) => v?.toLowerCase().includes(q))) &&
      (!city || s.city === city) &&
      (!interest || s.interests.includes(interest)) &&
      (contact === 'todos' || (contact === 'whatsapp' ? !!s.whatsapp : !!s.email)),
  );

  const withWhats = supporters.filter((s) => s.whatsapp).length;
  const withEmail = supporters.filter((s) => s.email).length;
  const last7 = supporters.filter((s) => Date.now() - s.createdAt < 7 * 86400000).length;

  const exportCsv = () => {
    if (!list.length) return Alert.alert('Nada para exportar', 'Nenhum apoiador com esses filtros.');
    Share.share({ title: 'apoiadores.csv', message: supportersToCsv(list) }).catch(() => {});
  };

  return (
    <FlatList
      data={list}
      keyExtractor={(s) => s.consentId}
      contentContainerStyle={{ paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.notice}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.noticeText}>
              Só aparecem aqui pessoas que tocaram em “Quero receber novidades” no seu perfil e autorizaram o contato
              (LGPD). Cada uma escolheu quais dados compartilhar e pode cancelar quando quiser. Não use estes contatos
              para outra finalidade nem repasse a terceiros.
            </Text>
          </View>

          <View style={styles.stats}>
            <Stat value={supporters.length} label="apoiadores" />
            <Stat value={withWhats} label="com WhatsApp" />
            <Stat value={withEmail} label="com e-mail" />
            <Stat value={last7} label="últimos 7 dias" />
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              placeholder="Buscar nome, cidade, contato"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todos" active={contact === 'todos'} onPress={() => setContact('todos')} />
            <Chip label="Com WhatsApp" active={contact === 'whatsapp'} onPress={() => setContact('whatsapp')} />
            <Chip label="Com e-mail" active={contact === 'email'} onPress={() => setContact('email')} />
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todas as cidades" active={!city} onPress={() => setCity(null)} />
            {cities.map((c) => (
              <Chip key={c} label={c} active={city === c} onPress={() => setCity(city === c ? null : c)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todos os temas" active={!interest} onPress={() => setInterest(null)} />
            {INTERESTS.map((i) => (
              <Chip key={i} label={i} active={interest === i} onPress={() => setInterest(interest === i ? null : i)} />
            ))}
          </ScrollView>

          <View style={styles.listHeader}>
            <Text style={styles.count}>
              {list.length} {list.length === 1 ? 'apoiador' : 'apoiadores'}
            </Text>
            <Pressable style={styles.export} onPress={exportCsv}>
              <Ionicons name="download-outline" size={16} color={colors.white} />
              <Text style={styles.exportText}>Exportar planilha</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => <SupporterRow s={item} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum apoiador com esses filtros.</Text>}
    />
  );
}

function SupporterRow({ s }: { s: Supporter }) {
  return (
    <View style={styles.row}>
      {s.avatar ? (
        <Avatar uri={s.avatar} size={44} />
      ) : (
        <View style={styles.initials}>
          <Text style={styles.initialsText}>{s.name ? s.name.split(' ').map((p) => p[0]).slice(0, 2).join('') : '?'}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {s.name ?? 'Nome não compartilhado'}
          {s.demo ? <Text style={styles.demo}> · exemplo</Text> : null}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[s.city && `${s.city}${s.state ? `/${s.state}` : ''}`, s.ageRange && `${s.ageRange} anos`, `autorizou há ${timeAgo(s.createdAt)}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {s.interests.length ? (
          <View style={styles.tags}>
            {s.interests.map((i) => (
              <Text key={i} style={styles.tag}>
                {i}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.contacts}>
          {s.whatsapp ? (
            <View style={styles.contact}>
              <Ionicons name="logo-whatsapp" size={13} color={colors.text} />
              <Text style={styles.contactText}>{s.whatsapp}</Text>
            </View>
          ) : null}
          {s.email ? (
            <View style={styles.contact}>
              <Ionicons name="mail-outline" size={13} color={colors.text} />
              <Text style={styles.contactText} numberOfLines={1}>
                {s.email}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('pt-BR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: spacing.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 17 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexBasis: '45%', flexGrow: 1, backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  chips: { gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  count: { fontWeight: '700', color: colors.text, fontSize: 15 },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  exportText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.background },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  initials: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: colors.primaryDark, fontWeight: '800' },
  name: { fontWeight: '700', color: colors.text },
  demo: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  meta: { color: colors.textMuted, fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: { fontSize: 11, color: colors.text, backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  contacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  contactText: { fontSize: 12, color: colors.text, flexShrink: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
});
