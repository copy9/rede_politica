import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { UserName } from '@/components/UserName';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

const MAX_PARTICIPANTS = 6;

export default function NewBattleScreen() {
  const me = useMe();
  const { users, followingOf, createBattle, canInteract } = useApp();
  // vindo do botão "Desafiar" no perfil: a pessoa já vem escolhida
  const { adversario } = useLocalSearchParams<{ adversario?: string }>();
  // escolhidos na ordem: a primeira pessoa é a desafiada, as demais entram ao vivo como convidadas
  const [picked, setPicked] = useState<string[]>(adversario ? [adversario] : []);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const opponentId = picked[0] ?? null;
  const guestIds = picked.slice(1);

  // Quem eu sigo aparece primeiro
  const following = followingOf(me.id);
  const others = users.filter((u) => u.id !== me.id && !following.some((f) => f.id === u.id));
  const q = query.trim().toLowerCase();
  const ordered = [...following, ...others];
  // a pessoa escolhida pelo perfil aparece no topo da lista
  const chosen = adversario ? ordered.find((u) => u.id === adversario) : undefined;
  const candidates = (chosen ? [chosen, ...ordered.filter((u) => u.id !== chosen.id)] : ordered).filter(
    (u) => !q || u.username.includes(q) || u.name.toLowerCase().includes(q),
  );

  const togglePick = (id: string) => {
    if (picked.includes(id)) return setPicked(picked.filter((p) => p !== id));
    if (picked.length >= MAX_PARTICIPANTS) return setError(`No máximo ${MAX_PARTICIPANTS} pessoas no debate.`);
    setError(null);
    setPicked([...picked, id]);
  };

  const start = () => {
    if (!opponentId) return setError('Escolha pelo menos uma pessoa.');
    if (!topic.trim()) return setError('Escreva o título do debate.');
    const battle = createBattle({
      opponentId,
      topic,
      description,
      // sem tempo fixo: quem criou encerra no botão "Encerrar"
      durationSec: 3600,
      guestIds,
    });
    if (battle) router.replace(`/battle/${battle.id}`);
  };

  return (
    // edges bottom: o botão fica acima da barra de navegação do Android, em qualquer celular
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={candidates}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>Título</Text>
            <TextInput
              placeholder="Ex.: Passe livre estudantil: vale o custo?"
              placeholderTextColor={colors.textMuted}
              value={topic}
              onChangeText={setTopic}
              maxLength={90}
              style={styles.input}
            />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              placeholder="Explique o debate. Pode colocar um link (ex.: https://...)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={1000}
              multiline
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            />

            <View style={styles.guestHead}>
              <Text style={styles.label}>Quem participa</Text>
              <Text style={styles.counter}>
                {picked.length}/{MAX_PARTICIPANTS}
              </Text>
            </View>
            <Text style={styles.muted}>
              Toque nas bolinhas para escolher várias pessoas. O número 1 é o outro lado do debate; as outras entram ao vivo como convidadas.
            </Text>

            <Text style={styles.label}>Convidar</Text>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Pesquisar pessoa"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                style={{ flex: 1, color: colors.text }}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const selected = picked.includes(item.id);
          const order = picked.indexOf(item.id) + 1;
          // respeita "Quem pode desafiar você para batalhas" de cada conta
          const allowed = canInteract(item.id, 'challenge');
          return (
            <Pressable
              style={[styles.person, selected && styles.personSelected, !allowed && { opacity: 0.45 }]}
              disabled={!allowed}
              onPress={() => togglePick(item.id)}>
              <Avatar uri={item.avatar} size={44} />
              <View style={{ flex: 1 }}>
                <UserName user={item} />
                <Text style={styles.muted} numberOfLines={1}>
                  {allowed ? [item.name, item.role].filter(Boolean).join(' • ') : 'Não aceita desafios de você'}
                </Text>
              </View>
              {selected ? (
                <View style={styles.orderBadge}>
                  <Text style={styles.orderText}>{order}</Text>
                </View>
              ) : null}
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={selected ? colors.like : colors.textMuted}
              />
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>
          Regras: debate com respeito. A plateia apoia um lado com pontos; quem tiver mais pontos no fim do tempo vence.
        </Text>
        <Pressable style={styles.button} onPress={start}>
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.buttonText}>Começar debate ao vivo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}


const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.like, borderColor: colors.like },
  chipText: { color: colors.text, fontWeight: '600' },
  guestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  counter: { color: colors.textMuted, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 38 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  personSelected: { backgroundColor: colors.dangerBg },
  orderBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.like, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  orderText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 13 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  error: { color: colors.like, textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.like, borderRadius: 12, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
}));
