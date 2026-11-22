import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

// Nome "Polarizei" desenhado (fonte Poppins Bold), com o pingo do primeiro "i" azul e o do segundo vermelho.
const WORD = 'M339 748H233V1000H62V298H339Q423 298 481.0 327.0Q539 356 568.0 407.0Q597 458 597 524Q597 585 569.0 635.5Q541 686 483.0 717.0Q425 748 339 748ZM423 524Q423 482 399.0 459.0Q375 436 326 436H233V612H326Q375 612 399.0 589.0Q423 566 423 524ZM652 721Q652 635 690.0 569.5Q728 504 794.0 469.0Q860 434 942 434Q1024 434 1090.0 469.0Q1156 504 1194.0 569.5Q1232 635 1232 721Q1232 807 1193.5 872.5Q1155 938 1088.5 973.0Q1022 1008 940 1008Q858 1008 792.5 973.0Q727 938 689.5 873.0Q652 808 652 721ZM1058 721Q1058 654 1024.5 618.0Q991 582 942 582Q892 582 859.0 617.5Q826 653 826 721Q826 788 858.5 824.0Q891 860 940 860Q989 860 1023.5 824.0Q1058 788 1058 721ZM1494 260V1000H1323V260ZM1830 434Q1889 434 1933.5 458.0Q1978 482 2002 521V442H2173V1000H2002V921Q1977 960 1932.5 984.0Q1888 1008 1829 1008Q1761 1008 1705.0 972.5Q1649 937 1616.5 871.5Q1584 806 1584 720Q1584 634 1616.5 569.0Q1649 504 1705.0 469.0Q1761 434 1830 434ZM1880 583Q1829 583 1793.5 619.5Q1758 656 1758 720Q1758 784 1793.5 821.5Q1829 859 1880 859Q1931 859 1966.5 822.0Q2002 785 2002 721Q2002 657 1966.5 620.0Q1931 583 1880 583ZM2643 436V617H2596Q2532 617 2500.0 644.5Q2468 672 2468 741V1000H2297V442H2468V535Q2498 489 2543.0 462.5Q2588 436 2643 436ZM2909 442V1000H2738V442ZM3206 859H3448V1000H3015V864L3247 583H3017V442H3443V578ZM4065 762H3678Q3682 814 3711.5 841.5Q3741 869 3784 869Q3848 869 3873 815H4055Q4041 870 4004.5 914.0Q3968 958 3913.0 983.0Q3858 1008 3790 1008Q3708 1008 3644.0 973.0Q3580 938 3544.0 873.0Q3508 808 3508 721Q3508 634 3543.5 569.0Q3579 504 3643.0 469.0Q3707 434 3790 434Q3871 434 3934.0 468.0Q3997 502 4032.5 565.0Q4068 628 4068 712Q4068 736 4065 762ZM3893 667Q3893 623 3863.0 597.0Q3833 571 3788 571Q3745 571 3715.5 596.0Q3686 621 3679 667ZM4342 442V1000H4171V442Z';
export const BRAND_BLUE = '#1082EE';
export const BRAND_RED = '#ED080A';

/** Só o nome, com os pingos azul e vermelho. */
export function Wordmark({ size = 24, color }: { size?: number; color?: string }) {
  // caixa do desenho: largura 4417 x altura 830 (de y=190 a y=1020)
  const h = size * 1.1;
  return (
    <Svg width={(h * 4417) / 830} height={h} viewBox="0 190 4417 830">
      <Path d={WORD} fill={color ?? colors.text} />
      <Circle cx={2823.5} cy={291.5} r={101.5} fill={BRAND_BLUE} />
      <Circle cx={4256.5} cy={291.5} r={101.5} fill={BRAND_RED} />
    </Svg>
  );
}

/** Logo do Polarizei: o "P" com as órbitas azul e vermelha + o nome. */
export function Logo({ size = 24, markOnly = false }: { size?: number; markOnly?: boolean }) {
  const mark = size * 1.45;
  return (
    <View style={styles.row}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: mark, height: mark, borderRadius: mark * 0.24 }}
        contentFit="cover"
      />
      {markOnly ? null : <Wordmark size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
