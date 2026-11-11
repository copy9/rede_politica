// Gráficos simples do Painel do político, feitos só com View (funcionam no Expo Go e na web).
// Cores: série 1 = azul, série 2 = âmbar (paleta validada para daltonismo).
// O âmbar tem pouco contraste com o fundo, por isso todo gráfico mostra o valor em texto ao lado.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, themed } from '@/lib/theme';

export const SERIES = {
  get one() {
    return colors.series1;
  },
  get two() {
    return colors.series2;
  },
};
const STATUS = {
  get good() {
    return colors.good;
  },
  get neutral() {
    return colors.neutral;
  },
  get critical() {
    return colors.critical;
  },
};

const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function Card({ title, info, children, right }: { title: string; info?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {info ? <Text style={styles.cardInfo}>{info}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function StatTile({
  label,
  value,
  delta,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  delta?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.tile, selected && styles.tileSelected]}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta !== undefined ? (
        <Text style={[styles.tileDelta, { color: delta >= 0 ? STATUS.good : STATUS.critical }]} numberOfLines={1}>
          {delta >= 0 ? '▲' : '▼'} {pct(Math.abs(delta))} vs. período anterior
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: i.color }]} />
          <Text style={styles.legendText}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Colunas (série no tempo ou por hora). Toque numa coluna para ver o valor. */
export function ColumnChart({
  values,
  labels,
  format,
  height = 140,
  color = SERIES.one,
  axisLabels,
}: {
  values: number[];
  labels: string[];
  format: (v: number) => string;
  height?: number;
  color?: string;
  /** rótulos exibidos embaixo: [início, meio, fim] */
  axisLabels: string[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const idx = selected ?? values.indexOf(max);
  return (
    <View>
      <View style={styles.tooltip}>
        <Text style={styles.tooltipValue}>{format(values[idx] ?? 0)}</Text>
        <Text style={styles.tooltipLabel}>
          {labels[idx]}
          {selected === null ? ' · maior valor' : ''}
        </Text>
      </View>
      <View style={[styles.columns, { height }]}>
        {/* linha de grade no topo e no meio */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <View style={[styles.gridLine, { top: height / 2 }]} />
        {values.map((v, i) => (
          <Pressable
            key={i}
            style={styles.columnHit}
            onPress={() => setSelected(i === selected ? null : i)}
            hitSlop={{ top: 10, bottom: 10 }}>
            <View
              style={[
                styles.column,
                {
                  height: Math.max(2, (v / max) * height),
                  backgroundColor: color,
                  opacity: selected === null || selected === i ? 1 : 0.35,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        {axisLabels.map((l, i) => (
          <Text key={i} style={styles.axisText}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Lista de barras horizontais com percentual (cidades, estados, interesses...). */
export function BarList({ items, color = SERIES.one, max }: { items: { label: string; pct: number }[]; color?: string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.pct));
  return (
    <View style={{ gap: 12 }}>
      {items.map((i) => (
        <View key={i.label} style={{ gap: 5 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {i.label}
            </Text>
            <Text style={styles.rowValue}>{pct(i.pct)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(i.pct / top) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Barras empilhadas em duas séries (ex.: mulheres x homens por faixa etária). */
export function SplitBarList({
  rows,
  names,
  max,
}: {
  rows: { label: string; a: number; b: number }[];
  names: [string, string];
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.a + r.b));
  return (
    <View style={{ gap: 12 }}>
      <Legend
        items={[
          { label: names[0], color: SERIES.one },
          { label: names[1], color: SERIES.two },
        ]}
      />
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 5 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue}>
              {pct(r.a + r.b)}
              <Text style={styles.rowSub}>
                {'  '}
                {names[0][0]} {pct(r.a)} · {names[1][0]} {pct(r.b)}
              </Text>
            </Text>
          </View>
          <View style={[styles.track, { flexDirection: 'row' }]}>
            <View style={[styles.fill, { width: `${(r.a / top) * 100}%`, backgroundColor: SERIES.one }]} />
            {r.b > 0 ? <View style={{ width: 2 }} /> : null}
            <View style={[styles.fill, { width: `${(r.b / top) * 100}%`, backgroundColor: SERIES.two }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Uma barra com segmentos que somam 100% (gênero, sentimento). */
export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.segmentBar}>
        {parts
          .filter((p) => p.value > 0)
          .map((p, i) => (
            <View
              key={p.label}
              style={{ flex: p.value / total, backgroundColor: p.color, marginLeft: i === 0 ? 0 : 2 }}
            />
          ))}
      </View>
      <View style={styles.segmentLegend}>
        {parts.map((p) => (
          <View key={p.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>
              {p.label} <Text style={styles.rowValue}>{pct(p.value)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const SENTIMENT_COLORS = STATUS;

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardInfo: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: colors.text, backgroundColor: colors.background },
  tileLabel: { color: colors.textMuted, fontSize: 13 },
  tileValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  tileDelta: { fontSize: 11, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.text, fontSize: 13 },
  tooltip: { marginBottom: spacing.sm },
  tooltipValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  tooltipLabel: { fontSize: 12, color: colors.textMuted },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  columnHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  column: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11, color: colors.textMuted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  rowLabel: { color: colors.text, fontSize: 14, flexShrink: 1 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12, fontWeight: '400' },
  track: { height: 10, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  segmentBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  segmentLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
}));
