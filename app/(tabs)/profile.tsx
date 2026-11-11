import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/ProfileView';
import { UserName } from '@/components/UserName';
import { useSettings } from '@/lib/settings';
import { useMe } from '@/lib/store';
import { colors, getScheme, spacing, themed } from '@/lib/theme';

export default function MyProfileScreen() {
  const me = useMe();
  const { update } = useSettings();
  const dark = getScheme() === 'dark';
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <UserName user={me} size={20} />
        <View style={styles.icons}>
          <Pressable
            onPress={() => update({ themeMode: dark ? 'light' : 'dark' })}
            hitSlop={8}
            accessibilityLabel={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}>
            <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={25} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.navigate('/create')} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={27} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Ionicons name="menu" size={28} color={colors.text} />
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
  icons: { flexDirection: 'row', gap: 20 },
}));
