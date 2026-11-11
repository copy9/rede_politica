import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { NavRow, Section, SettingsScreen, audienceLabel } from '@/components/SettingsUI';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

const THEME_LABEL = { system: 'Automático', light: 'Claro', dark: 'Escuro' };
const LANG_LABEL = { 'pt-BR': 'Português', en: 'English', es: 'Español' };

export default function SettingsHome() {
  const me = useMe();
  const { signOut, updateProfile, consents } = useApp();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const t = useT();
  const political = me.accountType === 'politico';
  const myConsents = consents.filter((c) => c.userId === me.id).length;

  const { confirm } = useOverlay();

  const toggleAccountType = () =>
    confirm(
      political ? 'Voltar para conta de cidadão?' : 'Ativar conta política?',
      political
        ? 'Você perde o acesso ao Painel do político.'
        : 'Para candidatos e políticos. Libera o Painel com dados do seu público e o banco de apoiadores.',
      political ? 'Voltar para cidadão' : 'Ativar conta política',
      () => {
        updateProfile({ accountType: political ? 'cidadao' : 'politico' });
        if (!political) router.push('/painel');
      },
    );

  const logout = () => confirm('Sair da conta?', 'Você pode entrar de novo quando quiser.', 'Sair', signOut, true);

  // Busca: filtra as opções pelo nome
  const q = query.trim().toLowerCase();
  const show = (label: string) => !q || t(label).toLowerCase().includes(q) || label.toLowerCase().includes(q);
  const go = (path: string) => () => router.push(path as never);

  const sections: { title: string; rows: { icon: React.ComponentProps<typeof NavRow>['icon']; label: string; value?: string; onPress: () => void }[] }[] = [
    {
      title: 'Sua conta',
      rows: [
        { icon: 'person-circle-outline', label: 'Editar perfil', onPress: go('/edit-profile') },
        { icon: 'card-outline', label: 'Informações pessoais', onPress: go('/config/dados-pessoais') },
        { icon: 'key-outline', label: 'Senha e segurança', onPress: go('/config/seguranca') },
        { icon: 'shield-checkmark-outline', label: 'Verificação de conta oficial', value: settings.verification.status === 'em_analise' ? t('Em análise') : undefined, onPress: go('/config/verificacao') },
        { icon: political ? 'person-outline' : 'business-outline', label: political ? 'Conta política (ativa)' : 'Sou político ou candidato', onPress: toggleAccountType },
        ...(political ? [{ icon: 'bar-chart-outline' as const, label: 'Painel do político', onPress: go('/painel') }] : []),
      ],
    },
    {
      title: 'Como você usa a Rede Política',
      rows: [
        { icon: 'bookmark-outline', label: 'Salvos', onPress: go('/salvos') },
        { icon: 'time-outline', label: 'Sua atividade', onPress: go('/atividade') },
        { icon: 'notifications-outline', label: 'Notificações', value: settings.notifications.pauseAll ? t('Pausadas') : undefined, onPress: go('/config/notificacoes') },
        { icon: 'hourglass-outline', label: 'Tempo de uso', value: settings.dailyLimitMin ? `${settings.dailyLimitMin} ${t('min/dia')}` : undefined, onPress: go('/atividade?tab=tempo') },
      ],
    },
    {
      title: 'Quem pode ver seu conteúdo',
      rows: [
        { icon: 'lock-closed-outline', label: 'Privacidade da conta', value: settings.privateAccount ? t('Privada') : t('Pública'), onPress: go('/config/privacidade') },
        { icon: 'star-outline', label: 'Melhores amigos', value: settings.closeFriendIds.length ? String(settings.closeFriendIds.length) : undefined, onPress: go('/config/melhores-amigos') },
        { icon: 'remove-circle-outline', label: 'Bloqueados e silenciados', value: String(settings.blockedIds.length + settings.mutedIds.length), onPress: go('/config/bloqueados') },
        { icon: 'shield-half-outline', label: 'Minhas autorizações a políticos', value: myConsents ? String(myConsents) : undefined, onPress: go('/autorizacoes') },
      ],
    },
    {
      title: 'Como outras pessoas podem interagir com você',
      rows: [
        { icon: 'chatbubbles-outline', label: 'Mensagens', value: t(audienceLabel(settings.whoCanMessage)), onPress: go('/config/privacidade') },
        { icon: 'at-outline', label: 'Menções', value: t(audienceLabel(settings.whoCanMention)), onPress: go('/config/privacidade') },
        { icon: 'chatbubble-ellipses-outline', label: 'Comentários e palavras ocultas', onPress: go('/config/comentarios') },
        { icon: 'flash-outline', label: 'Desafios para batalhas', value: t(audienceLabel(settings.whoCanChallenge)), onPress: go('/config/privacidade') },
      ],
    },
    {
      title: 'Seu app e mídia',
      rows: [
        { icon: 'contrast-outline', label: 'Aparência (modo escuro)', value: t(THEME_LABEL[settings.themeMode]), onPress: go('/config/aparencia') },
        { icon: 'cellular-outline', label: 'Uso de dados e mídia', value: settings.dataSaver ? t('Economia ligada') : undefined, onPress: go('/config/aparencia') },
        { icon: 'language-outline', label: 'Idioma', value: LANG_LABEL[settings.language], onPress: go('/config/idioma') },
      ],
    },
    {
      title: 'Mais informações e suporte',
      rows: [
        { icon: 'help-circle-outline', label: 'Ajuda', onPress: go('/config/ajuda') },
        { icon: 'document-text-outline', label: 'Termos de uso e privacidade', onPress: go('/config/sobre?tab=termos') },
        { icon: 'information-circle-outline', label: 'Sobre', onPress: go('/config/sobre') },
      ],
    },
  ];

  return (
    <SettingsScreen>
      <View style={styles.searchBox}>
        <TextInput
          placeholder={t('Pesquisar nas configurações')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
      </View>
      {sections.map((section) => {
        const rows = section.rows.filter((r) => show(r.label));
        if (!rows.length) return null;
        return (
          <Section key={section.title} title={t(section.title)}>
            {rows.map((r) => (
              <NavRow key={r.label} icon={r.icon} label={t(r.label)} value={r.value} onPress={r.onPress} />
            ))}
          </Section>
        );
      })}
      {show('Sair') ? (
        <Section title={t('Entrar')}>
          <NavRow label={t('Sair')} onPress={logout} danger />
        </Section>
      ) : null}
      <Text style={styles.version}>{t('Rede Política • versão de demonstração')}</Text>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    searchBox: { backgroundColor: colors.background, padding: spacing.md, marginBottom: spacing.sm },
    search: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, height: 40, color: colors.text, fontSize: 15 },
    version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: spacing.xl },
  }),
);
