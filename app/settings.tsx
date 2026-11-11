import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/lib/store';
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
  const { signOut } = useApp();

  const logout = () =>
    Alert.alert('Sair da conta?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return (
    <ScrollView style={styles.container}>
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
