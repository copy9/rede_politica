import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors } from '@/lib/theme';

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textMuted} autoCapitalize="none" {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
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
});
