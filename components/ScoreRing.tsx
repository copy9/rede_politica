// Anel de score em volta da foto do candidato: os pedaços coloridos vão surgindo conforme o score sobe
// (vermelho → laranja → amarelo → verde). Embaixo, o nível: Regular, Positivo ou Excelente.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, themed } from '@/lib/theme';

/** Nota de 0 a 100 a partir dos pontos de engajamento (escala logarítmica: 10 mil pontos = 100). */
export const scorePercent = (points: number) => Math.max(0, Math.min(100, (Math.log10(points + 1) / 4) * 100));

// níveis (nota de 0 a 100): Positivo é o melhor (verde), Regular (laranja), Negativo (vermelho)
export function scoreLevel(pct: number) {
  if (pct >= 70) return { label: 'Positivo', color: '#22C55E' };
  if (pct >= 40) return { label: 'Regular', color: '#F97316' };
  return { label: 'Negativo', color: '#EF4444' };
}

const SEGMENTS = 20;
// cor de cada pedaço pela posição no anel
const segColor = (i: number) => {
  const t = i / (SEGMENTS - 1);
  const stops = [
    [239, 68, 68],
    [249, 115, 22],
    [245, 158, 11],
    [234, 179, 8],
    [34, 197, 94],
  ];
  const pos = t * (stops.length - 1);
  const a = stops[Math.floor(pos)];
  const b = stops[Math.min(stops.length - 1, Math.ceil(pos))];
  const f = pos - Math.floor(pos);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
};

export function ScoreRing({ points, size, children }: { points: number; size: number; children: React.ReactNode }) {
  const pct = scorePercent(points);
  const target = Math.round((pct / 100) * SEGMENTS);
  // os pedaços acendem um a um quando o perfil abre
  const [lit, setLit] = useState(0);
  useEffect(() => {
    setLit(0);
    if (!target) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setLit(n);
      if (n >= target) clearInterval(t);
    }, 60);
    return () => clearInterval(t);
  }, [target]);

  const stroke = Math.max(5, Math.round(size * 0.06));
  const outer = size + stroke * 2 + 8;
  const r = (outer - stroke) / 2;
  const c = outer / 2;
  const step = (Math.PI * 2) / SEGMENTS;
  const gap = step * 0.22;
  const start = Math.PI; // começa na esquerda e acende para a direita, passando por cima

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFill}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <Path
            key={i}
            d={arcPath(c, c, r, start + i * step + gap / 2, start + (i + 1) * step - gap / 2)}
            stroke={i < lit ? segColor(i) : colors.border}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}

export function ScoreLevel({ points }: { points: number }) {
  const pct = scorePercent(points);
  const level = scoreLevel(pct);
  return (
    <View style={styles.level} accessibilityLabel={`Nível ${level.label}, score ${Math.round(pct)} de 100`}>
      <View style={[styles.levelPill, { borderColor: level.color }]}>
        <View style={[styles.dot, { backgroundColor: level.color }]} />
        <Text style={[styles.levelText, { color: level.color }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
          {level.label}
        </Text>
      </View>
      <Text style={styles.levelPct} maxFontSizeMultiplier={1.1}>
        {Math.round(pct)}/100
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  level: { alignItems: 'center', gap: 2, marginTop: 6 },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  levelText: { fontWeight: '800', fontSize: 12 },
  levelPct: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
}));
