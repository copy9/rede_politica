// Text do app com tradução: o metro.config.js faz o `Text` de 'react-native' apontar para cá.
// Qualquer texto fixo da interface é traduzido para o idioma escolhido em Configurações › Idioma.
// Textos que as pessoas escrevem (posts, comentários, nomes) não estão no dicionário e ficam como são.
import React, { useContext } from 'react';

import { translate, UILanguageContext } from '@/lib/i18n';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Original = require('react-native/Libraries/Text/Text').default as React.ComponentType<Record<string, unknown>>;

type Props = { children?: React.ReactNode; accessibilityLabel?: string } & Record<string, unknown>;

function tChildren(children: React.ReactNode, lang: Parameters<typeof translate>[1]): React.ReactNode {
  if (typeof children === 'string') return translate(children, lang);
  if (Array.isArray(children)) return children.map((c) => (typeof c === 'string' ? translate(c, lang) : c));
  return children;
}

function Text(props: Props) {
  const lang = useContext(UILanguageContext);
  if (lang === 'pt-BR') return <Original {...props} />;
  return (
    <Original
      {...props}
      accessibilityLabel={typeof props.accessibilityLabel === 'string' ? translate(props.accessibilityLabel, lang) : props.accessibilityLabel}>
      {tChildren(props.children, lang)}
    </Original>
  );
}
Text.displayName = 'Text';
// mantém o que outras bibliotecas leem do Text original
Object.assign(Text, Original);

export default Text;
