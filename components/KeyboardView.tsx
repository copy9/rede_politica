// Mantém o campo de digitar sempre acima do teclado (Android e iPhone).
// No Android novo (tela de ponta a ponta) a tela não encolhe sozinha com o teclado, então empurramos o conteúdo.
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function KeyboardView({
  children,
  style,
  withHeader = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** true quando a tela tem a barra de título em cima */
  withHeader?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const offset = withHeader ? insets.top + (Platform.OS === 'ios' ? 44 : 56) : 0;
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding" keyboardVerticalOffset={offset}>
      {children}
    </KeyboardAvoidingView>
  );
}
