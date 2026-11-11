import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { InfoText, NavRow, PrimaryButton, Section, SettingsScreen } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';
import { useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function PersonalInfoScreen() {
  const me = useMe();
  const { settings, update } = useSettings();
  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone);

  const save = () => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return Alert.alert('E-mail inválido');
    update({ email: email.trim(), phone: phone.trim() });
    Alert.alert('Salvo');
  };

  return (
    <SettingsScreen>
      <InfoText>Estes dados são privados: não aparecem no seu perfil e não são mostrados a ninguém.</InfoText>
      <Section title="Contato">
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
      <Section title="Seus dados (LGPD)" footer="Você pode pedir uma cópia de tudo que a Rede Política guarda sobre você, ou a exclusão da conta.">
        <NavRow label="Baixar meus dados" onPress={() => Alert.alert('Pedido registrado', 'Você receberá um arquivo com seus dados por e-mail (na versão com servidor).')} />
        <NavRow
          label="Excluir minha conta"
          danger
          onPress={() =>
            Alert.alert('Excluir conta?', 'Na versão com servidor, sua conta e seus dados serão apagados em até 30 dias.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Solicitar exclusão', style: 'destructive', onPress: () => Alert.alert('Pedido registrado') },
            ])
          }
        />
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
