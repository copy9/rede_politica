import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, themed } from '@/lib/theme';

export function Field(props: TextInputProps) {
  const [show, setShow] = useState(false);
  if (!props.secureTextEntry) {
    return <TextInput placeholderTextColor={colors.textMuted} autoCapitalize="none" {...props} style={[styles.input, props.style]} />;
  }
  // senha: olho para mostrar ou esconder
  return (
    <View style={styles.wrap}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        {...props}
        secureTextEntry={!show}
        style={[styles.input, { paddingRight: 46 }, props.style]}
      />
      <Pressable onPress={() => setShow(!show)} hitSlop={8} style={styles.eye} accessibilityLabel={show ? 'Esconder senha' : 'Mostrar senha'}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { justifyContent: 'center' },
  eye: { position: 'absolute', right: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
}));
