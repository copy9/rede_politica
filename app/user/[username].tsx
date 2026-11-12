import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useReport } from '@/components/useReport';
import { useOverlay } from '@/components/Overlay';
import { ProfileView } from '@/components/ProfileView';
import { UserName } from '@/components/UserName';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getUserByUsername, me } = useApp();
  const { settings, toggleIn } = useSettings();
  const { showSheet, confirm, showBanner } = useOverlay();
  const reportIt = useReport();
  const user = getUserByUsername(username);

  if (!user) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Perfil não encontrado</Text>
        <Text style={styles.muted}>O link pode estar quebrado ou o perfil foi removido.</Text>
      </View>
    );
  }

  const isBlocked = settings.blockedIds.includes(user.id);
  const isMuted = settings.mutedIds.includes(user.id);
  const isMe = me?.id === user.id;

  const openMenu = () =>
    showSheet({
      title: user.username,
      options: [
        ...(!isMe
          ? [
              {
                label: isBlocked ? 'Desbloquear' : 'Bloquear',
                icon: 'remove-circle-outline' as const,
                destructive: !isBlocked,
                onPress: () =>
                  isBlocked
                    ? toggleIn('blockedIds', user.id)
                    : confirm(`Bloquear ${user.username}?`, 'A pessoa não verá seu perfil e não será avisada.', 'Bloquear', () => {
                        toggleIn('blockedIds', user.id);
                        showBanner(`${user.username} foi bloqueado(a).`, { icon: 'remove-circle-outline' });
                      }, true),
              },
              {
                label: isMuted ? 'Reativar no feed' : 'Silenciar',
                icon: 'volume-mute-outline' as const,
                onPress: () => {
                  toggleIn('mutedIds', user.id);
                  showBanner(isMuted ? `${user.username} voltou para o seu feed.` : `Você silenciou ${user.username}.`, { icon: 'volume-mute-outline' });
                },
              },
            ]
          : []),
        {
          label: 'Denunciar perfil',
          icon: 'flag-outline' as const,
          destructive: true,
          onPress: () => reportIt('profile', user.id, 'perfil'),
        },
      ],
    });

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <UserName user={user} size={17} />,
          headerRight: () => (
            <Pressable hitSlop={8} onPress={openMenu} accessibilityLabel="Mais opções">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {isBlocked ? (
        <View style={styles.empty}>
          <Ionicons name="remove-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Você bloqueou {user.username}</Text>
          <Text style={styles.muted}>Você não vê as publicações dessa conta.</Text>
          <Pressable style={styles.unblock} onPress={() => toggleIn('blockedIds', user.id)}>
            <Text style={styles.unblockText}>Desbloquear</Text>
          </Pressable>
        </View>
      ) : (
        <ProfileView user={user} />
      )}
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6, backgroundColor: colors.background },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, textAlign: 'center' },
  unblock: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  unblockText: { color: colors.text, fontWeight: '700' },
}));
