import { View } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * Anel em volta do avatar indicando story.
 * Usa bordas em 3 cores (sem dependência de gradiente nativo).
 */
export function LinearGradientRing({
  size,
  seen,
  close,
  children,
}: {
  size: number;
  seen: boolean;
  /** story só para Melhores amigos (anel verde) */
  close?: boolean;
  children: React.ReactNode;
}) {
  const [a, b, c] = close ? ['#16A34A', '#16A34A', '#16A34A'] : colors.storyRing;
  const width = Math.max(2, Math.round(size * 0.035));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: width,
        borderTopColor: seen ? colors.border : a,
        borderRightColor: seen ? colors.border : b,
        borderBottomColor: seen ? colors.border : c,
        borderLeftColor: seen ? colors.border : a,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {children}
    </View>
  );
}
