// Medidor do score do candidato: ponteiro que gira até a nota e muda de cor (vermelho → amarelo → verde).
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { compactNumber } from '@/lib/format';
import { colors, themed } from '@/lib/theme';

/** Nota de 0 a 100 a partir dos pontos de engajamento (escala logarítmica: 10 mil pontos = 100). */
export const scorePercent = (points: number) => Math.max(0, Math.min(100, (Math.log10(points + 1) / 4) * 100));

const W = 120;
const R = 48;
const CX = W / 2;
const CY = 56;
const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

export function ScoreGauge({ points }: { points: number }) {
  const pct = scorePercent(points);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: pct, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, anim]);

  const rotate = anim.interpolate({ inputRange: [0, 100], outputRange: ['-90deg', '90deg'] });
  const tone = anim.interpolate({ inputRange: [0, 50, 100], outputRange: ['#EF4444', '#F59E0B', '#22C55E'] });

  return (
    <View style={styles.wrap} accessibilityLabel={`Score ${Math.round(pct)} de 100`}>
      <Svg width={W} height={CY + 6}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#EF4444" />
            <Stop offset="0.5" stopColor="#F59E0B" />
            <Stop offset="1" stopColor="#22C55E" />
          </LinearGradient>
        </Defs>
        <Path d={arc} stroke="url(#g)" strokeWidth={10} strokeLinecap="round" fill="none" />
      </Svg>
      {/* ponteiro: gira a partir do centro de baixo */}
      <Animated.View style={[styles.needleBox, { transform: [{ rotate }] }]} pointerEvents="none">
        <Animated.View style={[styles.needle, { backgroundColor: tone }]} />
      </Animated.View>
      <Animated.View style={[styles.hub, { backgroundColor: tone }]} />
      <Animated.Text style={[styles.value, { color: tone }]} maxFontSizeMultiplier={1.15}>
        {Math.round(pct)}
      </Animated.Text>
      <Text style={styles.label} maxFontSizeMultiplier={1.1}>
        SCORE · {compactNumber(points)} pts
      </Text>
    </View>
  );
}

const NEEDLE = R - 8;
const styles = themed(() => StyleSheet.create({
  wrap: { width: W, alignItems: 'center' },
  // caixa do tamanho de 2x o ponteiro, centrada no pivô: girar a caixa gira o ponteiro em volta do pivô
  needleBox: { position: 'absolute', top: CY - NEEDLE, left: CX - 2, width: 4, height: NEEDLE * 2, alignItems: 'center' },
  needle: { width: 4, height: NEEDLE, borderRadius: 2 },
  hub: { position: 'absolute', top: CY - 6, left: CX - 6, width: 12, height: 12, borderRadius: 6 },
  value: { fontSize: 22, fontWeight: '800', marginTop: -2 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
}));
