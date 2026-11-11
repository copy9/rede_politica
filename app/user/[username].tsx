import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileView } from '@/components/ProfileView';
import { UserName } from '@/components/UserName';
import { useApp } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getUserByUsername } = useApp();
  const user = getUserByUsername(username);

  if (!user) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Perfil não encontrado</Text>
        <Text style={styles.muted}>O link pode estar quebrado ou o perfil foi removido.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <UserName user={user} size={17} />,
          headerRight: () => (
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert(user.username, undefined, [
                  { text: 'Denunciar perfil', style: 'destructive', onPress: () => Alert.alert('Obrigado', 'Sua denúncia foi registrada.') },
                  { text: 'Cancelar', style: 'cancel' },
                ])
              }>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ProfileView user={user} />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6, backgroundColor: colors.background },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, textAlign: 'center' },
});
