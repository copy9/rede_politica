import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradientRing } from './Ring';
import { View } from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  uri: string;
  size?: number;
  /** 'none' = sem anel; 'unseen' = anel colorido (story novo); 'seen' = anel cinza */
  ring?: 'none' | 'unseen' | 'seen' | 'close';
};

export function Avatar({ uri, size = 32, ring = 'none' }: Props) {
  // sem foto: mostra o ícone de pessoa
  const image = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
      contentFit="cover"
      transition={150}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Ionicons name="person" size={size * 0.62} color={colors.textMuted} style={{ marginTop: size * 0.12 }} />
    </View>
  );
  if (ring === 'none') return image;

  const pad = Math.max(2, Math.round(size * 0.05));
  return (
    <LinearGradientRing size={size + pad * 4} seen={ring === 'seen'} close={ring === 'close'}>
      <View style={{ padding: pad, backgroundColor: colors.background, borderRadius: size }}>{image}</View>
    </LinearGradientRing>
  );
}
