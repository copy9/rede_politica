import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
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
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatar(result.assets[0].uri);
  };

  const save = () => {
    const err = updateProfile({
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
});
