// Botão "Apoiadores": ligado, tudo o que você escreve nas mensagens também vai por direct
// para todos os seus apoiadores. Fica ligado até você tocar de novo.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { colors, themed } from '@/lib/theme';

export function useSupportersBroadcast() {
  const me = useMe();
  const { supportersFor } = useApp();
  const { settings, update } = useSettings();
  const on = !!settings.broadcastSupporters;
  const count = supportersFor(me.id).length;
  return { on, count, toggle: () => update({ broadcastSupporters: !on }) };
}

export function SupportersToggle() {
  const { on, count, toggle } = useSupportersBroadcast();
  const { showBanner } = useOverlay();
  return (
    <Pressable
      onPress={() => {
        toggle();
        showBanner(
          on
            ? 'Envio para apoiadores desligado.'
            : `Ligado: suas mensagens também vão por direct para ${count} ${count === 1 ? 'apoiador' : 'apoiadores'}.`,
          { icon: 'people', tone: on ? 'warning' : 'success' },
        );
      }}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityLabel="Enviar para apoiadores"
      accessibilityState={{ selected: on }}>
      <Ionicons name="people" size={15} color={on ? '#fff' : colors.text} />
      <Text style={[styles.text, on && { color: '#fff' }]}>Apoiadores{count ? ` · ${count}` : ''}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: colors.like, borderColor: colors.like },
  text: { color: colors.text, fontWeight: '700', fontSize: 13 },
}));
