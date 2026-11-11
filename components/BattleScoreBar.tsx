import { StyleSheet, Text, View } from 'react-native';

import { compactNumber } from '@/lib/format';
import { colors, themed } from '@/lib/theme';

/** Barra de placar: azul (quem abriu a batalha) x âmbar (convidado). */
export function BattleScoreBar({ host, opponent, height = 22 }: { host: number; opponent: number; height?: number }) {
  const total = host + opponent;
  const hostShare = total === 0 ? 0.5 : Math.min(0.92, Math.max(0.08, host / total));
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
      <View style={[styles.side, { flex: hostShare, backgroundColor: colors.primary }]}>
        <Text style={styles.text}>{compactNumber(host)}</Text>
      </View>
      <View style={[styles.side, styles.right, { flex: 1 - hostShare, backgroundColor: colors.accent }]}>
        <Text style={styles.text}>{compactNumber(opponent)}</Text>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bar: { flexDirection: 'row', overflow: 'hidden', width: '100%' },
  side: { justifyContent: 'center', paddingHorizontal: 10 },
  right: { alignItems: 'flex-end' },
  text: { color: '#fff', fontWeight: '800', fontSize: 12 },
}));
