// Peças comuns das telas de Configurações.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, themed } from '@/lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function SettingsScreen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

export function NavRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={24} color={danger ? colors.like : colors.text} /> : null}
      <Text style={[styles.label, danger && { color: colors.like, fontWeight: '600' }]}>{label}</Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {!danger ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  icon?: IconName;
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      {icon ? <Ionicons name={icon} size={24} color={colors.text} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.labelText}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description?: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => onChange(o.value)}>
            {o.icon ? <Ionicons name={o.icon} size={24} color={colors.text} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.labelText}>{o.label}</Text>
              {o.description ? <Text style={styles.description}>{o.description}</Text> : null}
            </View>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.info}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: 0.5 }]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export const AUDIENCE_OPTIONS = [
  { value: 'todos' as const, label: 'Todos' },
  { value: 'seguidores' as const, label: 'Pessoas que você segue' },
  { value: 'ninguem' as const, label: 'Ninguém' },
];

export const audienceLabel = (v: string) => AUDIENCE_OPTIONS.find((o) => o.value === v)?.label ?? '';

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    content: { paddingBottom: 40 },
    section: { backgroundColor: colors.background, marginBottom: spacing.sm, paddingVertical: spacing.sm },
    sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    footer: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.sm, lineHeight: 17 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    pressed: { backgroundColor: colors.surface },
    label: { flex: 1, fontSize: 15, color: colors.text },
    labelText: { fontSize: 15, color: colors.text },
    value: { color: colors.textMuted, fontSize: 14, maxWidth: 150 },
    description: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
    info: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, lineHeight: 18 },
    button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginHorizontal: spacing.lg, marginVertical: spacing.sm },
    buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  }),
);
