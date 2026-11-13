import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/ProfileView';
import { useMe } from '@/lib/store';
import { colors, spacing, themed } from '@/lib/theme';

export default function MyProfileScreen() {
  const me = useMe();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate('/create')} hitSlop={8} accessibilityLabel="Nova publicação">
          <Ionicons name="add-outline" size={30} color={colors.text} />
        </Pressable>
        <View style={styles.title}>
          <Text style={styles.username}>{me.username}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.text} />
        </View>
        <View style={styles.icons}>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
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
  title: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontWeight: '700', fontSize: 18, color: colors.text },
  icons: { flexDirection: 'row', gap: 20 },
}));
