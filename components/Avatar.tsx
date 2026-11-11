import { Image } from 'expo-image';
import { LinearGradientRing } from './Ring';
import { View } from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  uri: string;
  size?: number;
  /** 'none' = sem anel; 'unseen' = anel colorido (story novo); 'seen' = anel cinza */
  ring?: 'none' | 'unseen' | 'seen';
};

export function Avatar({ uri, size = 32, ring = 'none' }: Props) {
  const image = (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
      contentFit="cover"
      transition={150}
    />
  );
  if (ring === 'none') return image;

  const pad = Math.max(2, Math.round(size * 0.05));
  return (
    <LinearGradientRing size={size + pad * 4} seen={ring === 'seen'}>
      <View style={{ padding: pad, backgroundColor: colors.background, borderRadius: size }}>{image}</View>
    </LinearGradientRing>
  );
}
