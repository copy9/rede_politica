import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { InfoText, NavRow, PrimaryButton, Section, SettingsScreen } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function PersonalInfoScreen() {
  const me = useMe();
  const { settings, update } = useSettings();
  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone);
  const { exportMyData, deleteAccount } = useApp();
  const { showBanner, confirm } = useOverlay();

  const save = () => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return showBanner('E-mail inválido.', { tone: 'warning' });
    if (phone && phone.replace(/\D/g, '').length < 10) return showBanner('Telefone inválido: use DDD + número.', { tone: 'warning' });
    update({ email: email.trim(), phone: phone.trim() });
    showBanner('Informações salvas.', { icon: 'checkmark-circle', tone: 'success' });
  };

  const download = () => {
    // Abre a tela de compartilhar do celular com um arquivo JSON dos seus dados (salve no Drive, e-mail etc.)
    Share.share({ title: 'meus-dados-rede-politica.json', message: exportMyData() }).catch(() => {});
  };

  const remove = () =>
    confirm(
      'Excluir sua conta?',
      'Apaga seu perfil, publicações, comentários, mensagens, seguidores e autorizações. Não dá para desfazer.',
      'Excluir conta definitivamente',
      () => void deleteAccount(),
      true,
    );

  return (
    <SettingsScreen>
      <InfoText>Estes dados são privados: não aparecem no seu perfil e não são mostrados a ninguém.</InfoText>
      <Section title="Contato" footer="O telefone e o e-mail recebem o código da autenticação em dois fatores e já vêm preenchidos quando você autoriza um político a te contatar.">
        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <Text style={styles.label}>Telefone</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="(81) 99999-9999" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={styles.input} />
        </View>
        <PrimaryButton label="Salvar" onPress={save} />
      </Section>
      <Section title="Perfil">
        <NavRow label="Cidade, gênero, nascimento e interesses" value={[me.city, me.state].filter(Boolean).join('/')} onPress={() => router.push('/edit-profile')} />
      </Section>
      <Section title="Seus dados (LGPD)" footer="Baixe uma cópia de tudo que a Rede Política guarda sobre você, ou exclua a conta de vez.">
        <NavRow icon="download-outline" label="Baixar meus dados" onPress={download} />
        <NavRow label="Excluir minha conta" danger onPress={remove} />
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    form: { gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    label: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
    input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 44, color: colors.text, fontSize: 15 },
  }),
);
