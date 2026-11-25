// TextInput do app com tradução do texto de exemplo (placeholder). Ver components/i18n-native/Text.tsx.
import React, { useContext } from 'react';

import { translate, UILanguageContext } from '@/lib/i18n';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Original = require('react-native/Libraries/Components/TextInput/TextInput').default as React.ComponentType<Record<string, unknown>>;

function TextInput(props: Record<string, unknown>) {
  const lang = useContext(UILanguageContext);
  if (lang === 'pt-BR' || typeof props.placeholder !== 'string') return <Original {...props} />;
  return <Original {...props} placeholder={translate(props.placeholder, lang)} />;
}
TextInput.displayName = 'TextInput';
// TextInput.State (foco do teclado) e outros estáticos continuam funcionando
Object.assign(TextInput, Original);

export default TextInput;
