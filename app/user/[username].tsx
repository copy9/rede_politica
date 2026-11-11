import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileView } from '@/components/ProfileView';
import { UserName } from '@/components/UserName';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getUserByUsername, me } = useApp();
  const { settings, toggleIn } = useSettings();
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
    Alert.alert(user.username, undefined, [
      ...(!isMe
        ? [
            {
              text: isBlocked ? 'Desbloquear' : 'Bloquear',
              style: 'destructive' as const,
              onPress: () =>
                isBlocked
                  ? toggleIn('blockedIds', user.id)
                  : Alert.alert(`Bloquear ${user.username}?`, 'A pessoa não verá seu perfil e não será avisada.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Bloquear', style: 'destructive', onPress: () => toggleIn('blockedIds', user.id) },
                    ]),
            },
            { text: isMuted ? 'Reativar no feed' : 'Silenciar', onPress: () => toggleIn('mutedIds', user.id) },
          ]
        : []),
      { text: 'Denunciar perfil', style: 'destructive', onPress: () => Alert.alert('Obrigado', 'Sua denúncia foi registrada.') },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <UserName user={user} size={17} />,
          headerRight: () => (
            <Pressable hitSlop={8} onPress={openMenu}>
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
