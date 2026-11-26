import { Image } from 'expo-image';
import { View } from 'react-native';

import { getScheme } from '@/lib/theme';

// Identidade do Splitter: nome em itálico com a seta vermelha e azul embaixo.
export const BRAND_BLUE = '#037EF6';
export const BRAND_RED = '#F5091F';

// proporção da imagem do nome (largura / altura)
const RATIO = 1176 / 309;

/** Nome "Splitter" com a seta: versão clara no tema escuro e escura no tema claro. */
export function Wordmark({ size = 24 }: { size?: number }) {
  const h = size * 1.6;
  return (
    <Image
      source={getScheme() === 'dark' ? require('@/assets/images/wordmark-light.png') : require('@/assets/images/wordmark-dark.png')}
      style={{ width: h * RATIO, height: h }}
      contentFit="contain"
      accessibilityLabel="Splitter"
    />
  );
}

/** Logo do Splitter. markOnly mostra só o ícone (S com a seta). */
export function Logo({ size = 24, markOnly = false }: { size?: number; markOnly?: boolean }) {
  if (markOnly) {
    const mark = size * 1.45;
    return (
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: mark, height: mark, borderRadius: mark * 0.24 }}
        contentFit="cover"
        accessibilityLabel="Splitter"
      />
    );
  }
  return (
    <View>
      <Wordmark size={size} />
    </View>
  );
}
