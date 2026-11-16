import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { shareText } from '@/lib/share';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/ProfileView';
import { useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function MyProfileScreen() {
  const me = useMe();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityLabel="Configurações" style={styles.side}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={[styles.icons, styles.side, { justifyContent: 'flex-end' }]}>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityLabel="Notificações">
            <Ionicons name="notifications-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => Share.share({ message: shareText(`Siga @${me.username} na Rede Política`, `user/${me.username}`) }).catch(() => {})}
            hitSlop={8}
            accessibilityLabel="Compartilhar perfil">
            <Ionicons name="share-social-outline" size={25} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <ProfileView user={me} />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontWeight: '700', fontSize: 15, color: colors.text },
  side: { width: 76 },
  icons: { flexDirection: 'row', gap: 20 },
}));
