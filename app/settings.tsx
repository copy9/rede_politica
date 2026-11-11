import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp, useMe } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const soon = () => Alert.alert('Em breve', 'Esta configuração será liberada nas próximas versões.');

const SECTIONS: { title: string; items: { icon: IconName; label: string; onPress?: () => void }[] }[] = [
  {
    title: 'Sua conta',
    items: [
      { icon: 'person-circle-outline', label: 'Editar perfil', onPress: () => router.push('/edit-profile') },
      { icon: 'shield-checkmark-outline', label: 'Verificação de conta oficial' },
      { icon: 'key-outline', label: 'Senha e segurança' },
    ],
  },
  {
    title: 'Como você usa a Rede Política',
    items: [
      { icon: 'bookmark-outline', label: 'Salvos', onPress: () => router.navigate('/profile') },
      { icon: 'notifications-outline', label: 'Notificações', onPress: () => router.push('/notifications') },
      { icon: 'time-outline', label: 'Tempo de uso' },
    ],
  },
  {
    title: 'Quem pode ver seu conteúdo',
    items: [
      { icon: 'shield-checkmark-outline', label: 'Minhas autorizações a políticos', onPress: () => router.push('/autorizacoes') },
      { icon: 'lock-closed-outline', label: 'Privacidade da conta' },
      { icon: 'people-outline', label: 'Contas bloqueadas' },
      { icon: 'chatbubbles-outline', label: 'Mensagens e respostas' },
    ],
  },
  {
    title: 'Mais informações e suporte',
    items: [
      { icon: 'help-circle-outline', label: 'Ajuda' },
      { icon: 'document-text-outline', label: 'Termos de uso e privacidade' },
      { icon: 'information-circle-outline', label: 'Sobre' },
    ],
  },
];

export default function SettingsScreen() {
  const me = useMe();
  const { signOut, updateProfile } = useApp();
  const political = me.accountType === 'politico';

  const toggleAccountType = () =>
    Alert.alert(
      political ? 'Voltar para conta de cidadão?' : 'Ativar conta política?',
      political
        ? 'Você perde o acesso ao Painel do político.'
        : 'Para candidatos e políticos. Libera o Painel com dados do seu público e o banco de apoiadores. Contas oficiais passam por verificação.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: political ? 'Voltar para cidadão' : 'Ativar',
          onPress: () => {
            updateProfile({ accountType: political ? 'cidadao' : 'politico' });
            if (!political) router.push('/painel');
          },
        },
      ],
    );

  const logout = () =>
    Alert.alert('Sair da conta?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de conta</Text>
        {political ? (
          <Pressable style={styles.row} onPress={() => router.push('/painel')}>
            <Ionicons name="bar-chart-outline" size={24} color={colors.text} />
            <Text style={styles.label}>Painel do político</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable style={styles.row} onPress={toggleAccountType}>
          <Ionicons name={political ? 'person-outline' : 'business-outline'} size={24} color={colors.text} />
          <Text style={styles.label}>{political ? 'Conta política (ativa) · mudar para cidadão' : 'Sou político ou candidato'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <Pressable key={item.label} style={styles.row} onPress={item.onPress ?? soon}>
              <Ionicons name={item.icon} size={24} color={colors.text} />
              <Text style={styles.label}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ))}
      <View style={styles.section}>
        <Pressable style={styles.row} onPress={logout}>
          <Text style={styles.logout}>Sair</Text>
        </Pressable>
      </View>
      <Text style={styles.version}>Rede Política • versão de demonstração</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  section: { backgroundColor: colors.background, marginBottom: spacing.sm, paddingVertical: spacing.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { flex: 1, fontSize: 15, color: colors.text },
  logout: { color: colors.like, fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: spacing.xl },
});
