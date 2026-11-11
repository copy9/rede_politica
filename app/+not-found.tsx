import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, themed } from '@/lib/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Esta página não existe.</Text>
      <Link href="/" style={styles.link}>
        Voltar para o início
      </Link>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  link: { marginTop: 16, color: colors.primary, fontWeight: '600' },
}));
