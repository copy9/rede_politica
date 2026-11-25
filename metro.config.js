// Tradução do app inteiro: o Text e o TextInput de 'react-native' passam por components/i18n-native,
// que traduz os textos fixos da interface para o idioma escolhido (Configurações › Idioma).
// Nenhuma tela precisa mudar para ser traduzida.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const WRAPPERS = {
  './Libraries/Text/Text': path.resolve(__dirname, 'components/i18n-native/Text.tsx'),
  './Libraries/Components/TextInput/TextInput': path.resolve(__dirname, 'components/i18n-native/TextInput.tsx'),
};
const fromRNIndex = /[\\/]node_modules[\\/]react-native[\\/]index\.js$/;

const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (WRAPPERS[moduleName] && fromRNIndex.test(context.originModulePath)) {
    return { type: 'sourceFile', filePath: WRAPPERS[moduleName] };
  }
  return previous ? previous(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
