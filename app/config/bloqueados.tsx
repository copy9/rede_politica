import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { InfoText, Section, SettingsScreen } from '@/components/SettingsUI';
import { UserName } from '@/components/UserName';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function BlockedScreen() {
  const { settings, toggleIn } = useSettings();
  const { getUser } = useApp();
  const [tab, setTab] = useState<'blockedIds' | 'mutedIds'>('blockedIds');
  const list = settings[tab].map(getUser).filter((u) => !!u);

  return (
    <SettingsScreen>
      <View style={styles.tabs}>
        {(
          [
            ['blockedIds', `Bloqueados (${settings.blockedIds.length})`],
            ['mutedIds', `Silenciados (${settings.mutedIds.length})`],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab !== key && { color: colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <InfoText>
        {tab === 'blockedIds'
          ? 'Pessoas bloqueadas não veem seu perfil e você não vê o conteúdo delas. Elas não são avisadas.'
          : 'Você continua seguindo, mas as publicações e stories dessas pessoas não aparecem no seu feed.'}
      </InfoText>
      <Section>
        {list.length === 0 ? <InfoText>Ninguém por aqui. Bloqueie ou silencie pelo menu (•••) no perfil da pessoa.</InfoText> : null}
        {list.map((u) => (
          <View key={u!.id} style={styles.row}>
            <Avatar uri={u!.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <UserName user={u!} />
              <Text style={styles.muted}>{u!.name}</Text>
            </View>
            <Pressable style={styles.btn} onPress={() => toggleIn(tab, u!.id)}>
              <Text style={styles.btnText}>{tab === 'blockedIds' ? 'Desbloquear' : 'Reativar'}</Text>
            </Pressable>
          </View>
        ))}
      </Section>
    </SettingsScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', backgroundColor: colors.background },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
    tabText: { fontWeight: '700', color: colors.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    muted: { color: colors.textMuted, fontSize: 12 },
    btn: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    btnText: { color: colors.text, fontWeight: '600' },
  }),
);
