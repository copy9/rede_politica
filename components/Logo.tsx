import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

/** Logotipo textual da Rede Política. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { width: size * 1.1, height: size * 1.1, borderRadius: size * 0.3 }]}>
        <Text style={[styles.markText, { fontSize: size * 0.6 }]}>RP</Text>
      </View>
      <Text style={[styles.text, { fontSize: size }]}>
        rede<Text style={{ color: colors.primary }}>política</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.accent, fontWeight: '900' },
  text: { fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
});
