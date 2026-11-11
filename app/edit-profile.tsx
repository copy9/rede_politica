import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { INTERESTS } from '@/lib/analytics';
import type { Gender } from '@/lib/types';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

export default function EditProfileScreen() {
  const me = useMe();
  const { updateProfile } = useApp();
  const [avatar, setAvatar] = useState(me.avatar);
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [role, setRole] = useState(me.role ?? '');
  const [party, setParty] = useState(me.party ?? '');
  const [bio, setBio] = useState(me.bio);
  const [website, setWebsite] = useState(me.website ?? '');
  const [city, setCity] = useState(me.city ?? '');
  const [uf, setUf] = useState(me.state ?? '');
  const [gender, setGender] = useState<Gender | undefined>(me.gender);
  const [birthYear, setBirthYear] = useState(me.birthYear ? String(me.birthYear) : '');
  const [interests, setInterests] = useState<string[]>(me.interests ?? []);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatar(result.assets[0].uri);
  };

  const save = () => {
    const year = birthYear.trim() ? Number(birthYear) : undefined;
    const thisYear = new Date().getFullYear();
    if (year !== undefined && (!Number.isInteger(year) || year < thisYear - 110 || year > thisYear - 13)) {
      setError('Ano de nascimento inválido.');
      return;
    }
    const err = updateProfile({
      city: city.trim() || undefined,
      state: uf.trim().toUpperCase() || undefined,
      gender,
      birthYear: year,
      interests,
      avatar,
      name: name.trim(),
      username,
      role: role.trim() || undefined,
      party: party.trim() || undefined,
      bio: bio.trim(),
      website: website.trim().replace(/^https?:\/\//, '') || undefined,
    });
    if (err) setError(err);
    else router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} hitSlop={8}>
              <Text style={styles.done}>Concluir</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.avatarBox} onPress={pickAvatar}>
          <Avatar uri={avatar} size={90} />
          <Text style={styles.changePhoto}>Alterar foto</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Row label="Nome" value={name} onChange={setName} />
        <Row label="Usuário" value={username} onChange={setUsername} autoCapitalize="none" />
        <Row label="Cargo" value={role} onChange={setRole} placeholder="Ex.: Vereadora, Eleitor, Jornalista" />
        <Row label="Partido" value={party} onChange={setParty} placeholder="Opcional" />
        <Row label="Bio" value={bio} onChange={setBio} multiline />
        <Row label="Site" value={website} onChange={setWebsite} autoCapitalize="none" placeholder="seusite.com.br" />

        <Text style={styles.sectionTitle}>Sobre você</Text>
        <Text style={styles.sectionInfo}>
          Opcional. Não aparece no seu perfil: entra só nas estatísticas anônimas (percentuais) que os políticos que você segue
          veem sobre o público deles.
        </Text>
        <Row label="Cidade" value={city} onChange={setCity} placeholder="Sua cidade" />
        <Row label="UF" value={uf} onChange={setUf} placeholder="Ex.: PE" autoCapitalize="none" />
        <Row label="Nascimento" value={birthYear} onChange={setBirthYear} placeholder="Ano, ex.: 1990" autoCapitalize="none" />
        <View style={styles.row}>
          <Text style={styles.label}>Gênero</Text>
          <View style={styles.chips}>
            {(
              [
                ['F', 'Feminino'],
                ['M', 'Masculino'],
                ['O', 'Outro'],
              ] as [Gender, string][]
            ).map(([g, label]) => (
              <Pressable key={g} onPress={() => setGender(gender === g ? undefined : g)} style={[styles.chip, gender === g && styles.chipActive]}>
                <Text style={[styles.chipText, gender === g && { color: colors.white }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.row, { flexDirection: 'column', gap: 8 }]}>
          <Text style={styles.label}>Interesses</Text>
          <View style={styles.chips}>
            {INTERESTS.map((i) => (
              <Pressable
                key={i}
                onPress={() => setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                style={[styles.chip, interests.includes(i) && styles.chipActive]}>
                <Text style={[styles.chipText, interests.includes(i) && { color: colors.white }]}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function Row({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        maxLength={multiline ? 150 : 60}
        style={[styles.input, multiline && { minHeight: 60 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  cancel: { color: colors.text, fontSize: 16 },
  done: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  avatarBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  changePhoto: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.like, textAlign: 'center', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { width: 80, color: colors.text, fontSize: 15, paddingTop: 2 },
  input: { flex: 1, color: colors.text, fontSize: 15, padding: 0 },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionInfo: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: 4 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
});
