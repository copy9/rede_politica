import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { SettingsScreen } from '@/components/SettingsUI';
import { colors, spacing, themed } from '@/lib/theme';

const TERMS = [
  ['Respeito', 'Debata ideias, não ataque pessoas. Ameaças, discurso de ódio e assédio levam à suspensão da conta.'],
  ['Informação verdadeira', 'Não publique conteúdo falso sobre eleições, candidatos ou o processo de votação. Conteúdos denunciados podem ser removidos.'],
  ['Contas políticas', 'Devem representar a pessoa real. Propaganda eleitoral segue as regras e os prazos da Justiça Eleitoral.'],
  ['Dados de apoiadores', 'Só podem ser usados para a finalidade autorizada pelo cidadão. É proibido vender, ceder ou repassar a terceiros.'],
];

const PRIVACY = [
  ['O que coletamos', 'Dados do seu perfil, o que você publica e como usa o app. Cidade, gênero, nascimento e interesses são opcionais.'],
  ['Estatísticas', 'Políticos veem apenas números agregados e anônimos do público deles.'],
  ['Consentimento', 'Seu nome e contato só são compartilhados com um político se você autorizar, e você pode cancelar quando quiser.'],
  ['Seus direitos (LGPD)', 'Você pode pedir cópia, correção ou exclusão dos seus dados em Configurações › Informações pessoais.'],
];

export default function AboutScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'sobre' | 'termos' | 'privacidade'>(params.tab === 'termos' ? 'termos' : 'sobre');
  const list = tab === 'termos' ? TERMS : PRIVACY;

  return (
    <SettingsScreen>
      <View style={styles.tabs}>
        {(
          [
            ['sobre', 'Sobre'],
            ['termos', 'Termos de uso'],
            ['privacidade', 'Privacidade'],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab !== key && { color: colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'sobre' ? (
        <View style={styles.about}>
          <Logo size={28} />
          <Text style={styles.text}>Rede social para participar, debater e fiscalizar a política da sua cidade.</Text>
          <Text style={styles.muted}>Versão de demonstração 0.1</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map(([title, body]) => (
            <View key={title} style={styles.block}>
              <Text style={styles.blockTitle}>{title}</Text>
              <Text style={styles.text}>{body}</Text>
            </View>
          ))}
          <Text style={styles.muted}>Texto resumido de demonstração. A versão final deve ser revisada por um advogado.</Text>
        </View>
      )}
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', backgroundColor: colors.background },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
    tabText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    about: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background, marginTop: spacing.sm },
    list: { padding: spacing.lg, gap: spacing.md },
    block: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, gap: 4 },
    blockTitle: { fontWeight: '700', color: colors.text },
    text: { color: colors.text, lineHeight: 20, textAlign: 'left' },
    muted: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  }),
);
