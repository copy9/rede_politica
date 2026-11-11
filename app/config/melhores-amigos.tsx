import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { InfoText, Section, SettingsScreen } from '@/components/SettingsUI';
import { UserName } from '@/components/UserName';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function CloseFriendsScreen() {
  const me = useMe();
  const { followingOf } = useApp();
  const { settings, toggleIn } = useSettings();
  const people = followingOf(me.id);

  return (
    <SettingsScreen>
      <InfoText>Escolha quem pode ver os stories que você compartilhar só com Melhores amigos. Ninguém é avisado.</InfoText>
      <Section title={`${settings.closeFriendIds.length} selecionados`}>
        {people.map((u) => {
          const on = settings.closeFriendIds.includes(u.id);
          return (
            <Pressable key={u.id} style={styles.row} onPress={() => toggleIn('closeFriendIds', u.id)}>
              <Avatar uri={u.avatar} size={44} />
              <View style={{ flex: 1 }}>
                <UserName user={u} />
                <Text style={styles.muted}>{u.name}</Text>
              </View>
              <Ionicons name={on ? 'star' : 'star-outline'} size={22} color={on ? '#16A34A' : colors.textMuted} />
            </Pressable>
          );
        })}
        {!people.length ? <InfoText>Siga pessoas para adicioná-las aqui.</InfoText> : null}
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    muted: { color: colors.textMuted, fontSize: 12 },
  }),
);
